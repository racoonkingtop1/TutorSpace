# DB schema vs. design — gap analysis

Source materials: `tutor-app-db-schema.md` (the hand-written schema doc you
provided) vs. the 8 screens in the Claude Design project (`Prototype.dc.html`
plus `Today`, `Student Profile`, `Create Edit Lesson`, `Plan`, `Public Tutor
Card`, `Settings`, `Subscription`). The schema in `db/schema.sql` is the
result of reconciling the two — this doc explains what changed and why.

## 1. What matched cleanly

The original doc's core loop — `tutors` → `tutor_subjects` → `students` →
`lessons` → `payments`, with balance/debt computed rather than stored — maps
onto the design almost exactly:

- **Lesson statuses**: the doc's `on_hold` status (planned but held back for
  debt) is exactly what Today.dc.html and the Prototype's lesson cards render
  as "Занятие заблокировано до оплаты" with a disabled "Долг" pill.
- **Post-lesson fields**: Create Edit Lesson.dc.html's "Занятие проведено"
  toggle reveals exactly the fields the doc predicted — actual duration,
  topic, grade (1–10), comment — and the UI's own copy ("автоматически
  спишет его с баланса ученика") confirms the doc's design choice to compute
  balance from `lessons.price_charged`, not store it.
- **Plan targets**: Plan.dc.html's four metrics (revenue, students, lessons,
  rating) with week/month/year period selection map 1:1 onto
  `plans.target_revenue/target_students/target_lessons/target_rating` and
  `period_type`.
- **Review token flow**: Public Tutor Card's tutor-mode "Скрыть от учеников" /
  "Показать снова" toggle is exactly `reviews.is_hidden`, and the doc's
  one-time `review_token` mechanism is consistent with there being no
  reviewer login anywhere in the design.
- **`graduated` recommendation**: the doc's own suggestion to add
  `students.graduated boolean` (rather than inferring "graduated" from
  `status='archived'`) is adopted as-is in `schema.sql`.

## 2. Missing from the original schema — net new

### 2.1 Subscription / billing (biggest gap)

`Subscription.dc.html` is a full SaaS billing surface with **no home at all**
in the original 10 tables: a plan picker (Basic 990₽/mo, Pro 1990₽/mo, Pro
yearly 17900₽/yr, each with a feature list), a payment method choice
(card/SBP), a promo code field, a subscription account screen (status,
next billing date, cancel), and a retention flow ("Скидка 30% на 3 месяца"
before the cancel completes).

Added 4 tables to cover it: `subscription_plans` (plan catalog),
`tutor_subscriptions` (one row per tutor, current plan + status +
period + any active retention discount), `subscription_payments` (billing
history), `promo_codes`. This is a second product surface layered on top of
the tutoring-business schema — the tutor is a *customer* of your app in
addition to being the *owner* of their own students/lessons data. Worth
keeping that distinction in mind: subscription tables should never be joined
into tutoring-business queries except to gate feature access.

No payment gateway is wired into `apps/api` — `POST /subscriptions/checkout`
always succeeds, mirroring the prototype's own mocked "Оплатить" /
"Смоделировать ошибку оплаты (демо)" buttons. Before this goes live you need
a real provider (YooKassa and CloudPayments are the common SBP-capable
choices in Russia) and its webhook to reconcile `subscription_payments.status`.

### 2.2 Tutor contact fields

Public Tutor Card.dc.html's "Контакты" block collects Telegram, WhatsApp,
**MAX** (a messenger not mentioned anywhere in the original doc), email, and
phone — with the rule "only filled-in methods are shown to students." The
original `tutors` table had none of these. Added `contact_telegram`,
`contact_whatsapp`, `contact_max`, `contact_email`, `contact_phone` directly
on `tutors`, mirroring the pattern `students.contact_telegram` /
`contact_phone` already used.

### 2.3 Theme preference

Settings.dc.html and every other screen render a light/dark/"system" theme
switcher. Added `tutors.theme_preference` (`light` \| `dark` \| `system`,
default `system`). Minor, but it's real user-controlled state that needs
persisting somewhere.

## 3. Refinements — the doc was right in spirit, design adds precision

### 3.1 Reminder granularity

