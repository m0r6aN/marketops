"""
Tests for GitHub Publisher Phase 2
===================================

Proves that the GitHub Publisher enforces all authorization constraints:
1. Mode must be "prod" (fail-closed)
2. Receipt must be present (fail-closed)
3. Receipt must be enforceable (advisory receipts rejected)
4. Receipt bound to run_id and operation_kind (no replay across boundaries)
5. All operations audited
6. One-time receipt consumption (replay prevention)
"""

import pytest
from datetime import datetime, timedelta
from github_publisher_phase2 import (
    GitHubPublisher,
    EnforceableReceipt,
    OperationKind,
    ReceiptValidationError,
    ModeViolationError,
    ReceiptBindingValidator,
)


class TestGitHubPublisherModeEnforcement:
    """Prove mode must be 'prod' (fail-closed)"""
    
    def test_mode_must_be_exactly_prod(self):
        """Mode 'prod' must be exactly that - not 'Prod', 'PROD', 'production', etc."""
        # Valid modes
        pub_prod = GitHubPublisher("fake-token", mode="prod")
        assert pub_prod.mode == "prod"
        
        pub_dry = GitHubPublisher("fake-token", mode="dry_run")
        assert pub_dry.mode == "dry_run"
    
    def test_invalid_mode_raises_immediately(self):
        """Invalid modes raise ModeViolationError at construction time"""
        with pytest.raises(ModeViolationError):
            GitHubPublisher("fake-token", mode="PROD")
        
        with pytest.raises(ModeViolationError):
            GitHubPublisher("fake-token", mode="Prod")
        
        with pytest.raises(ModeViolationError):
            GitHubPublisher("fake-token", mode="production")
        
        with pytest.raises(ModeViolationError):
            GitHubPublisher("fake-token", mode="")
    
    def test_dry_run_mode_blocks_all_operations(self):
        """Dry-run mode must reject all operations (fail-closed)"""
        pub = GitHubPublisher("fake-token", mode="dry_run")
        receipt = _make_valid_receipt("run-1", OperationKind.PUBLISH_RELEASE)
        
        with pytest.raises(ModeViolationError) as exc_info:
            pub.publish_release(
                run_id="run-1",
                receipt=receipt,
                repository="owner/repo",
                tag_name="v1.0.0",
                release_name="Release 1.0.0",
                body="Release notes"
            )
        assert "prod" in str(exc_info.value).lower()


class TestGitHubPublisherReceiptEnforcement:
    """Prove receipt is required (fail-closed)"""
    
    def test_publish_release_requires_receipt(self):
        """publish_release must fail if receipt is None"""
        pub = GitHubPublisher("fake-token", mode="prod")
        
        with pytest.raises(ReceiptValidationError) as exc_info:
            pub.publish_release(
                run_id="run-1",
                receipt=None,
                repository="owner/repo",
                tag_name="v1.0.0",
                release_name="Release 1.0.0",
                body="Release notes"
            )
        assert "receipt" in str(exc_info.value).lower()
    
    def test_tag_repo_requires_receipt(self):
        """tag_repo must fail if receipt is None"""
        pub = GitHubPublisher("fake-token", mode="prod")
        
        with pytest.raises(ReceiptValidationError):
            pub.tag_repo(
                run_id="run-1",
                receipt=None,
                repository="owner/repo",
                tag_name="v1.0.0",
                target_sha="abc123",
                message="Tag message"
            )
    
    def test_open_pr_requires_receipt(self):
        """open_pr must fail if receipt is None"""
        pub = GitHubPublisher("fake-token", mode="prod")
        
        with pytest.raises(ReceiptValidationError):
            pub.open_pr(
                run_id="run-1",
                receipt=None,
                repository="owner/repo",
                title="PR Title",
                body="PR body",
                head_branch="feature/branch",
                base_branch="main"
            )


