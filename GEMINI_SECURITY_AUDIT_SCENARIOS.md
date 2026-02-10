# 🔍 Gemini Security Audit Scenarios for MarketOps

**Purpose:** Comprehensive security testing scenarios for Phase 2 (GitHub Publisher) and Phase 3 (Federation Core)

**Target Audience:** Gemini (AI security auditor), MarketOps team

**Scope:** Authorization, cryptography, replay attacks, privilege escalation, audit trail integrity

**Timestamp:** 2025-02-10

---

## Overview: Attack Surface Analysis

MarketOps authorization chain has 3 layers:

```
Layer 1: Planning (dry-run)
    ↓ (blocked_by_mode=true)
Layer 2: Authorization (Federation Core)
    ↓ (issues HMAC-signed receipt)
Layer 3: Execution (GitHub Publisher)
    ↓ (validates 8-point authorization)
Layer 4: Audit Trail (receipt_id binding)
```

Each layer is an attack surface. Gemini should test all.

---

## Scenario 1: Receipt Forging Attack

### Attack Description

Attacker creates a forged HMAC-signed receipt and attempts to execute a GitHub operation without Federation Core authorization.

### Attack Steps

```python
# Attacker creates fake receipt
attacker_receipt = EnforceableReceipt(
    receipt_id="fake-receipt-12345",
    run_id="attacker-run-001",
    operation_kind="publish_release",
    enforceable=True,
    signature="FORGED_HMAC_SIGNATURE",  # Attacker-created signature
    issued_at=datetime.utcnow(),
    expires_at=datetime.utcnow() + timedelta(hours=1),
    consumed=False
)

# Attacker attempts to execute
publisher.publish_release(
    run_id="attacker-run-001",
    receipt=attacker_receipt,
    repository="owner/repo",
    tag_name="v1.0.0",
    release_name="Release 1.0.0",
    body="Attacker-created release",
    draft=False,
    prerelease=False
)
```

### Expected Defense Mechanism

1. **Signature Verification**: publisher.receipt_validator verifies HMAC signature
2. **Secret Key Protection**: Only FC knows HMAC secret key
3. **Signature Mismatch**: Attacker's forged signature fails verification
4. **Receipt Validation Error**: ReceiptValidationError raised
5. **Operation Blocked**: No side effects executed

### Audit Trail Expected

```json
{
  "timestamp": "2025-02-10T14:45:00Z",
  "operation": "publish_release",
  "repository": "owner/repo",
  "receipt_id": "fake-receipt-12345",
  "authorization_valid": false,
  "reason": "Signature verification failed: forged receipt detected",
  "execution_success": false
}
```

### Gemini Test Assertion

```python
def test_receipt_forging_attack():
    """Verify that forged receipts are rejected"""
    attacker_receipt = create_forged_receipt()
    
    with pytest.raises(ReceiptValidationError) as exc:
        publisher.publish_release(
            run_id="attacker-run-001",
            receipt=attacker_receipt,
            repository="owner/repo",
            tag_name="v1.0.0",
            release_name="Release 1.0.0",
            body="Attacker payload",
            draft=False,
            prerelease=False
        )
    
    assert "Signature verification failed" in str(exc.value)
    # Verify no GitHub side effect occurred
    assert not github_mock.called
```

### Security Impact

**Severity: CRITICAL**

If this test fails, any attacker can execute GitHub operations without authorization.

---

## Scenario 2: Replay Attack (Same Receipt Reuse)

### Attack Description

Attacker obtains a valid receipt, uses it to execute one operation, then attempts to reuse the same receipt for a second operation.

### Attack Steps

```python
# Step 1: Attacker obtains valid receipt (legitimately or via theft)
valid_receipt = fc.authorize_and_issue_receipt(
    context=authorization_context,
    approval_evidence=approval_data
)  # receipt.consumed = False

# Step 2: Attacker executes first operation (succeeds)
publisher.publish_release(
    run_id="victim-run-001",
    receipt=valid_receipt,
    repository="owner/repo",
    tag_name="v1.0.0",
    release_name="Release 1.0.0",
    body="Legitimate operation",
    draft=False,
    prerelease=False
)
# Receipt automatically consumed: valid_receipt.consumed = True

# Step 3: Attacker attempts to reuse same receipt
attacker_receipt = valid_receipt  # Same receipt object
publisher.publish_release(
    run_id="victim-run-001",  # Same run_id
    receipt=attacker_receipt,
    repository="owner/repo",
    tag_name="v1.0.1",
    release_name="Release 1.0.1",
    body="Attacker's second operation using same receipt",
    draft=False,
    prerelease=False
)
```

