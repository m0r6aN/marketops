"use client";
import { ImportProgress } from "@/components/library/import-progress";
import { ModeSelector } from "@/components/library/mode-selector";
import { initiatives } from "@/lib/initiatives";
import type { ImportFileMetadata, ImportRequest, ProcessingMode } from "@/lib/library/types";
import { type InputHTMLAttributes, useRef, useState } from "react";

const ACCEPTED_IMPORT_TYPES = ".md,.txt,.json,.yaml,.yml,.csv,.html,.htm,.pdf";

const folderUploadProps: InputHTMLAttributes<HTMLInputElement> & {
  webkitdirectory: string;
  directory: string;
} = {
  webkitdirectory: "",
  directory: "",
};

function getRelativePath(file: File): string | null {
  const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath?.trim();
  if (!path || path === file.name) return null;
  return path.replace(/\\+/g, "/");
}

function getDisplayName(file: File): string {
  return getRelativePath(file) ?? file.name;
}

export function ImportForm() {
  const [modes, setModes] = useState<ProcessingMode[]>(["canon", "marketing", "internal", "trash"]);
  const [files, setFiles] = useState<File[]>([]);
  const [initiativeSlug, setInitiativeSlug] = useState<string>("");
  const [useOllama, setUseOllama] = useState(false);
  const [useBlackbox, setUseBlackbox] = useState(true);
  const [sensitiveWarning, setSensitiveWarning] = useState<string[]>([]);
  const [confirmSensitive, setConfirmSensitive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    setFiles(selected);
    setSensitiveWarning([]);
    setConfirmSensitive(false);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) {
      setError("Please select at least one file.");
      return;
    }
    if (modes.length === 0) {
      setError("Please select at least one processing mode.");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file);
    }
    const fileMetadata: ImportFileMetadata[] = files.map((file) => ({
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
      relativePath: getRelativePath(file),
    }));
    const requestBody: ImportRequest = {
      modes,
      modelStrategy: useOllama || useBlackbox ? "auto" : "sonnet-only",
      useOllama,
      useBlackbox,
    };

    formData.append("modes", JSON.stringify(requestBody.modes));
    formData.append("modelStrategy", requestBody.modelStrategy);
    formData.append("useOllama", String(requestBody.useOllama ?? false));
    formData.append("useBlackbox", String(requestBody.useBlackbox ?? false));
    formData.append("fileMetadata", JSON.stringify(fileMetadata));
    if (initiativeSlug) {
      formData.append("initiativeSlug", initiativeSlug);
    }

    const url = confirmSensitive
      ? "/api/library/import?confirmSensitive=true"
      : "/api/library/import";

    try {
      const res = await fetch(url, { method: "POST", body: formData });
      const data = await res.json();

      if (res.status === 422 && data.sensitiveFiles) {
        setSensitiveWarning(data.sensitiveFiles);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(data.message ?? data.error ?? "Import failed");
        setLoading(false);
        return;
      }

      setBatchId(data.batchId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  const extractionModesSelected = modes.some((mode) => mode !== "trash");

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_IMPORT_TYPES}
        onChange={handleFileChange}
        className="sr-only"
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        accept={ACCEPTED_IMPORT_TYPES}
        onChange={handleFileChange}
        className="sr-only"
        {...folderUploadProps}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.12fr)_minmax(380px,1fr)] lg:items-start">
        <div className="space-y-4">
          {/* File picker */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Files</label>
            <div className="rounded-xl border-2 border-dashed border-border/60 p-5 text-center transition-colors hover:border-border sm:p-6">
              {files.length > 0 ? (
                <div>
                  <p className="text-sm font-medium">{files.length} file(s) selected</p>
                  <ul className="mt-1.5 text-xs text-muted-foreground">
                    {files.slice(0, 5).map((f, index) => (
                      <li key={`${f.name}-${f.lastModified}-${index}`}>
                        {getDisplayName(f)} ({(f.size / 1024).toFixed(1)} KB)
                      </li>
                    ))}
                    {files.length > 5 && <li>…and {files.length - 5} more</li>}
                  </ul>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                    >
                      Choose different files
                    </button>
                    <button
                      type="button"
                      onClick={() => folderInputRef.current?.click()}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                    >
                      Choose folder
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-muted-foreground">
                    Select individual files or an entire folder
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    .md .txt .json .yaml .yml .csv .html .pdf — max 10 MB per file
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Filenames are tracked automatically. Folder-relative paths are preserved when the browser provides them.
                  </p>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80"
                    >
                      Select files
                    </button>
                    <button
                      type="button"
                      onClick={() => folderInputRef.current?.click()}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                    >
                      Select folder
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sensitive file warning */}
          {sensitiveWarning.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
              <p className="text-sm font-medium text-amber-800">
                ⚠ Sensitive files detected
              </p>
              <ul className="mt-1 text-xs text-amber-700">
                {sensitiveWarning.map((f) => <li key={f}>{f}</li>)}
              </ul>
              <label className="mt-3 flex items-center gap-2 text-xs text-amber-700">
                <input
                  type="checkbox"
                  checked={confirmSensitive}
                  onChange={(e) => setConfirmSensitive(e.target.checked)}
                />
                I understand these files may contain secrets and want to proceed anyway
              </label>
            </div>
          )}

          {/* Initiative association */}
          <div>
            <label htmlFor="initiative-select" className="mb-1.5 block text-sm font-medium">
              Initiative
            </label>
            <select
              id="initiative-select"
              value={initiativeSlug}
              onChange={(e) => setInitiativeSlug(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
            >
              <option value="">— None / cross-initiative —</option>
              {initiatives
                .filter((i) => i.isActive)
                .map((i) => (
                  <option key={i.slug} value={i.slug}>
                    {i.name}
                  </option>
                ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Tag all extracted entries with this initiative for scoped filtering.
            </p>
          </div>

          <div className="space-y-3 rounded-xl border border-border/60 p-3.5">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={useBlackbox}
                onChange={(e) => setUseBlackbox(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-medium">Use Blackbox for this import</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Uses Blackbox API with smart routing (default `blackbox-pro`) for speed/cost/accuracy balance.
                  Requires `BLACKBOX_API_KEY` on the server.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={useOllama}
                onChange={(e) => setUseOllama(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-medium">Use Ollama for this import</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Sends library extraction to your local Ollama server instead of cloud models.
                  Requires `OLLAMA_HOST` and, optionally, `OLLAMA_MODEL` on the server.
                </span>
              </span>
            </label>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="space-y-4 lg:sticky lg:top-4">
          {/* Processing modes */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Processing Modes</label>
            <ModeSelector selected={modes} onChange={setModes} />
            <p className="mt-2 text-xs text-muted-foreground">
              <span className="font-medium text-teal-700 dark:text-teal-300">Extraction</span> modes create
              review entries. <span className="font-medium text-amber-700 dark:text-amber-300">Screening</span>
              {" "}mode only flags low-value files.
            </p>
            {!extractionModesSelected && (
              <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                Trash Detection alone scans for low-value files but does not create review entries.
                Select Public Canon, Marketing Gold, or Internal Knowledge to extract entries.
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || files.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {loading ? "Starting import…" : `Start Import${files.length > 0 ? ` (${files.length} file${files.length !== 1 ? "s" : ""})` : ""}`}
          </button>

          {batchId && (
            <ImportProgress
              batchId={batchId}
              llmProvider={useOllama ? "ollama" : useBlackbox ? "blackbox" : "anthropic"}
            />
          )}
        </div>
      </div>
    </form>
  );
}
