#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Evidence seal harness — seal-bundle <name> <version>.
//
// Turns tested code into sealed evidence: collects a listed set of artifact
// files, computes a SHA-256 hash per artifact, copies the artifacts into
// evidence/bundles/<name>-<version>/, and writes manifest.json alongside
// them. The bundle directory is immutable once written: sealing refuses to
// overwrite an existing version, so corrections ship as a NEW version
// (optionally linked with --supersedes).
//
// Hashing convention (reused, not reinvented): per-artifact SHA-256 over raw
// file bytes, recorded as "sha256:<hex>" — the same artifact-hash vocabulary
// as src/lib/keon/ledger.ts (computeEntryHash) and
// src/lib/keon/proof-bundle.ts (per-artifact sha256). The manifest itself is
// alongside metadata (never hashed into the artifact hashes), matching the
// proof-bundle rule that composition pins ride alongside sealed bytes.
//
// Chain-vs-bundle boundary: this harness seals FILES, not ledger rows. When
// the Evidence Ledger receipt-chain head is cheaply available the caller
// records it with --chain-head; otherwise the manifest carries an explicit
// chainHeadNote (S11-live composition) instead of a fabricated reference.
//
// Offline + dependency-free: node builtins only (no new dependencies).
// Anyone with node and the pinned commands can re-run the sealed commands
// and re-verify every hash with tools/evidence/verify-bundle.mjs.
//
// Usage:
//   node tools/evidence/seal.mjs seal-bundle <name> <version> \
//     --artifact <src>=<dest> [--artifact <src>=<dest> ...] \
//     --command "<cmd>" [--command "<cmd>" ...] \
//     --negative "<case>" [--negative "<case>" ...] \
//     [--note "<text>"] [--supersedes <bundle-version>] \
//     [--chain-head <hash>] [--chain-head-note "<text>"] \
//     [--sealed-at <iso-utc>] [--root <dir>]
//
//   <src>  repo-relative (resolved under --root) or absolute file path.
//   <dest> bundle-relative destination path (no "..", no absolute paths).
// ---------------------------------------------------------------------------

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Checkout that owns this harness file — env pins always describe it. */
const HARNESS_REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const VERSION_PATTERN = /^v[0-9][A-Za-z0-9._-]*$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const HEX64_PATTERN = /^[a-f0-9]{64}$/;

function fail(reason) {
  console.error(`seal-bundle: FAIL: ${reason}`);
  process.exit(1);
}

