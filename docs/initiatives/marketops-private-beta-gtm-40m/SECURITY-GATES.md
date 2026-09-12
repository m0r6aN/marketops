# Security Gates — marketops-private-beta-gtm-40m

| Gate | Surface | Threat | Required evidence | Blocking | Status |
|---|---|---|---|---|---|
| sec-auth | S2 | broken-access | unauth 401 + cross-tenant 403 tests | yes | pending |
| sec-tenant-isolation | S1 | cross-tenant leakage | isolation tests + DB proof | yes | pending |
| sec-secrets | S7 | secret leak | boot-refuses-without-key test | yes | pending |
| sec-claim-safety | S4 | unsafe-claim send | eval precision/recall + block receipts | yes | pending |
| sec-compliance-no-send | S5 | unlawful send | blocked-reason artifacts | yes | pending |
| sec-headers-ratelimit | S2 | web exposure | header + ratelimit tests | yes | pending |
| sec-import-dlp | S1 | malicious upload | content-scan quarantine tests | yes | pending |
| sec-pentest | S7 | release without review | pen-test report + SOC2 path memo | yes | pending |
