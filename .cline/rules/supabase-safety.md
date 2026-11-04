# Supabase and schema safety

- Use the typed Supabase clients and existing server/client boundaries. Never expose `SUPABASE_SERVICE_ROLE_KEY` or import `supabaseAdmin` into client code.
- Validate and authorize every server action, API route, and privileged database operation. Treat form data, request bodies, and external messages as untrusted input.
- Add new schema changes as new SQL migrations under `supabase/migrations/`; do not rewrite migrations that may already have been applied.
- Keep `src/lib/database.types.ts` aligned with real schema changes. Check the target Supabase environment before running linked commands.
- Do not run `pnpm db:push`, `pnpm db:reset`, or other remote/destructive database operations without explicit user approval. Prefer local checks such as `pnpm typecheck` when possible.
