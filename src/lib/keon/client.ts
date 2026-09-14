// ---------------------------------------------------------------------------
// Keon MCP gateway client (k1-gateway-client, S8).
//
// Governed, transport-agnostic client: identity bind + scopes + envelope
// handling + correlation threading. Stub transport only (pure in-process,
// zero network calls); stdio/HTTP transports arrive later behind the same
// KeonTransport interface.
//
// Fail-closed: missing tenant/actor/scopes throws before transport;
// transport error/timeout/invalid envelope/correlation mismatch/isError
// becomes a governed KeonGatewayError (never a fake success).
//
// Casing rule (Grok D4, binding): domain types are camelCase everywhere.
// snake_case appears ONLY in the transport-boundary mapper below
// (mapWireEnvelope + Wire* types), never in domain types or contracts.
// ---------------------------------------------------------------------------

import { ensureCorrelationId } from "./correlation";
import {
  KEON_SCOPE_BROWSE_AHEAD_SCAN,
  KEON_SCOPE_MCP_INVOKE,
  requireScopes,
} from "./scopes";
import {
  deriveKeonDispositionDecision,
  KEON_POLICY_DECISIONS,
  type KeonDispositionDecision,
  type KeonEnvelope,
  type KeonEnvelopeStatus,
  type KeonFailureStage,
  type KeonPolicyDecision,
} from "./types";

// ---------------------------------------------------------------------------
// Context + transport interface.
// ---------------------------------------------------------------------------

/** Identity + authorization bound to every gateway call. */
export type KeonCallContext = {
  tenantId: string;
  actorId: string;
  scopes: readonly string[];
  /** Optional caller correlation; generated when absent. Always echoed. */
  correlationId?: string;
};

/** What the client hands to the transport (already identity-bound). */
export type KeonTransportRequest = {
  tool: string;
  params: Record<string, unknown>;
  tenantId: string;
  actorId: string;
  correlationId: string;
};

/**
 * Transport boundary. StubTransport implements this now (pure in-process);
 * stdio/HTTP implementations arrive later. Implementations must not perform
 * real-network calls in this parcel (loopback-stub only — here, none at all).
 */
export interface KeonTransport {
  invoke(request: KeonTransportRequest): Promise<unknown>;
}

/** Tool ids routed through this client. */
export const KEON_TOOL_POLICY_CHECK = "keon.policy.check.v1" as const;
export const KEON_TOOL_BROWSE_AHEAD_SCAN = "keon.browseahead.scan.v1" as const;

/** Per-tool required scopes. Every tool needs keon:mcp:invoke. */
export function requiredScopesForTool(tool: string): readonly string[] {
  if (tool === KEON_TOOL_BROWSE_AHEAD_SCAN) {
    return [KEON_SCOPE_MCP_INVOKE, KEON_SCOPE_BROWSE_AHEAD_SCAN];
  }
  return [KEON_SCOPE_MCP_INVOKE];
}

// ---------------------------------------------------------------------------
// Governed errors (never a fake success).
// ---------------------------------------------------------------------------

export type KeonGatewayErrorCode =
  | "KEON_IDENTITY_BIND_FAILED"
  | "KEON_MISSING_SCOPE"
  | "KEON_TRANSPORT_ERROR"
  | "KEON_TRANSPORT_TIMEOUT"
  | "KEON_INVALID_ENVELOPE"
  | "KEON_CORRELATION_MISMATCH"
  | "KEON_GATEWAY_TRANSPORT_ERROR";

export class KeonGatewayError extends Error {
  readonly code: KeonGatewayErrorCode;
  readonly correlationId?: string;

  constructor(code: KeonGatewayErrorCode, message: string, correlationId?: string) {
    super(`${code}: ${message}`);
    this.name = "KeonGatewayError";
    this.code = code;
    this.correlationId = correlationId;
  }
}

export const KEON_DEFAULT_TIMEOUT_MS = 5000;

