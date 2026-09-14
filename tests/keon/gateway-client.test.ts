// k1-gateway-client: governed MCP gateway client tests (stub only, no network).
import { describe, expect, test } from "vitest";

import {
  KEON_TOOL_BROWSE_AHEAD_SCAN,
  KeonGatewayClient,
  KeonGatewayError,
  mapWireEnvelope,
  parseKeonEnvelope,
  requiredScopesForTool,
  StubTransport,
} from "@/lib/keon/client";
import { ensureCorrelationId, newCorrelationId } from "@/lib/keon/correlation";
import {
  KEON_SCOPE_BROWSE_AHEAD_SCAN,
  KEON_SCOPE_MCP_INVOKE,
  requireScopes,
} from "@/lib/keon/scopes";
import type { KeonCallContext } from "@/lib/keon/client";
import deniedEnvelope from "./fixtures/denied-envelope.json";
import disclaimerEnvelope from "./fixtures/disclaimer-envelope.json";
import okEnvelope from "./fixtures/ok-envelope.json";
import rewriteEnvelope from "./fixtures/rewrite-envelope.json";

const BASE_CTX: KeonCallContext = {
  tenantId: "tenant-keon",
  actorId: "user:3fa85f64-5717-4562-b3fc-2c963f66afa6",
  scopes: [KEON_SCOPE_MCP_INVOKE],
};

function governedCode(err: unknown): string | undefined {
  return (err as { code?: string })?.code;
}

describe("correlation threading", () => {
  test("stub round-trip preserves an explicit correlation id", async () => {
    const transport = new StubTransport({ kind: "ok" });
    const client = new KeonGatewayClient(transport);
    const envelope = await client.callTool(
      "keon.policy.check.v1",
      { subjectUri: "campaign:cmp-001/publish" },
      { ...BASE_CTX, correlationId: "k1-corr-roundtrip-0001" }
    );
    expect(envelope.correlationId).toBe("k1-corr-roundtrip-0001");
    expect(envelope.tool).toBe("keon.policy.check.v1");
    expect(envelope.ok).toBe(true);
    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]?.correlationId).toBe("k1-corr-roundtrip-0001");
  });

  test("missing correlation id is generated and echoed", async () => {
    const transport = new StubTransport({ kind: "ok" });
    const client = new KeonGatewayClient(transport);
    const envelope = await client.callTool("keon.policy.check.v1", {}, BASE_CTX);
    expect(envelope.correlationId).toBeTruthy();
    expect(transport.calls[0]?.correlationId).toBe(envelope.correlationId);
  });

  test("newCorrelationId generates unique non-empty ids", () => {
    const a = newCorrelationId();
    const b = newCorrelationId();
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
    expect(ensureCorrelationId("explicit-id")).toBe("explicit-id");
    expect(ensureCorrelationId("")).not.toBe("");
  });

  test("correlation mismatch fails closed", async () => {
    const transport = new StubTransport({
      rawEnvelope: { ...okEnvelope, correlationId: "different-corr-id" },
    });
    const client = new KeonGatewayClient(transport);
    const err = await client
      .callTool("keon.policy.check.v1", {}, { ...BASE_CTX, correlationId: "expected-corr" })
      .then(
        () => null,
        (e: unknown) => e
      );
    expect(err).toBeInstanceOf(KeonGatewayError);
    expect(governedCode(err)).toBe("KEON_CORRELATION_MISMATCH");
  });
});

