/**
 * Library Canon Foundry — LLM prompt templates.
 *
 * All prompts are typed functions that produce { systemPrompt, userPrompt }
 * pairs.  Response schemas are defined here as TypeScript types so the
 * processor can safely parse and validate them.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Shared schema types (returned by each prompt)
// ─────────────────────────────────────────────────────────────────────────────

export type CanonCategory =
  | "project_description"
  | "brand_positioning"
  | "mission"
  | "vision"
  | "product_feature"
  | "audience_definition"
  | "offer"
  | "roadmap"
  | "brand_voice"
  | "glossary"
  | "founder_story"
  | "differentiator"
  | "terminology"
  | "faq"
  | "other";

export type CanonExtractionResult = {
  entries: Array<{
    title: string;
    canonCategory: CanonCategory;
    canonicalStatement: string;
    summary: string;
    tags: string[];
    confidenceScore: number;
    memoryValueScore: number;
    publicSafe: boolean;
    sourceQuote: string;
  }>;
};

export type MarketingNuggetResult = {
  entries: Array<{
    title: string;
    copyText: string;
    suggestedUse: string;
    suggestedChannel: string;
    emotionalAngle: string;
    audience: string;
    confidenceScore: number;
    memoryValueScore: number;
    sourceQuote: string;
  }>;
};

export type InternalNoteResult = {
  entries: Array<{
    title: string;
    summary: string;
    internalCategory: string;
    sensitivityLevel: "low" | "medium" | "high" | "critical";
    whyItMatters: string;
    confidenceScore: number;
    memoryValueScore: number;
    sourceQuote: string;
  }>;
};

export type TrashDetectionResult = {
  recommendation: "keep" | "trash";
  reason: string;
  confidenceScore: number;
  memoryValueScore: number;
};

export type CombinedExtractionResult = {
  canon: CanonExtractionResult["entries"];
  marketing: MarketingNuggetResult["entries"];
  internal: InternalNoteResult["entries"];
};

export type TrashDetectionBatchResult = TrashDetectionResult & {
  sampleAssessments?: Array<{
    index: number;
    recommendation: "keep" | "trash";
    reason: string;
    memoryValueScore: number;
  }>;
};

export type PublicSafetyResult = {
  publicSafe: boolean;
  sensitiveFlags: string[];
  reasoning: string;
  confidence: number;
};

export type ConflictDetectionResult = {
  conflicting: boolean;
  conflictReason: string;
  severity: "minor" | "major" | "critical";
  recommendation: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Prompt builders
// ─────────────────────────────────────────────────────────────────────────────

const CANON_CATEGORIES_LIST = [
  "project_description", "brand_positioning", "mission", "vision",
  "product_feature", "audience_definition", "offer", "roadmap",
  "brand_voice", "glossary", "founder_story", "differentiator",
  "terminology", "faq", "other",
].join(" | ");

export function buildCanonExtractionPrompt(chunk: string): {
  systemPrompt: string;
  userPrompt: string;
} {
  return {
    systemPrompt: `You are a canon extraction analyst for a marketing intelligence system.

Your job: extract ONLY official, durable public truth from the document chunk.
Do NOT extract opinions, brainstorming, drafts, plans that aren't confirmed, or internal-only content.

Canon is:
- Stable over time (not "we're thinking about…")
- Public-safe (can be published externally)
- Factual, not aspirational unless explicitly an approved mission/vision statement
- Represents what the project/brand IS, not what it might become

Output strict JSON matching this schema:
{
  "entries": [
    {
      "title": "short descriptive label",
      "canonCategory": "${CANON_CATEGORIES_LIST}",
      "canonicalStatement": "the durable truth, written cleanly",
      "summary": "1-2 sentence explanation of why this is canon",
      "tags": ["array", "of", "relevant", "tags"],
      "confidenceScore": 0.0-1.0,
      "memoryValueScore": 0-100,
      "publicSafe": true|false,
      "sourceQuote": "exact quote from the source text"
    }
  ]
}

If there is no extractable canon in this chunk, return { "entries": [] }.
Output only valid JSON. No markdown fences. No explanation outside the JSON.`,
    userPrompt: `Extract all public canon from this document chunk:\n\n${chunk}`,
  };
}

export function buildMarketingNuggetPrompt(chunk: string): {
  systemPrompt: string;
  userPrompt: string;
} {
  return {
    systemPrompt: `You are a marketing copy analyst for a project intelligence system.

Your job: identify phrases, hooks, headlines, positioning statements, and copy fragments
that could be used in public-facing marketing materials.

Marketing nuggets include:
- Taglines and headlines
- Product metaphors and benefit statements
- Customer pain point descriptions
- Objection-handling language
- Strong descriptive phrases about the product
- Audience-fit language
- Differentiation claims with evidence

Do NOT extract internal-only content, pricing, credentials, or strategy that shouldn't be public.

Suggested uses: landing_page | social_post | email_subject | ad_hook | product_description | faq | sales_page | launch_announcement | onboarding_copy | video_script
Suggested channels: twitter | linkedin | email | blog | landing_page | ads | youtube | newsletter | product_hunt

Output strict JSON:
{
  "entries": [
    {
      "title": "short label for this nugget",
      "copyText": "the marketing copy or phrase",
      "suggestedUse": "one of the suggested uses above",
      "suggestedChannel": "one of the suggested channels above",
      "emotionalAngle": "pain | aspiration | curiosity | trust | urgency | social_proof",
      "audience": "who this is for",
      "confidenceScore": 0.0-1.0,
      "memoryValueScore": 0-100,
      "sourceQuote": "exact quote from source"
    }
  ]
}

If no useful marketing copy found, return { "entries": [] }.
Output only valid JSON. No markdown fences.`,
    userPrompt: `Find marketing nuggets in this document chunk:\n\n${chunk}`,
  };
}

export function buildInternalNotePrompt(chunk: string): {
  systemPrompt: string;
  userPrompt: string;
} {
  return {
    systemPrompt: `You are a knowledge preservation analyst for a project intelligence system.

Your job: identify valuable internal business intelligence that should be saved for future reference
but should NOT be published publicly.

Internal knowledge includes:
- Technical architecture and deployment notes
- Integration details and dependencies
- Monetization plans and pricing experiments
- Strategic decisions and their rationale
- Lessons learned and failure analysis
- Roadmap ideas not yet public
- Agent workflows and operational procedures
- Historical decisions worth remembering
- Research findings

Output strict JSON:
{
  "entries": [
    {
      "title": "short descriptive label",
      "summary": "clear explanation of what this knowledge is",
      "internalCategory": "technical | strategic | operational | financial | research | historical | experimental",
      "sensitivityLevel": "low | medium | high | critical",
      "whyItMatters": "why this should be preserved",
      "confidenceScore": 0.0-1.0,
      "memoryValueScore": 0-100,
      "sourceQuote": "exact quote from source"
    }
  ]
}

If no valuable internal knowledge found, return { "entries": [] }.
Output only valid JSON. No markdown fences.`,
    userPrompt: `Identify valuable internal knowledge in this document chunk:\n\n${chunk}`,
  };
}

export function buildCombinedExtractionPrompt(
  chunk: string,
  modes: Array<"canon" | "marketing" | "internal">
): { systemPrompt: string; userPrompt: string } {
  const enabled = modes.join(", ");

  return {
    systemPrompt: `You are a marketing intelligence extraction analyst.

Extract candidates for only these enabled sections: ${enabled}.

Return strict JSON with this shape:
{
  "canon": [],
  "marketing": [],
  "internal": []
}

canon entries use: title, canonCategory (${CANON_CATEGORIES_LIST}), canonicalStatement, summary, tags, confidenceScore, memoryValueScore, publicSafe, sourceQuote.
marketing entries use: title, copyText, suggestedUse, suggestedChannel, emotionalAngle, audience, confidenceScore, memoryValueScore, sourceQuote.
internal entries use: title, summary, internalCategory, sensitivityLevel, whyItMatters, confidenceScore, memoryValueScore, sourceQuote.

Rules:
- Keep disabled sections as empty arrays.
	- Extract high-signal durable information. Avoid duplicates and low-value noise.
	- Prefer a few concise candidates over empty arrays when the chunk contains clear project, product, architecture, strategy, migration, risk, checklist, or operational knowledge.
- Canon must be stable, factual, durable, and public-safe.
- Marketing must be public-facing phrases, hooks, positioning, benefits, or campaign-ready fragments.
- Internal must be valuable private operational, strategic, technical, financial, research, or historical knowledge.
- Do not invent facts. Use sourceQuote from the chunk.
- Output only valid JSON. No markdown fences.`,
    userPrompt: `Extract enabled candidate types from this document chunk:\n\n${chunk}`,
  };
}

export function buildTrashDetectionPrompt(chunk: string): {
  systemPrompt: string;
  userPrompt: string;
} {
  return {
    systemPrompt: `You are a document usefulness analyst for a project intelligence system.

Your job: evaluate whether this document chunk contains information worth preserving.

Trash candidates are:
- Empty or near-empty content
- Generated logs or build output
- Obvious duplicates
- Temporary scratch notes with no durable value
- Irrelevant content unrelated to the project
- Failed output dumps
- Low-information boilerplate

Keep candidates are:
- Any unique project information
- Technical details with future value
- Strategic content
- Marketing language
- Historical decisions
- Any content that would be hard to recover or reconstruct

Err on the side of KEEP.  Only recommend trash when clearly useless.

Output strict JSON:
{
  "recommendation": "keep" | "trash",
  "reason": "concise explanation",
  "confidenceScore": 0.0-1.0,
  "memoryValueScore": 0-100
}

Output only valid JSON. No markdown fences.`,
    userPrompt: `Evaluate whether this content is worth preserving:\n\n${chunk}`,
  };
}

export function buildTrashDetectionBatchPrompt(
  samples: Array<{ index: number; text: string }>
): { systemPrompt: string; userPrompt: string } {
  return {
    systemPrompt: `You are a document usefulness analyst for a project intelligence system.

Evaluate sampled chunks and make one document-level keep/trash recommendation.

Trash candidates are empty/near-empty content, generated logs, build output, obvious duplicates, temporary scratch notes with no durable value, irrelevant content, failed dumps, or boilerplate.

Keep candidates contain unique project information, technical details, strategy, marketing language, historical decisions, or anything hard to reconstruct.

Err on the side of KEEP. Only recommend trash when all samples are clearly useless.

Return strict JSON:
{
  "recommendation": "keep" | "trash",
  "reason": "concise explanation",
  "confidenceScore": 0.0-1.0,
  "memoryValueScore": 0-100,
  "sampleAssessments": [{ "index": 0, "recommendation": "keep", "reason": "...", "memoryValueScore": 50 }]
}

Output only valid JSON. No markdown fences.`,
    userPrompt: JSON.stringify({ samples }),
  };
}

export function buildPublicSafetyPrompt(content: string): {
  systemPrompt: string;
  userPrompt: string;
} {
  return {
    systemPrompt: `You are a public content safety auditor for a marketing intelligence system.

Your job: audit content before it is used in public marketing automation.

Check for and flag any of the following:
- API keys, tokens, or credentials
- Pricing or financial details not intended for public (rough estimates OK if explicitly approved)
- Internal strategy that should not be shared
- Sensitive customer data or PII
- Unreleased feature details that could be competitive intel
- Legal exposure (specific claims requiring legal review)
- Security vulnerabilities or architecture details that expose attack surface
- Employee names or internal contact information

Output strict JSON:
{
  "publicSafe": true|false,
  "sensitiveFlags": ["list", "of", "specific", "issues", "found"],
  "reasoning": "explanation of your assessment",
  "confidence": 0.0-1.0
}

If no issues found, return: { "publicSafe": true, "sensitiveFlags": [], "reasoning": "No sensitive content detected", "confidence": 0.95 }
Output only valid JSON. No markdown fences.`,
    userPrompt: `Audit this content for public safety:\n\n${content}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Marketing rewrite (existing entry → polished copy)
// ─────────────────────────────────────────────────────────────────────────────

export type MarketingRewriteResult = {
  title: string;
  copyText: string;
  suggestedUse: string;
  suggestedChannel: string;
  emotionalAngle: string;
  audience: string;
};

/**
 * Rewrites an existing library entry's content into polished, deployable
 * marketing copy.  Designed for single-entry transformation, not bulk extraction.
 */
