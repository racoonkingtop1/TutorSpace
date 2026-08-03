-- Sample data mirroring the values hardcoded into the design prototype
-- (Today.dc.html, Student Profile.dc.html, Public Tutor Card.dc.html, etc.)
-- so the API/UI can be exercised against something that looks like the mockups.

begin;

insert into subscription_plans (key, name, price, billing_period, features, is_popular, sort_order) values
  ('basic', 'Базовый', 990, 'month', '["До 15 учеников", "Напоминания о занятиях", "История занятий"]', false, 1),
  ('pro', 'Профи', 1990, 'month', '["Без ограничений по ученикам", "AI-анализ успеваемости", "Публичная страница репетитора"]', true, 2),
  ('pro_yearly', 'Профи · год', 17900, 'year', '["Всё из плана «Профи»", "Экономия ≈ 25% к месячной цене"]', false, 3);

insert into promo_codes (code, discount_percent) values ('FIRST10', 10);

with new_tutor as (
  insert into tutors (
    auth_user_id, name, age, total_experience_years, education, greeting_text,
    public_slug, contact_telegram, contact_whatsapp, contact_email, contact_phone
  ) values (
    gen_random_uuid(), 'Иван Соколов', 34, 8, 'МГУ, физический факультет',
    'Здравствуйте! Я преподаю математику и физику школьникам 5–11 классов уже восемь лет — готовлю к ОГЭ, ЕГЭ и олимпиадам.',
    'ivanov-matematika', '@ivan_tutor', '+7 900 123-45-67', 'ivan@example.com', '+7 900 123-45-67'
  ) returning id
)
select id as tutor_id into temp _t from new_tutor;

insert into payment_policy (tutor_id) select tutor_id from _t;
insert into payment_reminder_settings (tutor_id) select tutor_id from _t;

insert into tutor_subjects (tutor_id, subject_name, experience_years, default_price)
select tutor_id, v.subject_name, v.years, v.price
from _t, (values
  ('Алгебра', 8, 1500),
  ('Физика', 8, 1600),
  ('Английский', 5, 1400)
) as v(subject_name, years, price);

insert into students (tutor_id, name, age, subject_id, status)
select t.tutor_id, v.name, v.age, ts.id, 'active'
from _t t
join (values
  ('Анна Петрова', 15, 'Алгебра'),
  ('Дмитрий Орлов', 16, 'Физика'),
  ('Игорь Смирнов', 14, 'Физика'),
  ('Мария Кузнецова', 13, 'Английский')
) as v(name, age, subject_name) on true
join tutor_subjects ts on ts.tutor_id = t.tutor_id and ts.subject_name = v.subject_name;

-- Anna Petrova: lesson history + payments matching Student Profile.dc.html
with anna as (
  select s.id as student_id, s.tutor_id, s.subject_id
  from students s join _t t on s.tutor_id = t.tutor_id
  where s.name = 'Анна Петрова'
)
insert into lessons (tutor_id, student_id, scheduled_at, status, price_charged, subject_id, topic, grade, comment, actual_duration_min)
select a.tutor_id, a.student_id, v.scheduled_at::timestamptz, 'completed', 1500, a.subject_id, v.topic, v.grade, v.comment, 60
from anna a, (values
  ('2026-07-30 15:00', 'Квадратные уравнения', 8, 'Хорошо усвоила материал, нужна практика на дом'),
  ('2026-07-23 15:00', 'Системы уравнений', 7, 'Путается в подстановке, повторить ещё раз'),
  ('2026-07-16 15:00', 'Линейные функции', 9, 'Отлично, готова к контрольной'),
  ('2026-07-09 15:00', 'Проценты и доли', 4, 'Нужно больше практики на задачах'),
  ('2026-07-02 15:00', 'Дроби', 8, 'Уверенно решает базовые примеры')
) as v(scheduled_at, topic, grade, comment);

with anna as (select id as student_id, tutor_id from students where name = 'Анна Петрова')
insert into payments (tutor_id, student_id, amount, paid_at, method)
select a.tutor_id, a.student_id, v.amount, v.paid_at::timestamptz, v.method
from anna a, (values
  (3000, '2026-07-25', 'other'),
  (1500, '2026-07-11', 'manual'),
  (3000, '2026-06-27', 'sbp')
) as v(amount, paid_at, method);

-- Today's lessons across all four students, matching Today.dc.html
insert into lessons (tutor_id, student_id, scheduled_at, status, price_charged, subject_id)
select s.tutor_id, s.id, ('2026-08-01 ' || v.time)::timestamptz, 'planned', ts.default_price, s.subject_id
from students s
join tutor_subjects ts on ts.id = s.subject_id
join (values
  ('Анна Петрова', '10:00'),
  ('Дмитрий Орлов', '13:30'),
  ('Игорь Смирнов', '16:00'),
  ('Мария Кузнецова', '18:30')
) as v(name, time) on v.name = s.name;

insert into reviews (tutor_id, student_id, rating, review_text, reviewer_display_name, reviewer_age, subject_name, is_hidden)
select s.tutor_id, s.id, v.rating, v.text, v.name, v.age, v.subject, v.hidden
from students s, (values
  ('Анна Петрова', 'Мария', 16, 10, 'Готовилась к ЕГЭ, подняла балл со 60 до 88. Объясняет очень понятно.', 'Математика', false),
  ('Дмитрий Орлов', 'Артём', 14, 9, 'Стало гораздо легче понимать механику, спасибо за терпение.', 'Физика', false),
  ('Игорь Смирнов', 'Ольга', 15, 4, 'Иногда опаздывает на занятия, но объясняет по делу.', 'Математика', false)
) as v(student_name, name, age, rating, text, subject, hidden)
where s.name = v.student_name;

commit;
