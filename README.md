# Tutor Service

A tool for independent tutors to track students, schedule lessons, record
payments/debt, publish a public booking card, and manage their own app
subscription. Scaffolded from a Claude Design prototype (`Prototype.dc.html`
and its per-screen mockups) plus a hand-written DB schema doc; see
[docs/db-schema-analysis.md](docs/db-schema-analysis.md) for how the two were
reconciled.

## Stack

Monorepo, npm workspaces:

- **`apps/web`** — React 18 + Vite + TypeScript, client-side routed (react-router).
- **`apps/api`** — Express + TypeScript, talks to Postgres via `pg` directly (no ORM).
- **`packages/shared`** — TypeScript entity types + Zod validation schemas, imported by both.
- **`db/`** — the actual source of truth: `schema.sql`, `views.sql` (computed values), `seed.sql`.

Database is plain PostgreSQL, hosted on Supabase for convenience (connection
pooling, backups, dashboard) — but the API is a normal Express server with its
own auth (email/password + JWT), not `supabase-js` in the browser. See the
"auth model" note in the analysis doc for why that split matters for the schema.

## Getting started

1. Create a Postgres database (a free Supabase project works, or local Postgres).
2. Apply the schema:
   ```bash
   psql "$DATABASE_URL" -f db/schema.sql
   psql "$DATABASE_URL" -f db/views.sql
   psql "$DATABASE_URL" -f db/seed.sql   # optional sample data
   ```
3. Install dependencies from the repo root (workspaces install everything):
   ```bash
   npm install
   ```
4. Copy env files and fill in `DATABASE_URL`:
   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env
   ```
5. Run both apps (two terminals):
   ```bash
   npm run dev:api
   npm run dev:web
   ```
   API on `:4000`, web on `:5173`.

## Repository layout

```
apps/
  api/                  Express API
    src/
      routes/           one file per resource (tutors, students, lessons, ...)
      middleware/        auth (JWT), error handling
      db.ts              pg Pool
  web/                  React app
    src/
      pages/             one component per design screen
      components/        AppShell (phone-frame layout + bottom nav)
      state/AuthContext.tsx
      api/client.ts       thin fetch wrapper
packages/
  shared/
    src/
      entities.ts         DB row types (camelCase, mirrors schema.sql)
      computed.ts          types for views.sql (balances, ratings, ...)
      inputs.ts             zod schemas for request bodies, shared by both apps
db/
  schema.sql              tables
  views.sql               computed/derived values (never stored)
  seed.sql                sample data matching the design mockups
docs/
  db-schema-analysis.md    design vs. original schema doc — gap analysis
```

## Screen ↔ route ↔ table map

| Design screen | Web route | Key API endpoints | Core tables |
|---|---|---|---|
| Today.dc.html | `/today` | `GET /lessons?date=` | lessons, students, student_debt_status |
| (Students list, inside Prototype.dc.html) | `/students` | `GET /students` | students, tutor_subjects, student_debt_status |
| Student Profile.dc.html | `/students/:id` | `GET /students/:id` | students, lessons, payments |
| Create Edit Lesson.dc.html | `/lessons/new`, `/lessons/:id` | `POST /lessons`, `POST /lessons/:id/complete` | lessons |
| Plan.dc.html | `/plan` | `GET /plans`, `GET /plans/:id/progress` | plans (targets), computed progress |
| Settings.dc.html | `/settings` | `/settings/*` | reminder_settings, payment_policy, payment_reminder_settings |
| Public Tutor Card.dc.html | `/t/:slug` | `GET /public/tutors/:slug` | tutors, tutor_subjects, reviews |
| Subscription.dc.html | `/subscription` | `/subscriptions/*` | subscription_plans, tutor_subscriptions, subscription_payments |

## What's real vs. scaffolded

Fully wired end-to-end (DB → API → UI): auth (register/login), Today, Students
list, Student Profile, create/complete a lesson, payment policy toggle in
Settings, subscription plan list + mock checkout, public tutor card.

Scaffolded but simplified compared to the mockups: Plan (no donut chart/date
range picker yet — plain progress numbers), Settings (only the payment-policy
block is wired; reminders and payment-reminder settings have working API
routes but no UI yet), Subscription (no card-entry UI, checkout always
"succeeds" — there's no real payment gateway integrated, see the analysis
doc). Review-token public submission flow has an API route (`POST
/reviews/submit`) but no page yet.
