"""
Tests for Federation Core ReceiptGenerator
==========================================

Proves FC is the ONLY MINT for enforceable receipts.

Key Invariants:
- Only FC can issue enforceable receipts
- Advisory receipts explicitly marked non-enforceable
- Policy validation determines enforceable vs advisory
- Receipts are one-time use (consumed after use)
- Receipt signature proves FC authority
- Receipt binding prevents replay
"""

import pytest
from datetime import datetime, timedelta
from federation_core_receipt_generator import (
    ReceiptGenerator,
    AuthorizationPolicy,
    AuthorizationPolicyValidator,
    OperationContext,
    AuthorizationEvidence,
    AuthorizationDecision,
    OperationKind,
    PolicyViolationError,
    UnauthorizedOperationError,
    AuthorizationError,
    FederationCoreBridge,
)


@pytest.fixture
def authorization_policy():
    """Create a test authorization policy"""
    return AuthorizationPolicy(
        policy_id="policy-test-v1",
        version="1.0",
        rules={
            "publish_release": {
                "allowed_repositories": ["omega/*", "marketops/*"],
                "require_evidence": []
            },
            "tag_repo": {
                "allowed_repositories": ["omega/*", "marketops/*"],
                "require_evidence": []
            },
            "open_pr": {
                "allowed_repositories": ["omega/*", "marketops/*"],
                "require_evidence": []
            }
        }
    )


@pytest.fixture
def receipt_generator(authorization_policy):
    """Create a test ReceiptGenerator"""
    return ReceiptGenerator(
        fc_id="federation-core-test",
        fc_secret="test-secret-key",
        policy=authorization_policy
    )


class TestFCIsOnlyMint:
    """Prove FC is the ONLY MINT for enforceable receipts"""
    
    def test_receipt_generator_is_fc(self, receipt_generator):
        """Receipt generator represents FC authority"""
        assert receipt_generator.fc_id == "federation-core-test"
    
    def test_receipt_signed_by_fc(self, receipt_generator):
        """All receipts are signed by FC"""
        context = OperationContext(
            run_id="run-1",
            operation_kind=OperationKind.PUBLISH_RELEASE,
            repository="omega/test",
            payload={}
        )
        
        receipt = receipt_generator.authorize_and_issue_receipt(context)
        
        assert receipt.signature is not None
        assert receipt.issuer == "federation-core-test"
        assert receipt.verify_signature(receipt_generator.fc_secret)
    
    def test_receipt_cannot_be_forged(self, receipt_generator):
        """Receipt signature proves FC authority"""
        context = OperationContext(
            run_id="run-1",
            operation_kind=OperationKind.PUBLISH_RELEASE,
            repository="omega/test",
            payload={}
        )
        
        receipt = receipt_generator.authorize_and_issue_receipt(context)
        
        # Try to verify with wrong secret
        assert not receipt.verify_signature("wrong-secret")
    
    def test_all_issued_receipts_tracked(self, receipt_generator):
        """FC tracks all issued receipts"""
        context1 = OperationContext(
            run_id="run-1",
            operation_kind=OperationKind.PUBLISH_RELEASE,
            repository="omega/test1",
            payload={}
        )
        context2 = OperationContext(
            run_id="run-2",
            operation_kind=OperationKind.TAG_REPO,
            repository="omega/test2",
            payload={}
        )
        
        receipt1 = receipt_generator.authorize_and_issue_receipt(context1)
        receipt2 = receipt_generator.authorize_and_issue_receipt(context2)
        
        issued = receipt_generator.get_issued_receipts()
        assert len(issued) == 2
        assert issued[0]["receipt_id"] == receipt1.receipt_id
        assert issued[1]["receipt_id"] == receipt2.receipt_id