describe("identity bind + scopes fail closed pre-transport", () => {
  test("missing tenant throws before transport", async () => {
    const transport = new StubTransport({ kind: "ok" });
    const client = new KeonGatewayClient(transport);
    const err = await client
      .callTool("keon.policy.check.v1", {}, { ...BASE_CTX, tenantId: "" })
      .then(
        () => null,
        (e: unknown) => e
      );
    expect(err).toBeInstanceOf(KeonGatewayError);
    expect(governedCode(err)).toBe("KEON_IDENTITY_BIND_FAILED");
    expect(transport.calls).toHaveLength(0);
  });

  test("missing actor throws before transport", async () => {
    const transport = new StubTransport({ kind: "ok" });
    const client = new KeonGatewayClient(transport);
    const err = await client
      .callTool("keon.policy.check.v1", {}, { ...BASE_CTX, actorId: "  " })
      .then(
        () => null,
        (e: unknown) => e
      );
    expect(err).toBeInstanceOf(KeonGatewayError);
    expect(governedCode(err)).toBe("KEON_IDENTITY_BIND_FAILED");
    expect(transport.calls).toHaveLength(0);
  });

  test("missing scopes throws before transport", async () => {
    const transport = new StubTransport({ kind: "ok" });
    const client = new KeonGatewayClient(transport);
    const err = await client
      .callTool("keon.policy.check.v1", {}, { ...BASE_CTX, scopes: [] })
      .then(
        () => null,
        (e: unknown) => e
      );
    expect(err).toBeInstanceOf(KeonGatewayError);
    expect(governedCode(err)).toBe("KEON_MISSING_SCOPE");
    expect(transport.calls).toHaveLength(0);
  });

  test("wrong scope for tool throws before transport", async () => {
    const transport = new StubTransport({ kind: "ok" });
    const client = new KeonGatewayClient(transport);
    const err = await client
      .callTool(KEON_TOOL_BROWSE_AHEAD_SCAN, {}, BASE_CTX)
      .then(
        () => null,
        (e: unknown) => e
      );
    expect(err).toBeInstanceOf(KeonGatewayError);
    expect(governedCode(err)).toBe("KEON_MISSING_SCOPE");
    expect(transport.calls).toHaveLength(0);
  });

  test("browseahead scan succeeds with both scopes", async () => {
    const transport = new StubTransport({ kind: "ok" });
    const client = new KeonGatewayClient(transport);
    const envelope = await client.callTool(
      KEON_TOOL_BROWSE_AHEAD_SCAN,
      { bytesRef: "caller-supplied" },
      {
        ...BASE_CTX,
        scopes: [KEON_SCOPE_MCP_INVOKE, KEON_SCOPE_BROWSE_AHEAD_SCAN],
        correlationId: "k1-corr-scan-0001",
      }
    );
    expect(envelope.correlationId).toBe("k1-corr-scan-0001");
    expect(transport.calls).toHaveLength(1);
  });

  test("requireScopes guard + per-tool scope table", () => {
    expect(() =>
      requireScopes([KEON_SCOPE_MCP_INVOKE], [KEON_SCOPE_MCP_INVOKE])
    ).not.toThrow();
    expect(() => requireScopes([], [KEON_SCOPE_MCP_INVOKE])).toThrow();
    expect(requiredScopesForTool("keon.policy.check.v1")).toEqual([
      KEON_SCOPE_MCP_INVOKE,
    ]);
    expect(requiredScopesForTool(KEON_TOOL_BROWSE_AHEAD_SCAN)).toEqual([
      KEON_SCOPE_MCP_INVOKE,
      KEON_SCOPE_BROWSE_AHEAD_SCAN,
    ]);
  });
});

describe("transport failure is a governed error (never a fake success)", () => {
  test("throwing transport becomes KEON_TRANSPORT_ERROR", async () => {
    const transport = new StubTransport({
      throwError: new Error("boom: connection reset"),
    });
    const client = new KeonGatewayClient(transport);
    const err = await client
      .callTool("keon.policy.check.v1", {}, { ...BASE_CTX, correlationId: "k1-corr-fail-1" })
      .then(
        () => null,
        (e: unknown) => e
      );
    expect(err).toBeInstanceOf(KeonGatewayError);
    expect(governedCode(err)).toBe("KEON_TRANSPORT_ERROR");
  });

  test("hanging transport hits the timeout as a governed error", async () => {
    const transport = new StubTransport({ hang: true });
    const client = new KeonGatewayClient(transport, { timeoutMs: 10 });
    const err = await client
      .callTool("keon.policy.check.v1", {}, BASE_CTX)
      .then(
        () => null,
        (e: unknown) => e
      );
    expect(err).toBeInstanceOf(KeonGatewayError);
    expect(governedCode(err)).toBe("KEON_TRANSPORT_TIMEOUT");
  });

  test("isError envelope becomes a governed error", async () => {
    const transport = new StubTransport({ kind: "transport-error" });
    const client = new KeonGatewayClient(transport);
    const err = await client
      .callTool("keon.policy.check.v1", {}, { ...BASE_CTX, correlationId: "k1-corr-iserr-1" })
      .then(
        () => null,
        (e: unknown) => e
      );
    expect(err).toBeInstanceOf(KeonGatewayError);
    expect(governedCode(err)).toBe("KEON_GATEWAY_TRANSPORT_ERROR");
  });
});