class TestGitHubPublisherAdvisoryRejection:
    """Prove advisory receipts (enforceable=false) are rejected for authorization"""
    
    def test_advisory_receipt_rejected_for_publish_release(self):
        """Advisory receipts cannot authorize operations"""
        pub = GitHubPublisher("fake-token", mode="prod")
        advisory = _make_advisory_receipt("run-1", OperationKind.PUBLISH_RELEASE)
        
        with pytest.raises(ReceiptValidationError) as exc_info:
            pub.publish_release(
                run_id="run-1",
                receipt=advisory,
                repository="owner/repo",
                tag_name="v1.0.0",
                release_name="Release 1.0.0",
                body="Release notes"
            )
        assert "advisory" in str(exc_info.value).lower()
        assert "cannot" in str(exc_info.value).lower()
    
    def test_advisory_receipt_rejected_for_tag_repo(self):
        """Advisory receipts rejected for tag_repo"""
        pub = GitHubPublisher("fake-token", mode="prod")
        advisory = _make_advisory_receipt("run-1", OperationKind.TAG_REPO)
        
        with pytest.raises(ReceiptValidationError):
            pub.tag_repo(
                run_id="run-1",
                receipt=advisory,
                repository="owner/repo",
                tag_name="v1.0.0",
                target_sha="abc123",
                message="Tag message"
            )


class TestGitHubPublisherReceiptBinding:
    """Prove receipt binding prevents replay attacks"""
    
    def test_receipt_run_id_must_match(self):
        """Receipt must be for specific run_id (no cross-run replay)"""
        pub = GitHubPublisher("fake-token", mode="prod")
        receipt = _make_valid_receipt("run-1", OperationKind.PUBLISH_RELEASE)
        
        with pytest.raises(ReceiptValidationError) as exc_info:
            pub.publish_release(
                run_id="run-2",  # Different run_id
                receipt=receipt,
                repository="owner/repo",
                tag_name="v1.0.0",
                release_name="Release 1.0.0",
                body="Release notes"
            )
        assert "run_id" in str(exc_info.value)
        assert "cross-run" in str(exc_info.value).lower()
    
    def test_receipt_operation_kind_must_match(self):
        """Receipt must be for specific operation_kind (no cross-operation replay)"""
        pub = GitHubPublisher("fake-token", mode="prod")
        receipt = _make_valid_receipt("run-1", OperationKind.PUBLISH_RELEASE)
        
        with pytest.raises(ReceiptValidationError) as exc_info:
            pub.tag_repo(  # Different operation
                run_id="run-1",
                receipt=receipt,  # Receipt is for publish_release, not tag_repo
                repository="owner/repo",
                tag_name="v1.0.0",
                target_sha="abc123",
                message="Tag message"
            )
        assert "operation_kind" in str(exc_info.value)
        assert "cross-operation" in str(exc_info.value).lower()


class TestGitHubPublisherOneTimeUse:
    """Prove receipts are one-time use (replay prevention)"""
    
    def test_consumed_receipt_cannot_be_reused(self):
        """Receipt marked consumed cannot be used again"""
        pub = GitHubPublisher("fake-token", mode="prod")
        receipt = _make_valid_receipt("run-1", OperationKind.PUBLISH_RELEASE)
        
        # First use succeeds
        result = pub.publish_release(
            run_id="run-1",
            receipt=receipt,
            repository="owner/repo",
            tag_name="v1.0.0",
            release_name="Release 1.0.0",
            body="Release notes"
        )
        assert result["status"] == "success"
        assert receipt.consumed is True
        
        # Second use with same receipt fails
        with pytest.raises(ReceiptValidationError) as exc_info:
            pub.publish_release(
                run_id="run-1",
                receipt=receipt,  # Already consumed
                repository="owner/repo",
                tag_name="v1.0.1",
                release_name="Release 1.0.1",
                body="More release notes"
            )
        assert "already consumed" in str(exc_info.value).lower()
        assert "replay" in str(exc_info.value).lower()


