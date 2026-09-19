#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Offline bundle verifier — recompute every sealed hash, fail closed.
//
// Usage:
//   node tools/evidence/verify-bundle.mjs <bundleDir> [<bundleDir> ...]
//   node tools/evidence/verify-bundle.mjs --all [--root <dir>]
//
// --all verifies every directory directly under <root>/evidence/bundles
// (default <root> is the checkout that owns this verifier file).
//
// Fail-closed vocabulary: every refusal names its class so transcripts stay
// actionable — [missing field] (manifest absent/unparseable/required field
// absent), [gap] (empty commands/artifacts/negatives — a bundle that seals
// nothing), [tamper] (a sealed file whose bytes no longer recompute to the
// sealed hash, or a file that vanished), [mismatch] (identity break: the
// directory name no longer matches bundle+version, a hash is malformed, or
// an optional field has the wrong shape).
//
// Exit 0 only when every named bundle passes; exit 1 otherwise. Node
// builtins only — anyone with node can run this, no install step.
// ---------------------------------------------------------------------------

import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HARNESS_REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const VERSION_PATTERN = /^v[0-9][A-Za-z0-9._-]*$/;
const SEALED_HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

async function verifyBundle(bundleDir) {
  const label = path.resolve(bundleDir);
  const failures = [];
  const passes = [];
  const note = (ok, text) => {
    if (ok) passes.push(text);
    else failures.push(text);
  };

  // -- [missing field]: manifest must exist and parse. -----------------------
  let manifestRaw;
  try {
    manifestRaw = await readFile(path.join(label, "manifest.json"), "utf8");
  } catch {
    return {
      label,
      ok: false,
      passes,
      failures: [`[missing field] manifest.json absent in ${label}.`],
    };
  }
  let manifest;
  try {
    manifest = JSON.parse(manifestRaw);
  } catch (error) {
    return {
      label,
      ok: false,
      passes,
      failures: [`[missing field] manifest.json is not valid JSON in ${label}: ${error instanceof Error ? error.message : String(error)}.`],
    };
  }
  if (manifest === null || typeof manifest !== "object" || Array.isArray(manifest)) {
    return {
      label,
      ok: false,
      passes,
      failures: [`[missing field] manifest.json must be a JSON object in ${label}.`],
    };
  }

  // -- Identity: bundle/version present, well-formed, match the directory. --
  const identityOk =
    isNonEmptyString(manifest.bundle) &&
    NAME_PATTERN.test(manifest.bundle) &&
    isNonEmptyString(manifest.version) &&
    VERSION_PATTERN.test(manifest.version);
  note(
    identityOk,
    identityOk
      ? `identity bundle=${manifest.bundle} version=${manifest.version}.`
      : `[missing field] manifest requires bundle ${NAME_PATTERN} and version ${VERSION_PATTERN} in ${label}.`,
  );
  if (identityOk) {
    const expectedDir = `${manifest.bundle}-${manifest.version}`;
    const actualDir = path.basename(path.resolve(label));
    note(
      actualDir === expectedDir,
      actualDir === expectedDir
        ? `directory matches identity (${expectedDir}).`
        : `[mismatch] directory ${JSON.stringify(actualDir)} does not match bundle identity ${JSON.stringify(expectedDir)} (moved or renamed bundle).`,
    );
  }

  // -- sealedAtUtc must be a real timestamp. ---------------------------------
  note(
    isNonEmptyString(manifest.sealedAtUtc) && !Number.isNaN(Date.parse(manifest.sealedAtUtc)),
    isNonEmptyString(manifest.sealedAtUtc) && !Number.isNaN(Date.parse(manifest.sealedAtUtc))
      ? `sealedAtUtc=${manifest.sealedAtUtc}.`
      : `[missing field] manifest requires a valid ISO-8601 sealedAtUtc in ${label}.`,
  );

  // -- [gap]: commands / artifacts / negatives must be non-empty. ------------
  const commandsOk =
    Array.isArray(manifest.commands) &&
    manifest.commands.length > 0 &&
    manifest.commands.every(isNonEmptyString);
  note(
    commandsOk,
    commandsOk
      ? `${manifest.commands.length} pinned command(s).`
      : `[gap] manifest requires a non-empty commands[] list of pinned re-run commands in ${label}.`,
  );

  const envPins = manifest.envPins;
  const envOk =
    envPins !== null &&
    typeof envPins === "object" &&
    !Array.isArray(envPins) &&
    isNonEmptyString(envPins.node) &&
    isNonEmptyString(envPins.packageLockHash) &&
    isNonEmptyString(envPins.gitCommit);
  note(
    envOk,
    envOk
      ? `env pins node=${envPins.node} gitCommit=${envPins.gitCommit} packageLockHash=${envPins.packageLockHash}.`
      : `[missing field] manifest requires envPins {node, packageLockHash, gitCommit} in ${label}.`,
  );

  const artifactsOk =
    Array.isArray(manifest.artifacts) &&
    manifest.artifacts.length > 0 &&
    manifest.artifacts.every(
      (artifact) =>
        artifact !== null &&
        typeof artifact === "object" &&
        isNonEmptyString(artifact.path) &&
        isNonEmptyString(artifact.sha256),
    );
  note(
    artifactsOk,
    artifactsOk
      ? `${manifest.artifacts.length} sealed artifact(s).`
      : `[gap] manifest requires a non-empty artifacts[] list of {path, sha256} entries in ${label}.`,
  );

  const negativesOk =
    Array.isArray(manifest.negativeCases) &&
    manifest.negativeCases.length > 0 &&
    manifest.negativeCases.every(isNonEmptyString);
  note(
    negativesOk,
    negativesOk
      ? `${manifest.negativeCases.length} negative case(s) inventoried.`
      : `[gap] manifest requires a non-empty negativeCases[] inventory in ${label} (negatives are mandatory).`,
  );

  // -- Optional fields: when present, they must have the right shape. --------
  const optionalChecks = [
    manifest.supersedes === null ||
      manifest.supersedes === undefined ||
      isNonEmptyString(manifest.supersedes),
    manifest.chainHead === null ||
      manifest.chainHead === undefined ||
      isNonEmptyString(manifest.chainHead),
    manifest.chainHeadNote === null ||
      manifest.chainHeadNote === undefined ||
      isNonEmptyString(manifest.chainHeadNote),
    manifest.notes === undefined ||
      (Array.isArray(manifest.notes) && manifest.notes.every(isNonEmptyString)),
  ];
  note(
    optionalChecks.every(Boolean),
    optionalChecks.every(Boolean)
      ? "optional fields well-formed."
      : "[mismatch] optional manifest fields (supersedes/chainHead/chainHeadNote/notes) have the wrong shape.",
  );

  // -- [tamper]: recompute every artifact hash from live bytes. --------------
  if (artifactsOk) {
    for (const artifact of manifest.artifacts) {
      if (path.isAbsolute(artifact.path)) {
        failures.push(`[mismatch] artifact path must be bundle-relative, got absolute ${JSON.stringify(artifact.path)}.`);
        continue;
      }
      const normalized = path.normalize(artifact.path).replace(/\\/g, "/");
      if (normalized === "." || normalized.startsWith("../") || normalized.includes("/../")) {
        failures.push(`[mismatch] artifact path escapes the bundle: ${JSON.stringify(artifact.path)}.`);
        continue;
      }
      if (!SEALED_HASH_PATTERN.test(artifact.sha256)) {
        failures.push(`[mismatch] artifact ${JSON.stringify(artifact.path)} carries a malformed sealed hash ${JSON.stringify(artifact.sha256)} (want sha256:<64 hex>).`);
        continue;
      }
      const filePath = path.join(label, normalized);
      let bytes;
      try {
        const fileStat = await stat(filePath);
        if (!fileStat.isFile()) {
          failures.push(`[tamper] sealed artifact is no longer a file: ${JSON.stringify(artifact.path)}.`);
          continue;
        }
        bytes = await readFile(filePath);
      } catch {
        failures.push(`[tamper] sealed artifact missing from bundle: ${JSON.stringify(artifact.path)}.`);
        continue;
      }
      const recomputed = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
      if (recomputed !== artifact.sha256) {
        failures.push(
          `[tamper] artifact ${JSON.stringify(artifact.path)} no longer recomputes: sealed=${artifact.sha256} recomputed=${recomputed}.`,
        );
      } else {
        passes.push(`artifact ${artifact.path} recomputes ${artifact.sha256}.`);
      }
    }
  }

  return { label, ok: failures.length === 0, passes, failures };
}