// ---------------------------------------------------------------------------
// Transport-boundary wire mapper (ONLY snake_case site in src).
//
// The future S8 adapter speaks snake_case on the wire (correlation_id,
// policy_hash, ...). Domain types stay camelCase; this mapper normalizes
// either form into the camelCase domain shape before validation.
// ---------------------------------------------------------------------------

/** snake_case wire form of the policy hash (transport boundary only). */
export type WirePolicyHash = {
  value?: unknown;
  version?: unknown;
};

/** snake_case wire form of the envelope decision (transport boundary only). */
export type WireDecision = {
  policyDecision?: unknown;
  policy_decision?: unknown;
  status?: unknown;
  policyHash?: unknown;
  policy_hash?: unknown;
};

/** snake_case wire form of the gateway envelope (transport boundary only). */
export type WireEnvelope = {
  correlationId?: unknown;
  correlation_id?: unknown;
  tool?: unknown;
  ok?: unknown;
  status?: unknown;
  decision?: unknown;
  result?: unknown;
  denialCode?: unknown;
  denial_code?: unknown;
  denialMessage?: unknown;
  denial_message?: unknown;
  failureStage?: unknown;
  failure_stage?: unknown;
  receipts?: unknown;
  isError?: unknown;
  is_error?: unknown;
};

function firstString(...candidates: unknown[]): string | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      return candidate;
    }
  }
  return undefined;
}

function firstBoolean(...candidates: unknown[]): boolean | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === "boolean") {
      return candidate;
    }
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

/**
 * Normalize a transport-boundary payload (snake_case and/or camelCase keys)
 * into the camelCase domain envelope, then validate. Throws governed
 * KeonGatewayError on anything malformed.
 */
export function mapWireEnvelope(wire: unknown): KeonEnvelope {
  const w = asRecord(wire);
  if (!w) {
    throw new KeonGatewayError("KEON_INVALID_ENVELOPE", "envelope must be an object");
  }
  const wireEnvelope = w as WireEnvelope;
  const decisionRaw = asRecord(wireEnvelope.decision) as
    | (WireDecision & Record<string, unknown>)
    | undefined;
  const policyHashRaw = (
    decisionRaw ? asRecord(decisionRaw.policyHash ?? decisionRaw.policy_hash) : undefined
  ) as (WirePolicyHash & Record<string, unknown>) | undefined;

  const normalized: Record<string, unknown> = {
    correlationId: firstString(wireEnvelope.correlationId, wireEnvelope.correlation_id),
    tool: firstString(wireEnvelope.tool),
    ok: firstBoolean(wireEnvelope.ok),
    status: typeof wireEnvelope.status === "string" ? wireEnvelope.status : undefined,
    decision: decisionRaw
      ? {
          policyDecision: firstString(
            decisionRaw.policyDecision,
            decisionRaw.policy_decision
          ),
          status: typeof decisionRaw.status === "string" ? decisionRaw.status : undefined,
          policyHash: policyHashRaw
            ? {
                value:
                  typeof policyHashRaw.value === "string"
                    ? policyHashRaw.value
                    : undefined,
                version:
                  typeof policyHashRaw.version === "string"
                    ? policyHashRaw.version
                    : undefined,
              }
            : undefined,
        }
      : undefined,
    receipts: wireEnvelope.receipts,
    isError: firstBoolean(wireEnvelope.isError, wireEnvelope.is_error),
  };

  if (wireEnvelope.result !== undefined) {
    normalized.result = wireEnvelope.result;
  }
  const denialCode = firstString(wireEnvelope.denialCode, wireEnvelope.denial_code);
  if (denialCode !== undefined) {
    normalized.denialCode = denialCode;
  }
  const denialMessage = firstString(
    wireEnvelope.denialMessage,
    wireEnvelope.denial_message
  );
  if (denialMessage !== undefined) {
    normalized.denialMessage = denialMessage;
  }
  const failureStage =
    typeof wireEnvelope.failureStage === "string"
      ? wireEnvelope.failureStage
      : typeof wireEnvelope.failure_stage === "string"
        ? wireEnvelope.failure_stage
        : undefined;
  if (failureStage !== undefined) {
    normalized.failureStage = failureStage;
  }

  return parseKeonEnvelope(normalized);
}

