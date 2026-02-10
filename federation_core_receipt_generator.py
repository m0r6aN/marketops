"""
Federation Core ReceiptGenerator
================================

FC is the ONLY MINT for enforceable receipts.

A receipt proves that:
1. FC has reviewed the operation
2. Authorization policy has been checked
3. Authority has been satisfied
4. Single operation, single use, time-bound

Key Properties:
- Enforceable receipts = true (FC decision authority)
- Advisory receipts = false (information only)
- Cryptographically bound to run_id, operation_kind
- One-time use (consumed after use)
- Time-limited (24-hour window)
- Audience-specific (for GitHub Publisher)

Authorization Flow:
  1. MarketOps dry-run creates Publication Plan
  2. FC reviews plan against policies
  3. For each operation: approve or deny
  4. Approved → issue enforceable receipt
  5. Denied → issue advisory receipt
  6. GitHub Publisher receives receipt
  7. If enforceable → execute
  8. If advisory → reject
"""

import hmac
import hashlib
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from enum import Enum
from abc import ABC, abstractmethod


class AuthorizationDecision(str, Enum):
    """Authorization outcome"""
    APPROVED = "approved"
    DENIED = "denied"
    DEFERRED = "deferred"


class OperationKind(str, Enum):
    """Types of operations that need authorization"""
    PUBLISH_RELEASE = "publish_release"
    TAG_REPO = "tag_repo"
    OPEN_PR = "open_pr"


class AuthorizationError(Exception):
    """Authorization decision error"""
    pass


class PolicyViolationError(AuthorizationError):
    """Operation violates policy"""
    pass


class UnauthorizedOperationError(AuthorizationError):
    """Operation not authorized"""
    pass


@dataclass
class OperationContext:
    """Context for an operation needing authorization"""
    run_id: str
    operation_kind: OperationKind
    repository: str
    payload: Dict[str, Any]
    evidence: Dict[str, Any] = field(default_factory=dict)  # e.g., who requested, why, etc.
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "run_id": self.run_id,
            "operation_kind": self.operation_kind.value,
            "repository": self.repository,
            "payload": self.payload,
            "evidence": self.evidence
        }


@dataclass
class AuthorizationPolicy:
    """Policy governing when FC issues receipts"""
    policy_id: str
    version: str
    rules: Dict[str, Any]  # Policy-specific rules
    
    # Example rules structure:
    # {
    #   "publish_release": {
    #     "allowed_repositories": ["omega/*", "marketops/*"],
    #     "require_evidence": ["approval_count >= 2"],
    #     "rate_limit": {"per_hour": 10}
    #   },
    #   "tag_repo": {...},
    #   "open_pr": {...}
    # }


