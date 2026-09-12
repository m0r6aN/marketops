"use client";

import { useState } from "react";

const STORAGE_KEY = "marketops.beta.waitlist.v1";

type WaitlistStatus =
  | { state: "idle" }
  | { state: "error"; message: string }
  | { state: "saved"; referenceId: string };

type SavedRequest = {
  referenceId: string;
  fullName: string;
  workEmail: string;
  team: string;
  workspace: string;
  useCase: string;
  submittedAtUtc: string;
};

function newReferenceId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `beta-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

const inputClassName =
  "w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary";

export function WaitlistForm() {
  const [fullName, setFullName] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [team, setTeam] = useState("");
  const [workspace, setWorkspace] = useState("keon-systems");
  const [useCase, setUseCase] = useState("");
  const [status, setStatus] = useState<WaitlistStatus>({ state: "idle" });

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = fullName.trim();
    const trimmedEmail = workEmail.trim();
    const trimmedTeam = team.trim();

    if (!trimmedName || !trimmedEmail || !trimmedTeam) {
      setStatus({ state: "error", message: "Name, work email, and team are required." });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setStatus({ state: "error", message: "Enter a valid work email address." });
      return;
    }

    const record: SavedRequest = {
      referenceId: newReferenceId(),
      fullName: trimmedName,
      workEmail: trimmedEmail,
      team: trimmedTeam,
      workspace,
      useCase: useCase.trim(),
      submittedAtUtc: new Date().toISOString(),
    };

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const existing: SavedRequest[] = raw ? (JSON.parse(raw) as SavedRequest[]) : [];
      existing.push(record);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    } catch {
      setStatus({
        state: "error",
        message: "This browser blocked local storage. The request was not saved.",
      });
      return;
    }

    setStatus({ state: "saved", referenceId: record.referenceId });
  }

  if (status.state === "saved") {
    return (
      <div aria-live="polite" className="rounded-2xl border border-border/70 bg-muted/25 p-5">
        <p className="text-sm font-medium">Request saved in this browser.</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Reference <span className="font-mono text-xs">{status.referenceId}</span>. Nothing
          was sent anywhere and no account was created. Invite review is manual and
          separate — a saved request does not grant access.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate={false}>
      <div className="grid gap-2">
        <label htmlFor="beta-waitlist-name" className="text-sm font-medium">
          Full name
        </label>
        <input
          id="beta-waitlist-name"
          name="fullName"
          type="text"
          autoComplete="name"
          required
          maxLength={120}
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          className={inputClassName}
        />
      </div>

      <div className="grid gap-2">
        <label htmlFor="beta-waitlist-email" className="text-sm font-medium">
          Work email
        </label>
        <input
          id="beta-waitlist-email"
          name="workEmail"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          value={workEmail}
          onChange={(event) => setWorkEmail(event.target.value)}
          className={inputClassName}
        />
      </div>

      <div className="grid gap-2">
        <label htmlFor="beta-waitlist-team" className="text-sm font-medium">
          Team / company
        </label>
        <input
          id="beta-waitlist-team"
          name="team"
          type="text"
          autoComplete="organization"
          required
          maxLength={160}
          value={team}
          onChange={(event) => setTeam(event.target.value)}
          className={inputClassName}
        />
      </div>

      <div className="grid gap-2">
        <label htmlFor="beta-waitlist-workspace" className="text-sm font-medium">
          Workspace you are requesting
        </label>
        <select
          id="beta-waitlist-workspace"
          name="workspace"
          value={workspace}
          onChange={(event) => setWorkspace(event.target.value)}
          className={inputClassName}
        >
          <option value="keon-systems">Keon Systems — private beta</option>
          <option value="biostack">BioStack — private alpha</option>
        </select>
      </div>

      <div className="grid gap-2">
        <label htmlFor="beta-waitlist-usecase" className="text-sm font-medium">
          What would you review in the beta? <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <textarea
          id="beta-waitlist-usecase"
          name="useCase"
          rows={4}
          maxLength={1000}
          value={useCase}
          onChange={(event) => setUseCase(event.target.value)}
          className={inputClassName}
        />
      </div>

      {status.state === "error" && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {status.message}
        </p>
      )}

      <div>
        <button
          type="submit"
          className="inline-flex items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Save request in this browser
        </button>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Beta only. This button stores your request in this browser&apos;s local storage.
          It sends nothing external, dispatches no email, and creates no account.
        </p>
      </div>
    </form>
  );
}
