/**
 * POST /api/billing/webhook
 *
 * w2-billing-wire — idempotent TEST-MODE billing webhook ingest. No charge
 * path, no Stripe SDK, no network calls to Stripe.
 *
 * Fail-closed order: test-mode marker (`x-marketops-billing-test: test`
 * header) → BillingWebhook contract shape → idempotent dedupe on `eventId` →
 * single entitlement apply. Anything not test-marked is rejected with 403
 * LIVE_WEBHOOK_REJECTED: live signature verification is a hardening follow-up
 * (h-webhook-signature) and is deliberately NOT half-implemented here.
 */

import { NextResponse } from "next/server";

import {
  ingestBillingWebhookEvent,
  isTestMarked,
} from "@/lib/entitlements/webhook";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  const testMode = isTestMarked(request.headers);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "Bad Request",
        denialCode: "INVALID_WEBHOOK_SHAPE",
        denialMessage: "Billing webhook denied: body must be JSON.",
        failureStage: "decision",
      },
      { status: 400 },
    );
  }

  const result = ingestBillingWebhookEvent(body, { testMode });

  if (!result.ok) {
    const statusText = result.httpStatus === 400 ? "Bad Request" : result.httpStatus === 403 ? "Forbidden" : "Unprocessable Entity";
    return NextResponse.json(
      {
        error: statusText,
        denialCode: result.denialCode,
        denialMessage: result.denialMessage,
        failureStage: result.failureStage,
      },
      { status: result.httpStatus },
    );
  }

  if (result.deduped) {
    return NextResponse.json(
      { ok: true, deduped: true, eventId: result.eventId, tenantId: result.tenantId },
      { status: 200 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      deduped: false,
      eventId: result.eventId,
      tenantId: result.tenantId,
      outcome: result.outcome,
    },
    { status: 200 },
  );
}