class TestEnforceableVsAdvisory:
    """Prove enforceable vs advisory distinction"""
    
    def test_approved_operation_gets_enforceable_receipt(self, receipt_generator):
        """Operations passing policy get enforceable receipts"""
        context = OperationContext(
            run_id="run-1",
            operation_kind=OperationKind.PUBLISH_RELEASE,
            repository="omega/marketops",  # Matches allowed list
            payload={}
        )
        
        receipt = receipt_generator.authorize_and_issue_receipt(context)
        
        assert receipt.enforceable is True
    
    def test_denied_operation_gets_advisory_receipt(self, receipt_generator):
        """Operations failing policy get advisory receipts"""
        context = OperationContext(
            run_id="run-1",
            operation_kind=OperationKind.PUBLISH_RELEASE,
            repository="random-org/repo",  # Does NOT match allowed list
            payload={}
        )
        
        receipt = receipt_generator.authorize_and_issue_receipt(context)
        
        assert receipt.enforceable is False
    
    def test_advisory_receipt_explicitly_marked(self, receipt_generator):
        """Advisory receipts clearly marked as not enforceable"""
        context = OperationContext(
            run_id="run-1",
            operation_kind=OperationKind.PUBLISH_RELEASE,
            repository="blocked-org/repo",
            payload={}
        )
        
        receipt = receipt_generator.authorize_and_issue_receipt(context)
        
        # Advisory MUST have enforceable=false
        assert receipt.enforceable is False
        assert receipt.issuer == "federation-core-test"  # Still from FC
        assert receipt.signature is not None  # Still signed


class TestReceiptPolicy:
    """Prove policy validation works"""
    
    def test_policy_validator_checks_repository(self):
        """Validator checks repository against allowed list"""
        policy = AuthorizationPolicy(
            policy_id="test",
            version="1.0",
            rules={
                "publish_release": {
                    "allowed_repositories": ["omega/*"]
                }
            }
        )
        validator = AuthorizationPolicyValidator(policy)
        
        # Should pass
        context_ok = OperationContext(
            run_id="run-1",
            operation_kind=OperationKind.PUBLISH_RELEASE,
            repository="omega/test",
            payload={}
        )
        evidence = AuthorizationEvidence(
            checked_at=datetime.utcnow().isoformat() + "Z",
            policy_id="test",
            decision=AuthorizationDecision.APPROVED,
            reason=""
        )
        assert validator.validate_operation(context_ok, evidence) is True
        
        # Should fail
        context_bad = OperationContext(
            run_id="run-1",
            operation_kind=OperationKind.PUBLISH_RELEASE,
            repository="random/test",
            payload={}
        )
        with pytest.raises(PolicyViolationError):
            validator.validate_operation(context_bad, evidence)


class TestReceiptBinding:
    """Prove receipts are bound to operations"""
    
    def test_receipt_bound_to_run_id(self, receipt_generator):
        """Receipt bound to specific run_id"""
        context = OperationContext(
            run_id="run-123",
            operation_kind=OperationKind.PUBLISH_RELEASE,
            repository="omega/test",
            payload={}
        )
        
        receipt = receipt_generator.authorize_and_issue_receipt(context)
        
        assert receipt.run_id == "run-123"
    
    def test_receipt_bound_to_operation_kind(self, receipt_generator):
        """Receipt bound to specific operation_kind"""
        context = OperationContext(
            run_id="run-1",
            operation_kind=OperationKind.TAG_REPO,
            repository="omega/test",
            payload={}
        )
        
        receipt = receipt_generator.authorize_and_issue_receipt(context)
        
        assert receipt.operation_kind == "tag_repo"


