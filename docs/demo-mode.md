# Demo mode (apps/web's own production build)

> **Note:** this is *not* what's currently deployed to GitHub Pages — that's
> [static/](../static/README.md), a plain HTML/CSS/JS rebuild, because a
> bundled SPA build hit issues on Pages. This doc describes `apps/web`'s own
> demo mode, which still works the same way for any other static host (or if
> Pages is revisited later) but isn't live right now.

GitHub Pages serves static files only — there is no server to run
`apps/api` or Postgres on. To still ship something that looks like a real,
used app from a build of `apps/web`, its production build runs entirely
against a bundled dataset instead of the network.

## How it's wired

1. **`scripts/generate-demo-data.mjs`** generates a deterministic (seeded
   PRNG) dataset of exactly 500 records — 1 tutor, 6 subjects, 60 students,
   300 lessons, 100 payments, 25 reviews, 5 goal-tracking plans, 3
   subscription plans — modeled directly on the shared entity types in
   `packages/shared/src/entities.ts`. Written to
   `apps/web/src/demo/dataset.json` (consumed by the app) and mirrored to
   `db/demo-data.json` (for reference/inspection outside the frontend).
   Re-run it after changing entity shapes: `node scripts/generate-demo-data.mjs`.

2. **`apps/web/src/demo/mockServer.ts`** is an in-browser stand-in for
   `apps/api`. It deep-clones the dataset once per page load into memory and
   exposes `mockRequest(method, path, body)`, which pattern-matches the same
   route surface as `apps/api/src/routes/*.ts` (`GET /lessons?date=`,
   `GET /students/:id`, `POST /lessons/:id/complete`, etc.) and replicates
   the computed-value logic from `db/views.sql` (balance, debt/blocked
   status, rating) in plain JS/TS against the in-memory arrays.

3. **`apps/web/src/api/client.ts`**'s `api()` function branches on
   `VITE_DEMO_MODE`: true routes every call through `mockRequest` instead of
   `fetch`. Every page (`Today.tsx`, `Students.tsx`, etc.) is unaware of the
   difference — they only ever call `get`/`post`/`patch`/`put` from
   `client.ts`.

4. **`apps/web/src/state/AuthContext.tsx`** auto-logs-in as the seeded demo
   tutor on mount when `VITE_DEMO_MODE` is true, so a Pages visitor lands
   straight in a populated app instead of an empty login screen.

5. **`apps/web/.env.production`** sets `VITE_DEMO_MODE=true`. Vite loads
   `.env.production` automatically for `vite build` (mode=production), so
   the flag doesn't need to be set anywhere in CI — a plain `npm run build`
   produces the demo build. Local dev (`npm run dev`) uses `.env` (no demo
   flag) and hits the real `apps/api` server as normal.

6. **`apps/web/vite.config.ts`** sets `base: '/TutorSpace/'` only for
   `command === 'build'`, matching where GitHub Pages serves this repo
   (`https://racoonkingtop1.github.io/TutorSpace/`). Local dev keeps `base: '/'`.

7. **Routing is `HashRouter`, not `BrowserRouter`** (`apps/web/src/main.tsx`)
   — GitHub Pages has no server-side rewrite rule, so a path-based deep link
   like `/students/:id` would 404 on refresh. Hash routing
   (`/#/students/:id`) always resolves to `index.html` regardless of host.

## What this is NOT

- Not a general-purpose "mock backend for tests" — it exists solely to make
  the static Pages build functional. Don't extend it to be a test double for
  `apps/api`'s own tests; write those against the real routes/DB instead.
- Not persistent. All writes (`POST /lessons`, `PUT /settings/payment-policy`,
  etc.) mutate the in-memory clone only; a page reload resets everything back
  to the generated dataset. This is called out to the visitor via a banner
  in `AppShell.tsx`.
- Not a schema reference. If `mockServer.ts` and `apps/api`'s real routes
  ever disagree on a response shape, `db/schema.sql` + the real API are
  correct — fix the mock, not the other way around.

## Rebuilding the demo dataset

```bash
node scripts/generate-demo-data.mjs
npm run build -w apps/web
```