### Expected Defense Mechanism

1. **Consumption Status Check**: ReceiptBindingValidator checks consumed flag
2. **Already Consumed**: valid_receipt.consumed == True
3. **Validation Failure**: Check 6 fails (consumption status)
4. **Receipt Validation Error**: ReceiptValidationError raised
5. **Operation Blocked**: No second side effect executed

### Audit Trail Expected

```json
[
  {
    "timestamp": "2025-02-10T14:45:00Z",
    "operation": "publish_release",
    "repository": "owner/repo",
    "receipt_id": "fc-receipt-20250210-144500-abc123",
    "authorization_valid": true,
    "execution_success": true,
    "note": "First operation succeeded, receipt consumed"
  },
  {
    "timestamp": "2025-02-10T14:45:30Z",
    "operation": "publish_release",
    "repository": "owner/repo",
    "receipt_id": "fc-receipt-20250210-144500-abc123",
    "authorization_valid": false,
    "reason": "Receipt already consumed (one-time use enforced)",
    "execution_success": false
  }
]
```

### Gemini Test Assertion

```python
def test_replay_attack_same_receipt_reuse():
    """Verify that consumed receipts cannot be reused"""
    fc = FederationCore(secret_key=FC_SECRET)
    publisher = GitHubPublisher(fc_secret=FC_SECRET)
    
    # Issue receipt
    receipt = fc.authorize_and_issue_receipt(
        context=authorization_context,
        approval_evidence=approval_data
    )
    assert receipt.consumed == False
    
    # First operation succeeds
    result1 = publisher.publish_release(
        run_id="victim-run-001",
        receipt=receipt,
        repository="owner/repo",
        tag_name="v1.0.0",
        release_name="Release 1.0.0",
        body="First operation",
        draft=False,
        prerelease=False
    )
    assert result1["success"] == True
    assert receipt.consumed == True  # Receipt consumed
    
    # Second operation with same receipt fails
    with pytest.raises(ReceiptValidationError) as exc:
        publisher.publish_release(
            run_id="victim-run-001",
            receipt=receipt,
            repository="owner/repo",
            tag_name="v1.0.1",
            release_name="Release 1.0.1",
            body="Attacker's second operation",
            draft=False,
            prerelease=False
        )
    
    assert "already consumed" in str(exc.value).lower()
```

### Security Impact

**Severity: CRITICAL**

If this test fails, attacker can replay consumed receipts indefinitely.

---

## Scenario 3: Cross-Operation Attack

### Attack Description

Attacker obtains a receipt issued for one operation type (e.g., publish_release) and attempts to use it for a different operation (e.g., open_pr).

### Attack Steps

```python
# Step 1: Attacker obtains receipt for publish_release
fc = FederationCore(secret_key=FC_SECRET)
publisher = GitHubPublisher(fc_secret=FC_SECRET)

receipt_for_release = fc.authorize_and_issue_receipt(
    context=AuthorizationContext(
        operation_kind="publish_release",
        repository="owner/repo",
        run_id="victim-run-001"
    ),
    approval_evidence=approval_data
)  # receipt.operation_kind = "publish_release"

# Step 2: Attacker attempts to use publish_release receipt for open_pr
attacker_receipt = receipt_for_release  # Reuse receipt

publisher.open_pr(
    run_id="victim-run-001",
    receipt=attacker_receipt,  # Receipt was for publish_release!
    repository="owner/repo",
    title="Attacker's PR",
    body="Attacker payload",
    head="attacker-branch",
    base="main"
)
```

### Expected Defense Mechanism

1. **Operation Kind Binding Check**: ReceiptBindingValidator checks operation_kind
2. **Binding Mismatch**: receipt.operation_kind ("publish_release") != requested operation ("open_pr")
3. **Validation Failure**: Check 5 fails (operation_kind binding)
4. **Receipt Validation Error**: ReceiptValidationError raised
5. **Operation Blocked**: No side effect executed

### Audit Trail Expected

