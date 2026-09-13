/**
 * GET /api/library/automation/approved
 *
 * Returns all library entries that pass every public-safety gate.
 * This is the endpoint marketing automation systems query.
 *
 * An entry appears here only if ALL 8 conditions are met (spec §7):
 * 1. visibility = 'public'
 * 2. public_safe = true
 * 3. status IN ('approved', 'locked')
 * 4. sensitive = false
 * 5. approved_for_automation = true
 * 6. No unresolved conflicts
 * 7. Not an internal_note
 * 8. Source document not in trash
 */
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { isRowVisibleToTenant } from "@/lib/library/repository";
import { getAutomationApprovedEntries } from "@/lib/library/service";

export async function GET(request: NextRequest) {
  // w2-tenant-wire: session gate + per-record tenant wiring. No session =>
  // 401; automation-approved rows are scoped to the session tenant (legacy
  // sqlite rows without a tenant column stay visible locally; PG rows are
  // RLS- plus predicate-scoped).
  const session = verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null);
  if (!session) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        denialCode: "UNAUTHENTICATED",
        denialMessage: "Automation entries denied: no authenticated tenant session.",
        failureStage: "decision",
      },
      { status: 401 },
    );
  }
  const entries = getAutomationApprovedEntries().filter((entry) =>
    isRowVisibleToTenant(session.tenantId, entry),
  );
  return NextResponse.json({
    entries,
    count: entries.length,
    generatedAt: new Date().toISOString(),
  });
}
