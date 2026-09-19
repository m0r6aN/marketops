// Evidence seal harness self-tests (EHG-007 mutation coverage at the gate:
// seal a temp fixture bundle, tamper a copy, and assert the offline verifier
// refuses the tampered copy while the untouched bundle still verifies).
//
// Hermetic: every file lands under os.tmpdir() via fs.mkdtemp — the repo
// tree is never written. Env pins (node version, lockfile hash, git commit)
// still describe the real checkout that owns the harness; only the bundle
// output root is redirected with --root.

import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const SEAL_SCRIPT = path.resolve(HARNESS_DIR, "..", "..", "tools", "evidence", "seal.mjs");
const VERIFY_SCRIPT = path.resolve(HARNESS_DIR, "..", "..", "tools", "evidence", "verify-bundle.mjs");

function runNode(script, args, cwd) {
  try {
    const output = execFileSync(process.execPath, [script, ...args], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, output };
  } catch (error) {
    const failed = error as { status?: number; stdout?: string; stderr?: string };
    return {
      status: typeof failed.status === "number" ? failed.status : 1,
      output: `${failed.stdout ?? ""}\n${failed.stderr ?? ""}`,
    };
  }
}

async function makeFixtureRoot() {
  const root = await mkdtemp(path.join(tmpdir(), "evidence-seal-test-"));
  await mkdir(path.join(root, "fixtures"), { recursive: true });
  await writeFile(path.join(root, "fixtures", "alpha.txt"), "alpha fixture bytes\n", "utf8");
  await writeFile(path.join(root, "fixtures", "beta.txt"), "beta fixture bytes\n", "utf8");
  return root;
}

function sealArgs(root, name, version) {
  return [
    "seal-bundle",
    name,
    version,
    "--artifact",
    `fixtures/alpha.txt=transcripts/alpha.log`,
    "--artifact",
    `fixtures/beta.txt=transcripts/beta.log`,
    "--command",
    "npx vitest run tests/evidence/seal.test.ts",
    "--negative",
    "fixture/deny-tampered-copy: verifier refuses a one-byte mutation",
  ];
}

describe("evidence seal harness", () => {
  it("seal then verify round-trips to PASS", async () => {
    const root = await makeFixtureRoot();
    const sealed = runNode(SEAL_SCRIPT, sealArgs(root, "selftest", "v1").concat(["--root", root]), root);
    expect(sealed.status).toBe(0);
    expect(sealed.output).toContain("RESULT: PASS");

    const bundleDir = path.join(root, "evidence", "bundles", "selftest-v1");
    const manifest = JSON.parse(await readFile(path.join(bundleDir, "manifest.json"), "utf8")) as {
      bundle: string;
      version: string;
      artifacts: Array<{ path: string; sha256: string }>;
      negativeCases: string[];
    };
    expect(manifest.bundle).toBe("selftest");
    expect(manifest.version).toBe("v1");
    expect(manifest.artifacts).toHaveLength(2);
    expect(manifest.negativeCases.length).toBeGreaterThan(0);

    const verified = runNode(VERIFY_SCRIPT, [bundleDir], root);
    expect(verified.output).toContain("RESULT: PASS");
    expect(verified.status).toBe(0);
  });

  it("refuses a tampered copy with an explicit tamper reason", async () => {
    const root = await makeFixtureRoot();
    expect(runNode(SEAL_SCRIPT, sealArgs(root, "selftest", "v1").concat(["--root", root]), root).status).toBe(0);

    const bundleDir = path.join(root, "evidence", "bundles", "selftest-v1");
    const tamperedDir = path.join(root, "evidence", "bundles-tampered", "selftest-v1");
    await cp(bundleDir, tamperedDir, { recursive: true });
    // One-byte mutation of a sealed artifact copy (the original stays clean).
    await writeFile(path.join(tamperedDir, "transcripts", "alpha.log"), "ALPHA fixture bytes\n", "utf8");

    const verified = runNode(VERIFY_SCRIPT, [tamperedDir], root);
    expect(verified.status).toBe(1);
    expect(verified.output).toContain("[tamper]");
    expect(verified.output).toContain("RESULT: FAIL");

    // The untouched bundle still verifies — tamper evidence is localized.
    const clean = runNode(VERIFY_SCRIPT, [bundleDir], root);
    expect(clean.status).toBe(0);
  });

  it("refuses to overwrite an existing version (corrections are new versions)", async () => {
    const root = await makeFixtureRoot();
    expect(runNode(SEAL_SCRIPT, sealArgs(root, "selftest", "v1").concat(["--root", root]), root).status).toBe(0);
    const second = runNode(SEAL_SCRIPT, sealArgs(root, "selftest", "v1").concat(["--root", root]), root);
    expect(second.status).toBe(1);
    expect(second.output).toMatch(/refusing to overwrite/i);
  });

  it("refuses a seal with no negative cases (negatives are mandatory)", async () => {
    const root = await makeFixtureRoot();
    const args = [
      "seal-bundle",
      "selftest",
      "v1",
      "--artifact",
      "fixtures/alpha.txt=transcripts/alpha.log",
      "--command",
      "npx vitest run tests/evidence/seal.test.ts",
      "--root",
      root,
    ];
    const sealed = runNode(SEAL_SCRIPT, args, root);
    expect(sealed.status).toBe(1);
    expect(sealed.output).toMatch(/negative/i);
  });
});