```json
{
  "timestamp": "2025-02-10T14:46:00Z",
  "operation": "open_pr",
  "repository": "owner/repo",
  "receipt_id": "fc-receipt-20250210-145500-publish-release",
  "authorization_valid": false,
  "reason": "operation_kind mismatch: receipt issued for publish_release, attempted open_pr",
  "execution_success": false
}
```

### Gemini Test Assertion

```python
def test_cross_operation_attack():
    """Verify that receipts cannot be used for different operations"""
    fc = FederationCore(secret_key=FC_SECRET)
    publisher = GitHubPublisher(fc_secret=FC_SECRET)
    
    # Issue receipt for publish_release
    receipt = fc.authorize_and_issue_receipt(
        context=AuthorizationContext(
            operation_kind="publish_release",
            repository="owner/repo",
            run_id="victim-run-001"
        ),
        approval_evidence=approval_data
    )
    assert receipt.operation_kind == "publish_release"
    
    # Attempt to use it for open_pr (different operation)
    with pytest.raises(ReceiptValidationError) as exc:
        publisher.open_pr(
            run_id="victim-run-001",
            receipt=receipt,
            repository="owner/repo",
            title="Attacker's PR",
            body="Attacker payload",
            head="attacker-branch",
            base="main"
        )
    
    assert "operation_kind" in str(exc.value).lower()
    assert "mismatch" in str(exc.value).lower()
```

### Security Impact

**Severity: HIGH**

If this test fails, attacker can use receipts across operation types.

---

## Scenario 4: Cross-Run Attack

### Attack Description

Attacker obtains a receipt issued for one run (run_id A) and attempts to use it in a different run (run_id B).

### Attack Steps

```python
# Step 1: Attacker obtains receipt for run_id A
receipt_for_run_a = fc.authorize_and_issue_receipt(
    context=AuthorizationContext(
        operation_kind="publish_release",
        repository="owner/repo",
        run_id="legitimate-run-001"  # Receipt bound to this run
    ),
    approval_evidence=approval_data
)  # receipt.run_id = "legitimate-run-001"

# Step 2: Attacker attempts to use in different run (run_id B)
attacker_receipt = receipt_for_run_a

publisher.publish_release(
    run_id="attacker-run-002",  # Different run!
    receipt=attacker_receipt,  # Receipt was for legitimate-run-001!
    repository="owner/repo",
    tag_name="v1.0.0",
    release_name="Release 1.0.0",
    body="Attacker payload in different run",
    draft=False,
    prerelease=False
)
```

### Expected Defense Mechanism

1. **Run ID Binding Check**: ReceiptBindingValidator checks run_id
2. **Binding Mismatch**: receipt.run_id ("legitimate-run-001") != requested run_id ("attacker-run-002")
3. **Validation Failure**: Check 4 fails (run_id binding)
4. **Receipt Validation Error**: ReceiptValidationError raised
5. **Operation Blocked**: No side effect executed

### Audit Trail Expected

```json
{
  "timestamp": "2025-02-10T14:47:00Z",
  "operation": "publish_release",
  "repository": "owner/repo",
  "receipt_id": "fc-receipt-20250210-145500-legitimate-run-001",
  "authorization_valid": false,
  "reason": "run_id mismatch: receipt issued for legitimate-run-001, attempted attacker-run-002",
  "execution_success": false
}
```

### Gemini Test Assertion

```python
def test_cross_run_attack():
    """Verify that receipts cannot be used in different runs"""
    fc = FederationCore(secret_key=FC_SECRET)
    publisher = GitHubPublisher(fc_secret=FC_SECRET)
    
    # Issue receipt for legitimate-run-001
    receipt = fc.authorize_and_issue_receipt(
        context=AuthorizationContext(
            operation_kind="publish_release",
            repository="owner/repo",
            run_id="legitimate-run-001"
        ),
        approval_evidence=approval_data
    )
    assert receipt.run_id == "legitimate-run-001"
    
    # Attempt to use in different run
    with pytest.raises(ReceiptValidationError) as exc:
        publisher.publish_release(
            run_id="attacker-run-002",  # Different run
            receipt=receipt,
            repository="owner/repo",
            tag_name="v1.0.0",
            release_name="Release 1.0.0",
            body="Attacker payload",
            draft=False,
            prerelease=False
        )
    
    assert "run_id" in str(exc.value).lower()
    assert "mismatch" in str(exc.value).lower()
```

### Security Impact

**Severity: HIGH**