class TestGitHubPublisherExpiration:
    """Prove expired receipts are rejected"""
    
    def test_expired_receipt_rejected(self):
        """Receipts past expiration time are rejected"""
        pub = GitHubPublisher("fake-token", mode="prod")
        
        # Create receipt that expired 1 hour ago
        now = datetime.utcnow()
        receipt = EnforceableReceipt(
            receipt_id="receipt-123",
            run_id="run-1",
            operation_kind=OperationKind.PUBLISH_RELEASE.value,
            enforceable=True,
            issued_at=(now - timedelta(hours=25)).isoformat() + "Z",
            expires_at=(now - timedelta(hours=1)).isoformat() + "Z"
        )
        
        with pytest.raises(ReceiptValidationError) as exc_info:
            pub.publish_release(
                run_id="run-1",
                receipt=receipt,
                repository="owner/repo",
                tag_name="v1.0.0",
                release_name="Release 1.0.0",
                body="Release notes"
            )
        assert "expired" in str(exc_info.value).lower()


class TestGitHubPublisherStaleness:
    """Prove very old receipts are rejected (defense against time-shift attacks)"""
    
    def test_stale_receipt_rejected(self):
        """Receipts older than 24 hours are rejected"""
        pub = GitHubPublisher("fake-token", mode="prod")
        
        # Create receipt issued 25 hours ago
        now = datetime.utcnow()
        receipt = EnforceableReceipt(
            receipt_id="receipt-456",
            run_id="run-1",
            operation_kind=OperationKind.PUBLISH_RELEASE.value,
            enforceable=True,
            issued_at=(now - timedelta(hours=25)).isoformat() + "Z",
            expires_at=(now + timedelta(hours=1)).isoformat() + "Z"  # Still valid expiration
        )
        
        with pytest.raises(ReceiptValidationError) as exc_info:
            pub.publish_release(
                run_id="run-1",
                receipt=receipt,
                repository="owner/repo",
                tag_name="v1.0.0",
                release_name="Release 1.0.0",
                body="Release notes"
            )
        assert "stale" in str(exc_info.value).lower()


class TestGitHubPublisherAuditTrail:
    """Prove all operations are audited"""
    
    def test_successful_operation_creates_audit_record(self):
        """Successful operations create audit records"""
        pub = GitHubPublisher("fake-token", mode="prod")
        receipt = _make_valid_receipt("run-1", OperationKind.PUBLISH_RELEASE)
        
        result = pub.publish_release(
            run_id="run-1",
            receipt=receipt,
            repository="owner/repo",
            tag_name="v1.0.0",
            release_name="Release 1.0.0",
            body="Release notes"
        )
        
        audit_records = pub.get_audit_trail()
        assert len(audit_records) == 1
        
        record = audit_records[0]
        assert record["status"] == "success"
        assert record["run_id"] == "run-1"
        assert record["receipt_id"] == receipt.receipt_id
        assert record["mode"] == "prod"
        assert "operation_id" in record
    
    def test_failed_operation_creates_audit_record(self):
        """Failed operations create audit records with error info"""
        pub = GitHubPublisher("fake-token", mode="prod")
        receipt = _make_valid_receipt("run-1", OperationKind.PUBLISH_RELEASE)
        
        # Use wrong mode
        pub.mode = "dry_run"
        
        try:
            pub.publish_release(
                run_id="run-1",
                receipt=receipt,
                repository="owner/repo",
                tag_name="v1.0.0",
                release_name="Release 1.0.0",
                body="Release notes"
            )
        except ModeViolationError:
            pass
        
        audit_records = pub.get_audit_trail()
        assert len(audit_records) == 1
        
        record = audit_records[0]
        assert "rejected" in record["status"].lower() or "failed" in record["status"].lower()
        assert record["error_message"] is not None
    
    def test_multiple_operations_tracked_in_audit(self):
        """Multiple operations all appear in audit trail"""
        pub = GitHubPublisher("fake-token", mode="prod")
        
        # First operation
        receipt1 = _make_valid_receipt("run-1", OperationKind.PUBLISH_RELEASE)
        pub.publish_release(
            run_id="run-1",
            receipt=receipt1,
            repository="owner/repo",
            tag_name="v1.0.0",
            release_name="Release 1.0.0",
            body="Release notes"
        )
        
        # Second operation
        receipt2 = _make_valid_receipt("run-2", OperationKind.TAG_REPO)
        pub.tag_repo(
            run_id="run-2",
            receipt=receipt2,
            repository="owner/repo",
            tag_name="v2.0.0",
            target_sha="def456",
            message="Tag 2.0.0"
        )
        
        audit_records = pub.get_audit_trail()
        assert len(audit_records) == 2
        assert audit_records[0]["run_id"] == "run-1"
        assert audit_records[1]["run_id"] == "run-2"


