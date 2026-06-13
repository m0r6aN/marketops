# MarketOps Developer Workflow

## Branch Hygiene

- **Never work directly on `main`.** All changes come in via PR.
- **Start from a clean, up-to-date main** before creating any branch:
  ```sh
  git checkout main
  git pull --ff-only origin main
  git status --short
  ```
  Confirm `git status --short` is empty before proceeding.
- **Create one branch per lane** using the appropriate prefix:
  - `feat/<name>` — new user-facing functionality
  - `chore/<name>` — scripts, tooling, configuration, docs-only changes
  - `docs/<name>` — standalone documentation or spec additions
  - `fix/<name>` — targeted bug fixes
- **Push branch and open a PR back to main.** Do not squash or merge locally.

## Standard Verification

Run all three commands before committing and again before opening a PR. All must exit clean.

```sh
npm run build
npm run lint
npm run typecheck
git status --short
```

- `npm run build` — Next.js production build; catches import and compilation errors.
- `npm run lint` — ESLint via `eslint-config-next`; catches style and correctness issues.
- `npm run typecheck` — `tsc --noEmit`; catches type errors without emitting output files.
- `git status --short` — confirms no unexpected generated or modified files in the working tree.

If any command fails, fix the issue before committing. Do not suppress errors with `--no-verify` or inline `// eslint-disable` unless the suppression is intentional, documented, and reviewed in the PR.

## Generated File Guidance

Next.js writes `next-env.d.ts` to the project root during build and type generation. This file may drift (e.g., new route types added by the framework) after running `npm run build` or `npm run typecheck`.

**Before committing:**

1. Run `git diff next-env.d.ts` to inspect any changes.
2. If the diff only reflects legitimate route additions or framework updates, commit it alongside the feature that caused it.
3. If the diff is noise or does not match any change in this branch, restore the file:
   ```sh
   git checkout -- next-env.d.ts
   ```
4. Never commit `next-env.d.ts` changes that do not correspond to a deliberate route or config change in the same PR.

## PR Report Template

Every PR description should include the following sections:

```
## Branch
<branch-name>

## Commits
<list of commit hashes and one-line messages>

## Changed Files
<list of files added, modified, or deleted>

## Verification
npm run build    — [pass / fail + output excerpt]
npm run lint     — [pass / fail + output excerpt]
npm run typecheck — [pass / fail + output excerpt]
git status       — [clean / list of unexpected files]

## Deferred Work
<list any intentionally deferred items with a one-line reason each>

## Final git status
<output of git status --short after all commits>
```

Use this template for all PRs, including chore and docs lanes. It ensures reviewers can reproduce the verification state and understand what was explicitly left out.

## Parallel Work Guidance

Multiple branches may be active simultaneously. The following rules apply:

- **Docs-only lanes are the safest parallel work.** A branch that only adds files under `docs/` has zero risk of conflicting with production lanes.
- **Production lanes are safe in parallel only when they do not touch the same routes, components, or domain files.** For example:
  - A campaign route lane and an assets route lane can run in parallel if they create new files under separate directories and do not modify shared components.
  - Two lanes that both modify `src/components/initiative-detail-sections.tsx` or `src/app/page.tsx` cannot safely run in parallel without explicit coordination.
- **Serialize lanes that touch:** dashboard layout, app-level nav, initiative detail page, shared UI components (e.g., `Badge`, `Card` wrappers), or domain type files (`src/lib/initiatives.ts`, `src/lib/campaigns.ts`).
- **When in doubt, serialize.** The cost of a merge conflict outweighs the benefit of parallelism.
- When a parallel lane is explicitly coordinated (e.g., a spec says "Agent A does X, Agent B does Y"), document the coordination boundary in the PR description.
