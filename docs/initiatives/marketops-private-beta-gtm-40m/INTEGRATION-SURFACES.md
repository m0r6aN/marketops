# Integration Surfaces — marketops-private-beta-gtm-40m

| Surface | Producer → Consumer | Auth boundary | Data class | Sec |
|---|---|---|---|---|
| S1 web-tenant-db | web-app → deploy-infra | authenticated tenant | tenant-scoped PII | high |
| S2 auth-session | deploy-infra → web-app | session/tenant-mismatch deny | auth | high |
| S3 billing-gate | gtm-monet → web-app | stripe-webhook verified | billing | medium |
| S4 claim-approval-receipt | web-app → governance-dotnet | approval-required | marketing-claims | high |
| S5 email-compliance-block | web-app → web-app | consent/suppression gate | PII contacts | high |
| S6 mcp-canon | mcp-dist → web-app | tool auth | docs, no secrets/pricing | medium |
| S7 pipeline-seal | governance-dotnet → proof-legal | prod-auth, no DevKey | evidence | high |
