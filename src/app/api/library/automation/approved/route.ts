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
import { NextResponse } from "next/server";
import { getAutomationApprovedEntries } from "@/lib/library/service";

export async function GET() {
  const entries = getAutomationApprovedEntries();
  return NextResponse.json({
    entries,
    count: entries.length,
    generatedAt: new Date().toISOString(),
  });
}
