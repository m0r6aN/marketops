"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createBrandVoiceVersionAction,
  saveBrandVoiceGuidelineAction,
} from "@/app/actions/brand-voice";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  brandVoiceClaimHandlingOptions,
  brandVoiceSourceTypeOptions,
  type BrandVoiceEvent,
  type BrandVoiceGuidelineInput,
  type BrandVoiceGuidelineRecord,
  type BrandVoiceLibrarySourceOption,
  type BrandVoiceStatus,
} from "@/lib/brand-voice/types";

type Props = {
  initiativeSlug: string;
  initiativeName: string;
  versions: BrandVoiceGuidelineRecord[];
  selected?: BrandVoiceGuidelineRecord;
  librarySources: BrandVoiceLibrarySourceOption[];
  events: BrandVoiceEvent[];
};

const inputClass = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
const textareaClass = `${inputClass} min-h-24`;
const newId = () => crypto.randomUUID();

function asInput(record: BrandVoiceGuidelineRecord): BrandVoiceGuidelineInput {
  return {
    name: record.name,
    status: record.status,
    sourceMaterials: record.sourceMaterials,
    audienceSummary: record.audienceSummary,
    positioningSummary: record.positioningSummary,
    toneAttributes: record.toneAttributes,
    allowedLanguage: record.allowedLanguage,
    discouragedLanguage: record.discouragedLanguage,
    claimBoundaries: record.claimBoundaries,
    examplePairs: record.examplePairs,
    channelVariations: record.channelVariations,
    notes: record.notes,
  };
}

function availableStatuses(status: BrandVoiceStatus): BrandVoiceStatus[] {
  if (status === "draft") return ["draft", "review-ready"];
  if (status === "review-ready") return ["review-ready", "draft", "changes-requested", "approved"];
  if (status === "changes-requested") return ["changes-requested", "draft", "review-ready"];
  return [status];
}