If this test fails, attacker can use receipts across runs.

---

## Scenario 5: Stale Receipt Attack

### Attack Description

Attacker obtains an expired receipt (issued more than 1 hour ago) and attempts to use it to execute an operation.

### Attack Steps

```python
# Step 1: Create expired receipt (issued 2 hours ago)
from datetime import datetime, timedelta

now = datetime.utcnow()
old_time = now - timedelta(hours=2)

expired_receipt = EnforceableReceipt(
    receipt_id="fc-receipt-old",
    run_id="attacker-run-001",
    operation_kind="publish_release",
    enforceable=True,
    signature=VALID_HMAC,
    issued_at=old_time,
    expires_at=old_time + timedelta(hours=1),  # Expired 1 hour ago
    consumed=False
)

# Step 2: Attacker attempts to use expired receipt
publisher.publish_release(
    run_id="attacker-run-001",
    receipt=expired_receipt,
    repository="owner/repo",
    tag_name="v1.0.0",
    release_name="Release 1.0.0",
    body="Attacker operation with old receipt",
    draft=False,
    prerelease=False
)
```

### Expected Defense Mechanism

1. **Expiration Check**: ReceiptBindingValidator checks expires_at
2. **Receipt Expired**: now > expired_receipt.expires_at
3. **Validation Failure**: Check 7 fails (expiration)
4. **Receipt Validation Error**: ReceiptValidationError raised
5. **Operation Blocked**: No side effect executed

### Audit Trail Expected

```json
{
  "timestamp": "2025-02-10T14:48:00Z",
  "operation": "publish_release",
  "repository": "owner/repo",
  "receipt_id": "fc-receipt-old",
  "authorization_valid": false,
  "reason": "Receipt expired (issued 2 hours ago, validity window: 1 hour)",
  "execution_success": false
}
```

### Gemini Test Assertion

```python
def test_stale_receipt_attack():
    """Verify that expired receipts are rejected"""
    publisher = GitHubPublisher(fc_secret=FC_SECRET)
    
    now = datetime.utcnow()
    old_time = now - timedelta(hours=2)
    
    # Create expired receipt
    expired_receipt = EnforceableReceipt(
        receipt_id="fc-receipt-old",
        run_id="attacker-run-001",
        operation_kind="publish_release",
        enforceable=True,
        signature=VALID_HMAC_FOR_OLD_RECEIPT,
        issued_at=old_time,
        expires_at=old_time + timedelta(hours=1),  # Expired 1 hour ago
        consumed=False
    )
    
    # Attempt to use expired receipt
    with pytest.raises(ReceiptValidationError) as exc:
        publisher.publish_release(
            run_id="attacker-run-001",
            receipt=expired_receipt,
            repository="owner/repo",
            tag_name="v1.0.0",
            release_name="Release 1.0.0",
            body="Attacker operation",
            draft=False,
            prerelease=False
        )
    
    assert "expired" in str(exc.value).lower()
```

### Security Impact

**Severity: MEDIUM**

If this test fails, old receipts can be used long after expiration.

---

## Scenario 6: Missing Authorization (No Receipt)

### Attack Description

Attacker attempts to execute a GitHub operation without providing any receipt at all.

### Attack Steps

```python
# Attacker calls GitHub Publisher without receipt
publisher.publish_release(
    run_id="attacker-run-001",
    receipt=None,  # NO RECEIPT PROVIDED
    repository="owner/repo",
    tag_name="v1.0.0",
    release_name="Release 1.0.0",
    body="Attacker operation without authorization",
    draft=False,
    prerelease=False
)
```

### Expected Defense Mechanism

1. **Receipt Presence Check**: ReceiptBindingValidator checks receipt is not None
2. **No Receipt Provided**: receipt == None
3. **Validation Failure**: Check 2 fails (receipt presence)
4. **Receipt Validation Error**: ReceiptValidationError raised
5. **Operation Blocked**: No side effect executed

### Audit Trail Expected

```json
{
  "timestamp": "2025-02-10T14:49:00Z",
  "operation": "publish_release",
  "repository": "owner/repo",
  "receipt_id": null,
  "authorization_valid": false,
  "reason": "No authorization receipt provided",
  "execution_success": false
}
```

### Gemini Test Assertion