class TestReceiptLifecycle:
    """Prove receipt lifecycle management"""
    
    def test_receipt_has_expiration(self, receipt_generator):
        """Receipts have expiration time"""
        context = OperationContext(
            run_id="run-1",
            operation_kind=OperationKind.PUBLISH_RELEASE,
            repository="omega/test",
            payload={}
        )
        
        receipt = receipt_generator.authorize_and_issue_receipt(context)
        
        assert receipt.expires_at is not None
        expires = datetime.fromisoformat(receipt.expires_at.replace("Z", "+00:00"))
        now = datetime.utcnow().replace(tzinfo=expires.tzinfo)
        
        # Should expire in future
        assert expires > now
    
    def test_receipt_has_issue_time(self, receipt_generator):
        """Receipts record issue time"""
        context = OperationContext(
            run_id="run-1",
            operation_kind=OperationKind.PUBLISH_RELEASE,
            repository="omega/test",
            payload={}
        )
        
        before = datetime.utcnow()
        receipt = receipt_generator.authorize_and_issue_receipt(context)
        after = datetime.utcnow()
        
        issued = datetime.fromisoformat(receipt.issued_at.replace("Z", "+00:00"))
        before_tz = before.replace(tzinfo=issued.tzinfo)
        after_tz = after.replace(tzinfo=issued.tzinfo)
        
        assert before_tz <= issued <= after_tz
    
    def test_receipt_not_consumed_initially(self, receipt_generator):
        """Receipts start unconsumed"""
        context = OperationContext(
            run_id="run-1",
            operation_kind=OperationKind.PUBLISH_RELEASE,
            repository="omega/test",
            payload={}
        )
        
        receipt = receipt_generator.authorize_and_issue_receipt(context)
        
        assert receipt.consumed is False
        assert receipt.consumed_at is None


class TestReceiptConsumption:
    """Prove receipts are one-time use"""
    
    def test_receipt_can_be_verified_and_consumed(self, receipt_generator):
        """FC can verify and consume receipts"""
        context = OperationContext(
            run_id="run-1",
            operation_kind=OperationKind.PUBLISH_RELEASE,
            repository="omega/test",
            payload={}
        )
        
        receipt = receipt_generator.authorize_and_issue_receipt(context)
        
        # Should verify successfully
        assert receipt_generator.verify_and_consume_receipt(receipt) is True
        
        # Should be marked consumed
        assert receipt.consumed is True
        assert receipt.consumed_at is not None
    
    def test_consumed_receipt_cannot_be_verified_again(self, receipt_generator):
        """Consumed receipts cannot be reused"""
        context = OperationContext(
            run_id="run-1",
            operation_kind=OperationKind.PUBLISH_RELEASE,
            repository="omega/test",
            payload={}
        )
        
        receipt = receipt_generator.authorize_and_issue_receipt(context)
        
        # First consumption succeeds
        receipt_generator.verify_and_consume_receipt(receipt)
        
        # Second consumption fails
        with pytest.raises(AuthorizationError) as exc_info:
            receipt_generator.verify_and_consume_receipt(receipt)
        assert "already consumed" in str(exc_info.value).lower()


class TestFCAuthority:
    """Prove FC authority cannot be spoofed"""
    
    def test_invalid_signature_rejected(self, receipt_generator):
        """Receipts with invalid signatures are rejected"""
        context = OperationContext(
            run_id="run-1",
            operation_kind=OperationKind.PUBLISH_RELEASE,
            repository="omega/test",
            payload={}
        )
        
        receipt = receipt_generator.authorize_and_issue_receipt(context)
        
        # Tamper with receipt
        receipt.signature = "invalid-signature"
        
        # Should reject
        with pytest.raises(AuthorizationError) as exc_info:
            receipt_generator.verify_and_consume_receipt(receipt)
        assert "invalid signature" in str(exc_info.value).lower()
    
    def test_forged_receipt_rejected(self, receipt_generator):
        """Receipts not issued by this FC are rejected"""
        from federation_core_receipt_generator import EnforceableReceipt
        
        # Create a receipt manually (not issued by this FC)
        forged = EnforceableReceipt(
            receipt_id="forged-receipt",
            run_id="run-1",
            operation_kind="publish_release",
            enforceable=True,
            issued_at=datetime.utcnow().isoformat() + "Z",
            expires_at=(datetime.utcnow() + timedelta(hours=1)).isoformat() + "Z"
        )
        forged.sign("different-secret")
        
        # Should reject (not in issued_receipts)
        with pytest.raises(AuthorizationError) as exc_info:
            receipt_generator.verify_and_consume_receipt(forged)
        assert "not issued by this FC" in str(exc_info.value).lower()