The doc's `reminder_settings.offset_minutes` (a single int) is *sufficient*
but the Settings screen's actual editor is a three-field stepper (days /
hours / minutes) per reminder, plus an "Свой вариант" (custom) option
alongside presets like "1 день", "2 часа". No schema change needed —
`offset_minutes = days*1440 + hours*60 + minutes` — but the API
(`POST /settings/reminders`, see `apps/api/src/routes/settings.routes.ts`)
does that conversion server-side so the UI can keep working in the
day/hour/minute shape it already has. Worth knowing this is a lossy
round-trip if you ever want to redisplay "2 hours" instead of "120 minutes" —
you'd need to store the components too, or just recompute days/hours/minutes
from the stored integer at render time (trivial, no schema change either way).

### 3.2 `on_hold` — computed vs. stored

The design never actually *shows* a lesson literally transitioning into
`on_hold` — every "blocked" lesson in Today.dc.html and the Prototype is
rendered by checking the student's debt status at render time, not by a
stored lesson status. `db/views.sql`'s `student_debt_status` view and the
API's lesson list both compute `blocked` live rather than mutating
`lessons.status` when a student crosses the debt threshold. The `on_hold`
enum value is kept for a real future case — a lesson explicitly deferred by
the tutor rather than newly created while blocked — but nothing currently
writes it. Flagging this because it's a judgment call: if the intent is
literally "freeze the lesson row the moment debt crosses the limit," that's
a cron job or trigger you don't have yet, not just a view.

### 3.3 One subject per student — confirmed, not contradicted

I checked whether the design implies a student can have multiple subjects
with the same tutor (which would need a join table instead of
`students.subject_id`). It doesn't: Student Profile.dc.html shows one
subject per student, Create/Edit Lesson auto-fills subject from "the
student's one subject," and the Students list shows a single subject per
row. The original schema's one-`subject_id`-per-student design holds. If a
tutor ever needs a student to take two subjects, the current modeling
answer is two `students` rows (same name, two subjects) — noting this because
it's the kind of assumption that's cheap to get right now and expensive to
migrate later. Say so if that's wrong and it should be a `student_subjects`
join table instead.

### 3.4 Payment method labels

`payments.method` in the original doc is `manual | sbp | yumoney | other`.
Student Profile.dc.html's payment history shows "Перевод" (bank transfer)
and "Наличные" (cash) as distinct entries — both of which collapse into
`manual` in the current enum, with the human-readable label presumably
entered via `payments.comment` or inferred client-side. If you want transfer
vs. cash to be filterable/reportable, `manual` should split into two enum
values. Left as-is for now since the doc's philosophy is "keep it minimal
until proven necessary."

## 4. A structural decision I made: auth model

The original doc's `tutors.auth_user_id references auth.users(id)` assumes
Supabase Auth (`supabase-js` running in the browser, calling Supabase
directly). **You picked a custom Express API instead of that** — which means
the browser never talks to Supabase directly, so `auth.users` (a
Supabase-managed internal schema) isn't populated by anything in this stack.

I added `app_users` (`email`, `password_hash`) as a small credentials table
that `tutors.auth_user_id` now references, and the API issues its own JWTs
(`apps/api/src/routes/auth.routes.ts`, `middleware/auth.ts`) rather than
verifying Supabase session tokens. This is a real fork in the road, not a
cosmetic one:

- **Current setup (custom Express auth)**: you fully own login/session
  logic, easy to extend to Google OAuth or SMS login later, but you're
  reimplementing what Supabase Auth gives for free (password reset flows,
  email verification, rate limiting on login attempts — none of which exist
  yet in this scaffold).
- **Alternative**: switch to Supabase Auth from the browser and have the
  Express API only verify the Supabase-issued JWT (`supabase.auth.getUser()`
  server-side) instead of minting its own. That reverts to the original
  doc's `auth.users` FK and deletes `app_users` entirely. Doable later
  without touching `tutors`/`students`/`lessons` etc. — the fork is isolated
  to `app_users` + the auth routes/middleware.

Flagging this explicitly since it's the one place where the stack choice
changed the schema rather than just the app code.

## 5. Open questions worth resolving before you build further

1. **Multi-tutor / team accounts?** Nothing in the design suggests it (every
   screen assumes a single tutor owns the account), so the schema doesn't
   support it. Confirm that's intentional.
2. **Payment method split** (§3.3) — keep `manual` covering both cash and
   transfer, or split it?
3. **Real payment gateway** for both lesson payments (currently
   manual-entry only, matching the doc's "main case until an in-app SBP link
   is wired up") and subscription billing (currently fully mocked). Same
   provider for both, or different (in-app collection from students vs. your
   own SaaS billing)?
4. **Auth model** (§4) — stick with custom Express JWT auth, or move to
   Supabase Auth now while the schema is still young and the migration is cheap?