async function listBundles(root) {
  const base = path.join(path.resolve(root), "evidence", "bundles");
  let entries;
  try {
    entries = await readdir(base, { withFileTypes: true });
  } catch {
    console.error(`verify-bundle: FAIL: [missing field] bundles directory absent: ${base}.`);
    process.exit(1);
  }
  const dirs = entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(base, entry.name));
  if (dirs.length === 0) {
    console.error(`verify-bundle: FAIL: [gap] no bundles under ${base}.`);
    process.exit(1);
  }
  return dirs.sort();
}

async function main() {
  const args = process.argv.slice(2);
  let root = HARNESS_REPO_ROOT;
  let all = false;
  const targets = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--all") {
      all = true;
    } else if (args[index] === "--root") {
      const value = args[index + 1];
      if (value === undefined) {
        console.error("verify-bundle: FAIL: [missing field] --root needs a value.");
        process.exit(1);
      }
      index += 1;
      root = value;
    } else if (args[index].startsWith("--")) {
      console.error(`verify-bundle: FAIL: [missing field] unknown argument ${JSON.stringify(args[index])}.`);
      process.exit(1);
    } else {
      targets.push(args[index]);
    }
  }
  const bundleDirs = all ? await listBundles(root) : targets;
  if (bundleDirs.length === 0) {
    console.error("verify-bundle: FAIL: [missing field] usage: verify-bundle.mjs <bundleDir> [...] | --all [--root <dir>].");
    process.exit(1);
  }

  let failed = 0;
  for (const dir of bundleDirs) {
    console.log(`--- bundle: ${dir} ---`);
    const result = await verifyBundle(dir);
    for (const line of result.passes) console.log(`  PASS: ${line}`);
    for (const line of result.failures) console.log(`  FAIL: ${line}`);
    console.log(result.ok ? `--- RESULT: PASS ${dir} ---` : `--- RESULT: FAIL ${dir} ---`);
    if (!result.ok) failed += 1;
  }
  if (failed > 0) {
    console.log(`verify-bundle: RESULT: FAIL (${failed} of ${bundleDirs.length} bundle(s) refused).`);
    process.exit(1);
  }
  console.log(`verify-bundle: RESULT: PASS (all ${bundleDirs.length} bundle(s) verify).`);
}

await main();
