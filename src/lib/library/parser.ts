/**
 * Library Canon Foundry — file parser.
 *
 * Extracts normalised plain-text from uploaded files, chunks it for LLM
 * processing, detects sensitive filenames, and hashes content for duplicate
 * detection.  Runs entirely server-side on Buffer/Uint8Array input — no
 * filesystem access required (files come from multipart uploads).
 */
import { createHash } from "node:crypto";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { PDFParse } from "pdf-parse";

// ─────────────────────────────────────────────────────────────────────────────
// Sensitive-file detection
// ─────────────────────────────────────────────────────────────────────────────

const SENSITIVE_PATTERNS = [
  /^\.env/i,
  /\.pem$/i,
  /\.key$/i,
  /\.p12$/i,
  /\.pfx$/i,
  /credential/i,
  /secret/i,
  /password/i,
  /\.token$/i,
  /auth.*dump/i,
  /id_rsa/i,
  /id_ed25519/i,
  /\.ssh[/\\]/i,
];

/**
 * Returns true if the filename looks like it may contain secrets.
 * The upload handler should warn the user and require explicit opt-in.
 */
export function detectSensitiveFilename(filename: string): boolean {
  const basename = filename.split(/[/\\]/).pop() ?? filename;
  return SENSITIVE_PATTERNS.some((re) => re.test(basename));
}

// ─────────────────────────────────────────────────────────────────────────────
// Text extraction
// ─────────────────────────────────────────────────────────────────────────────

export type ExtractResult =
  | { status: "ok"; text: string }
  | { status: "failed"; error: string };

let pdfWorkerConfigured = false;

function configurePdfWorker(): void {
  if (pdfWorkerConfigured) return;

  const workerPath = join(
    process.cwd(),
    "node_modules",
    "pdf-parse",
    "dist",
    "pdf-parse",
    "esm",
    "pdf.worker.mjs"
  );

  PDFParse.setWorker(pathToFileURL(workerPath).href);
  pdfWorkerConfigured = true;
}

/**
 * Extracts plain text from a file buffer based on its original filename.
 * Supports .md, .txt, .json, .yaml, .yml, .csv, .html, and .pdf.
 */
export async function extractText(filename: string, buffer: Buffer): Promise<ExtractResult> {
  const lower = filename.toLowerCase();

  try {
    if (lower.endsWith(".md") || lower.endsWith(".txt")) {
      return { status: "ok", text: buffer.toString("utf-8") };
    }

    if (lower.endsWith(".json")) {
      const parsed = JSON.parse(buffer.toString("utf-8"));
      // Pretty-print so the LLM can read it naturally
      return { status: "ok", text: JSON.stringify(parsed, null, 2) };
    }

    if (lower.endsWith(".yaml") || lower.endsWith(".yml")) {
      // YAML is human-readable; pass through as-is
      return { status: "ok", text: buffer.toString("utf-8") };
    }

    if (lower.endsWith(".csv")) {
      // Join rows with newlines for readability
      const raw = buffer.toString("utf-8");
      const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
      return { status: "ok", text: lines.join("\n") };
    }

    if (lower.endsWith(".html") || lower.endsWith(".htm")) {
      return { status: "ok", text: stripHtml(buffer.toString("utf-8")) };
    }

    if (lower.endsWith(".pdf")) {
      return await extractPdfText(buffer);
    }

    // Unsupported type — still try UTF-8 but flag it
    const raw = buffer.toString("utf-8");
    if (raw.includes("\x00")) {
      return { status: "failed", error: "Binary file — cannot extract text" };
    }
    return { status: "ok", text: raw };
  } catch (err) {
    return {
      status: "failed",
      error: err instanceof Error ? err.message : "Unknown parse error",
    };
  }
}

async function extractPdfText(buffer: Buffer): Promise<ExtractResult> {
  configurePdfWorker();

  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    const text = result.text.trim();
    if (!text) {
      return { status: "failed", error: "PDF produced no extractable text" };
    }
    return { status: "ok", text };
  } finally {
    await parser.destroy();
  }
}

/** Very simple HTML tag stripper.  Good enough for document text extraction. */
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Chunking
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Splits text into chunks suitable for LLM processing.
 *
 * Strategy:
 * 1. Split on blank lines (paragraph / section boundaries).
 * 2. Re-join paragraphs into chunks up to `maxChars` characters.
 * 3. Markdown heading transitions always start a new chunk.
 *
 * Default maxChars ~8 000 chars ≈ 2 000 tokens (safe for Sonnet context).
 */
export function chunkText(text: string, maxChars = 8_000): string[] {
  if (!text.trim()) return [];

  // Split on blank lines
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    const isHeading = /^#{1,6}\s/.test(para);

    // Start a new chunk at headings or when adding this paragraph would overflow
    if (
      (isHeading && current.trim().length > 0) ||
      (current.length + para.length + 2 > maxChars && current.trim().length > 0)
    ) {
      chunks.push(current.trim());
      current = "";
    }

    current += (current.length > 0 ? "\n\n" : "") + para;
  }

  if (current.trim().length > 0) {
    chunks.push(current.trim());
  }

  return chunks;
}

// ─────────────────────────────────────────────────────────────────────────────
// Content hashing (duplicate detection)
// ─────────────────────────────────────────────────────────────────────────────

/** Returns a SHA-256 hex digest of the normalised text for deduplication. */
export function hashContent(text: string): string {
  // Normalise whitespace before hashing so minor formatting changes don't
  // produce different hashes for the same content.
  const normalised = text.replace(/\s+/g, " ").trim().toLowerCase();
  return createHash("sha256").update(normalised, "utf-8").digest("hex");
}

// ─────────────────────────────────────────────────────────────────────────────
// Memory value heuristics
// ─────────────────────────────────────────────────────────────────────────────

const HIGH_VALUE_KEYWORDS = [
  "revenue", "pricing", "cost", "roadmap", "architecture", "strategy",
  "positioning", "audience", "mission", "vision", "differentiator",
  "competitive", "deployment", "integration", "security", "auth",
  "api", "database", "schema", "workflow", "pipeline", "feature",
  "launch", "go-to-market", "gtm", "okr", "kpi", "metric", "conversion",
];

const LOW_VALUE_PATTERNS = [
  /^(todo|fixme|hack|xxx|note):/i,
  /^\[object Object\]/,
  /^undefined$/i,
  /^null$/i,
  /^(yes|no|ok|done|true|false)$/i,
];

/**
 * Heuristic memory-value adjustment on top of the LLM score.
 * Returns a delta in [-20, +20] range.
 */
export function computeMemoryValueAdjustment(text: string): number {
  const lower = text.toLowerCase();
  let delta = 0;

  // Boost for strategic keywords
  for (const kw of HIGH_VALUE_KEYWORDS) {
    if (lower.includes(kw)) {
      delta += 2;
    }
  }
  delta = Math.min(delta, 20);

  // Penalty for obvious low-value content
  if (LOW_VALUE_PATTERNS.some((re) => re.test(text.trim()))) {
    delta -= 20;
  }

  // Penalty for very short content (< 50 chars)
  if (text.trim().length < 50) {
    delta -= 10;
  }

  return Math.max(-20, Math.min(20, delta));
}
