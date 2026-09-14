/**
 * k1-context-conformance — Context Fabric conformance harness.
 *
 * Proves library/canon context assembly meets doctrine WITHOUT behavior
 * redesign: advisory-only bundles, provenance-bound units, tenant-scoped
 * retrieval (incl. cache keys), deterministic assembly, fail-closed on
 * unverifiable, never a receipt substitute.
 *
 * Mapping (verified against src/lib/library/*):
 * - Units built in repository.createLibraryEntry via processor candidates +
 *   marketing-review-writer.persistMarketingReview; provenance today =
 *   sourceDocumentId/importBatchId/initiativeSlug/sourceQuote/sourceLocation/
 *   sourceSection+Excerpt/modelUsed/createdAt + SourceDocument.contentHash.
 * - Retrieval boundaries: listLibraryEntries, listApprovedCanon,
 *   listPublicAutomationApproved/service.getAutomationApprovedEntries,
 *   service.getCanonView, searchLibraryEntries,
 *   brand-voice listEligibleBrandVoiceLibrarySources.
 * - No dedicated cache exists on library paths (only Next revalidatePath);
 *   cache-key test below locks the REQUIRED tenant-scoped shape for any
 *   future cache.
 */
import { describe, expect, test } from "vitest";

import {
  assembleContextBundle,
  buildLibraryContextCacheKey,
  collectHashMismatches,
  CrossTenantContextError,
  fingerprintContextUnits,
  hashAdvisoryContent,
  isProvenanceComplete,
  isSha256Hash,
  requireProvenance,
  tenantScopeCheck,
  verifyUnitContentHash,
  type ProvenanceUnit,
} from "@/lib/keon/context";
import {
  canonicalContentForLibraryEntry,
  libraryContextCacheKey,
  libraryEntryToProvenanceUnit,
} from "@/lib/library/service";
import type { LibraryEntry } from "@/lib/library/types";
import fixture from "./fixtures/advisory-excerpts.json";

const TENANT_A = "tenant-acme";
const TENANT_B = "tenant-other";
const CORR = "corr-conformance-001";
const NOW = new Date().toISOString();

function makeUnit(overrides: Partial<ProvenanceUnit> = {}): ProvenanceUnit {
  const excerpt =
    overrides.excerpt ??
    "Canon statement: the platform records a receipt for every governed effect.";
  return {
    sourceId: "entry-canon-001",
    contentHash: hashAdvisoryContent(excerpt),
    retrievedAtUtc: NOW,
    tenantId: TENANT_A,
    kind: "canon",
    title: "Platform receipts",
    excerpt,
    initiativeSlug: "keon-systems",
    ...overrides,
  };
}

function makeEntry(overrides: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    id: "entry-canon-001",
    sourceDocumentId: "doc-001",
    importBatchId: "batch-001",
    initiativeSlug: "keon-systems",
    entryType: "canon",
    title: "Platform receipts",
    content: "Fallback content body.",
    summary: null,
    visibility: "public",
    status: "approved",
    tags: [],
    confidenceScore: 0.9,
    memoryValueScore: 80,
    publicSafe: true,
    sensitive: false,
    sourceQuote: "exact quote",
    sourceLocation: "chunk 1 of 2",
    modelUsed: "test-model",
    canonCategory: "other",
    canonicalStatement:
      "Canon statement: the platform records a receipt for every governed effect.",
    locked: false,
    conflictStatus: null,
    publicAutomationAllowed: true,
    copyText: null,
    suggestedChannel: null,
    suggestedUse: null,
    emotionalAngle: null,
    audience: null,
    approvedForAutomation: true,
    internalCategory: null,
    sensitivityLevel: null,
    whyItMatters: null,
    reviewPriority: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    sourceSection: null,
    sourceExcerpt: null,
    marketingAngle: null,
    suggestedRewrite: null,
    useFor: null,
    reviewAudience: null,
    funnelStage: null,
    contentType: null,
    reviewConfidence: null,
    proofStrength: null,
    claimRisk: null,
    linkBackRequired: false,
    reviewSummaryId: null,
    rubricVersion: null,
    ...overrides,
  };
}

// Fields that would make context look like authority. They MUST NEVER appear
// as own properties on units or bundles (keon receipt/decision vocabulary).
const FORBIDDEN_AUTHORITY_FIELDS = [
  "decision",
  "policyDecision",
  "disposition",
  "authorization",
  "authorized",
  "approve",
  "approved",
  "allow",
  "allowed",
  "deny",
  "denied",
  "receipt",
  "receiptRef",
  "receipts",
  "verdict",
  "policyHash",
  "denialCode",
  "denialMessage",
  "signature",
  "epochRef",
  "entryHash",
  "prevHash",
];