class TestReceiptBindingValidator:
    """Test receipt binding validator directly"""
    
    def test_validator_detects_cross_run_replay(self):
        """Validator catches attempts to use receipt in different run"""
        validator = ReceiptBindingValidator()
        receipt = _make_valid_receipt("run-1", OperationKind.PUBLISH_RELEASE)
        
        with pytest.raises(ReceiptValidationError) as exc_info:
            validator.validate_binding(
                receipt,
                expected_run_id="run-2",
                expected_operation=OperationKind.PUBLISH_RELEASE
            )
        assert "run_id" in str(exc_info.value)
    
    def test_validator_detects_cross_operation_replay(self):
        """Validator catches attempts to use receipt for different operation"""
        validator = ReceiptBindingValidator()
        receipt = _make_valid_receipt("run-1", OperationKind.PUBLISH_RELEASE)
        
        with pytest.raises(ReceiptValidationError) as exc_info:
            validator.validate_binding(
                receipt,
                expected_run_id="run-1",
                expected_operation=OperationKind.TAG_REPO
            )
        assert "operation_kind" in str(exc_info.value)


class TestEndToEndGitHubPublisherFlow:
    """End-to-end test of complete publisher flow"""
    
    def test_complete_authorization_and_publication_flow(self):
        """Prove complete flow: authorization → operation → audit"""
        pub = GitHubPublisher("fake-token", mode="prod")
        
        # Step 1: Get valid receipt
        receipt = _make_valid_receipt("campaign-2024-01", OperationKind.PUBLISH_RELEASE)
        assert receipt.enforceable is True
        assert receipt.consumed is False
        
        # Step 2: Execute operation with authorization
        result = pub.publish_release(
            run_id="campaign-2024-01",
            receipt=receipt,
            repository="omega/marketops",
            tag_name="v0.2.0",
            release_name="MarketOps Release v0.2.0",
            body="Phase 2 release with GitHub publisher integration"
        )
        
        # Step 3: Verify operation succeeded
        assert result["status"] == "success"
        assert receipt.consumed is True
        assert "github_response" in result["audit_record"]
        
        # Step 4: Verify audit trail
        audit_trail = pub.get_audit_trail()
        assert len(audit_trail) == 1
        audit = audit_trail[0]
        assert audit["status"] == "success"
        assert audit["run_id"] == "campaign-2024-01"
        assert audit["operation_kind"] == "publish_release"
        assert audit["receipt_id"] == receipt.receipt_id
        
        # Step 5: Verify replay is prevented
        with pytest.raises(ReceiptValidationError):
            pub.publish_release(
                run_id="campaign-2024-01",
                receipt=receipt,  # Already consumed
                repository="omega/marketops",
                tag_name="v0.3.0",
                release_name="v0.3.0",
                body="Attempt to replay"
            )


# Helpers to create test receipts
def _make_valid_receipt(run_id: str, operation_kind: OperationKind) -> EnforceableReceipt:
    """Create a valid, non-consumed receipt"""
    now = datetime.utcnow()
    return EnforceableReceipt(
        receipt_id=f"receipt-{run_id}-{operation_kind.value}",
        run_id=run_id,
        operation_kind=operation_kind.value,
        enforceable=True,
        issued_at=now.isoformat() + "Z",
        expires_at=(now + timedelta(hours=1)).isoformat() + "Z",
        consumed=False,
        consumed_at=None
    )


def _make_advisory_receipt(run_id: str, operation_kind: OperationKind) -> EnforceableReceipt:
    """Create an advisory (non-enforceable) receipt"""
    now = datetime.utcnow()
    return EnforceableReceipt(
        receipt_id=f"advisory-{run_id}-{operation_kind.value}",
        run_id=run_id,
        operation_kind=operation_kind.value,
        enforceable=False,  # Advisory, not enforceable
        issued_at=now.isoformat() + "Z",
        expires_at=(now + timedelta(hours=1)).isoformat() + "Z",
        consumed=False,
        consumed_at=None
    )


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
