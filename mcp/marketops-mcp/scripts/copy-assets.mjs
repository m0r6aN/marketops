/**
 * Copies non-TS assets (JSON schemas, rubric markdown, examples) into dist/
 * so they're loadable at runtime from the same relative paths.
 */
import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const dirs = ["schemas", "rubrics", "skills", "examples"];

for (const d of dirs) {
  const src = join(root, "src", d);
  const dst = join(root, "dist", d);
  if (!existsSync(src)) continue;
  await mkdir(dst, { recursive: true });
  await cp(src, dst, { recursive: true });
  console.log(`copied src/${d} → dist/${d}`);
}
