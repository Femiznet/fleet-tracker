# Next.js and UI conventions

- Follow the existing Next.js App Router structure and TypeScript patterns. Keep components server-rendered by default; add `"use client"` only for browser state, event handlers, or client-only APIs.
- Reuse existing components and the CSS variables in `src/app/global.css`. Prefer the established Tailwind utility style over adding a new styling system or dependency.
- Keep loading, empty, error, and success states understandable. Check keyboard access, semantic HTML, responsive layouts, and reduced-motion behavior when changing UI.
- Keep server-only code, privileged Supabase clients, and secrets out of client components. Authenticate and authorize server actions and API handlers before privileged operations.
- Preserve unrelated user changes. Verify UI behavior in a running app or browser when practical; otherwise state what was and was not checked.
