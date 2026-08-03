-- Tutor Service — PostgreSQL schema (Supabase-hosted, accessed via a custom Express API)
--
-- Source of truth. Update this file + add a new file under db/migrations/ for any change
-- instead of editing a running database by hand.
--
-- Conventions:
--   - UUID primary keys everywhere (gen_random_uuid(), from pgcrypto/pgcrypto is enabled by default on Supabase).
--   - created_at/updated_at on every table that represents a mutable entity.
--   - Money as numeric(10,2). Currency is RUB-only for MVP (not modeled as a column).
--   - Computed/derived values (balances, ratings, plan progress) are NOT stored — see views.sql.

create extension if not exists pgcrypto;

-- ═══════════════════════════════════════════════════════════════════════
-- 0. app_users — login identity (email + password hash)
-- ═══════════════════════════════════════════════════════════════════════
-- The original schema doc pointed tutors.auth_user_id at Supabase's
-- auth.users, assuming supabase-js on the client. This repo's chosen stack
-- (Express owns auth, not the browser) needs its own credentials table
-- instead — Supabase Postgres is still just the database, not the auth
-- provider. One row per login identity; tutors.auth_user_id references this.
create table app_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════
-- 1. tutors — the account owner
-- ═══════════════════════════════════════════════════════════════════════
create table tutors (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references app_users(id) on delete cascade,

  name text not null,
  age int,
  age_visible boolean not null default true,
  total_experience_years int,
  photo_url text,
  education text,
  awards text,
  greeting_text text,
  public_slug text unique not null,

  -- Contacts shown on the public card (Public Tutor Card.dc.html "Контакты" block).
  -- All nullable — only filled-in methods are shown to students.
  contact_telegram text,
  contact_whatsapp text,
  contact_max text,
  contact_email text,
  contact_phone text,

  theme_preference text not null default 'system'
    check (theme_preference in ('light', 'dark', 'system')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column tutors.public_slug is 'Human-readable URL slug, e.g. ivanov-matematika. Uniqueness enforced at DB level.';
comment on column tutors.age_visible is 'Tutor can hide age from the public card without deleting the data.';

-- ═══════════════════════════════════════════════════════════════════════
-- 2. tutor_subjects — subjects a tutor teaches
-- ═══════════════════════════════════════════════════════════════════════
create table tutor_subjects (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references tutors(id) on delete cascade,
  subject_name text not null,
  experience_years int,
  default_price numeric(10,2) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (tutor_id, subject_name)
);

comment on column tutor_subjects.default_price is 'Default per-lesson price; a student may override via students.custom_price.';
comment on column tutor_subjects.is_active is 'false = not taking new students in this subject; existing history is kept.';

-- ═══════════════════════════════════════════════════════════════════════
-- 3. students
-- ═══════════════════════════════════════════════════════════════════════
create table students (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references tutors(id) on delete cascade,
  name text not null,
  age int,
  contact_telegram text,
  contact_phone text,
  subject_id uuid references tutor_subjects(id),
  custom_price numeric(10,2),
  status text not null default 'active'
    check (status in ('active', 'paused', 'archived')),

  -- Recommended by the original schema doc's own "computed fields" note:
  -- distinguishes "successfully completed the course" from "just stopped coming".
  graduated boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column students.custom_price is 'If null, falls back to tutor_subjects.default_price.';
comment on column students.status is 'paused = on a break; blocked-for-debt is a separate, computed state — see student_debt_status view.';
comment on column students.graduated is 'Set manually by the tutor when archiving a student who finished successfully (drives the public card "graduated students" count).';

-- ═══════════════════════════════════════════════════════════════════════
-- 4. lessons
-- ═══════════════════════════════════════════════════════════════════════
create table lessons (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references tutors(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  scheduled_at timestamptz not null,
  planned_duration_min int not null default 60,
  status text not null default 'planned'
    check (status in ('planned', 'completed', 'cancelled', 'rescheduled', 'on_hold')),
  price_charged numeric(10,2),

  -- Post-lesson fields (filled when the "Занятие проведено" toggle is switched on).
  actual_duration_min int,
  subject_id uuid references tutor_subjects(id),
  topic text,
  grade int check (grade between 1 and 10),
  comment text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column lessons.status is 'on_hold = scheduled but held back because the student is over the unpaid-lesson limit, instead of recreating it.';
comment on column lessons.price_charged is 'Snapshot of the price at the moment the lesson was marked completed, so later price changes do not rewrite history.';

-- ═══════════════════════════════════════════════════════════════════════
-- 5. payments
-- ═══════════════════════════════════════════════════════════════════════
create table payments (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references tutors(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  amount numeric(10,2) not null,
  paid_at timestamptz not null default now(),
  method text check (method in ('manual', 'sbp', 'yumoney', 'other')),
  comment text,
  created_at timestamptz not null default now()
);

comment on column payments.method is 'manual = tutor marked cash/transfer received outside the app; the main path until an in-app SBP link is wired up.';

-- ═══════════════════════════════════════════════════════════════════════
-- 6. reviews
-- ═══════════════════════════════════════════════════════════════════════
create table reviews (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references tutors(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  lesson_id uuid references lessons(id),
  rating int not null check (rating between 1 and 10),
  review_text text,
  reviewer_display_name text,
  reviewer_age int,
  subject_name text,
  is_hidden boolean not null default false,
  review_token uuid unique,
  token_used boolean not null default false,
  created_at timestamptz not null default now()
);

comment on column reviews.review_token is 'One-time link generated after the Nth completed lesson; token_used=true after it is submitted, then it stops working.';
comment on column reviews.reviewer_display_name is 'Free-text entered by the student at review time; not tied to students.name (they may want to give only a first name). student_id is still stored, for anti-fraud.';
comment on column reviews.is_hidden is 'Tutor-controlled visibility moderation. Tutor cannot edit review_text.';

-- ═══════════════════════════════════════════════════════════════════════
-- 7. plans — a tutor's own goal-tracking period
-- ═══════════════════════════════════════════════════════════════════════
create table plans (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references tutors(id) on delete cascade,
  period_type text not null check (period_type in ('week', 'month', 'year')),
  period_start date not null,
  period_end date not null,
  target_students int,
  target_revenue numeric(10,2),
  target_lessons int,
  target_rating numeric(3, 1),
  subject_filter_id uuid references tutor_subjects(id),
  created_at timestamptz not null default now()
);

comment on table plans is 'Progress against a plan is never stored — computed on demand from lessons/payments/students for [period_start, period_end].';

-- ═══════════════════════════════════════════════════════════════════════
-- 8. reminder_settings — lesson reminders
-- ═══════════════════════════════════════════════════════════════════════
create table reminder_settings (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references tutors(id) on delete cascade,
  target text not null check (target in ('student', 'tutor')),
  offset_minutes int not null,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

comment on column reminder_settings.offset_minutes is 'One row = one reminder at one offset before the lesson. The Settings screen''s day/hour/minute picker is just an editor for this value: days*1440 + hours*60 + minutes.';

-- ═══════════════════════════════════════════════════════════════════════
-- 9. payment_policy — debt-blocking policy (one row per tutor)
-- ═══════════════════════════════════════════════════════════════════════
create table payment_policy (
  tutor_id uuid primary key references tutors(id) on delete cascade,
  max_unpaid_lessons int not null default 2,
  block_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════
-- 10. payment_reminder_settings — overdue-payment nudges (one row per tutor)
-- ═══════════════════════════════════════════════════════════════════════
create table payment_reminder_settings (
  tutor_id uuid primary key references tutors(id) on delete cascade,
  is_enabled boolean not null default true,
  start_after_days int not null default 1,
  repeat_every_days int not null default 3,
  max_reminders int not null default 3,
  updated_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════
-- 11. subscription_plans — the app's own SaaS pricing (Subscription.dc.html)
-- ═══════════════════════════════════════════════════════════════════════
-- Not present at all in the original schema doc — the design adds a full
-- billing surface (plan picker, payment method, promo code, cancel/retention
-- flow) that has no home in the original 10 tables. See db-schema-analysis.md.
create table subscription_plans (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,                 -- 'basic' | 'pro' | 'pro_yearly'
  name text not null,
  price numeric(10, 2) not null,
  billing_period text not null check (billing_period in ('month', 'year')),
  features jsonb not null default '[]',      -- ordered list of bullet strings shown on the plan card
  is_popular boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════
-- 12. tutor_subscriptions — one active/most-recent subscription per tutor
-- ═══════════════════════════════════════════════════════════════════════
create table tutor_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null unique references tutors(id) on delete cascade,
  plan_id uuid not null references subscription_plans(id),
  status text not null check (status in ('trialing', 'active', 'past_due', 'cancelled')),
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,

  -- Retention-offer discount ("Скидка 30% на 3 месяца") — nullable, expires on its own.
  discount_percent numeric(5, 2),
  discount_until timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column tutor_subscriptions.cancel_at_period_end is 'true after "Отменить подписку" is confirmed: access stays until current_period_end, then the account drops to free limits.';

-- ═══════════════════════════════════════════════════════════════════════
-- 13. subscription_payments — billing history / receipts
-- ═══════════════════════════════════════════════════════════════════════
create table subscription_payments (
  id uuid primary key default gen_random_uuid(),
  tutor_subscription_id uuid not null references tutor_subscriptions(id) on delete cascade,
  amount numeric(10, 2) not null,
  method text not null check (method in ('card', 'sbp')),
  status text not null check (status in ('succeeded', 'failed')),
  promo_code text,
  paid_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════
-- 14. promo_codes — subscription discounts ("FIRST10" in the prototype)
-- ═══════════════════════════════════════════════════════════════════════
create table promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  discount_percent numeric(5, 2) not null,
  is_active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════
-- Indexes
-- ═══════════════════════════════════════════════════════════════════════
create index idx_tutor_subjects_tutor on tutor_subjects(tutor_id);
create index idx_students_tutor on students(tutor_id);
create index idx_lessons_tutor_date on lessons(tutor_id, scheduled_at);
create index idx_lessons_student on lessons(student_id);
create index idx_payments_student on payments(student_id);
create index idx_payments_tutor on payments(tutor_id);
create index idx_reviews_tutor on reviews(tutor_id) where is_hidden = false;
create index idx_plans_tutor on plans(tutor_id);
create index idx_reminder_settings_tutor on reminder_settings(tutor_id);
create index idx_subscription_payments_sub on subscription_payments(tutor_subscription_id);