function parseFlags(args) {
  const flags = {
    artifacts: [],
    commands: [],
    negatives: [],
    notes: [],
    supersedes: null,
    chainHead: null,
    chainHeadNote: null,
    sealedAt: null,
    root: HARNESS_REPO_ROOT,
  };
  const repeatable = new Set(["--artifact", "--command", "--negative", "--note"]);
  const single = new Set([
    "--supersedes",
    "--chain-head",
    "--chain-head-note",
    "--sealed-at",
    "--root",
  ]);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (repeatable.has(arg)) {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("--")) {
        fail(`missing value for ${arg}.`);
      }
      index += 1;
      if (arg === "--artifact") flags.artifacts.push(value);
      else if (arg === "--command") flags.commands.push(value);
      else if (arg === "--negative") flags.negatives.push(value);
      else flags.notes.push(value);
    } else if (single.has(arg)) {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("--")) {
        fail(`missing value for ${arg}.`);
      }
      index += 1;
      if (arg === "--supersedes") flags.supersedes = value;
      else if (arg === "--chain-head") flags.chainHead = value;
      else if (arg === "--chain-head-note") flags.chainHeadNote = value;
      else if (arg === "--sealed-at") flags.sealedAt = value;
      else flags.root = value;
    } else {
      fail(`unknown argument ${JSON.stringify(arg)}.`);
    }
  }
  return flags;
}

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function gitOutput(gitArgs, cwd) {
  return execFileSync("git", gitArgs, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function assertBundleRelative(dest) {
  if (!isNonEmptyString(dest)) {
    fail("artifact destination must be a non-empty bundle-relative path.");
  }
  if (path.isAbsolute(dest)) {
    fail(`artifact destination must be bundle-relative, got absolute ${JSON.stringify(dest)}.`);
  }
  const normalized = path.normalize(dest).replace(/\\/g, "/");
  if (normalized === "." || normalized.startsWith("../") || normalized.includes("/../")) {
    fail(`artifact destination must stay inside the bundle, got ${JSON.stringify(dest)}.`);
  }
  return normalized;
}

async function main() {
  const positional = process.argv.slice(2);
  if (positional[0] !== "seal-bundle") {
    fail(`usage: node tools/evidence/seal.mjs seal-bundle <name> <version> [options]. Got ${JSON.stringify(positional[0] ?? null)}.`);
  }
  const name = positional[1];
  const version = positional[2];
  if (!isNonEmptyString(name) || !NAME_PATTERN.test(name)) {
    fail(`bundle name must match ${NAME_PATTERN}, got ${JSON.stringify(name ?? null)}.`);
  }
  if (!isNonEmptyString(version) || !VERSION_PATTERN.test(version)) {
    fail(`bundle version must match ${VERSION_PATTERN} (e.g. v1), got ${JSON.stringify(version ?? null)}.`);
  }
  const flags = parseFlags(positional.slice(3));

  // Negatives are mandatory: a sealed campaign without an explicit
  // deny/block/quarantine inventory seals nothing worth keeping.
  if (flags.commands.length === 0) {
    fail("at least one --command pin is required (published commands are mandatory).");
  }
  if (flags.artifacts.length === 0) {
    fail("at least one --artifact <src>=<dest> entry is required.");
  }
  if (flags.negatives.length === 0) {
    fail("at least one --negative case is required (negatives are mandatory).");
  }
  for (const entry of flags.negatives) {
    if (!isNonEmptyString(entry)) {
      fail("negative-case entries must be non-empty strings.");
    }
  }

  const root = path.resolve(flags.root);
  const bundleDir = path.join(root, "evidence", "bundles", `${name}-${version}`);

  // Sealed means immutable: never overwrite an existing version.
  try {
    await stat(bundleDir);
    fail(
      `refusing to overwrite existing bundle directory ${bundleDir}. ` +
        `Corrections ship as a new version (e.g. ${name}-v2 with --supersedes ${name}-${version}).`,
    );
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code !== "ENOENT") {
      fail(`cannot inspect bundle directory ${bundleDir}: ${error.message}`);
    }
    // ENOENT: directory does not exist yet — the expected path.
  }

  // Env pins describe the checkout that produced the artifacts.
  let gitCommit;
  try {
    gitCommit = gitOutput(["rev-parse", "HEAD"], HARNESS_REPO_ROOT);
  } catch (error) {
    fail(`cannot resolve git commit for env pins: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!COMMIT_PATTERN.test(gitCommit)) {
    fail(`git commit pin is malformed: ${JSON.stringify(gitCommit)}.`);
  }
  let packageLockBytes;
  try {
    packageLockBytes = await readFile(path.join(HARNESS_REPO_ROOT, "package-lock.json"));
  } catch (error) {
    fail(`cannot read package-lock.json for env pins: ${error instanceof Error ? error.message : String(error)}`);
  }
  const packageLockHash = `sha256:${sha256Hex(packageLockBytes)}`;

  let sealedAtUtc = flags.sealedAt ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(sealedAtUtc))) {
    fail(`sealed-at timestamp must be ISO-8601 UTC, got ${JSON.stringify(sealedAtUtc)}.`);
  }
  sealedAtUtc = new Date(sealedAtUtc).toISOString();

  const notes = [...flags.notes];
  try {
    const dirty = gitOutput(["status", "--short"], HARNESS_REPO_ROOT);
    if (dirty.length > 0) {
      const preview = dirty.split("\n").slice(0, 10).join("; ");
      notes.push(
        `source tree not clean at seal time (recorded honestly, never blocks the seal): ${preview}`,
      );
    }
  } catch {
    notes.push("source tree cleanliness could not be determined (git status failed).");
  }

  // Collect + copy artifacts, hashing raw bytes before the copy lands.
  const manifestArtifacts = [];
  for (const spec of flags.artifacts) {
    const separator = spec.indexOf("=");
    if (separator <= 0 || separator === spec.length - 1) {
      fail(`--artifact must be <src>=<dest>, got ${JSON.stringify(spec)}.`);
    }
    const srcRaw = spec.slice(0, separator);
    const dest = assertBundleRelative(spec.slice(separator + 1));
    const src = path.isAbsolute(srcRaw) ? srcRaw : path.join(root, srcRaw);
    let bytes;
    try {
      const fileStat = await stat(src);
      if (!fileStat.isFile()) {
        fail(`artifact source is not a file: ${src}.`);
      }
      bytes = await readFile(src);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        fail(`artifact source not found: ${src} (recorded honestly — missing inputs fail the seal, never a silent skip).`);
      }
      throw error;
    }
    const outPath = path.join(bundleDir, dest);
    await mkdir(path.dirname(outPath), { recursive: true });
    await copyFile(src, outPath);
    manifestArtifacts.push({ path: dest, sha256: `sha256:${sha256Hex(bytes)}` });
    console.log(`seal-bundle: artifact ${dest} sha256:${sha256Hex(bytes)}`);
  }

  const manifest = {
    bundle: name,
    version,
    sealedAtUtc,
    commands: [...flags.commands],
    envPins: {
      node: process.version,
      packageLockHash,
      gitCommit,
    },
    artifacts: manifestArtifacts,
    negativeCases: [...flags.negatives],
    chainHead: flags.chainHead,
    chainHeadNote:
      flags.chainHeadNote ??
      "S11-live composition: the Evidence Ledger receipt chain is composed live at runtime, so this offline file bundle pins no static chain head.",
    supersedes: flags.supersedes,
    notes,
  };

  await mkdir(bundleDir, { recursive: true });
  await writeFile(path.join(bundleDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  if (!HEX64_PATTERN.test(packageLockHash.slice("sha256:".length))) {
    fail("internal error: package-lock hash malformed.");
  }
  console.log(`seal-bundle: sealed evidence/bundles/${name}-${version}/ (${manifestArtifacts.length} artifacts, ${manifest.negativeCases.length} negative cases)`);
  console.log(`seal-bundle: env node=${process.version} gitCommit=${gitCommit} packageLockHash=${packageLockHash}`);
  console.log("seal-bundle: RESULT: PASS");
}

await main();
