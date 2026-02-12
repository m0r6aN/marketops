# Dry Run Example — Complete Walkthrough

## Scenario

User initiates a MarketOps run to publish a release. They want to see what would happen without actually publishing anything.

## Step 1: Start Dry Run

```bash
POST /marketops/runs
Content-Type: application/json

{
  "mode": null,  # Defaults to "dry_run"
  "input": {
    "artifacts": ["release-v1.0.0", "docs-v1.0.0"],
    "target": "github:federation/sdk-releases"
  }
}
```

**Response:**
```json
{
  "runId": "run-abc123",
  "mode": "dry_run",
  "status": "started"
}
```

## Step 2: Pipeline Executes (Identical to Prod)

### Stage 1: Discover
- Finds 2 artifacts in repository
- Computes SHA256 hashes
- Records metadata

### Stage 2: Select
- Filters artifacts by policy
- Selects both for publication

### Stage 3: Verify
- Validates hashes
- Checks manifests
- Verifies provenance
- ✅ All checks pass

### Stage 4: Evaluate
- Runs governance policies
- Judge evaluates policies
- ✅ All policies approved

### Stage 5: Plan
- Generates PublicationPlan
- Records SideEffectIntents (but doesn't execute)

**SideEffectIntent Example:**
```json
{
  "id": "intent-xyz789",
  "mode": "dry_run",
  "effect_type": "publish_release",
  "target": "github:federation/sdk-releases",
  "parameters": {
    "tag": "v1.0.0",
    "artifacts": ["release-v1.0.0"]
  },
  "blocked_by_mode": true,
  "required_authorization": {
    "enforceable_required": false
  },
  "timestamp": "2026-02-11T10:30:00Z"
}
```

### Stage 6: Execute
- **Dry Run:** Blocked immediately
- Records intent with reason: `blocked_by_mode`
- **Zero external side effects**
- Emits `marketops.execute.blocked` event

### Stage 7: Seal
- Generates ProofLedger
- Generates JudgeAdvisoryReceipt

## Step 3: Retrieve Results

### Get PublicationPlan

```bash
GET /marketops/runs/run-abc123/plan
```

**Response:**
```json
{
  "runId": "run-abc123",
  "mode": "dry_run",
  "discoveredArtifacts": [
    {
      "id": "release-v1.0.0",
      "type": "release",
      "hash": "sha256:abc..."
    },
    {
      "id": "docs-v1.0.0",
      "type": "documentation",
      "hash": "sha256:def..."
    }
  ],
  "wouldShip": [
    { "id": "release-v1.0.0" },
    { "id": "docs-v1.0.0" }
  ],
  "wouldNotShip": [],
  "reasons": {
    "release-v1.0.0": "approved_by_policy",
    "docs-v1.0.0": "approved_by_policy"
  },
  "missingPrerequisites": []
}
```

### Get ProofLedger

```bash
GET /marketops/runs/run-abc123/ledger
```

**Response:**
```json
{
  "runId": "run-abc123",
  "mode": "dry_run",
  "inputHashes": {
    "artifacts_hash": "sha256:input123",
    "config_hash": "sha256:config456"
  },
  "policySetReferences": [
    {
      "policyId": "federation.systems/publish-policy",
      "version": "v1.0",
      "digest": "sha256:policy789"
    }
  ],
  "stageEvents": [
    {
      "stage": "discover",
      "eventHash": "sha256:discover...",
      "timestamp": "2026-02-11T10:30:01Z"
    },
    {
      "stage": "execute",
      "eventHash": "sha256:execute...",
      "timestamp": "2026-02-11T10:30:05Z"
    }
  ],
  "sideEffectIntents": [
    {
      "id": "intent-xyz789",
      "mode": "dry_run",
      "effect_type": "publish_release",
      "target": "github:federation/sdk-releases",
      "blockedByMode": true
    }
  ],
  "sideEffectReceipts": [],
  "sealedAt": "2026-02-11T10:30:06Z"
}
```

### Get Advisory Receipt

```bash
GET /marketops/runs/run-abc123/advisory
```

**Response:**
```json
{
  "id": "advisory-pqr123",
  "mode": "dry_run",
  "enforceable": false,
  "runId": "run-abc123",
  "advisoryOutcome": "would_ship_2_artifacts",
  "reasons": [
    "All artifacts passed verification",
    "All governance policies approved",
    "No missing prerequisites"
  ],
  "issuedAt": "2026-02-11T10:30:06Z"
}
```

## Step 4: WebSocket Events (Ordered)

```
1. marketops.run.started
   {runId: "run-abc123", mode: "dry_run"}

2. marketops.stage.started
   {runId: "run-abc123", mode: "dry_run", stage: "discover"}

3. marketops.stage.completed
   {runId: "run-abc123", mode: "dry_run", stage: "discover"}

4. marketops.stage.started
   {runId: "run-abc123", mode: "dry_run", stage: "select"}

5. marketops.stage.completed
   {runId: "run-abc123", mode: "dry_run", stage: "select"}

... (verify, evaluate, plan stages)

6. marketops.plan.generated
   {runId: "run-abc123", mode: "dry_run"}

7. marketops.stage.started
   {runId: "run-abc123", mode: "dry_run", stage: "execute"}

8. marketops.execute.blocked
   {runId: "run-abc123", mode: "dry_run", stage: "execute"}

9. marketops.judge.advisory_issued
   {runId: "run-abc123", mode: "dry_run"}

10. marketops.ledger.sealed
    {runId: "run-abc123", mode: "dry_run"}

11. marketops.run.completed
    {runId: "run-abc123", mode: "dry_run"}
```

## Key Observations

✅ **Zero External Side Effects**
- No GitHub API calls
- No releases published
- No tags created
- No PRs opened

✅ **Complete Information**
- User sees exactly what would ship
- User sees why each artifact would/wouldn't ship
- User sees all governance decisions

✅ **Non-Promotable Advisory**
- Advisory receipt has `enforceable=false`
- Cannot be used to authorize publication
- Must be explicitly promoted to prod mode

✅ **Identical Pipeline**
- Same stages as production
- Same policy evaluation
- Same verification checks

## Next: Promote to Production

If user is satisfied, they can start a new run with `mode: "prod"`:

```bash
POST /marketops/runs
{
  "mode": "prod",  # Explicit opt-in
  "input": { ... }
}
```

This will execute the identical pipeline but with side effects enabled (subject to governance authorization).

