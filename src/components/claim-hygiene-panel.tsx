import type { Initiative } from "@/lib/initiatives";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClaimList } from "@/components/claim-list";

type ClaimHygienePanelProps = {
  initiative: Initiative;
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm leading-6 text-foreground">{value}</p>
    </div>
  );
}

export function ClaimHygienePanel({ initiative }: ClaimHygienePanelProps) {
  return (
    <Card className="border-border/70">
      <CardHeader className="space-y-2">
        <CardTitle className="text-base font-semibold">Claim hygiene</CardTitle>
        <CardDescription className="max-w-2xl">
          Approved language stays narrow. Needs-proof claims require attached evidence before use.
          Banned claims must not appear in operator copy or review notes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-5 md:grid-cols-3">
          <ClaimList
            label="Allowed claims"
            claims={initiative.allowedClaims}
            variant="neutral"
          />
          <ClaimList
            label="Needs-proof claims"
            claims={initiative.needsProofClaims}
            variant="caution"
          />
          <ClaimList
            label="Banned claims"
            claims={initiative.bannedClaims}
            variant="blocked"
          />
        </div>
        <div className="grid gap-4 text-sm md:grid-cols-2">
          <Field label="Claim posture" value={initiative.claimPosture} />
          <Field label="Tone notes" value={initiative.toneNotes} />
        </div>
      </CardContent>
    </Card>
  );
}
