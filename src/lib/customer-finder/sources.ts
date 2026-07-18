import type {
  DiscoverySourceDefinition,
  DiscoverySourceId,
  DiscoverySourceProposal,
} from "@/lib/customer-finder/types";

const sourceCatalog: Record<DiscoverySourceId, DiscoverySourceDefinition> = {
  manual_csv: {
    id: "manual_csv",
    label: "Manual CSV import",
    explanation:
      "Best for verified lead lists, event exports, CRM slices, or hand-curated research that already passed human review.",
    supportLevel: "supported",
    requiresSeedInput: true,
    inputLabel: "CSV rows",
    inputPlaceholder:
      "name,organization,source_url,reason,evidence,contact_channel,contact_value\nJane Doe,Acme AI,https://example.com/team/jane,Matches AI workflow consultancy,Founder bio mentions client workflow automation,email,jane@example.com",
    supportsAutomaticSearch: false,
  },
  company_websites: {
    id: "company_websites",
    label: "Company websites and public team pages",
    explanation:
      "Useful when the target description maps to a clear type of company and public site copy can verify fit.",
    supportLevel: "conditional",
    availabilityNote:
      "Supported when seed URLs are provided. This release does not perform blind web search inside the app.",
    requiresSeedInput: true,
    inputLabel: "Seed URLs",
    inputPlaceholder:
      "https://example.com\nhttps://example.com/about\nhttps://example.com/team",
    supportsAutomaticSearch: false,
  },
  github: {
    id: "github",
    label: "GitHub organizations and repositories",
    explanation:
      "Good for developer-facing companies, open-source teams, builder tools, and technical operators with public repos.",
    supportLevel: "supported",
    availabilityNote:
      "Uses the public GitHub API and public profile metadata only. Results may be rate-limited.",
    requiresSeedInput: true,
    inputLabel: "Optional GitHub seeds",
    inputPlaceholder:
      "acme-ai\nhttps://github.com/acme-ai\nowner/repository",
    supportsAutomaticSearch: true,
  },
  linkedin_public: {
    id: "linkedin_public",
    label: "LinkedIn public company and profile pages",
    explanation:
      "Relevant for B2B role and company discovery, especially when title and firmographic filters matter.",
    supportLevel: "unsupported",
    availabilityNote:
      "Approved as a future source, but this release has no approved LinkedIn connector or API path.",
    requiresSeedInput: false,
    supportsAutomaticSearch: false,
  },
  x_public: {
    id: "x_public",
    label: "X / Twitter public profiles and posts",
    explanation:
      "Helpful for founder-led products, AI builders, agencies, and public launch activity.",
    supportLevel: "unsupported",
    availabilityNote:
      "Approved as a future source, but this release has no approved X connector or API path.",
    requiresSeedInput: false,
    supportsAutomaticSearch: false,
  },
  business_directories: {
    id: "business_directories",
    label: "Business directories and startup directories",
    explanation:
      "Useful for firmographic discovery when vertical, geography, funding, or category directories are available.",
    supportLevel: "unsupported",
    availabilityNote:
      "Approved as a future source, but this release has no approved directory connector yet.",
    requiresSeedInput: false,
    supportsAutomaticSearch: false,
  },
};

const keywordSets = {
  github: ["developer", "developers", "technical", "open source", "builder", "builders", "ai", "workflow", "automation", "software"],
  company_websites: ["company", "companies", "agency", "agencies", "startup", "startups", "entrepreneur", "entrepreneurs", "consultancy", "business"],
  linkedin_public: ["b2b", "sales", "recruiter", "hiring", "founder", "head of", "director", "manager"],
  x_public: ["founder", "builders", "creator", "launch", "build in public"],
  business_directories: ["directory", "startup", "saas", "local", "agency", "firmographic"],
} as const;

function countKeywordHits(text: string, keywords: readonly string[]) {
  const lower = text.toLowerCase();
  return keywords.reduce((total, keyword) => (lower.includes(keyword) ? total + 1 : total), 0);
}

export function getSourceDefinition(sourceId: DiscoverySourceId): DiscoverySourceDefinition {
  return sourceCatalog[sourceId];
}

export function getSourceCatalog(): DiscoverySourceDefinition[] {
  return Object.values(sourceCatalog);
}

export function buildSourceProposals(targetDescription: string): DiscoverySourceProposal[] {
  const lower = targetDescription.toLowerCase();

  return getSourceCatalog()
    .map((source) => {
      let relevanceScore = 1;
      if (source.id === "manual_csv") {
        relevanceScore = 10;
      }
      if (source.id === "github") {
        relevanceScore = 3 + countKeywordHits(lower, keywordSets.github);
      }
      if (source.id === "company_websites") {
        relevanceScore = 3 + countKeywordHits(lower, keywordSets.company_websites);
      }
      if (source.id === "linkedin_public") {
        relevanceScore = 2 + countKeywordHits(lower, keywordSets.linkedin_public);
      }
      if (source.id === "x_public") {
        relevanceScore = 2 + countKeywordHits(lower, keywordSets.x_public);
      }
      if (source.id === "business_directories") {
        relevanceScore = 2 + countKeywordHits(lower, keywordSets.business_directories);
      }

      return {
        ...source,
        reason: buildSourceReason(source.id, targetDescription),
        selectedByDefault: source.supportLevel !== "unsupported",
        relevanceScore,
      } satisfies DiscoverySourceProposal;
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore || a.label.localeCompare(b.label));
}

function buildSourceReason(sourceId: DiscoverySourceId, targetDescription: string) {
  switch (sourceId) {
    case "manual_csv":
      return `Best path for verified operator-provided research about ${targetDescription}.`;
    case "company_websites":
      return `Useful when public site copy, team pages, or contact pages can verify whether a company matches ${targetDescription}.`;
    case "github":
      return `Relevant when ${targetDescription} overlaps with technical builders, engineering teams, or public product repos.`;
    case "linkedin_public":
      return `Would help when the target depends on titles, firmographic filters, or named decision-makers.`;
    case "x_public":
      return `Would help when the target is visible through founder-led posting, launch threads, or public builder activity.`;
    case "business_directories":
      return `Would help when the target is easier to find through category, geography, funding, or industry listings.`;
  }
}
