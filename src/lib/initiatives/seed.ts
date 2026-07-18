import type { Initiative } from "@/lib/initiatives/types";

export const initiativeSeed: Initiative[] = [
  {
    slug: "keon-systems",
    name: "Keon Systems",
    category: "Governed AI Execution",
    stage: { key: "public-proof", label: "Public proof" },
    status: { key: "access-building", label: "Access-building" },
    oneLiner: "Keon governs AI effects before they happen.",
    primaryAudiences: [
      { label: "CISO" },
      { label: "CTO" },
      { label: "Platform engineering" },
      { label: "Regulated enterprise" },
    ],
    primaryCta: "Request access",
    currentMarketingFocus: "Proof-led access building",
    allowedClaims: [
      { text: "separates cognition from authority" },
      { text: "governs effects before execution" },
      { text: "records reviewable receipts" },
    ],
    bannedClaims: [
      { text: "proves all AI actions are safe" },
      { text: "fully autonomous trust" },
      { text: "replaces security/compliance teams" },
    ],
    claimPosture: "Claims must stay tied to governed execution and reviewable receipts.",
    needsProofClaims: [
      { text: "live policy checks" },
      { text: "verifier-bound evidence" },
      { text: "production Runtime enforcement" },
      { text: "tenant-isolated execution receipts" },
    ],
    narrative:
      "Keon is a governed execution layer that sits between AI cognition and real-world effects. It enforces policies, records receipts, and ensures no AI action reaches production without a reviewable decision trail. It does not replace security teams. It gives them a surface.",
    toneNotes:
      "Technical and precise. Avoid outcome promises. Stay close to mechanism: govern, record, enforce, verify.",
    needsPositioningReview: false,
    isActive: true,
  },
  {
    slug: "biostack",
    name: "BioStack",
    category: "Protocol Intelligence",
    stage: { key: "alpha", label: "Alpha" },
    status: { key: "conversion-polish", label: "Conversion polish" },
    oneLiner:
      "BioStack helps people organize, track, and understand supplement protocol patterns.",
    primaryAudiences: [
      { label: "Self-optimizers" },
      { label: "Providers" },
      { label: "Wellness operators" },
    ],
    primaryCta: "Start analyzing / Track a protocol",
    currentMarketingFocus: "Conversion polish",
    allowedClaims: [
      { text: "observational protocol tracking" },
      { text: "pattern visibility" },
      { text: "supplement stack organization" },
    ],
    bannedClaims: [
      { text: "medical advice" },
      { text: "diagnosis" },
      { text: "treatment" },
      { text: "cure" },
      { text: "dosing directive" },
    ],
    claimPosture: "Claims must remain observational and non-clinical.",
    needsProofClaims: [
      { text: "interaction intelligence" },
      { text: "provider-ready summaries" },
      { text: "sequence expectations" },
      { text: "drift detection" },
    ],
    narrative:
      "BioStack gives people a structured way to log, visualize, and compare supplement protocols over time. It surfaces pattern data without interpreting it clinically. It is an observation tool, not a health advisor.",
    toneNotes:
      "Observational and measured. Never clinical. Avoid words like 'optimize' unless tied to tracking, not outcomes.",
    needsPositioningReview: false,
    isActive: true,
  },
  {
    slug: "silentapply",
    name: "SilentApply",
    category: "Career Automation",
    stage: { key: "concept", label: "Concept" },
    status: { key: "early-build", label: "Early build" },
    oneLiner:
      "SilentApply helps job seekers run targeted application workflows without living inside job boards.",
    primaryAudiences: [
      { label: "Job seekers" },
      { label: "Career switchers" },
      { label: "Laid-off tech workers" },
    ],
    primaryCta: "Join waitlist",
    currentMarketingFocus: "Positioning refinement",
    allowedClaims: [
      { text: "organize applications" },
      { text: "tailor outreach" },
      { text: "reduce manual tracking" },
    ],
    bannedClaims: [
      { text: "guaranteed interviews" },
      { text: "guaranteed job offers" },
      { text: "bypasses hiring systems" },
    ],
    claimPosture: "Claims should stay operational and avoid outcome guarantees.",
    needsProofClaims: [
      { text: "recruiter response improvement" },
      { text: "application quality scoring" },
      { text: "interview pipeline lift" },
    ],
    narrative:
      "SilentApply helps job seekers run application workflows without living inside job boards. It organizes targets, tailors outreach, and reduces the manual overhead of a focused job search. It does not promise outcomes.",
    toneNotes:
      "Practical and direct. No outcome promises. Focus on the workflow reduction and targeting precision.",
    needsPositioningReview: true,
    isActive: true,
  },
  {
    slug: "forgepilot",
    name: "ForgePilot",
    category: "Builder Workflow Automation",
    stage: { key: "concept", label: "Concept" },
    status: { key: "early-build", label: "Early build" },
    oneLiner: "ForgePilot helps builders turn ideas into shipped product workflows.",
    primaryAudiences: [
      { label: "Indie hackers" },
      { label: "Technical founders" },
      { label: "Product builders" },
    ],
    primaryCta: "Follow build progress",
    currentMarketingFocus: "Positioning refinement",
    allowedClaims: [
      { text: "supports product planning" },
      { text: "organizes build lanes" },
      { text: "tracks launch readiness" },
    ],
    bannedClaims: [
      { text: "guarantees product-market fit" },
      { text: "replaces engineering judgment" },
      { text: "fully autonomous shipping" },
    ],
    claimPosture: "Claims should stay grounded in workflow support, not autonomous delivery.",
    needsProofClaims: [
      { text: "faster shipping cycles" },
      { text: "reduced context switching" },
      { text: "better launch readiness" },
    ],
    narrative:
      "ForgePilot gives builders a structured workspace for turning ideas into shipped product workflows. It tracks what needs to happen, in what order, before a lane is ready to ship. It supports judgment; it does not replace it.",
    toneNotes:
      "Builder-native and unassuming. Avoid 'AI-powered' framing. Focus on workflow clarity and reduced drag.",
    needsPositioningReview: true,
    isActive: true,
  },
];