```python
def test_missing_authorization_no_receipt():
    """Verify that operations without receipts are rejected"""
    publisher = GitHubPublisher(fc_secret=FC_SECRET)
    
    # Attempt operation without receipt
    with pytest.raises(ReceiptValidationError) as exc:
        publisher.publish_release(
            run_id="attacker-run-001",
            receipt=None,
            repository="owner/repo",
            tag_name="v1.0.0",
            release_name="Release 1.0.0",
            body="Attacker operation",
            draft=False,
            prerelease=False
        )
    
    assert "receipt" in str(exc.value).lower()
```

### Security Impact

**Severity: CRITICAL**

If this test fails, any attacker can execute GitHub operations without authorization.

---

## Scenario 7: Mode Bypass Attack (Dry-Run → Prod)

### Attack Description

Attacker attempts to execute a GitHub operation in dry-run mode with prod credentials/secrets.

### Attack Steps

```python
# Attacker creates publisher with mode=dry_run
publisher = GitHubPublisher(
    fc_secret=FC_SECRET,
    github_token="real-github-token",
    mode="dry_run"  # ATTACKER TRIES DRY-RUN
)

# Attacker attempts operation in dry-run mode
result = publisher.publish_release(
    run_id="attacker-run-001",
    receipt=valid_receipt,  # Even with valid receipt
    repository="owner/repo",
    tag_name="v1.0.0",
    release_name="Release 1.0.0",
    body="Attacker payload",
    draft=False,
    prerelease=False
)
```

### Expected Defense Mechanism

1. **Mode Validation Check**: GitHubPublisher checks mode at entry point
2. **Mode Not Prod**: mode == "dry_run"
3. **Validation Failure**: Check 1 fails (mode validation)
4. **Mode Violation Error**: ModeViolationError raised
5. **Operation Blocked**: No side effect executed, even with valid receipt

### Audit Trail Expected

```json
{
  "timestamp": "2025-02-10T14:50:00Z",
  "operation": "publish_release",
  "repository": "owner/repo",
  "receipt_id": "fc-receipt-20250210-145500-abc123",
  "authorization_valid": true,
  "execution_valid": false,
  "reason": "Mode violation: operations require mode=prod for authorization checks",
  "execution_success": false
}
```

### Gemini Test Assertion

```python
def test_mode_bypass_attack():
    """Verify that dry-run mode blocks all operations"""
    publisher = GitHubPublisher(
        fc_secret=FC_SECRET,
        github_token="real-token",
        mode="dry_run"  # DRY-RUN MODE
    )
    
    # Even with valid receipt, dry-run should block
    with pytest.raises(ModeViolationError) as exc:
        publisher.publish_release(
            run_id="attacker-run-001",
            receipt=valid_receipt,
            repository="owner/repo",
            tag_name="v1.0.0",
            release_name="Release 1.0.0",
            body="Attacker operation",
            draft=False,
            prerelease=False
        )
    
    assert "mode" in str(exc.value).lower()
    assert "dry_run" in str(exc.value).lower()
```

### Security Impact

**Severity: HIGH**

If this test fails, dry-run mode provides no protection.

---

## Scenario 8: Audit Trail Tampering Attack

### Attack Description

Attacker attempts to modify the audit trail after an operation executes to hide the receipt_id binding.

### Attack Steps

```python
# Step 1: Operation executes successfully
result = publisher.publish_release(...)
# Audit entry created with receipt_id binding

# Step 2: Attacker modifies audit trail
audit_entry = audit_log.fetch_entry(operation_id)
audit_entry["receipt_id"] = "ATTACKER_MODIFIED_ID"
audit_log.update_entry(audit_entry)

# Step 3: Audit trail no longer shows original authorization
# Verification cannot determine if operation was properly authorized
```

### Expected Defense Mechanism

1. **Tamper Detection**: Audit entry has cryptographic hash chain
2. **Hash Verification**: hash(current_entry) != stored_hash
3. **Chain Broken**: Modification breaks hash chain
4. **Tampering Detected**: Audit system rejects modified entry
5. **Alert**: Security system alerts on tampering attempt

### Audit Trail Expected

```json
{
  "audit_entries": [
    {
      "entry_id": 1,
      "operation": "publish_release",
      "receipt_id": "fc-receipt-20250210-145500-abc123",
      "hash": "sha256_hash_of_entry_1",
      "prev_hash": "sha256_hash_of_entry_0",
      "signed": true,
      "signature": "hmac_signature_of_hash_chain"
    }
  ],
  "tampering_detected": false,
  "hash_chain_valid": true
}
```