describe("k1 context conformance", () => {
  test("fixture carries advisory excerpts only (no authority fields)", () => {
    expect(fixture.excerpts.length).toBeGreaterThanOrEqual(2);
    const raw = JSON.stringify(fixture);
    for (const field of ["decision", "receipt", "authorization", "verdict"]) {
      expect(raw).not.toContain(`"${field}"`);
    }
  });

  test("unprovenanced units excluded fail-closed (never defaulted)", () => {
    const valid = makeUnit();
    const missingHash = {
      sourceId: "bad-1",
      retrievedAtUtc: NOW,
      tenantId: TENANT_A,
      kind: "canon",
      title: "bad",
      excerpt: "x",
    };
    const bareHex = makeUnit({
      sourceId: "bad-2",
      contentHash:
        "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    });
    const emptySource = makeUnit({ sourceId: "   " });
    const candidates = [valid, missingHash, bareHex, emptySource, null, undefined];

    expect(isProvenanceComplete(valid)).toBe(true);
    expect(isProvenanceComplete(missingHash)).toBe(false);
    expect(isProvenanceComplete(bareHex)).toBe(false);
    expect(isSha256Hash(bareHex.contentHash)).toBe(false);

    const kept = requireProvenance(candidates);
    expect(kept).toHaveLength(1);
    expect(kept[0]?.sourceId).toBe(valid.sourceId);

    // Assembly is fail-closed too: excludes unverifiable instead of throwing.
    const bundle = assembleContextBundle({
      candidates,
      tenantId: TENANT_A,
      correlationId: CORR,
    });
    expect(bundle.advisoryOnly).toBe(true);
    expect(bundle.units).toHaveLength(1);
    expect(bundle.units[0]?.sourceId).toBe(valid.sourceId);
  });

  test("cross-tenant units rejected (fail-closed, no partial leak)", () => {
    const a = makeUnit({ sourceId: "a", tenantId: TENANT_A });
    const b = makeUnit({
      sourceId: "b",
      excerpt: "different excerpt for b",
      tenantId: TENANT_B,
    });
    // Fix b's hash to match its excerpt (makeUnit already does via excerpt).
    expect(() => tenantScopeCheck([a, b], TENANT_A)).toThrow(
      CrossTenantContextError,
    );
    try {
      tenantScopeCheck([a, b], TENANT_A);
      expect.unreachable("expected CrossTenantContextError");
    } catch (err) {
      expect(err).toBeInstanceOf(CrossTenantContextError);
      expect((err as CrossTenantContextError).rejectedSourceIds).toContain("b");
    }
    expect(() =>
      assembleContextBundle({
        candidates: [a, b],
        tenantId: TENANT_A,
        correlationId: CORR,
      }),
    ).toThrow(CrossTenantContextError);
    // Same-tenant passes.
    expect(tenantScopeCheck([a], TENANT_A)).toHaveLength(1);
  });

  test("tenant-scoped cache keys (no cache exists today; shape locked for future)", () => {
    // Verified: src/lib/library/* has no in-memory/dedicated cache (only Next
    // revalidatePath in app actions). This helper defines the REQUIRED shape
    // so a future cache cannot collide across tenants.
    const keyA = buildLibraryContextCacheKey(TENANT_A, "canon");
    const keyB = buildLibraryContextCacheKey(TENANT_B, "canon");
    expect(keyA).toContain(`tenant:${TENANT_A}`);
    expect(keyB).toContain(`tenant:${TENANT_B}`);
    expect(keyA).not.toBe(keyB);

    const sameA = buildLibraryContextCacheKey(TENANT_A, "canon");
    expect(sameA).toBe(keyA);
    expect(buildLibraryContextCacheKey(TENANT_A, "automation")).not.toBe(keyA);
    expect(
      buildLibraryContextCacheKey(TENANT_A, "canon", CORR),
    ).toContain(`corr:${CORR}`);
    expect(() => buildLibraryContextCacheKey("", "canon")).toThrow();
    expect(() => buildLibraryContextCacheKey(TENANT_A, "")).toThrow();

    // Library boundary delegates to the same helper (wiring proof).
    expect(libraryContextCacheKey(TENANT_A, "canon")).toBe(keyA);
    expect(libraryContextCacheKey(TENANT_A, "canon")).not.toBe(
      libraryContextCacheKey(TENANT_B, "canon"),
    );
  });

  test("identical inputs → identical fingerprint (order-independent, deterministic)", () => {
    const u1 = makeUnit({ sourceId: "entry-canon-001" });
    const u2 = makeUnit({
      sourceId: "entry-canon-002",
      title: "Evidence before publish",
      excerpt:
        "Canon statement: no publish occurs without attributable evidence and review.",
    });
    const fpForward = fingerprintContextUnits([u1, u2], TENANT_A, CORR);
    const fpReversed = fingerprintContextUnits([u2, u1], TENANT_A, CORR);
    expect(fpForward).toBe(fpReversed);
    expect(fpForward.startsWith("sha256:")).toBe(true);

    const b1 = assembleContextBundle({
      candidates: [u1, u2],
      tenantId: TENANT_A,
      correlationId: CORR,
    });
    const b2 = assembleContextBundle({
      candidates: [u2, u1],
      tenantId: TENANT_A,
      correlationId: CORR,
    });
    expect(b1.fingerprint).toBe(b2.fingerprint);
    // Sorted storage proves deterministic assembly.
    expect(b1.units.map((u) => u.sourceId)).toEqual([
      "entry-canon-001",
      "entry-canon-002",
    ]);

    // Any byte difference changes the fingerprint.
    const tampered = makeUnit({
      sourceId: "entry-canon-002",
      title: "Evidence before publish",
      excerpt: "Canon statement: edited excerpt changes the bundle.",
    });
    expect(
      fingerprintContextUnits([u1, tampered], TENANT_A, CORR),
    ).not.toBe(fpForward);
    expect(fingerprintContextUnits([u1, u2], TENANT_B, CORR)).not.toBe(
      fpForward,
    );
    expect(fingerprintContextUnits([u1, u2], TENANT_A, "other-corr")).not.toBe(
      fpForward,
    );
  });

  test("bundle type-distinct from receipts (advisory-only, no authority fields)", () => {
    const bundle = assembleContextBundle({
      candidates: [makeUnit(), makeUnit({ sourceId: "entry-canon-002" })],
      tenantId: TENANT_A,
      correlationId: CORR,
    });
    // TYPE-level advisory marking.
    expect(bundle.advisoryOnly).toBe(true);
    const marker: true = bundle.advisoryOnly;
    expect(marker).toBe(true);

    for (const field of FORBIDDEN_AUTHORITY_FIELDS) {
      expect(bundle).not.toHaveProperty(field);
      for (const unit of bundle.units) {
        expect(unit).not.toHaveProperty(field);
      }
    }
    // Bundle carries context vocabulary only.
    expect(Object.keys(bundle).sort()).toEqual(
      [
        "advisoryOnly",
        "assembledAtUtc",
        "bundleId",
        "correlationId",
        "fingerprint",
        "tenantId",
        "units",
      ].sort(),
    );
  });

  test("hash mismatch flagged (never auto-corrected)", () => {
    const excerpt = "Canon statement: stable excerpt.";
    const unit = makeUnit({ excerpt });
    expect(verifyUnitContentHash(unit, excerpt)).toBe(true);
    expect(verifyUnitContentHash(unit, "tampered excerpt")).toBe(false);

    const mismatched = collectHashMismatches([
      { unit, content: excerpt },
      { unit: makeUnit({ sourceId: "other", excerpt }), content: "different" },
    ]);
    expect(mismatched.map((u) => u.sourceId)).toEqual(["other"]);
  });

  test("library wiring binds provenance at bundle boundaries (surgical, no redesign)", () => {
    const entry = makeEntry();
    expect(canonicalContentForLibraryEntry(entry)).toBe(
      "Canon statement: the platform records a receipt for every governed effect.",
    );
    const fallback = makeEntry({ canonicalStatement: null, copyText: null });
    expect(canonicalContentForLibraryEntry(fallback)).toBe(
      "Fallback content body.",
    );

    const unit = libraryEntryToProvenanceUnit(entry, TENANT_A);
    expect(isProvenanceComplete(unit)).toBe(true);
    expect(unit.sourceId).toBe(entry.id);
    expect(unit.tenantId).toBe(TENANT_A);
    expect(unit.kind).toBe("canon");
    expect(unit.initiativeSlug).toBe("keon-systems");
    expect(
      verifyUnitContentHash(unit, canonicalContentForLibraryEntry(entry)),
    ).toBe(true);
    for (const field of FORBIDDEN_AUTHORITY_FIELDS) {
      expect(unit).not.toHaveProperty(field);
    }

    // Two entries → deterministic advisory bundle via the harness.
    const second = makeEntry({
      id: "entry-canon-002",
      title: "Second",
      canonicalStatement: "Second canon statement.",
    });
    const bundle = assembleContextBundle({
      candidates: [
        libraryEntryToProvenanceUnit(entry, TENANT_A),
        libraryEntryToProvenanceUnit(second, TENANT_A),
      ],
      tenantId: TENANT_A,
      correlationId: CORR,
    });
    expect(bundle.advisoryOnly).toBe(true);
    expect(bundle.units).toHaveLength(2);
    expect(bundle.tenantId).toBe(TENANT_A);
  });
});
