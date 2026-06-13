/**
 * Typed views of the input and output JSON contracts. These types are the
 * minimum needed to write tool logic; the JSON schemas remain the source of
 * truth and validate every payload before it leaves the tool.
 */

export type DocumentType =
  | "whitepaper" | "spec" | "readme" | "architecture"
  | "changelog" | "proof-pack" | "canon" | "other";

export type UseFor =
  | "Website" | "Landing Page" | "Blog" | "SEO"
  | "Social Media" | "LinkedIn" | "X / Twitter"
  | "Email" | "Newsletter"
  | "Sales Deck" | "Investor Deck"
  | "Webinar" | "Demo Script" | "Product Tour"
  | "FAQ" | "Knowledge Hub" | "Case Study"
  | "One-Pager" | "Whitepaper" | "Press / Launch"
  | "Documentation Link-Back";

export type Audience =
  | "Developer" | "Platform Team" | "Security Team" | "Compliance Team"
  | "Executive" | "Founder" | "Buyer" | "Operator"
  | "Auditor" | "Partner" | "Investor";

export type FunnelStage =
  | "Awareness" | "Education" | "Consideration" | "Conversion"
  | "Activation" | "Retention" | "Expansion"
  | "Trust Building" | "Objection Handling";

export type ContentType =
  | "Problem Statement" | "Product Positioning" | "Feature" | "Benefit"
  | "Proof Point" | "Differentiator" | "Customer Outcome"
  | "Technical Explanation" | "Architecture Principle" | "Integration"
  | "Benchmark" | "FAQ" | "Glossary" | "Tutorial" | "Comparison"
  | "Objection" | "Risk Reduction"
  | "Quote Candidate" | "Hook" | "CTA Candidate";

export type ReviewConfidence =
  | "Use As-Is" | "Light Rewrite" | "Heavy Rewrite"
  | "Needs Proof" | "Needs Version Check" | "Roadmap Only"
  | "Internal Only" | "Do Not Use";

export type ProofStrength = "Strong" | "Medium" | "Weak" | "Unsupported";
export type ClaimRisk = "Low" | "Medium" | "High";
export type AssetPriority = "High" | "Medium" | "Low";

export interface DocsAsMarketingInput {
  initiative: string;
  document_type: DocumentType;
  source_title: string;
  source_url_or_path: string;
  target_audience: string[];
  review_goal: string;
  document_text: string;
  output_mode?: "json" | "markdown";
}

export interface Candidate {
  source_section: string;
  source_excerpt: string;
  marketing_angle: string;
  suggested_rewrite: string;
  use_for: UseFor[];
  audience: Audience[];
  funnel_stage: FunnelStage;
  content_type: ContentType[];
  confidence: ReviewConfidence;
  proof_strength: ProofStrength;
  claim_risk: ClaimRisk;
  link_back_required: boolean;
}

export interface RedFlag {
  source_excerpt: string;
  risk_level: ClaimRisk;
  issue: string;
  safer_wording?: string | null;
  proof_requirement?: string | null;
}

export interface AssetOpportunity {
  asset_type: string;
  theme: string;
  priority: AssetPriority;
}

export interface DocsAsMarketingOutput {
  summary: {
    best_marketing_uses: UseFor[];
    overall_score: number;
    highest_value_theme: string | null;
  };
  candidates: Candidate[];
  red_flags: RedFlag[];
  asset_opportunities: AssetOpportunity[];
}

/** Structured error returned through the MCP transport on tool failure. */
export interface ToolError {
  error: string;            // machine-readable code
  message: string;          // human-readable summary
  details?: unknown;        // optional ajv error list, stack trace summary, etc.
}