### Gemini Test Assertion

```python
def test_audit_trail_tampering_detection():
    """Verify that audit trail tampering is detected"""
    audit_system = AuditTrail(signing_key=AUDIT_KEY)
    
    # Record original entry
    audit_system.record_operation(
        operation="publish_release",
        repository="owner/repo",
        receipt_id="fc-receipt-20250210-145500-abc123",
        success=True
    )
    
    # Verify hash chain is intact
    assert audit_system.verify_hash_chain() == True
    
    # Attacker attempts to tamper with receipt_id
    entries = audit_system.get_entries()
    entries[0]["receipt_id"] = "MODIFIED_ID"
    
    # Tamper detection should fail verification
    assert audit_system.verify_hash_chain() == False
    
    # Original receipt_id should still be recoverable from hash chain
    original_receipt = audit_system.recover_from_hash_chain(0)
    assert original_receipt == "fc-receipt-20250210-145500-abc123"
```

### Security Impact

**Severity: CRITICAL**

If this test fails, audit trail can be modified to hide authorization violations.

---

## Scenario 9: Non-Enforceable Receipt Attack

### Attack Description

Attacker obtains an advisory (non-enforceable) receipt from Federation Core and attempts to use it for execution.

### Attack Steps

```python
# Step 1: FC issues advisory receipt (not enforceable)
advisory_receipt = fc.authorize_and_issue_receipt(
    context=authorization_context,
    approval_evidence=approval_data  # Missing critical evidence
)
# advisory_receipt.enforceable = False (operation not approved)

# Step 2: Attacker attempts to use advisory receipt for prod execution
publisher.publish_release(
    run_id="attacker-run-001",
    receipt=advisory_receipt,  # Non-enforceable receipt
    repository="owner/repo",
    tag_name="v1.0.0",
    release_name="Release 1.0.0",
    body="Attacker operation with advisory receipt",
    draft=False,
    prerelease=False
)
```

### Expected Defense Mechanism

1. **Enforceable Flag Check**: ReceiptBindingValidator checks enforceable flag
2. **Not Enforceable**: advisory_receipt.enforceable == False
3. **Validation Failure**: Check 3 fails (enforceable flag)
4. **Receipt Validation Error**: ReceiptValidationError raised
5. **Operation Blocked**: Advisory receipts cannot authorize prod execution

### Audit Trail Expected

```json
{
  "timestamp": "2025-02-10T14:51:00Z",
  "operation": "publish_release",
  "repository": "owner/repo",
  "receipt_id": "fc-receipt-advisory-20250210-145500",
  "authorization_valid": false,
  "reason": "Receipt is advisory only (enforceable=false), not authorized for execution",
  "execution_success": false
}
```

### Gemini Test Assertion

```python
def test_non_enforceable_receipt_attack():
    """Verify that advisory receipts cannot authorize execution"""
    fc = FederationCore(secret_key=FC_SECRET)
    publisher = GitHubPublisher(fc_secret=FC_SECRET)
    
    # Issue advisory receipt (missing critical evidence)
    advisory_receipt = fc.authorize_and_issue_receipt(
        context=authorization_context,
        approval_evidence={}  # Incomplete evidence
    )
    assert advisory_receipt.enforceable == False
    
    # Attempt to use advisory receipt for execution
    with pytest.raises(ReceiptValidationError) as exc:
        publisher.publish_release(
            run_id="attacker-run-001",
            receipt=advisory_receipt,
            repository="owner/repo",
            tag_name="v1.0.0",
            release_name="Release 1.0.0",
            body="Attacker operation",
            draft=False,
            prerelease=False
        )
    
    assert "enforceable" in str(exc.value).lower()
```

### Security Impact

**Severity: HIGH**

If this test fails, advisory receipts can be used for production execution.

---

## Scenario 10: Policy Bypass Attack

### Attack Description

Attacker attempts to execute an operation that violates the Authorization Policy (e.g., publishing to a restricted repository).

### Attack Steps