// ---------------------------------------------------------------------------
// Domain envelope validation (camelCase only).
// ---------------------------------------------------------------------------

const KEON_ENVELOPE_STATUSES: readonly KeonEnvelopeStatus[] = ["ok", "denied", "error"];
const KEON_DERIVED_STATUSES: readonly KeonDispositionDecision[] = [
  "authorize",
  "deny",
  "require-review",
];
const KEON_FAILURE_STAGES: readonly KeonFailureStage[] = [
  "precheck",
  "decision",
  "hash",
  "audit",
  "evidence-pack",
  "verify",
  "exception",
];
const RECEIPT_URI_PATTERN = /^[a-z][a-z0-9+.-]*:\/\/\S+$/;

function invalid(message: string, correlationId?: string): KeonGatewayError {
  return new KeonGatewayError("KEON_INVALID_ENVELOPE", message, correlationId);
}

/**
 * Validate a camelCase domain payload as a KeonEnvelope per
 * contracts/KeonEnvelope.json. Throws governed KeonGatewayError when
 * malformed — never returns a fake success.
 */
export function parseKeonEnvelope(raw: unknown): KeonEnvelope {
  const record = asRecord(raw);
  if (!record) {
    throw invalid("envelope must be an object");
  }

  const correlationId = record.correlationId;
  if (typeof correlationId !== "string" || correlationId.length === 0) {
    throw invalid("envelope.correlationId must be a non-empty string");
  }
  const tool = record.tool;
  if (typeof tool !== "string" || tool.length === 0) {
    throw invalid("envelope.tool must be a non-empty string", correlationId);
  }
  const ok = record.ok;
  if (typeof ok !== "boolean") {
    throw invalid("envelope.ok must be a boolean", correlationId);
  }
  const status = record.status;
  if (
    typeof status !== "string" ||
    !(KEON_ENVELOPE_STATUSES as readonly string[]).includes(status)
  ) {
    throw invalid("envelope.status must be ok|denied|error", correlationId);
  }
  if (ok !== (status === "ok")) {
    throw invalid("envelope.ok must equal (status === \"ok\")", correlationId);
  }

  const decisionRaw = asRecord(record.decision);
  if (!decisionRaw) {
    throw invalid("envelope.decision must be an object", correlationId);
  }
  const policyDecision = decisionRaw.policyDecision;
  if (
    typeof policyDecision !== "string" ||
    !(KEON_POLICY_DECISIONS as readonly string[]).includes(policyDecision)
  ) {
    throw invalid(
      "envelope.decision.policyDecision must be a native BioStack decision",
      correlationId
    );
  }
  const derived = decisionRaw.status;
  if (
    typeof derived !== "string" ||
    !(KEON_DERIVED_STATUSES as readonly string[]).includes(derived)
  ) {
    throw invalid("envelope.decision.status must be derived disposition", correlationId);
  }
  const expectedDerived = deriveKeonDispositionDecision(
    policyDecision as KeonPolicyDecision
  );
  if (derived !== expectedDerived) {
    throw invalid(
      `envelope.decision.status must equal the native mapping (${String(policyDecision)} -> ${expectedDerived})`,
      correlationId
    );
  }
  const policyHashRaw = asRecord(decisionRaw.policyHash);
  if (!policyHashRaw) {
    throw invalid("envelope.decision.policyHash must be an object", correlationId);
  }
  if (
    typeof policyHashRaw.value !== "string" ||
    policyHashRaw.value.length === 0 ||
    typeof policyHashRaw.version !== "string" ||
    policyHashRaw.version.length === 0
  ) {
    throw invalid(
      "envelope.decision.policyHash requires non-empty value + version",
      correlationId
    );
  }

  const receipts = record.receipts;
  if (
    !Array.isArray(receipts) ||
    !receipts.every(
      (entry): entry is string =>
        typeof entry === "string" && RECEIPT_URI_PATTERN.test(entry)
    )
  ) {
    throw invalid("envelope.receipts must be an array of URIs", correlationId);
  }

  const isError = record.isError;
  if (typeof isError !== "boolean") {
    throw invalid("envelope.isError must be a boolean", correlationId);
  }

  if (policyDecision === "blocked") {
    if (
      typeof record.denialCode !== "string" ||
      record.denialCode.length === 0 ||
      typeof record.denialMessage !== "string" ||
      record.denialMessage.length === 0
    ) {
      throw invalid(
        "blocked envelopes require denialCode + denialMessage",
        correlationId
      );
    }
  }

  if (record.result !== undefined) {
    const result = asRecord(record.result);
    if (!result) {
      throw invalid("envelope.result must be an object when present", correlationId);
    }
  }

  if (record.failureStage !== undefined) {
    if (
      typeof record.failureStage !== "string" ||
      !(KEON_FAILURE_STAGES as readonly string[]).includes(record.failureStage)
    ) {
      throw invalid("envelope.failureStage is not a known stage", correlationId);
    }
  }

  return raw as KeonEnvelope;
}

