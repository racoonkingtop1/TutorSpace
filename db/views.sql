-- Computed values — intentionally NOT denormalized into tables (see schema.sql
-- comments). Each view mirrors an entry from the original schema doc's
-- "Вычисляемые поля" table. The API layer reads from these instead of
-- recomputing the same aggregates in application code.

-- ── student_balance: sum(payments) - sum(completed lesson prices) ─────────
create or replace view student_balance as
select
  s.id as student_id,
  s.tutor_id,
  coalesce(pay.total_paid, 0) as total_paid,
  coalesce(les.total_charged, 0) as total_charged,
  coalesce(pay.total_paid, 0) - coalesce(les.total_charged, 0) as balance
from students s
left join (
  select student_id, sum(amount) as total_paid
  from payments
  group by student_id
) pay on pay.student_id = s.id
left join (
  select student_id, sum(price_charged) as total_charged
  from lessons
  where status = 'completed'
  group by student_id
) les on les.student_id = s.id;

-- ── student_unpaid_count: completed lessons not yet covered by balance ────
-- Approximation used across the app: convert the negative balance into a
-- lesson count using the student's effective per-lesson price (custom_price,
-- falling back to the subject's default_price).
create or replace view student_debt_status as
select
  b.student_id,
  b.tutor_id,
  b.balance,
  coalesce(s.custom_price, ts.default_price, 0) as effective_price,
  case
    when coalesce(s.custom_price, ts.default_price, 0) > 0 and b.balance < 0
      then ceil(abs(b.balance) / coalesce(s.custom_price, ts.default_price))::int
    else 0
  end as unpaid_count,
  pp.max_unpaid_lessons,
  pp.block_enabled,
  case
    when pp.block_enabled and coalesce(s.custom_price, ts.default_price, 0) > 0 and b.balance < 0
      then (ceil(abs(b.balance) / coalesce(s.custom_price, ts.default_price))::int) >= pp.max_unpaid_lessons
    else false
  end as is_blocked
from student_balance b
join students s on s.id = b.student_id
left join tutor_subjects ts on ts.id = s.subject_id
left join payment_policy pp on pp.tutor_id = b.tutor_id;

-- ── tutor.rating: average of visible review ratings ────────────────────────
create or replace view tutor_rating as
select
  t.id as tutor_id,
  round(avg(r.rating)::numeric, 1) as rating,
  count(r.id) as review_count
from tutors t
left join reviews r on r.tutor_id = t.id and r.is_hidden = false
group by t.id;

-- ── tutor.graduated_students_count ─────────────────────────────────────────
create or replace view tutor_graduated_count as
select
  tutor_id,
  count(*) filter (where status = 'archived' and graduated = true) as graduated_students_count
from students
group by tutor_id;

-- ── today's lesson summary (Today.dc.html header: "4 занятия сегодня · 2 не оплачено") ──
create or replace view lesson_day_summary as
select
  l.tutor_id,
  (l.scheduled_at at time zone 'utc')::date as lesson_date,
  count(*) as lesson_count,
  count(*) filter (where d.is_blocked) as unpaid_count
from lessons l
join student_debt_status d on d.student_id = l.student_id
where l.status in ('planned', 'on_hold')
group by l.tutor_id, (l.scheduled_at at time zone 'utc')::date;
