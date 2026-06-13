import type { ClaimRule, Initiative } from "@/lib/initiatives";

// Literal phrase matching only. This does not detect paraphrases.
function matchesClaim(text: string, rule: ClaimRule): boolean {
  const ruleText = rule.text.trim();
  if (!ruleText) return false;
  return text.toLowerCase().includes(ruleText.toLowerCase());
}

// Literal phrase matching only. This does not detect paraphrases.
export function getBannedClaimMatches(
  initiative: Initiative,
  text: string
): ClaimRule[] {
  return initiative.bannedClaims.filter((rule) => matchesClaim(text, rule));
}

// Literal phrase matching only. This does not detect paraphrases.
export function getNeedsProofClaimMatches(
  initiative: Initiative,
  text: string
): ClaimRule[] {
  return initiative.needsProofClaims.filter((rule) => matchesClaim(text, rule));
}

// Literal phrase matching only. This does not detect paraphrases.
export function getClaimHygieneSummary(
  initiative: Initiative,
  text: string
): { banned: ClaimRule[]; needsProof: ClaimRule[]; clean: boolean } {
  const banned = getBannedClaimMatches(initiative, text);
  const needsProof = getNeedsProofClaimMatches(initiative, text);
  return {
    banned,
    needsProof,
    clean: banned.length === 0 && needsProof.length === 0,
  };
}
