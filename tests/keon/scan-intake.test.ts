// k1-browseahead-intake — scan intake tests (S13, sanitized-only).
//
// Covers: valid raw scan -> sanitized ingestible; critical fixture ->
// blocked with reason + null bundle; fetched-provenance fails closed;
// raw-can-never-flow (type-level + runtime guard); receipt refs recorded
// alongside customer-finder + citation-readiness sourced material.
//
// The stub port below reimplements the k0 spike scan shapes (READ ONLY
// reference): caller_supplied bytes are hashed + sanitized deterministically,
// no network, no secrets.
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { screenCitationSourcesWithScan } from "@/lib/citation-readiness/service";
import {
  createDiscoveryCampaignRecord,
  listCandidateRecordsForCampaign,
  purgeAllCustomerFinderData,
  replaceCampaignCandidates,
} from "@/lib/customer-finder/repository";
import {
  applyScanIntakeToCandidates,
  buildSubmissionFingerprint,
  computeRetentionExpiry,
  mapCsvRowsToCandidates,
  normalizeText,
  processSelectedSource,
  toCampaignName,
  toSlug,
  toSourceRun,
} from "@/lib/customer-finder/service";
import {
  ingestibleBundle,
  isBlockedOutcome,
  makeRawContent,
  requestScan,
  requireIngestibleBundle,
  scanReceiptRefs,
  toIngestibleEvidence,
  type ScanIntakeOptions,
  type ScannerPort,
  type SanitizedBundle,
} from "@/lib/keon/scan";
import type { ScanReceipt } from "@/lib/keon/types";
import samples from "./fixtures/scan-samples.json";

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function sha256Uri(input: string): string {
  return `sha256:${sha256Hex(input)}`;
}

function sanitize(text: string): string {
  return text.replace(/<script[\s\S]*?<\/script>/gi, "").trim();
}

function makeStubPort(options?: {
  severityFor?: (text: string) => ScanReceipt["severity"];
  hintFor?: (severity: ScanReceipt["severity"]) => ScanReceipt["ingestionHint"];
  tenantEcho?: string;
}): ScannerPort & { calls: number } {
  const state = { calls: 0 };
  return {
    get calls() {
      return state.calls;
    },
    async scan(input) {
      state.calls += 1;
      if (input.raw.kind !== "raw") throw new Error("stub expects RawContent");
      const rawText = input.raw.text;
      const sanitizedText = sanitize(rawText);
      const severity = options?.severityFor?.(rawText) ?? "none";
      const ingestionHint =
        options?.hintFor?.(severity) ??
        (severity === "high" || severity === "critical" ? "fail_closed" : "allow");
      const sanitizedBundleHash = sha256Uri(sanitizedText);
      const receipt: ScanReceipt = {
        scan: { mode: "raw", provenance: "caller_supplied", policyVersion: input.policyVersion },
        severity,
        ingestionHint,
        sanitizedBundleHash,
        rawContentHash: sha256Uri(rawText),
        canonicalSha256: sha256Hex(
          `${input.tenantId}|${input.correlationId}|${sanitizedBundleHash}`
        ),
        signature: null,
        tenantId: options?.tenantEcho ?? input.tenantId,
        actorId: input.actorId,
        correlationId: input.correlationId,
        scannedAtUtc: samples.scannedAtUtc,
      };
      return { receipt, sanitizedText };
    },
  };
}

function context() {
  return {
    tenantId: samples.tenantId,
    actorId: samples.actorId,
    correlationId: samples.correlationId,
  };
}

function severityPort(): ScannerPort {
  return makeStubPort({
    severityFor: (text) => (text.includes("CRITICAL-MARKER") ? "critical" : "none"),
  });
}

function scanOptions(port: ScannerPort): ScanIntakeOptions {
  return { port, context: context() };
}