// ---------------------------------------------------------------------------
// Client.
// ---------------------------------------------------------------------------

export type KeonGatewayClientOptions = {
  timeoutMs?: number;
};

function invokeWithTimeout(
  pending: Promise<unknown>,
  timeoutMs: number
): Promise<unknown> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return pending;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new KeonGatewayError("KEON_TRANSPORT_TIMEOUT", "transport timed out"));
    }, timeoutMs);
    if (typeof (timer as unknown as { unref?: () => void }).unref === "function") {
      (timer as unknown as { unref: () => void }).unref();
    }
  });
  return Promise.race([pending, timeout]).finally(() => {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  });
}

/** Governed MCP gateway client over an injected transport. */
export class KeonGatewayClient {
  private readonly transport: KeonTransport;
  private readonly timeoutMs: number;

  constructor(transport: KeonTransport, options: KeonGatewayClientOptions = {}) {
    if (!transport || typeof transport.invoke !== "function") {
      throw new KeonGatewayError(
        "KEON_TRANSPORT_ERROR",
        "a transport implementing invoke() is required"
      );
    }
    this.transport = transport;
    this.timeoutMs = options.timeoutMs ?? KEON_DEFAULT_TIMEOUT_MS;
  }

  /**
   * Call a gateway tool under the bound identity. Fail-closed pre-transport
   * on missing tenant/actor/scopes; governed KeonGatewayError on transport
   * failure, timeout, invalid envelope, correlation mismatch, or isError.
   * Denial envelopes (status denied, isError false) resolve normally so the
   * caller can route the denial with its disclaimer/rewrite evidence.
   */
  async callTool(
    tool: string,
    params: Record<string, unknown>,
    ctx: KeonCallContext
  ): Promise<KeonEnvelope> {
    if (typeof tool !== "string" || tool.trim().length === 0) {
      throw new KeonGatewayError("KEON_TRANSPORT_ERROR", "tool must be a non-empty string");
    }
    const tenantId =
      typeof ctx?.tenantId === "string" ? ctx.tenantId.trim() : "";
    const actorId = typeof ctx?.actorId === "string" ? ctx.actorId.trim() : "";
    if (tenantId.length === 0 || actorId.length === 0) {
      throw new KeonGatewayError(
        "KEON_IDENTITY_BIND_FAILED",
        "tenantId + actorId are required before transport"
      );
    }
    const scopes = ctx?.scopes;
    if (!Array.isArray(scopes) || scopes.length === 0) {
      throw new KeonGatewayError(
        "KEON_MISSING_SCOPE",
        "non-empty scopes are required before transport"
      );
    }
    try {
      requireScopes(scopes, requiredScopesForTool(tool));
    } catch (err) {
      if (err instanceof Error && (err as { code?: string }).code === "KEON_MISSING_SCOPE") {
        throw new KeonGatewayError(
          "KEON_MISSING_SCOPE",
          err.message.replace(/^KEON_MISSING_SCOPE:\s*/, "")
        );
      }
      throw err;
    }

    const correlationId = ensureCorrelationId(ctx?.correlationId);
    const request: KeonTransportRequest = {
      tool,
      params: params ?? {},
      tenantId,
      actorId,
      correlationId,
    };

    let raw: unknown;
    try {
      raw = await invokeWithTimeout(this.transport.invoke(request), this.timeoutMs);
    } catch (err) {
      if (err instanceof KeonGatewayError) {
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new KeonGatewayError(
        "KEON_TRANSPORT_ERROR",
        `transport failed: ${message}`,
        correlationId
      );
    }

    const envelope = mapWireEnvelope(raw);
    if (envelope.correlationId !== correlationId) {
      throw new KeonGatewayError(
        "KEON_CORRELATION_MISMATCH",
        `envelope correlationId ${envelope.correlationId} does not echo ${correlationId}`,
        correlationId
      );
    }
    if (envelope.isError) {
      throw new KeonGatewayError(
        "KEON_GATEWAY_TRANSPORT_ERROR",
        `gateway reported transport failure (status ${envelope.status})`,
        correlationId
      );
    }
    return envelope;
  }
}

// ---------------------------------------------------------------------------
// StubTransport (k0-shaped fixtures, pure in-process, zero network).
// ---------------------------------------------------------------------------

export type StubEnvelopeKind =
  | "ok"
  | "denied"
  | "disclaimer"
  | "rewrite"
  | "transport-error";

export type StubTransportOptions = {
  /** Which k0-shaped envelope to synthesize (default "ok"). */
  kind?: StubEnvelopeKind;
  /** Throw this instead of answering (transport-failure path). */
  throwError?: unknown;
  /** Answer with this raw payload instead (malformed-envelope path). */
  rawEnvelope?: unknown;
  /** Never resolve (timeout path). */
  hang?: boolean;
  /** Return the snake_case wire form to exercise mapWireEnvelope. */
  wire?: "camel" | "snake";
};

const STUB_POLICY_HASH = {
  value: `sha256:${"cf".repeat(32)}`,
  version: "claim-policy.v1",
} as const;

function stubHex(input: string): string {
  let hash = 0x811c9dc5;
  let extra = 0x01000193;
  let out = "";
  const bytes = `${input}|${input.length}`;
  for (let round = 0; round < 4; round += 1) {
    for (let i = 0; i < bytes.length; i += 1) {
      hash ^= bytes.charCodeAt(i) + round;
      hash = Math.imul(hash, extra) >>> 0;
      extra = (Math.imul(extra, 33) + i) >>> 0;
    }
    out += hash.toString(16).padStart(8, "0");
  }
  return out.slice(0, 32);
}

function stubReceiptUri(correlationId: string, policyDecision: string): string {
  return `keon://receipt/${stubHex(`${correlationId}|${policyDecision}`).slice(0, 12)}`;
}

/** Build a k0-shaped domain envelope for the stubbed kind. */
export function buildStubEnvelope(
  kind: StubEnvelopeKind,
  request: Pick<KeonTransportRequest, "tool" | "tenantId" | "correlationId">
): KeonEnvelope {
  const { tool, tenantId, correlationId } = request;
  switch (kind) {
    case "denied":
      return {
        correlationId,
        tool,
        ok: false,
        status: "denied",
        decision: {
          policyDecision: "blocked",
          status: "deny",
          policyHash: { ...STUB_POLICY_HASH },
        },
        denialCode: "STUB_POLICY_DENY",
        denialMessage: "Stub transport denied the effect at the decision stage.",
        failureStage: "decision",
        receipts: [stubReceiptUri(correlationId, "blocked")],
        isError: false,
      };
    case "disclaimer":
      return {
        correlationId,
        tool,
        ok: true,
        status: "ok",
        decision: {
          policyDecision: "allowed-with-disclaimer",
          status: "authorize",
          policyHash: { ...STUB_POLICY_HASH },
        },
        result: {
          tenantId,
          disclaimerText:
            "Stub disclaimer: throughput claim scoped to dry_run proofpack exports.",
        },
        receipts: [stubReceiptUri(correlationId, "allowed-with-disclaimer")],
        isError: false,
      };
    case "rewrite":
      return {
        correlationId,
        tool,
        ok: true,
        status: "ok",
        decision: {
          policyDecision: "rewrite-required",
          status: "require-review",
          policyHash: { ...STUB_POLICY_HASH },
        },
        result: {
          tenantId,
          rewrittenText:
            "Stub rewrite: dry-run proofpack exports averaged sealed throughput.",
        },
        receipts: [stubReceiptUri(correlationId, "rewrite-required")],
        isError: false,
      };
    case "transport-error":
      return {
        correlationId,
        tool,
        ok: false,
        status: "error",
        decision: {
          policyDecision: "blocked",
          status: "deny",
          policyHash: { ...STUB_POLICY_HASH },
        },
        denialCode: "STUB_TRANSPORT_FAULT",
        denialMessage: "Stub transport fault (isError envelope).",
        failureStage: "exception",
        receipts: [`marketops://unanchored-receipt/${stubHex(correlationId).slice(0, 16)}`],
        isError: true,
      };
    case "ok":
    default:
      return {
        correlationId,
        tool,
        ok: true,
        status: "ok",
        decision: {
          policyDecision: "allowed",
          status: "authorize",
          policyHash: { ...STUB_POLICY_HASH },
        },
        result: { tenantId, note: "stub authorize" },
        receipts: [stubReceiptUri(correlationId, "allowed")],
        isError: false,
      };
  }
}

function toSnakeWire(envelope: KeonEnvelope): Record<string, unknown> {
  const wire: Record<string, unknown> = {
    correlation_id: envelope.correlationId,
    tool: envelope.tool,
    ok: envelope.ok,
    status: envelope.status,
    decision: {
      policy_decision: envelope.decision.policyDecision,
      status: envelope.decision.status,
      policy_hash: {
        value: envelope.decision.policyHash.value,
        version: envelope.decision.policyHash.version,
      },
    },
    receipts: envelope.receipts,
    is_error: envelope.isError,
  };
  if (envelope.result !== undefined) {
    wire.result = envelope.result;
  }
  if (envelope.denialCode !== undefined) {
    wire.denial_code = envelope.denialCode;
  }
  if (envelope.denialMessage !== undefined) {
    wire.denial_message = envelope.denialMessage;
  }
  if (envelope.failureStage !== undefined) {
    wire.failure_stage = envelope.failureStage;
  }
  return wire;
}

/**
 * Pure in-process stub transport. Records every request; answers with a
 * deterministic k0-shaped envelope echoing the request correlationId. No
 * fetch, no sockets, no secrets — safe for unit tests.
 */
export class StubTransport implements KeonTransport {
  readonly calls: KeonTransportRequest[] = [];
  private readonly options: StubTransportOptions;

  constructor(options: StubTransportOptions = {}) {
    this.options = { kind: "ok", wire: "camel", ...options };
  }

  async invoke(request: KeonTransportRequest): Promise<unknown> {
    this.calls.push(request);
    if (this.options.hang) {
      return new Promise<never>(() => {});
    }
    if (this.options.throwError !== undefined) {
      throw this.options.throwError;
    }
    if (this.options.rawEnvelope !== undefined) {
      return this.options.rawEnvelope;
    }
    const envelope = buildStubEnvelope(this.options.kind ?? "ok", request);
    return this.options.wire === "snake" ? toSnakeWire(envelope) : envelope;
  }
}