class TestAuditTrail:
    """Prove FC audit trail"""
    
    def test_all_issuances_audited(self, receipt_generator):
        """FC logs all receipt issuances"""
        context1 = OperationContext(
            run_id="run-1",
            operation_kind=OperationKind.PUBLISH_RELEASE,
            repository="omega/test1",
            payload={}
        )
        context2 = OperationContext(
            run_id="run-2",
            operation_kind=OperationKind.TAG_REPO,
            repository="blocked/test2",  # Will be advisory
            payload={}
        )
        
        receipt1 = receipt_generator.authorize_and_issue_receipt(context1)
        receipt2 = receipt_generator.authorize_and_issue_receipt(context2)
        
        audit = receipt_generator.get_issuance_audit()
        
        assert len(audit) == 2
        assert audit[0]["receipt_id"] == receipt1.receipt_id
        assert audit[0]["enforceable"] is True
        assert audit[1]["receipt_id"] == receipt2.receipt_id
        assert audit[1]["enforceable"] is False


class TestFederationCoreBridge:
    """Test FC to GitHub Publisher bridge"""
    
    def test_bridge_authorizes_publication_plan(self, receipt_generator):
        """Bridge can authorize complete publication plan"""
        publication_plan = {
            "run_id": "campaign-2024-01",
            "operations": [
                {
                    "operation_id": "op-1",
                    "operation_kind": "PUBLISH_RELEASE",
                    "repository": "omega/marketops",
                    "tag_name": "v1.0.0",
                    "release_name": "Release 1.0.0",
                    "body": "Release notes"
                },
                {
                    "operation_id": "op-2",
                    "operation_kind": "TAG_REPO",
                    "repository": "blocked-org/repo",  # Will be blocked
                    "tag_name": "tag-1",
                    "target_sha": "abc123",
                    "message": "Tag message"
                }
            ]
        }
        
        bridge = FederationCoreBridge(receipt_generator, None)
        
        result = bridge.authorize_publication_plan(
            publication_plan,
            approver_evidence={"approvers": ["approver-1"]}
        )
        
        assert result["run_id"] == "campaign-2024-01"
        assert result["authorized_operations"] == 1  # Only op-1
        assert len(result["blocked_operations"]) == 1  # op-2 blocked
        assert result["execution_ready"] is False  # Some operations blocked


class TestEndToEndAuthorizationFlow:
    """End-to-end test of authorization flow"""
    
    def test_complete_authorization_flow(self, receipt_generator):
        """Prove complete flow: plan → authorize → receipt → (would execute)"""
        # Step 1: Operation needs authorization
        context = OperationContext(
            run_id="campaign-2024-01",
            operation_kind=OperationKind.PUBLISH_RELEASE,
            repository="omega/marketops",
            payload={
                "tag_name": "v1.0.0",
                "release_name": "Release 1.0.0",
                "body": "Release notes"
            },
            evidence={"approver": "admin-1"}
        )
        
        # Step 2: FC reviews and issues receipt
        receipt = receipt_generator.authorize_and_issue_receipt(context)
        
        # Step 3: Receipt is enforceable (authorization granted)
        assert receipt.enforceable is True
        assert receipt.run_id == "campaign-2024-01"
        assert receipt.operation_kind == "publish_release"
        
        # Step 4: Receipt could be passed to GitHub Publisher
        # (in real flow, would call pub.publish_release(..., receipt=receipt))
        
        # Step 5: FC verifies and consumes receipt
        assert receipt_generator.verify_and_consume_receipt(receipt) is True
        assert receipt.consumed is True
        
        # Step 6: Replay prevented
        with pytest.raises(AuthorizationError):
            receipt_generator.verify_and_consume_receipt(receipt)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
