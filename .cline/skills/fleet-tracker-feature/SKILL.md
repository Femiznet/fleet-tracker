---
name: fleet-tracker-feature
description: "Implement or extend a Fleet Tracker feature in this Next.js and Supabase app. Use for new screens, user workflows, server actions, API routes, and end-to-end feature requests."
---

# Fleet Tracker feature delivery

1. Trace the relevant route, components, data access, and existing auth checks before editing. Preserve all unrelated working-tree changes.
2. Deliver the smallest complete vertical slice: connect the UI to the existing server/data patterns, including validation and visible pending, success, empty, and error states as applicable.
3. Keep App Router components server-side by default. Put browser interactions in focused client components and use existing server actions or API route conventions.
4. For Supabase access, use the appropriate typed client. Keep service-role operations server-only and enforce authentication/authorization before using them.
5. Match the app's existing components, Tailwind usage, and CSS variables in `src/app/global.css`; avoid introducing a new design system for a local feature.
6. Run the focused available checks, normally `pnpm lint` and `pnpm typecheck`. For UI changes, inspect the running page at a narrow and wide viewport when practical.
7. Summarize the behavior changed and checks actually run. Do not claim a browser or database check that did not happen.
