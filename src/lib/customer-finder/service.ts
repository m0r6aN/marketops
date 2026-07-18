import { createHash } from "node:crypto";

import type { Initiative } from "@/lib/initiatives";
import { getSourceDefinition } from "@/lib/customer-finder/sources";
import type {
  CandidateProvenance,
  DiscoveredCandidate,
  DiscoveryConfidenceLabel,
  DiscoverySourceId,
  DiscoverySourceProcessingStatus,
  DiscoverySourceRun,
  OutreachChannel,
  TargetCustomerSuggestion,
} from "@/lib/customer-finder/types";

const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "in",
  "into",
  "is",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "these",
  "this",
  "to",
  "with",
  "who",
  "want",
  "wants",
  "looking",
]);

const sourceLabelById = {
  manual_csv: "Manual CSV import",
  company_websites: "Company websites and public team pages",
  github: "GitHub organizations and repositories",
  linkedin_public: "LinkedIn public company and profile pages",
  x_public: "X / Twitter public profiles and posts",
  business_directories: "Business directories and startup directories",
} as const satisfies Record<DiscoverySourceId, string>;

export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function toSlug(value: string) {
  return normalizeText(value).replace(/\s+/g, "-").slice(0, 64) || "campaign";
}

export function sentenceCase(value: string) {
  const trimmed = value.trim().replace(/^[\-–—\s]+/, "");
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function buildTargetCustomerSuggestion(
  prompt: string,
  initiative?: Initiative
): TargetCustomerSuggestion {
  const cleanedPrompt = prompt
    .replace(/^identify prospective customers\s*/i, "")
    .replace(/^find prospective customers\s*/i, "")
    .replace(/^find customers\s*/i, "")
    .replace(/^help me\s*/i, "")
    .trim();

  const baseDescription = sentenceCase(cleanedPrompt || initiative?.oneLiner || "Prospective customers");
  const primaryAudience = initiative?.primaryAudiences.map((audience) => audience.label).slice(0, 3).join(", ");

  let suggestedDescription = baseDescription;

  if (initiative && primaryAudience) {
    const initiativeNeed = initiative.oneLiner.replace(/\.$/, "").toLowerCase();
    if (normalizeText(baseDescription).includes(normalizeText(primaryAudience))) {
      suggestedDescription = sentenceCase(baseDescription);
    } else {
      suggestedDescription = `${sentenceCase(baseDescription)} — especially ${primaryAudience} who could benefit from ${initiativeNeed}.`;
    }
  }

  const rationale = [
    "Uses the operator prompt as the primary targeting signal.",
    initiative
      ? `Anchors the suggestion to ${initiative.name}'s approved audience and positioning context.`
      : "No initiative context was supplied, so the suggestion stays close to the user prompt.",
    "Keeps the output editable so the operator can narrow, broaden, or cancel before any campaign is created.",
  ];

  return {
    suggestedDescription,
    rationale,
  };
}

export function buildSubmissionFingerprint(input: {
  initiativeSlug?: string;
  prompt: string;
  targetDescription: string;
  selectedSourceIds: DiscoverySourceId[];
  sourceInputs: Partial<Record<DiscoverySourceId, string>>;
  idempotencyKey: string;
}) {
  const normalizedInputs = Object.entries(input.sourceInputs)
    .map(([key, value]) => [key, (value ?? "").trim()])
    .sort(([a], [b]) => a.localeCompare(b));

  const payload = JSON.stringify({
    initiativeSlug: input.initiativeSlug ?? "",
    prompt: normalizeText(input.prompt),
    targetDescription: normalizeText(input.targetDescription),
    selectedSourceIds: [...input.selectedSourceIds].sort(),
    sourceInputs: normalizedInputs,
    idempotencyKey: input.idempotencyKey,
  });

  return createHash("sha256").update(payload).digest("hex");
}

export function computeConfidence(score: number): DiscoveryConfidenceLabel {
  if (score >= 0.75) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

export function computeKeywordScore(targetDescription: string, evidence: string) {
  const keywords = extractKeywords(targetDescription);
  if (keywords.length === 0) return 0.3;
  const haystack = normalizeText(evidence);
  const hits = keywords.filter((keyword) => haystack.includes(keyword)).length;
  return Math.min(1, hits / Math.max(1, Math.min(keywords.length, 4)));
}

export function extractKeywords(text: string) {
  return Array.from(
    new Set(
      normalizeText(text)
        .split(" ")
        .filter((token) => token.length > 2 && !stopWords.has(token))
    )
  ).slice(0, 8);
}

type ParsedCsvRow = Record<string, string>;

export function parseCsvRows(csvText: string): ParsedCsvRow[] {
  const trimmed = csvText.trim();
  if (!trimmed) return [];

  const rows: string[][] = [];
  let currentField = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    const next = trimmed[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentField += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      currentRow.push(currentField.trim());
      if (currentRow.some((value) => value.length > 0)) {
        rows.push(currentRow);
      }
      currentField = "";
      currentRow = [];
      continue;
    }

    currentField += char;
  }

  currentRow.push(currentField.trim());
  if (currentRow.some((value) => value.length > 0)) {
    rows.push(currentRow);
  }

  if (rows.length === 0) return [];

  const headers = rows[0].map((header) => normalizeHeader(header));
  return rows.slice(1).map((row) => {
    const record: ParsedCsvRow = {};
    headers.forEach((header, index) => {
      record[header] = row[index]?.trim() ?? "";
    });
    return record;
  });
}

function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

export function parseSeedLines(input: string | undefined) {
  return Array.from(
    new Set(
      (input ?? "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    )
  );
}

export function buildDedupeKey(candidate: {
  displayName: string;
  organizationName?: string;
  contactValue?: string;
}) {
  const primary = candidate.contactValue || candidate.organizationName || candidate.displayName;
  return normalizeText(primary);
}

export function dedupeCandidates(candidates: DiscoveredCandidate[]): DiscoveredCandidate[] {
  const map = new Map<string, DiscoveredCandidate>();

  for (const candidate of candidates) {
    const dedupeKey = buildDedupeKey(candidate);
    const existing = map.get(dedupeKey);

    if (!existing) {
      map.set(dedupeKey, {
        ...candidate,
        provenance: [...candidate.provenance],
      });
      continue;
    }

    const best = candidate.confidenceScore > existing.confidenceScore ? candidate : existing;
    const combinedProvenance = [...existing.provenance, ...candidate.provenance];

    map.set(dedupeKey, {
      ...best,
      organizationName: best.organizationName || existing.organizationName || candidate.organizationName,
      contactChannel: best.contactChannel || existing.contactChannel || candidate.contactChannel,
      contactValue: best.contactValue || existing.contactValue || candidate.contactValue,
      sourceSummary: Array.from(new Set(combinedProvenance.map((item) => item.sourceLabel))).join(", "),
      inferredNotes: mergeSentence(existing.inferredNotes, candidate.inferredNotes),
      provenance: combinedProvenance,
    });
  }

  return Array.from(map.values());
}

function mergeSentence(left?: string, right?: string) {
  if (!left) return right;
  if (!right) return left;
  if (left === right) return left;
  return `${left} ${right}`;
}

export function prepareOutreachDraft(params: {
  campaignName: string;
  targetDescription: string;
  initiativeName?: string;
  initiativeOneLiner?: string;
  candidate: DiscoveredCandidate & { id: string };
  channel: OutreachChannel;
}) {
  const candidateName = params.candidate.displayName;
  const organization = params.candidate.organizationName ?? candidateName;
  const verifiedEvidence = params.candidate.verifiedEvidence;
  const offeringContext = params.initiativeOneLiner ?? params.targetDescription;
  const fitReason = params.candidate.matchReason;

  const subjectLine =
    params.channel === "email"
      ? `${params.campaignName}: possible fit for ${organization}`
      : undefined;

  const greeting = params.channel === "email" ? `Hi ${candidateName},` : `Draft for ${candidateName}`;
  const body = [
    greeting,
    "",
    `I am reaching out because your public information suggests a fit for ${params.targetDescription}.`,
    `Verified evidence: ${verifiedEvidence}`,
    `Why it looks relevant: ${fitReason}`,
    params.initiativeName
      ? `${params.initiativeName} is described internally as: ${offeringContext}`
      : `The operator's campaign focus is: ${offeringContext}`,
    "",
    "If this is relevant, I would be glad to compare notes and share a concise walkthrough.",
    "",
    "Human review required before any external use.",
  ].join("\n");

  return {
    subjectLine,
    messageBody: body,
    approvalStatus: "review-required" as const,
  };
}

export function assertOutboundDeliveryBlocked() {
  throw new Error(
    "Outbound delivery is not authorized in this release. Draft generation is allowed; sending is not."
  );
}

export function toCampaignName(targetDescription: string) {
  return `${sentenceCase(targetDescription).replace(/\.$/, "")} customer discovery`;
}

export function computeRetentionExpiry(createdAtIso: string) {
  const date = new Date(createdAtIso);
  date.setUTCDate(date.getUTCDate() + 90);
  return date.toISOString();
}

export function mapCsvRowsToCandidates(csvText: string, nowIso: string): DiscoveredCandidate[] {
  const rows = parseCsvRows(csvText);

  return rows
    .filter((row) => row.name || row.organization)
    .map((row) => {
      const confidenceScore = Math.max(0.25, Math.min(1, Number(row.confidence_score || row.confidence || 0.7)));
      const provenance: CandidateProvenance = {
        sourceId: "manual_csv",
        sourceLabel: sourceLabelById.manual_csv,
        sourceUrl: row.source_url || undefined,
        reason: row.reason || "Operator-provided manual import.",
        evidenceText: row.evidence || row.source_excerpt || row.notes || "Imported from a manually supplied CSV row.",
        confidenceScore,
        contactChannel: row.contact_channel || undefined,
        contactValue: row.contact_value || row.email || row.website || undefined,
        discoveredAt: nowIso,
      };

      return {
        candidateKind: row.name ? "person" : "organization",
        displayName: row.name || row.organization,
        organizationName: row.organization || undefined,
        matchReason: row.reason || "Operator-provided manual import.",
        verifiedEvidence: provenance.evidenceText,
        confidenceLabel: computeConfidence(confidenceScore),
        confidenceScore,
        contactChannel: provenance.contactChannel,
        contactValue: provenance.contactValue,
        inferredNotes: row.inferred_notes || undefined,
        discoveryTimestamp: nowIso,
        sourceSummary: provenance.sourceLabel,
        provenance: [provenance],
      } satisfies DiscoveredCandidate;
    });
}

export async function processCompanyWebsiteSeeds(params: {
  sourceRun: DiscoverySourceRun;
  targetDescription: string;
  fetchImpl?: typeof fetch;
  nowIso: string;
}): Promise<{ status: DiscoverySourceProcessingStatus; candidates: DiscoveredCandidate[]; errorMessage?: string }> {
  const seeds = parseSeedLines(params.sourceRun.inputText);
  if (seeds.length === 0) {
    return {
      status: "failed",
      candidates: [],
      errorMessage: "Seed URLs are required for company website processing in this release.",
    };
  }

  const fetchImpl = params.fetchImpl ?? fetch;
  const candidates: DiscoveredCandidate[] = [];
  const failures: string[] = [];

  for (const seed of seeds.slice(0, 5)) {
    try {
      const response = await fetchWithTimeout(fetchImpl, seed, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
        },
      });

      if (!response.ok) {
        failures.push(`${seed} returned ${response.status}`);
        continue;
      }

      const html = await response.text();
      const pageTitle = readTag(html, /<title>([\s\S]*?)<\/title>/i) || seed;
      const description =
        readTag(html, /<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i) ||
        readTag(html, /<meta\s+property=["']og:description["']\s+content=["']([\s\S]*?)["']/i) ||
        stripHtml(html).slice(0, 400);
      const organizationName = pageTitle.split(/[\-|·|•]/)[0]?.trim() || seed;
      const publicEmail = findFirstEmail(html);
      const confidenceScore = Math.max(0.25, computeKeywordScore(params.targetDescription, description));
      const evidence = description.replace(/\s+/g, " ").trim();

      candidates.push({
        candidateKind: "organization",
        displayName: organizationName,
        organizationName,
        matchReason: `Public website copy overlaps with ${params.targetDescription}.`,
        verifiedEvidence: evidence,
        confidenceLabel: computeConfidence(confidenceScore),
        confidenceScore,
        contactChannel: publicEmail ? "email" : "website",
        contactValue: publicEmail || seed,
        inferredNotes: publicEmail
          ? "Public contact email was found on the supplied website seed."
          : "No public email was found; defaulted to the supplied website URL.",
        discoveryTimestamp: params.nowIso,
        sourceSummary: sourceLabelById.company_websites,
        provenance: [
          {
            sourceId: "company_websites",
            sourceLabel: sourceLabelById.company_websites,
            sourceUrl: seed,
            reason: `Public website content overlaps with ${params.targetDescription}.`,
            evidenceText: evidence,
            confidenceScore,
            contactChannel: publicEmail ? "email" : "website",
            contactValue: publicEmail || seed,
            discoveredAt: params.nowIso,
          },
        ],
      });
    } catch (error) {
      failures.push(`${seed}: ${error instanceof Error ? error.message : "Unknown fetch error"}`);
    }
  }

  if (candidates.length === 0) {
    return {
      status: failures.length > 0 ? "failed" : "empty",
      candidates,
      errorMessage: failures.join("; ") || "No matching candidates were discovered from the supplied website seeds.",
    };
  }

  return {
    status: "completed",
    candidates,
    errorMessage: failures.length > 0 ? failures.join("; ") : undefined,
  };
}

export async function processGithubSource(params: {
  sourceRun: DiscoverySourceRun;
  targetDescription: string;
  fetchImpl?: typeof fetch;
  nowIso: string;
}): Promise<{ status: DiscoverySourceProcessingStatus; candidates: DiscoveredCandidate[]; errorMessage?: string }> {
  const fetchImpl = params.fetchImpl ?? fetch;
  const seeds = parseSeedLines(params.sourceRun.inputText);
  const query = buildGithubQuery(params.targetDescription, seeds);

  try {
    const response = await fetchWithTimeout(
      fetchImpl,
      `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=5`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "MarketOps-CustomerFinder",
        },
      }
    );

    if (!response.ok) {
      return {
        status: "failed",
        candidates: [],
        errorMessage: `GitHub search returned ${response.status}.`,
      };
    }

    const payload = (await response.json()) as {
      items?: Array<{
        full_name: string;
        description: string | null;
        html_url: string;
        homepage: string | null;
        topics?: string[];
        owner: {
          login: string;
          type: string;
          html_url: string;
        };
      }>;
    };

    const items = payload.items ?? [];
    if (items.length === 0) {
      return {
        status: "empty",
        candidates: [],
        errorMessage: "GitHub returned no repository matches for this target description.",
      };
    }

    const candidates = items.map((item) => {
      const evidence = [
        item.description || "No repository description provided.",
        item.topics?.length ? `Topics: ${item.topics.join(", ")}` : undefined,
        `Repository: ${item.full_name}`,
      ]
        .filter(Boolean)
        .join(" · ");
      const confidenceScore = Math.max(0.35, computeKeywordScore(params.targetDescription, evidence));
      const candidateKind = item.owner.type === "Organization" ? "organization" : "person";
      const contactValue = item.homepage || item.owner.html_url;

      return {
        candidateKind,
        displayName: item.owner.login,
        organizationName: item.owner.type === "Organization" ? item.owner.login : undefined,
        matchReason: `Public GitHub repository metadata overlaps with ${params.targetDescription}.`,
        verifiedEvidence: evidence,
        confidenceLabel: computeConfidence(confidenceScore),
        confidenceScore,
        contactChannel: item.homepage ? "website" : "github",
        contactValue,
        inferredNotes: item.homepage
          ? "Public homepage from GitHub repository metadata was used as the contact path."
          : "No public homepage was available, so the GitHub profile URL is the contact path.",
        discoveryTimestamp: params.nowIso,
        sourceSummary: sourceLabelById.github,
        provenance: [
          {
            sourceId: "github",
            sourceLabel: sourceLabelById.github,
            sourceUrl: item.html_url,
            reason: `Repository metadata overlaps with ${params.targetDescription}.`,
            evidenceText: evidence,
            confidenceScore,
            contactChannel: item.homepage ? "website" : "github",
            contactValue,
            discoveredAt: params.nowIso,
          },
        ],
      } satisfies DiscoveredCandidate;
    });

    return { status: "completed", candidates };
  } catch (error) {
    return {
      status: "failed",
      candidates: [],
      errorMessage: error instanceof Error ? error.message : "GitHub processing failed.",
    };
  }
}

export async function processSelectedSource(params: {
  sourceRun: DiscoverySourceRun;
  targetDescription: string;
  nowIso: string;
  fetchImpl?: typeof fetch;
}) {
  if (!params.sourceRun.selected) {
    return { status: "pending" as const, candidates: [] };
  }

  if (params.sourceRun.supportLevel === "unsupported") {
    return {
      status: "unsupported" as const,
      candidates: [],
      errorMessage: params.sourceRun.availabilityNote || "Source is approved but unavailable in this release.",
    };
  }

  if (params.sourceRun.sourceId === "manual_csv") {
    const candidates = mapCsvRowsToCandidates(params.sourceRun.inputText || "", params.nowIso);
    return {
      status: candidates.length > 0 ? ("completed" as const) : ("empty" as const),
      candidates,
      errorMessage:
        candidates.length === 0 ? "Manual CSV input was empty or did not contain candidate rows." : undefined,
    };
  }

  if (params.sourceRun.sourceId === "company_websites") {
    return processCompanyWebsiteSeeds(params);
  }

  if (params.sourceRun.sourceId === "github") {
    return processGithubSource(params);
  }

  return {
    status: "unsupported" as const,
    candidates: [],
    errorMessage: params.sourceRun.availabilityNote || "Source is not yet supported.",
  };
}

function buildGithubQuery(targetDescription: string, seeds: string[]) {
  if (seeds.length > 0) {
    const seedTerms = seeds
      .map((seed) => seed.replace(/^https?:\/\/github\.com\//, "").replace(/\/$/, ""))
      .join(" ");
    return `${seedTerms} ${extractKeywords(targetDescription).join(" ")}`.trim();
  }

  return `${extractKeywords(targetDescription).join(" ")} in:name,description`;
}

async function fetchWithTimeout(fetchImpl: typeof fetch, url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    return await fetchImpl(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timeout);
  }
}

function readTag(html: string, pattern: RegExp) {
  const match = html.match(pattern);
  return match?.[1]?.replace(/\s+/g, " ").trim();
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function findFirstEmail(text: string) {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
}

export function toSourceRun(params: {
  sourceId: DiscoverySourceId;
  selected: boolean;
  rationale: string;
  inputText?: string;
}) {
  const definition = getSourceDefinition(params.sourceId);

  return {
    sourceId: params.sourceId,
    sourceLabel: definition.label,
    supportLevel: definition.supportLevel,
    selected: params.selected,
    processingStatus: "pending",
    rationale: params.rationale,
    availabilityNote: definition.availabilityNote,
    inputText: params.inputText,
    resultCount: 0,
  } satisfies DiscoverySourceRun;
}
