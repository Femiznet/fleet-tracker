---
name: fleet-tracker-data-change
description: "Change Fleet Tracker's Supabase schema, SQL migrations, access policies, database types, or data flows. Use for table/column changes, RLS, migrations, and privileged queries."
---

# Fleet Tracker data changes

1. Inspect the current migrations, generated `src/lib/database.types.ts`, and all affected query/action call sites before proposing a schema change.
2. Add a new migration under `supabase/migrations/`; never edit an already-applied migration to change deployed behavior.
3. Review who can read or mutate the affected data. Add or adjust authorization and row-level policies where the schema or access pattern requires them.
4. Keep service-role usage on the server and behind explicit authentication/authorization. Validate all values crossing a form, API, or external integration boundary.
5. Update generated TypeScript types only when the schema changes, and confirm the linked project/environment before running `pnpm db:types`.
6. Never run `pnpm db:push`, `pnpm db:reset`, or another remote/destructive database command without explicit approval. Run `pnpm typecheck` and other safe focused checks.
7. Report the migration and any database operation that remains for the user to run.