describe("denial / disclaimer / rewrite envelopes", () => {
  test("denial envelope parses with denial fields and no fake success", async () => {
    const transport = new StubTransport({ kind: "denied" });
    const client = new KeonGatewayClient(transport);
    const envelope = await client.callTool(
      "keon.policy.check.v1",
      {},
      { ...BASE_CTX, correlationId: "k1-corr-deny-0001" }
    );
    expect(envelope.status).toBe("denied");
    expect(envelope.ok).toBe(false);
    expect(envelope.isError).toBe(false);
    expect(envelope.decision.policyDecision).toBe("blocked");
    expect(envelope.decision.status).toBe("deny");
    expect(envelope.denialCode).toBeTruthy();
    expect(envelope.denialMessage).toBeTruthy();
    expect(envelope.result).toBeUndefined();
  });

  test("disclaimer envelope preserves disclaimerText", async () => {
    const transport = new StubTransport({ kind: "disclaimer" });
    const client = new KeonGatewayClient(transport);
    const envelope = await client.callTool(
      "keon.policy.check.v1",
      {},
      { ...BASE_CTX, correlationId: "k1-corr-disc-0001" }
    );
    expect(envelope.decision.policyDecision).toBe("allowed-with-disclaimer");
    expect(envelope.decision.status).toBe("authorize");
    const result = envelope.result as { disclaimerText?: string } | undefined;
    expect(result?.disclaimerText).toBeTruthy();
  });

  test("rewrite envelope preserves rewrittenText", async () => {
    const transport = new StubTransport({ kind: "rewrite" });
    const client = new KeonGatewayClient(transport);
    const envelope = await client.callTool(
      "keon.policy.check.v1",
      {},
      { ...BASE_CTX, correlationId: "k1-corr-rewrite-0001" }
    );
    expect(envelope.decision.policyDecision).toBe("rewrite-required");
    expect(envelope.decision.status).toBe("require-review");
    const result = envelope.result as { rewrittenText?: string } | undefined;
    expect(result?.rewrittenText).toBeTruthy();
  });

  test("k0-shaped fixture envelopes validate", () => {
    expect(parseKeonEnvelope(okEnvelope).decision.policyDecision).toBe("allowed");
    expect(parseKeonEnvelope(deniedEnvelope).status).toBe("denied");
    const disclaimer = parseKeonEnvelope(disclaimerEnvelope);
    expect(disclaimer.decision.policyDecision).toBe("allowed-with-disclaimer");
    expect(
      (disclaimer.result as { disclaimerText?: string })?.disclaimerText
    ).toBeTruthy();
    const rewrite = parseKeonEnvelope(rewriteEnvelope);
    expect(rewrite.decision.policyDecision).toBe("rewrite-required");
    expect(
      (rewrite.result as { rewrittenText?: string })?.rewrittenText
    ).toBeTruthy();
  });
});

describe("malformed envelopes are rejected", () => {
  const malformedCases: Array<[string, unknown]> = [
    ["null", null],
    ["missing correlationId", { ...okEnvelope, correlationId: undefined }],
    ["empty correlationId", { ...okEnvelope, correlationId: "" }],
    [
      "ok/status mismatch",
      { ...okEnvelope, ok: true, status: "denied" },
    ],
    [
      "wrong derived status",
      {
        ...okEnvelope,
        decision: { ...okEnvelope.decision, status: "deny" },
      },
    ],
    [
      "unknown native decision",
      {
        ...okEnvelope,
        decision: { ...okEnvelope.decision, policyDecision: "maybe" },
      },
    ],
    [
      "blocked without denial fields",
      {
        ...deniedEnvelope,
        denialCode: undefined,
        denialMessage: undefined,
      },
    ],
    ["bad receipts", { ...okEnvelope, receipts: ["bare-id-123"] }],
    ["non-boolean isError", { ...okEnvelope, isError: "false" }],
    ["result not an object", { ...okEnvelope, result: "oops" }],
  ];

  for (const [name, payload] of malformedCases) {
    test(`rejects ${name}`, async () => {
      expect(() => parseKeonEnvelope(payload)).toThrow(KeonGatewayError);
      const transport = new StubTransport({ rawEnvelope: payload });
      const client = new KeonGatewayClient(transport);
      const err = await client
        .callTool("keon.policy.check.v1", {}, { ...BASE_CTX, correlationId: "k1-corr-malformed" })
        .then(
          () => null,
          (e: unknown) => e
        );
      expect(err).toBeInstanceOf(KeonGatewayError);
      expect(governedCode(err)).toBe("KEON_INVALID_ENVELOPE");
    });
  }
});

describe("transport-boundary casing (Grok D4)", () => {
  test("snake_case wire maps to camelCase domain, never leaks", async () => {
    const transport = new StubTransport({ kind: "ok", wire: "snake" });
    const raw = await transport.invoke({
      tool: "keon.policy.check.v1",
      params: {},
      tenantId: "tenant-keon",
      actorId: BASE_CTX.actorId,
      correlationId: "k1-corr-snake-0001",
    });
    const wireKeys = Object.keys(raw as Record<string, unknown>);
    expect(wireKeys).toContain("correlation_id");
    const envelope = mapWireEnvelope(raw);
    expect(envelope.correlationId).toBe("k1-corr-snake-0001");
    expect(envelope.decision.policyDecision).toBe("allowed");
    const topKeys = Object.keys(envelope);
    expect(topKeys.filter((k) => k.includes("_"))).toEqual([]);
  });

  test("client accepts snake wire end-to-end", async () => {
    const transport = new StubTransport({ kind: "denied", wire: "snake" });
    const client = new KeonGatewayClient(transport);
    const envelope = await client.callTool(
      "keon.policy.check.v1",
      {},
      { ...BASE_CTX, correlationId: "k1-corr-snake-deny-1" }
    );
    expect(envelope.status).toBe("denied");
    expect(envelope.denialCode).toBeTruthy();
  });
});