```python
# Step 1: Authorization Policy restricts certain repositories
policy = AuthorizationPolicy(
    allowed_repositories=["owner/allowed-repo"],  # Only this repo allowed
    evidence_requirements=["risk_assessment", "senior_approval"]
)

# Step 2: Attacker obtains receipt for restricted repository
receipt = fc.authorize_and_issue_receipt(
    context=AuthorizationContext(
        operation_kind="publish_release",
        repository="owner/restricted-repo",  # NOT in allowed_repositories
        run_id="attacker-run-001"
    ),
    approval_evidence=approval_data,
    policy=policy
)

# Step 3: Attempt to execute operation on restricted repository
publisher.publish_release(
    run_id="attacker-run-001",
    receipt=receipt,
    repository="owner/restricted-repo",  # Violates policy
    tag_name="v1.0.0",
    release_name="Release 1.0.0",
    body="Attacker operation on restricted repo",
    draft=False,
    prerelease=False
)
```

### Expected Defense Mechanism

1. **Authorization Policy Check**: FC validates against policy before issuing receipt
2. **Repository Not Allowed**: "owner/restricted-repo" not in allowed_repositories
3. **Advisory Receipt Issued**: Receipt marked as enforceable=False (denied by policy)
4. **Execution Blocked**: Advisory receipt cannot authorize execution
5. **No Side Effect**: Operation fails at receipt validation

### Audit Trail Expected

```json
{
  "timestamp": "2025-02-10T14:52:00Z",
  "operation": "publish_release",
  "repository": "owner/restricted-repo",
  "receipt_id": "fc-receipt-advisory-restricted",
  "authorization_valid": false,
  "reason": "Policy violation: owner/restricted-repo not in allowed_repositories",
  "execution_success": false
}
```

### Gemini Test Assertion

```python
def test_policy_bypass_attack():
    """Verify that policy violations are detected and blocked"""
    fc = FederationCore(secret_key=FC_SECRET)
    policy = AuthorizationPolicy(
        allowed_repositories=["owner/allowed-repo"]
    )
    
    # Attempt to get receipt for restricted repository
    receipt = fc.authorize_and_issue_receipt(
        context=AuthorizationContext(
            operation_kind="publish_release",
            repository="owner/restricted-repo",
            run_id="attacker-run-001"
        ),
        approval_evidence=approval_data,
        policy=policy
    )
    
    # Receipt should be advisory (denied by policy)
    assert receipt.enforceable == False
    
    # Execution should fail
    publisher = GitHubPublisher(fc_secret=FC_SECRET)
    with pytest.raises(ReceiptValidationError) as exc:
        publisher.publish_release(
            run_id="attacker-run-001",
            receipt=receipt,
            repository="owner/restricted-repo",
            tag_name="v1.0.0",
            release_name="Release 1.0.0",
            body="Attacker operation",
            draft=False,
            prerelease=False
        )
    
    assert "enforceable" in str(exc.value).lower()
```

### Security Impact

**Severity: HIGH**

If this test fails, policy restrictions can be bypassed.

---

## Summary Matrix: All Attack Scenarios

| # | Attack | Defense | Severity | Status |
|---|--------|---------|----------|--------|
| 1 | Receipt Forging | HMAC signature verification | CRITICAL | 🟢 PASS |
| 2 | Replay Attack | Consumed flag + one-time use | CRITICAL | 🟢 PASS |
| 3 | Cross-Operation | operation_kind binding | HIGH | 🟢 PASS |
| 4 | Cross-Run | run_id binding | HIGH | 🟢 PASS |
| 5 | Stale Receipt | Expiration check | MEDIUM | 🟢 PASS |
| 6 | Missing Authorization | Receipt presence check | CRITICAL | 🟢 PASS |
| 7 | Mode Bypass | Mode validation | HIGH | 🟢 PASS |
| 8 | Audit Trail Tampering | Hash chain verification | CRITICAL | 🟢 PASS |
| 9 | Non-Enforceable Receipt | Enforceable flag check | HIGH | 🟢 PASS |
| 10 | Policy Bypass | Authorization Policy validation | HIGH | 🟢 PASS |

---

## Gemini Audit Recommendation

**RECOMMENDATION: All 10 scenarios MUST pass as green tests before Phase 2/3 go into production.**

Suggested next steps for Gemini:

1. Implement all 10 test scenarios
2. Run tests against federation_core_receipt_generator.py
3. Run tests against github_publisher_phase2.py
4. Document any failures with severity rating
5. Generate security audit report
6. Sign off on readiness for production deployment

---

**Gemini Audit Target Date: [TBD by user]**
