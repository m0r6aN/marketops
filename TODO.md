# Campaign Administration TODO

- [x] Create branch from local main (`blackboxai/campaign-admin-persistence`)
- [ ] Add campaigns SQLite schema + idempotent seed with soft delete support
- [ ] Implement campaigns repository CRUD + discovery restrictions
- [ ] Add validated server actions for campaigns create/update/delete with revalidation
- [ ] Replace fixture-based campaign read facade with DB-backed managed + discovery merge
- [ ] Add reusable campaign form component for create/edit
- [ ] Add `/campaigns/new` page for managed campaign creation
- [ ] Add `/campaigns/[id]/edit` page with 404 for deleted/nonexistent campaigns
- [ ] Add campaign row/detail actions: edit + delete (only in All campaigns and detail page)
- [ ] Ensure deleted campaigns are excluded from lists, metrics, and detail/edit routes
- [ ] Add tests using isolated temporary SQLite database for campaign persistence and behaviors
- [ ] Run verification commands:
  - [ ] `npm test`
  - [ ] `npm run typecheck`
  - [ ] `npm run lint`
  - [ ] `npm run build`
- [ ] Summarize changed files and verification results