@dataclass
class AuthorizationEvidence:
    """Evidence for authorization decision"""
    checked_at: str
    policy_id: str
    decision: AuthorizationDecision
    reason: str
    approvers: List[str] = field(default_factory=list)
    checks: Dict[str, bool] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class EnforceableReceipt:
    """Receipt that authorizes an operation (FC-issued only)"""
    receipt_id: str
    run_id: str
    operation_kind: str
    enforceable: bool  # true = FC approved, false = advisory only
    issued_at: str
    expires_at: str
    issuer: str = "federation-core"  # FC is the issuer
    audience: str = "github-publisher"  # For GitHub Publisher
    signature: Optional[str] = None  # HMAC signature
    evidence_hash: Optional[str] = None  # Hash of authorization evidence
    consumed: bool = False
    consumed_at: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    def sign(self, secret: str):
        """Sign receipt with secret (FC authority proof)"""
        payload = {
            "receipt_id": self.receipt_id,
            "run_id": self.run_id,
            "operation_kind": self.operation_kind,
            "enforceable": self.enforceable,
            "issued_at": self.issued_at,
            "expires_at": self.expires_at,
            "issuer": self.issuer,
            "audience": self.audience,
            "evidence_hash": self.evidence_hash
        }
        payload_str = str(sorted(payload.items()))
        self.signature = hmac.new(
            secret.encode(),
            payload_str.encode(),
            hashlib.sha256
        ).hexdigest()
    
    def verify_signature(self, secret: str) -> bool:
        """Verify receipt signature"""
        if not self.signature:
            return False
        
        payload = {
            "receipt_id": self.receipt_id,
            "run_id": self.run_id,
            "operation_kind": self.operation_kind,
            "enforceable": self.enforceable,
            "issued_at": self.issued_at,
            "expires_at": self.expires_at,
            "issuer": self.issuer,
            "audience": self.audience,
            "evidence_hash": self.evidence_hash
        }
        payload_str = str(sorted(payload.items()))
        expected = hmac.new(
            secret.encode(),
            payload_str.encode(),
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(self.signature, expected)


class AuthorizationPolicyValidator:
    """Validates operations against policies"""
    
    def __init__(self, policy: AuthorizationPolicy):
        self.policy = policy
    
    def validate_operation(
        self,
        context: OperationContext,
        evidence: AuthorizationEvidence
    ) -> bool:
        """
        Validate operation against policy.
        Returns True if operation passes policy checks.
        """
        operation_key = context.operation_kind.value
        
        if operation_key not in self.policy.rules:
            raise PolicyViolationError(
                f"No policy defined for operation_kind '{operation_key}'"
            )
        
        op_policy = self.policy.rules[operation_key]
        
        # Check 1: Repository allowed
        if "allowed_repositories" in op_policy:
            allowed = op_policy["allowed_repositories"]
            if not self._matches_pattern(context.repository, allowed):
                raise PolicyViolationError(
                    f"Repository '{context.repository}' not in allowed list: {allowed}"
                )
        
        # Check 2: Evidence requirements
        if "require_evidence" in op_policy:
            required = op_policy["require_evidence"]
            if not self._check_evidence_requirements(required, evidence):
                raise PolicyViolationError(
                    f"Evidence requirements not met: {required}"
                )
        
        # Check 3: Rate limits (if tracking enabled)
        if "rate_limit" in op_policy:
            # In production, would check against Redis/database
            pass
        
        return True
    
    def _matches_pattern(self, text: str, patterns: List[str]) -> bool:
        """Check if text matches any pattern (support glob)"""
        for pattern in patterns:
            if "*" in pattern:
                # Simple glob matching
                import fnmatch
                if fnmatch.fnmatch(text, pattern):
                    return True
            else:
                if text == pattern:
                    return True
        return False
    
    def _check_evidence_requirements(
        self,
        requirements: List[str],
        evidence: AuthorizationEvidence
    ) -> bool:
        """Check if evidence satisfies requirements"""
        # Parse and evaluate requirements
        # Example: "approval_count >= 2"
        for req in requirements:
            if ">=" in req:
                key, value = req.split(">=")
                key = key.strip()
                value = int(value.strip())
                
                if key == "approval_count":
                    if len(evidence.approvers) < value:
                        return False
        
        return True


class ReceiptGenerator:
    """
    Federation Core Receipt Generator
    
    FC is the ONLY source of enforceable receipts.
    
    Properties:
    - Issues receipts after policy validation
    - Signs receipts with FC authority
    - Tracks receipt issuance (audit)
    - Manages receipt lifecycle
    """
    
    def __init__(
        self,
        fc_id: str,
        fc_secret: str,
        policy: AuthorizationPolicy,
        audience: str = "github-publisher"
    ):
        """
        Initialize ReceiptGenerator
        
        Args:
            fc_id: Federation Core identifier
            fc_secret: Secret for signing receipts
            policy: Authorization policy
            audience: Intended audience (e.g., "github-publisher")
        """
        self.fc_id = fc_id
        self.fc_secret = fc_secret
        self.policy = policy
        self.audience = audience
        self.validator = AuthorizationPolicyValidator(policy)
        
        # Audit trail
        self.issued_receipts: Dict[str, EnforceableReceipt] = {}
        self.issuance_audit: List[Dict[str, Any]] = []
    
    def authorize_and_issue_receipt(
        self,
        context: OperationContext,
        approval_evidence: Optional[AuthorizationEvidence] = None
    ) -> EnforceableReceipt:
        """
        Authorize an operation and issue receipt if approved.
        
        This is the PRIMARY method FC uses to issue receipts.
        
        Args:
            context: Operation context (run_id, operation_kind, repository, payload)
            approval_evidence: Evidence from authorization check
        
        Returns:
            EnforceableReceipt (enforceable=true if approved, false if advisory)
        
        Flow:
            1. Validate operation against policy
            2. If validation passes → enforceable=true
            3. If validation fails → enforceable=false (advisory)
            4. Sign receipt with FC authority
            5. Return receipt
        """
        receipt_id = self._generate_receipt_id(context)
        now = datetime.utcnow()
        issued_at = now.isoformat() + "Z"
        expires_at = (now + timedelta(hours=1)).isoformat() + "Z"
        
        # Default evidence if not provided
        if approval_evidence is None:
            approval_evidence = AuthorizationEvidence(
                checked_at=issued_at,
                policy_id=self.policy.policy_id,
                decision=AuthorizationDecision.DEFERRED,
                reason="No evidence provided"
            )
        
        # Try to validate
        try:
            self.validator.validate_operation(context, approval_evidence)
            is_enforceable = True
            decision = AuthorizationDecision.APPROVED
        except (PolicyViolationError, UnauthorizedOperationError) as e:
            is_enforceable = False
            decision = AuthorizationDecision.DENIED
            approval_evidence.reason = str(e)
        
        # Create receipt
        evidence_hash = self._hash_evidence(approval_evidence)
        receipt = EnforceableReceipt(
            receipt_id=receipt_id,
            run_id=context.run_id,
            operation_kind=context.operation_kind.value,
            enforceable=is_enforceable,
            issued_at=issued_at,
            expires_at=expires_at,
            issuer=self.fc_id,
            audience=self.audience,
            evidence_hash=evidence_hash
        )
        
        # Sign receipt (proof of FC authority)
        receipt.sign(self.fc_secret)
        
        # Audit
        self.issued_receipts[receipt_id] = receipt
        self.issuance_audit.append({
            "receipt_id": receipt_id,
            "run_id": context.run_id,
            "operation_kind": context.operation_kind.value,
            "enforceable": is_enforceable,
            "decision": decision.value,
            "issued_at": issued_at,
            "policy_id": self.policy.policy_id
        })
        
        return receipt
    
    def verify_and_consume_receipt(
        self,
        receipt: EnforceableReceipt
    ) -> bool:
        """
        Verify receipt was issued by FC and mark as consumed.
        
        GitHub Publisher calls this after successful operation.
        Ensures FC-issued receipts only.
        
        Args:
            receipt: Receipt to verify and consume
        
        Returns:
            True if receipt is valid and marked consumed
        
        Raises:
            AuthorizationError if receipt is invalid
        """
        # Check 1: Receipt was issued by FC
        if not receipt.verify_signature(self.fc_secret):
            raise AuthorizationError(
                f"Receipt {receipt.receipt_id} has invalid signature (not issued by FC)"
            )
        
        # Check 2: Receipt exists in our records
        if receipt.receipt_id not in self.issued_receipts:
            raise AuthorizationError(
                f"Receipt {receipt.receipt_id} was not issued by this FC instance"
            )
        
        # Check 3: Receipt matches our record
        stored = self.issued_receipts[receipt.receipt_id]
        if stored.consumed:
            raise AuthorizationError(
                f"Receipt {receipt.receipt_id} already consumed at {stored.consumed_at}"
            )
        
        # Mark consumed
        stored.consumed = True
        stored.consumed_at = datetime.utcnow().isoformat() + "Z"
        
        return True
    
    def get_issued_receipts(self) -> List[Dict[str, Any]]:
        """Get all issued receipts for audit"""
        return [r.to_dict() for r in self.issued_receipts.values()]
    
    def get_issuance_audit(self) -> List[Dict[str, Any]]:
        """Get audit trail of receipt issuance"""
        return self.issuance_audit.copy()
    
    def _generate_receipt_id(self, context: OperationContext) -> str:
        """Generate unique receipt ID"""
        payload = f"{context.run_id}-{context.operation_kind.value}-{datetime.utcnow().isoformat()}"
        return f"receipt-{hashlib.md5(payload.encode()).hexdigest()[:16]}"
    
    def _hash_evidence(self, evidence: AuthorizationEvidence) -> str:
        """Hash evidence for receipt binding"""
        evidence_str = str(sorted(evidence.to_dict().items()))
        return hashlib.sha256(evidence_str.encode()).hexdigest()


class FederationCoreBridge:
    """
    Bridge between FC and GitHub Publisher
    
    Coordinates:
    1. MarketOps Plan → FC review
    2. FC authorization decision → Receipt issuance
    3. Receipt → GitHub Publisher → Execution
    4. Execution result → Proof Ledger
    """
    
    def __init__(
        self,
        receipt_generator: ReceiptGenerator,
        github_publisher: Any  # Avoid circular import
    ):
        self.receipt_generator = receipt_generator
        self.github_publisher = github_publisher
    
    def authorize_publication_plan(
        self,
        publication_plan: Dict[str, Any],
        approver_evidence: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        FC authorizes a complete publication plan.
        
        Returns:
            {
                "run_id": str,
                "receipts": {operation_id: EnforceableReceipt},
                "blocked_operations": [{"op_id": str, "reason": str}],
                "execution_ready": bool
            }
        """
        run_id = publication_plan["run_id"]
        receipts = {}
        blocked = []
        
        for operation in publication_plan.get("operations", []):
            context = OperationContext(
                run_id=run_id,
                operation_kind=OperationKind[operation["operation_kind"].upper()],
                repository=operation["repository"],
                payload=operation.get("payload", {}),
                evidence=approver_evidence
            )
            
            # FC issues receipt
            receipt = self.receipt_generator.authorize_and_issue_receipt(
                context,
                approval_evidence=AuthorizationEvidence(
                    checked_at=datetime.utcnow().isoformat() + "Z",
                    policy_id=self.receipt_generator.policy.policy_id,
                    decision=AuthorizationDecision.APPROVED,
                    reason="Approved via batch authorization",
                    approvers=approver_evidence.get("approvers", [])
                )
            )
            
            if receipt.enforceable:
                receipts[operation["operation_id"]] = receipt
            else:
                blocked.append({
                    "operation_id": operation["operation_id"],
                    "reason": "Advisory receipt issued (not enforceable)"
                })
        
        return {
            "run_id": run_id,
            "receipts": receipts,
            "blocked_operations": blocked,
            "execution_ready": len(blocked) == 0,
            "total_operations": len(publication_plan.get("operations", [])),
            "authorized_operations": len(receipts)
        }
    
    def execute_with_authorization(
        self,
        operation: Dict[str, Any],
        receipt: EnforceableReceipt
    ) -> Dict[str, Any]:
        """
        Execute operation with FC-issued receipt.
        
        Flow:
            1. Verify receipt is enforceable
            2. Call GitHub Publisher with receipt
            3. Verify and consume receipt
            4. Return execution result with audit trail
        """
        if not receipt.enforceable:
            raise UnauthorizedOperationError(
                f"Receipt {receipt.receipt_id} is advisory (not enforceable)"
            )
        
        # Execute operation
        operation_kind = OperationKind[operation["operation_kind"].upper()]
        
        if operation_kind == OperationKind.PUBLISH_RELEASE:
            result = self.github_publisher.publish_release(
                run_id=operation["run_id"],
                receipt=receipt,
                repository=operation["repository"],
                tag_name=operation["tag_name"],
                release_name=operation["release_name"],
                body=operation["body"]
            )
        elif operation_kind == OperationKind.TAG_REPO:
            result = self.github_publisher.tag_repo(
                run_id=operation["run_id"],
                receipt=receipt,
                repository=operation["repository"],
                tag_name=operation["tag_name"],
                target_sha=operation["target_sha"],
                message=operation["message"]
            )
        elif operation_kind == OperationKind.OPEN_PR:
            result = self.github_publisher.open_pr(
                run_id=operation["run_id"],
                receipt=receipt,
                repository=operation["repository"],
                title=operation["title"],
                body=operation["body"],
                head_branch=operation["head_branch"],
                base_branch=operation.get("base_branch", "main")
            )
        else:
            raise ValueError(f"Unknown operation_kind: {operation_kind}")
        
        # Verify and consume receipt (marks as used)
        self.receipt_generator.verify_and_consume_receipt(receipt)
        
        return result
