import type { ContentClaimFinding,ContentSourceReference,ContentStatus } from "@/lib/content-workspace/types";

export const emailConsentBasisOptions=["explicit-consent","existing-relationship","legitimate-interest-reviewed","other-reviewed"] as const;
export type EmailConsentBasis=(typeof emailConsentBasisOptions)[number];
export type EmailSequenceStep={id:string;order:number;delayDays:number;purpose:string;subject:string;preheader:string;body:string;cta:string;sourceContentVersionId:string;sourceContentUpdatedAt:string;sourceContentTitle:string;sourceMaterials:ContentSourceReference[];brandVoiceGuidelineId:string;brandVoiceSnapshot:string;claimFindings:ContentClaimFinding[]};
export type EmailCampaignVersionInput={title:string;status:ContentStatus;campaignId:string;campaignName:string;objective:string;audienceSegment:string;senderName:string;replyTo:string;consentBasis:EmailConsentBasis;suppressionPlan:string;unsubscribePlan:string;senderAuthenticationPlan:string;physicalAddressPlan:string;primaryMetric:string;secondaryMetrics:string[];attributionWindowDays:number;steps:EmailSequenceStep[];notes:string};
export type EmailCampaignVersionRecord=EmailCampaignVersionInput&{id:string;emailCampaignItemId:string;initiativeSlug:string;versionNumber:number;createdAt:string;updatedAt:string;approvedAt?:string};
export type EmailCampaignEvent={id:string;emailCampaignItemId:string;emailCampaignVersionId:string;initiativeSlug:string;eventType:string;summary:string;detail:Record<string,unknown>;recordedAt:string};