export function buildMarketingRewritePrompt(
  sourceText: string,
  entryTitle: string
): { systemPrompt: string; userPrompt: string } {
  return {
    systemPrompt: `You are an expert marketing copywriter.

Your job: take raw source content from a company's knowledge base and transform it into
polished, deployable marketing copy that could appear on a landing page, social post,
or campaign email.

Rules:
- Lead with the benefit or insight, not the feature
- Use active voice and concrete language
- Keep it scannable — max 3 sentences for copyText
- Do NOT invent facts not present in the source
- Do NOT include pricing, credentials, or internal details

Output strict JSON:
{
  "title": "short descriptive label for this copy piece",
  "copyText": "the rewritten marketing copy (1-3 sentences, polished and deployable)",
  "suggestedUse": "landing_page | social_post | email_subject | ad_hook | product_description | faq | sales_page | launch_announcement | onboarding_copy | video_script",
  "suggestedChannel": "twitter | linkedin | email | blog | landing_page | ads | youtube | newsletter | product_hunt",
  "emotionalAngle": "pain | aspiration | curiosity | trust | urgency | social_proof",
  "audience": "who this copy is best suited for"
}

Output only valid JSON. No markdown fences. No explanation.`,
    userPrompt: `Rewrite the following content as polished marketing copy.

Original title: ${entryTitle}

Source content:
${sourceText}`,
  };
}

export function buildConflictDetectionPrompt(
  existingStatement: string,
  newStatement: string
): { systemPrompt: string; userPrompt: string } {
  return {
    systemPrompt: `You are a canon conflict analyst for a marketing intelligence system.

Your job: compare two pieces of content about the same topic and determine if they contradict each other.

Contradictions include:
- Different audience definitions (e.g., "for enterprise" vs "for solo developers")
- Different product descriptions or feature claims
- Different brand or product names
- Old vs new positioning that hasn't been reconciled
- Conflicting benefit claims
- Different origin stories
- Contradictory roadmap items

Minor differences in wording are NOT conflicts if the meaning is compatible.

Output strict JSON:
{
  "conflicting": true|false,
  "conflictReason": "specific explanation of the contradiction, or empty string if no conflict",
  "severity": "minor" | "major" | "critical",
  "recommendation": "brief suggestion for resolution"
}

Output only valid JSON. No markdown fences.`,
    userPrompt: `Compare these two statements:

EXISTING APPROVED CANON:
${existingStatement}

NEW CANDIDATE:
${newStatement}

Are they in conflict?`,
  };
}