export function BrandVoiceWorkspace(props: Props) {
  const router = useRouter();
  const [form, setForm] = useState<BrandVoiceGuidelineInput | undefined>(() =>
    props.selected ? asInput(props.selected) : undefined
  );
  const [allowedText, setAllowedText] = useState(() => props.selected?.allowedLanguage.join("\n") ?? "");
  const [discouragedText, setDiscouragedText] = useState(() => props.selected?.discouragedLanguage.join("\n") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const readOnly = !props.selected || ["approved", "superseded"].includes(props.selected.status);

  const createVersion = (baseId?: string) => {
    setError(null);
    startTransition(async () => {
      try {
        const created = await createBrandVoiceVersionAction(props.initiativeSlug, baseId);
        router.push(`/initiatives/${props.initiativeSlug}/brand-voice?version=${created.id}`);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to create the brand voice version.");
      }
    });
  };

  if (!props.selected || !form) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Create the first brand voice version</CardTitle>
          <CardDescription>
            Start with a draft derived from {props.initiativeName} canon. This does not call an AI or external provider.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button disabled={isPending} onClick={() => createVersion()}>
            {isPending ? "Creating draft..." : "Create draft from initiative canon"}
          </Button>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>
    );
  }

  const update = <K extends keyof BrandVoiceGuidelineInput>(key: K, value: BrandVoiceGuidelineInput[K]) => {
    setSaved(false);
    setForm((current) => current ? { ...current, [key]: value } : current);
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await saveBrandVoiceGuidelineAction(props.selected!.id, {
          ...form,
          allowedLanguage: lines(allowedText),
          discouragedLanguage: lines(discouragedText),
        });
        setForm(asInput(result));
        setSaved(true);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to save the brand voice version.");
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Version history</CardTitle>
              <CardDescription>Campaigns can pin approved versions; later approvals do not rewrite their snapshot.</CardDescription>
            </div>
            <Button variant="outline" disabled={isPending} onClick={() => createVersion(props.selected?.id)}>
              <Plus className="mr-2 size-4" /> Create new version
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {props.versions.map((version) => (
            <a
              key={version.id}
              className={buttonVariants({ size: "sm", variant: version.id === props.selected?.id ? "default" : "outline" })}
              href={`?version=${version.id}`}
            >
              v{version.versionNumber} · {version.status}
            </a>
          ))}
        </CardContent>
      </Card>

      <form onSubmit={submit} className="space-y-6">
        <Section title={`Brand voice v${props.selected.versionNumber}`} description="Approval makes this version immutable. Create a new draft for later changes.">
          <Field label="Guideline name" value={form.name} disabled={readOnly} onChange={(v) => update("name", v)} />
          <Select label="Approval state" value={form.status} disabled={readOnly} options={availableStatuses(props.selected.status)} onChange={(v) => update("status", v as BrandVoiceStatus)} />
          <Area label="Audience summary" value={form.audienceSummary} disabled={readOnly} onChange={(v) => update("audienceSummary", v)} />
          <Area label="Positioning summary" value={form.positioningSummary} disabled={readOnly} onChange={(v) => update("positioningSummary", v)} />
          <Area label="Allowed language (one per line)" value={allowedText} disabled={readOnly} onChange={(v) => { setAllowedText(v); setSaved(false); }} />
          <Area label="Discouraged language (one per line)" value={discouragedText} disabled={readOnly} onChange={(v) => { setDiscouragedText(v); setSaved(false); }} />
          <div className="md:col-span-2"><Area label="Internal notes" value={form.notes} disabled={readOnly} onChange={(v) => update("notes", v)} /></div>
        </Section>

        <Collection title="Source materials and provenance" description="References are retained as provenance only; MarketOps does not fetch URLs." disabled={readOnly} onAdd={() => update("sourceMaterials", [...form.sourceMaterials, { id: newId(), sourceType: "manual-reference", label: "", reference: "", evidenceNote: "" }])}>
          {form.sourceMaterials.map((source, index) => (
            <Row key={source.id} onRemove={readOnly ? undefined : () => update("sourceMaterials", form.sourceMaterials.filter((x) => x.id !== source.id))}>
              <Select label="Source type" value={source.sourceType} disabled={readOnly} options={brandVoiceSourceTypeOptions} onChange={(value) => update("sourceMaterials", replace(form.sourceMaterials, index, { ...source, sourceType: value as typeof source.sourceType, reference: "" }))} />
              <Field label="Label" value={source.label} disabled={readOnly} onChange={(value) => update("sourceMaterials", replace(form.sourceMaterials, index, { ...source, label: value }))} />
              {source.sourceType === "library-entry" ? (
                <Select label="Library entry" value={source.reference} disabled={readOnly} options={["", ...props.librarySources.map((item) => item.id)]} labels={Object.fromEntries(props.librarySources.map((item) => [item.id, `${item.title} · ${item.status}`]))} onChange={(value) => update("sourceMaterials", replace(form.sourceMaterials, index, { ...source, reference: value }))} />
              ) : <Field label="Reference" value={source.reference} disabled={readOnly || source.sourceType === "initiative-canon"} onChange={(value) => update("sourceMaterials", replace(form.sourceMaterials, index, { ...source, reference: value }))} />}
              <Area label="Evidence note" value={source.evidenceNote} disabled={readOnly} onChange={(value) => update("sourceMaterials", replace(form.sourceMaterials, index, { ...source, evidenceNote: value }))} />
            </Row>
          ))}
        </Collection>

        <Collection title="Tone attributes" description="Name the trait and describe how an author applies it." disabled={readOnly} onAdd={() => update("toneAttributes", [...form.toneAttributes, { id: newId(), name: "", guidance: "" }])}>
          {form.toneAttributes.map((item, index) => <Row key={item.id} onRemove={readOnly ? undefined : () => update("toneAttributes", form.toneAttributes.filter((x) => x.id !== item.id))}><Field label="Attribute" value={item.name} disabled={readOnly} onChange={(v) => update("toneAttributes", replace(form.toneAttributes, index, { ...item, name: v }))} /><Area label="Guidance" value={item.guidance} disabled={readOnly} onChange={(v) => update("toneAttributes", replace(form.toneAttributes, index, { ...item, guidance: v }))} /></Row>)}
        </Collection>

        <Collection title="Claim boundaries" description="Make allowed, avoided, and evidence-dependent claims explicit." disabled={readOnly} onAdd={() => update("claimBoundaries", [...form.claimBoundaries, { id: newId(), statement: "", handling: "needs-proof", rationale: "" }])}>
          {form.claimBoundaries.map((item, index) => <Row key={item.id} onRemove={readOnly ? undefined : () => update("claimBoundaries", form.claimBoundaries.filter((x) => x.id !== item.id))}><Area label="Claim" value={item.statement} disabled={readOnly} onChange={(v) => update("claimBoundaries", replace(form.claimBoundaries, index, { ...item, statement: v }))} /><Select label="Handling" value={item.handling} disabled={readOnly} options={brandVoiceClaimHandlingOptions} onChange={(v) => update("claimBoundaries", replace(form.claimBoundaries, index, { ...item, handling: v as typeof item.handling }))} /><Area label="Rationale" value={item.rationale} disabled={readOnly} onChange={(v) => update("claimBoundaries", replace(form.claimBoundaries, index, { ...item, rationale: v }))} /></Row>)}
        </Collection>

        <Collection title="Examples and counterexamples" description="Approval requires at least one paired example." disabled={readOnly} onAdd={() => update("examplePairs", [...form.examplePairs, { id: newId(), channel: "", approvedExample: "", counterExample: "", explanation: "" }])}>
          {form.examplePairs.map((item, index) => <Row key={item.id} onRemove={readOnly ? undefined : () => update("examplePairs", form.examplePairs.filter((x) => x.id !== item.id))}><Field label="Channel" value={item.channel} disabled={readOnly} onChange={(v) => update("examplePairs", replace(form.examplePairs, index, { ...item, channel: v }))} /><Area label="Approved example" value={item.approvedExample} disabled={readOnly} onChange={(v) => update("examplePairs", replace(form.examplePairs, index, { ...item, approvedExample: v }))} /><Area label="Counterexample" value={item.counterExample} disabled={readOnly} onChange={(v) => update("examplePairs", replace(form.examplePairs, index, { ...item, counterExample: v }))} /><Area label="Why" value={item.explanation} disabled={readOnly} onChange={(v) => update("examplePairs", replace(form.examplePairs, index, { ...item, explanation: v }))} /></Row>)}
        </Collection>

        <Collection title="Channel variations" description="Approval requires at least one channel-specific variation." disabled={readOnly} onAdd={() => update("channelVariations", [...form.channelVariations, { id: newId(), channel: "", audienceContext: "", guidance: "", ctaStyle: "" }])}>
          {form.channelVariations.map((item, index) => <Row key={item.id} onRemove={readOnly ? undefined : () => update("channelVariations", form.channelVariations.filter((x) => x.id !== item.id))}><Field label="Channel" value={item.channel} disabled={readOnly} onChange={(v) => update("channelVariations", replace(form.channelVariations, index, { ...item, channel: v }))} /><Area label="Audience context" value={item.audienceContext} disabled={readOnly} onChange={(v) => update("channelVariations", replace(form.channelVariations, index, { ...item, audienceContext: v }))} /><Area label="Guidance" value={item.guidance} disabled={readOnly} onChange={(v) => update("channelVariations", replace(form.channelVariations, index, { ...item, guidance: v }))} /><Field label="CTA style" value={item.ctaStyle} disabled={readOnly} onChange={(v) => update("channelVariations", replace(form.channelVariations, index, { ...item, ctaStyle: v }))} /></Row>)}
        </Collection>

        {error ? <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
        {saved ? <p role="status" className="rounded-lg border border-emerald-500/40 p-3 text-sm">Brand voice version saved. No external action was performed.</p> : null}
        {!readOnly ? <Button disabled={isPending} type="submit">{isPending ? "Saving..." : "Save brand voice version"}</Button> : <Badge variant="outline">This version is immutable</Badge>}
      </form>

      <Card><CardHeader><CardTitle>Version event trail</CardTitle><CardDescription>Status and edit evidence without copying raw guideline content into the log.</CardDescription></CardHeader><CardContent className="space-y-3">{props.events.length ? props.events.map((event) => <div key={event.id} className="rounded-lg border p-3"><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-medium">{event.summary}</p><time dateTime={event.recordedAt} className="text-xs text-muted-foreground">{formatTime(event.recordedAt)}</time></div><p className="text-xs text-muted-foreground">{event.eventType}</p></div>) : <p className="text-sm text-muted-foreground">No events recorded.</p>}</CardContent></Card>
    </div>
  );
}

function lines(value: string) { return Array.from(new Set(value.split("\n").map((x) => x.trim()).filter(Boolean))); }
function replace<T>(items: T[], index: number, value: T) { return items.map((item, i) => i === index ? value : item); }
function formatTime(value: string) { return `${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value))} UTC`; }

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <Card><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">{children}</CardContent></Card>; }
function Collection({ title, description, disabled, onAdd, children }: { title: string; description: string; disabled: boolean; onAdd: () => void; children: React.ReactNode }) { return <Card><CardHeader className="flex-row items-start justify-between gap-3"><div><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></div>{!disabled ? <Button type="button" size="sm" variant="outline" onClick={onAdd}><Plus className="mr-2 size-4" />Add</Button> : null}</CardHeader><CardContent className="space-y-4">{children}</CardContent></Card>; }
function Row({ children, onRemove }: { children: React.ReactNode; onRemove?: () => void }) { return <div className="relative grid gap-4 rounded-xl border p-4 md:grid-cols-2">{onRemove ? <Button type="button" aria-label="Remove item" className="absolute right-2 top-2" size="icon" variant="ghost" onClick={onRemove}><Trash2 className="size-4" /></Button> : null}{children}</div>; }
function Field({ label, value, onChange, disabled = false }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) { return <label className="space-y-2 text-sm"><span className="font-medium">{label}</span><input className={inputClass} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} /></label>; }
function Area({ label, value, onChange, disabled = false }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) { return <label className="space-y-2 text-sm"><span className="font-medium">{label}</span><textarea className={textareaClass} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} /></label>; }
function Select({ label, value, options, onChange, disabled = false, labels = {} }: { label: string; value: string; options: readonly string[]; onChange: (v: string) => void; disabled?: boolean; labels?: Record<string, string> }) { return <label className="space-y-2 text-sm"><span className="font-medium">{label}</span><select className={inputClass} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>{options.map((option) => <option key={option} value={option}>{labels[option] ?? (option || "Select...")}</option>)}</select></label>; }
