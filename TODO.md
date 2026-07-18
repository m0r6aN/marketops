# Initiatives CRUD Migration TODO

- [x] Create initiatives domain modules:
  - [x] `src/lib/initiatives/types.ts`
  - [x] `src/lib/initiatives/seed.ts`
  - [x] `src/lib/initiatives/db.ts`
  - [x] `src/lib/initiatives/repository.ts`
  - [x] Update `src/lib/initiatives.ts` as compatibility shim

- [x] Add initiatives server actions:
  - [x] `src/app/actions/initiatives.ts`

- [x] Refactor initiatives list + detail to repository-backed data:
  - [x] Update `src/app/initiatives/page.tsx`
  - [x] Update `src/components/initiative-table.tsx`
  - [x] Update `src/app/initiatives/[slug]/page.tsx`

- [x] Add CRUD UI building blocks:
  - [x] `src/components/initiative-form.tsx`
  - [x] `src/components/initiative-row-actions.tsx`

- [x] Add CRUD pages:
  - [x] `src/app/initiatives/new/page.tsx`
  - [x] `src/app/initiatives/[slug]/edit/page.tsx`

- [ ] Validation and checks:
  - [ ] Run lint/type checks
  - [ ] Verify `/initiatives`, `/initiatives/new`, `/initiatives/[slug]/edit`, `/initiatives/[slug]`