function expectScanCode(fn: () => unknown, code: string): void {
  try {
    fn();
  } catch (error) {
    expect((error as { code?: unknown }).code).toBe(code);
    return;
  }
  expect.unreachable(`expected ScanError ${code}`);
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

beforeEach(() => {
  purgeAllCustomerFinderData();
});

afterEach(() => {
  purgeAllCustomerFinderData();
});

describe("keon scan intake (sanitized-only)", () => {
  test("valid raw scan yields a sanitized ingestible bundle", async () => {
    const port = makeStubPort();
    const outcome = await requestScan({ content: samples.withMarkup, ...context() }, port);

    expect(outcome.blocked).toBe(false);
    expect(outcome.bundle).not.toBeNull();
    expect(isBlockedOutcome(outcome)).toBe(false);
    expect(ingestibleBundle(outcome)).toBe(outcome.bundle);

    const bundle = requireIngestibleBundle(outcome);
    expect(bundle.kind).toBe("sanitized");
    // Only sanitized bytes ingest: markup is stripped, raw never surfaces.
    expect(toIngestibleEvidence(bundle)).toBe(sanitize(samples.withMarkup));
    expect(toIngestibleEvidence(bundle)).not.toContain("<script>");
    expect(bundle.sanitizedBundleHash).toBe(sha256Uri(sanitize(samples.withMarkup)));
    expect(bundle.rawContentHash).toBe(sha256Uri(samples.withMarkup));
    expect(bundle.sanitizedBundleHash).not.toBe(bundle.rawContentHash);

    // Determinism: identical inputs hash identically through the stub.
    const again = await requestScan({ content: samples.withMarkup, ...context() }, port);
    expect(again.receipt.sanitizedBundleHash).toBe(outcome.receipt.sanitizedBundleHash);
    expect(again.receipt.canonicalSha256).toBe(outcome.receipt.canonicalSha256);
  });

  test("critical fixture blocks with a reason and a null bundle", async () => {
    const outcome = await requestScan({ content: samples.criticalMarker, ...context() }, severityPort());

    expect(outcome.blocked).toBe(true);
    expect(outcome.bundle).toBeNull();
    expect(ingestibleBundle(outcome)).toBeNull();
    expect(outcome.blockCode).toBe("SCAN_BLOCKED_FAIL_CLOSED");
    expect(outcome.blockReason).toMatch(/severity=critical/);
    expect(outcome.blockReason).toMatch(/ingestionHint=fail_closed/);
    expect(outcome.blockReason).toContain(outcome.receipt.sanitizedBundleHash);
    expect(() => requireIngestibleBundle(outcome)).toThrow(/fail_closed|blocked/i);

    // Refs are still recorded for quarantine/forensics.
    const refs = scanReceiptRefs(outcome.receipt);
    expect(refs.severity).toBe("critical");
    expect(refs.ingestionHint).toBe("fail_closed");
    expect(refs.sanitizedBundleHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(refs.rawContentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  test("quarantine hint holds for review with a null bundle", async () => {
    const port = makeStubPort({ hintFor: () => "quarantine" });
    const outcome = await requestScan({ content: samples.clean, ...context() }, port);

    expect(outcome.blocked).toBe(true);
    expect(outcome.bundle).toBeNull();
    expect(outcome.blockCode).toBe("SCAN_QUARANTINED");
    expect(outcome.blockReason).toMatch(/quarantined/i);
  });

  test("fetched-provenance requests fail closed without touching the port", async () => {
    const port = makeStubPort();

    await expect(
      requestScan({ url: "https://example.com/team", ...context() }, port)
    ).rejects.toMatchObject({ code: "SCAN_URL_FETCH_NOT_ENABLED" });
    await expect(
      requestScan({ content: samples.clean, provenance: "fetched", ...context() }, port)
    ).rejects.toMatchObject({ code: "SCAN_URL_FETCH_NOT_ENABLED" });

    expect(port.calls).toBe(0);
  });

  test("raw content can never flow into ingestible evidence", async () => {
    const outcome = await requestScan({ content: samples.clean, ...context() }, makeStubPort());
    const bundle = requireIngestibleBundle(outcome);

    const raw = makeRawContent(samples.clean);
    // @ts-expect-error RawContent must never be accepted where a SanitizedBundle belongs.
    expect(() => toIngestibleEvidence(raw)).toThrow(/Only a sanitized bundle/);
    // Runtime guard also rejects forged/untyped inputs (never persist raw).
    expectScanCode(
      () => toIngestibleEvidence(raw as unknown as SanitizedBundle),
      "SCAN_RAW_NOT_INGESTIBLE"
    );
    expectScanCode(
      () => toIngestibleEvidence(samples.clean as unknown as SanitizedBundle),
      "SCAN_RAW_NOT_INGESTIBLE"
    );
    expectScanCode(
      () => toIngestibleEvidence({ kind: "sanitized" } as unknown as SanitizedBundle),
      "SCAN_RAW_NOT_INGESTIBLE"
    );
    // The sanitized bundle itself is the only accepted form.
    expect(toIngestibleEvidence(bundle)).toBe(samples.clean);
  });

  test("mismatched receipts fail closed", async () => {
    const port = makeStubPort({ tenantEcho: "tenant-foreign" });
    await expect(
      requestScan({ content: samples.clean, ...context() }, port)
    ).rejects.toMatchObject({ code: "SCAN_RECEIPT_MISMATCH" });
  });

  test("customer-finder intake ingests sanitized evidence and records receipt refs", async () => {
    const csv =
      "name,organization,source_url,reason,evidence,contact_channel,contact_value\n" +
      `Jane Doe,Acme Automations,https://acme.example/team,Matches target,${csvCell(samples.withMarkup)},email,jane@acme.example\n` +
      `Evil Corp,Evil Corp,https://evil.invalid,Matches target,${csvCell(samples.criticalMarker)},website,https://evil.invalid`;
    const candidates = mapCsvRowsToCandidates(csv, "2026-09-14T00:00:00.000Z");
    expect(candidates).toHaveLength(2);

    const screened = await applyScanIntakeToCandidates(candidates, scanOptions(severityPort()));
    expect(screened.ingestible).toHaveLength(1);
    expect(screened.quarantined).toHaveLength(1);

    const kept = screened.ingestible[0];
    // Sanitized-only: no raw excerpts persist.
    expect(kept.verifiedEvidence).toBe(sanitize(samples.withMarkup));
    expect(kept.verifiedEvidence).not.toContain("<script>");
    expect(kept.provenance[0].evidenceText).toBe(sanitize(samples.withMarkup));
    // Receipt refs recorded alongside the sourced material.
    const refs = kept.provenance[0].scanReceiptRefs;
    expect(refs?.sanitizedBundleHash).toBe(sha256Uri(sanitize(samples.withMarkup)));
    expect(refs?.rawContentHash).toBe(sha256Uri(samples.withMarkup));
    expect(refs?.severity).toBe("none");
    expect(refs?.correlationId).toBe(samples.correlationId);

    const blocked = screened.quarantined[0];
    expect(blocked.candidate.displayName).toBe("Evil Corp");
    expect(blocked.receipt?.severity).toBe("critical");
    expect(blocked.reason).toMatch(/severity=critical/);

    // Refs survive the repository round-trip; legacy rows stay ref-free.
    const nowIso = "2026-09-14T00:00:00.000Z";
    createDiscoveryCampaignRecord({
      id: "camp-scan-intake",
      slug: `${toSlug("scan intake")}-test`,
      campaignName: toCampaignName("scan intake"),
      initiativeSlug: "workspace-discovery",
      originPrompt: "scan intake",
      targetDescription: "scan intake",
      normalizedTargetDescription: normalizeText("scan intake"),
      requestFingerprint: buildSubmissionFingerprint({
        prompt: "scan intake",
        targetDescription: "scan intake",
        selectedSourceIds: ["manual_csv"],
        sourceInputs: { manual_csv: csv },
        idempotencyKey: "scan-intake-001",
      }),
      provenance: { source: "scan-intake-test" },
      createdAt: nowIso,
      retentionExpiresAt: computeRetentionExpiry(nowIso),
      selectedChannels: ["email"],
    });
    replaceCampaignCandidates("camp-scan-intake", screened.ingestible, nowIso);
    const stored = listCandidateRecordsForCampaign("camp-scan-intake");
    expect(stored).toHaveLength(1);
    expect(stored[0].verifiedEvidence).toBe(sanitize(samples.withMarkup));
    expect(stored[0].provenance[0].scanReceiptRefs?.sanitizedBundleHash).toBe(
      sha256Uri(sanitize(samples.withMarkup))
    );
    expect(stored[0].provenance[0].scanReceiptRefs?.tenantId).toBe(samples.tenantId);
  });

  test("processSelectedSource honors the scan gate on the CSV path", async () => {
    const csv =
      "name,organization,source_url,reason,evidence,contact_channel,contact_value\n" +
      `Jane Doe,Acme Automations,https://acme.example/team,Matches target,${csvCell(samples.clean)},email,jane@acme.example\n` +
      `Evil Corp,Evil Corp,https://evil.invalid,Matches target,${csvCell(samples.criticalMarker)},website,https://evil.invalid`;
    const processed = await processSelectedSource({
      sourceRun: toSourceRun({
        sourceId: "manual_csv",
        selected: true,
        rationale: "Operator-verified import.",
        inputText: csv,
      }),
      targetDescription: "AI workflow automation companies",
      nowIso: "2026-09-14T00:00:00.000Z",
      scan: scanOptions(severityPort()),
    });

    expect(processed.status).toBe("completed");
    expect(processed.candidates).toHaveLength(1);
    expect(processed.quarantined).toHaveLength(1);
    expect(processed.errorMessage).toMatch(/Quarantined Evil Corp/);
    expect(processed.candidates[0].verifiedEvidence).toBe(samples.clean);
  });

  test("citation-readiness sourcing screens evidence and records refs", async () => {
    const screening = await screenCitationSourcesWithScan({
      sources: [
        { id: "source-1", evidenceNote: samples.clean },
        { id: "source-2", evidenceNote: samples.criticalMarker },
      ],
      port: severityPort(),
      context: context(),
    });

    expect(screening.allowed).toHaveLength(1);
    expect(screening.allowed[0].sourceId).toBe("source-1");
    expect(screening.allowed[0].evidence.kind).toBe("sanitized");
    expect(toIngestibleEvidence(screening.allowed[0].evidence)).toBe(samples.clean);

    expect(screening.quarantined).toHaveLength(1);
    expect(screening.quarantined[0].sourceId).toBe("source-2");
    expect(screening.quarantined[0].receipt?.severity).toBe("critical");
    expect(screening.quarantined[0].reason).toMatch(/severity=critical/);

    // Refs recorded for allowed AND quarantined material alike.
    expect(Object.keys(screening.refsBySourceId).sort()).toEqual(["source-1", "source-2"]);
    expect(screening.refsBySourceId["source-1"].severity).toBe("none");
    expect(screening.refsBySourceId["source-2"].severity).toBe("critical");
    expect(screening.refsBySourceId["source-2"].sanitizedBundleHash).toMatch(
      /^sha256:[a-f0-9]{64}$/
    );
  });
});
