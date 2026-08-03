#!/usr/bin/env node
// Generates the ~500-record demo dataset. Written to three places:
//   - static/data/dataset.json   — the actual GitHub Pages deployment reads this
//   - apps/web/src/demo/dataset.json — the React app's own (currently unpublished) demo mode
//   - db/demo-data.json          — reference copy, not read by any app code
// Deterministic (seeded PRNG) so re-running produces the same data — re-run
// after changing the shapes in packages/shared/src/entities.ts.
//
// Usage: node scripts/generate-demo-data.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// mulberry32 — small, fast, seedable PRNG so the dataset is reproducible.
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260803);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const pickWeighted = (pairs) => {
  const total = pairs.reduce((sum, [, w]) => sum + w, 0);
  let r = rand() * total;
  for (const [value, w] of pairs) {
    if ((r -= w) <= 0) return value;
  }
  return pairs[pairs.length - 1][0];
};
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const uuid = (() => {
  let counter = 0;
  return (prefix) => {
    counter += 1;
    return `${prefix}-${String(counter).padStart(6, '0')}-0000-4000-8000-${String(counter).padStart(12, '0')}`;
  };
})();

const TODAY = new Date('2026-08-03T00:00:00Z');
const isoDate = (d) => d.toISOString().slice(0, 10);
const addDays = (date, days) => new Date(date.getTime() + days * 86400000);

// ── Reference data ─────────────────────────────────────────────────────
const SUBJECTS = [
  { name: 'Математика', price: 1500, years: 8 },
  { name: 'Физика', price: 1600, years: 8 },
  { name: 'Английский', price: 1400, years: 5 },
  { name: 'Химия', price: 1550, years: 6 },
  { name: 'Биология', price: 1300, years: 4 },
  { name: 'Информатика', price: 1800, years: 5 },
];

const FIRST_NAMES_F = ['Анна', 'Мария', 'Ольга', 'Дарья', 'Екатерина', 'Полина', 'София', 'Виктория', 'Алиса', 'Ксения'];
const FIRST_NAMES_M = ['Дмитрий', 'Игорь', 'Артём', 'Никита', 'Максим', 'Кирилл', 'Александр', 'Егор', 'Иван', 'Роман'];
const LAST_NAMES = ['Петрова', 'Орлов', 'Смирнов', 'Кузнецова', 'Иванов', 'Соколова', 'Попов', 'Волкова', 'Новиков', 'Морозова', 'Лебедев', 'Козлова', 'Никитин', 'Егорова', 'Захаров'];

const TOPICS_BY_SUBJECT = {
  'Математика': ['Квадратные уравнения', 'Системы уравнений', 'Линейные функции', 'Проценты и доли', 'Дроби', 'Тригонометрия', 'Производные'],
  'Физика': ['Механика', 'Кинематика', 'Электричество', 'Оптика', 'Термодинамика', 'Законы Ньютона'],
  'Английский': ['Present Perfect', 'Условные предложения', 'Фразовые глаголы', 'Аудирование', 'Эссе на ЕГЭ'],
  'Химия': ['Периодическая таблица', 'Химические связи', 'Органическая химия', 'Реакции окисления'],
  'Биология': ['Клетка и органоиды', 'Генетика', 'Экосистемы', 'Анатомия человека'],
  'Информатика': ['Алгоритмы сортировки', 'Основы Python', 'Базы данных', 'Логические операции'],
};

const COMMENTS_BY_GRADE = {
  low: ['Путается в деталях, повторить ещё раз', 'Нужно больше практики на задачах', 'Тема далась тяжело, вернёмся к ней позже'],
  mid: ['Хорошо усвоил материал, нужна практика на дом', 'Есть прогресс по сравнению с прошлым разом', 'Уверенно решает базовые примеры'],
  high: ['Отлично, готов к контрольной', 'Материал усвоен полностью, можно двигаться дальше', 'Сильная работа, почти без ошибок'],
};
function commentForGrade(grade) {
  if (grade <= 5) return pick(COMMENTS_BY_GRADE.low);
  if (grade <= 7) return pick(COMMENTS_BY_GRADE.mid);
  return pick(COMMENTS_BY_GRADE.high);
}

const REVIEW_TEXTS = [
  'Готовился к экзамену, поднял балл значительно. Объясняет очень понятно.',
  'Стало гораздо легче понимать предмет, спасибо за терпение.',
  'Иногда опаздывает на занятия, но объясняет по делу.',
  'Очень довольны прогрессом, рекомендую.',
  'Занятия интересные, ребёнок стал увереннее в себе.',
  'Хороший подход, но хотелось бы больше домашних заданий.',
];

// ── Tutor ───────────────────────────────────────────────────────────────
const tutorId = uuid('tutor');
const tutor = {
  id: tutorId,
  authUserId: uuid('user'),
  name: 'Иван Соколов',
  age: 34,
  ageVisible: true,
  totalExperienceYears: 8,
  photoUrl: null,
  education: 'МГУ, физический факультет',
  awards: 'Победитель конкурса "Учитель года" (регион), 2023',
  greetingText:
    'Здравствуйте! Я преподаю точные науки школьникам 5–11 классов уже восемь лет — готовлю к ОГЭ, ЕГЭ и олимпиадам. Объясняю без спешки, с примерами из жизни, и слежу за прогрессом каждого ученика индивидуально.',
  publicSlug: 'ivanov-matematika',
  contactTelegram: '@ivan_tutor',
  contactWhatsapp: '+7 900 123-45-67',
  contactMax: '',
  contactEmail: 'ivan@example.com',
  contactPhone: '+7 900 123-45-67',
  themePreference: 'system',
  createdAt: '2024-09-01T08:00:00Z',
  updatedAt: TODAY.toISOString(),
};

// ── Subjects (6) ────────────────────────────────────────────────────────
const tutorSubjects = SUBJECTS.map((s) => ({
  id: uuid('subj'),
  tutorId,
  subjectName: s.name,
  experienceYears: s.years,
  defaultPrice: s.price,
  isActive: rand() > 0.08, // almost all active
  createdAt: '2024-09-01T08:00:00Z',
  updatedAt: '2024-09-01T08:00:00Z',
}));

// ── Students (60) ───────────────────────────────────────────────────────
const usedNames = new Set();
function uniqueName() {
  let name;
  do {
    const isFemale = rand() > 0.5;
    const first = pick(isFemale ? FIRST_NAMES_F : FIRST_NAMES_M);
    const last = pick(LAST_NAMES);
    name = `${first} ${last}`;
  } while (usedNames.has(name));
  usedNames.add(name);
  return name;
}

const STUDENT_COUNT = 60;
const students = Array.from({ length: STUDENT_COUNT }, () => {
  const subject = pick(tutorSubjects.filter((s) => s.isActive));
  const createdDaysAgo = randInt(20, 620);
  const status = pickWeighted([
    ['active', 78],
    ['paused', 10],
    ['archived', 12],
  ]);
  return {
    id: uuid('stud'),
    tutorId,
    name: uniqueName(),
    age: randInt(9, 18),
    contactTelegram: rand() > 0.3 ? `@student${randInt(100, 999)}` : null,
    contactPhone: rand() > 0.5 ? `+7 9${randInt(10, 99)} ${randInt(100, 999)}-${randInt(10, 99)}-${randInt(10, 99)}` : null,
    subjectId: subject.id,
    subjectName: subject.subjectName,
    customPrice: rand() > 0.85 ? subject.defaultPrice + pick([-200, -100, 100, 200]) : null,
    status,
    graduated: status === 'archived' ? rand() > 0.4 : false,
    createdAt: addDays(TODAY, -createdDaysAgo).toISOString(),
    updatedAt: addDays(TODAY, -randInt(0, createdDaysAgo)).toISOString(),
  };
});

// ── Lessons (300) ──────────────────────────────────────────────────────
const LESSON_COUNT = 300;
const lessons = [];
{
  // Give every active/paused student a handful of lessons, then top up randomly to hit the exact count.
  const eligible = students.filter((s) => s.status !== 'archived');
  const perStudentBase = Math.floor(LESSON_COUNT / eligible.length);
  let remaining = LESSON_COUNT;

  for (const student of eligible) {
    const count = perStudentBase + (rand() > 0.5 ? 1 : 0);
    for (let i = 0; i < count && remaining > 0; i++, remaining--) {
      lessons.push(makeLesson(student));
    }
  }
  while (remaining > 0) {
    lessons.push(makeLesson(pick(eligible)));
    remaining--;
  }

  function makeLesson(student) {
    const dayOffset = randInt(-90, 10); // most history in the past, a little scheduled ahead
    const scheduledAt = addDays(TODAY, dayOffset);
    scheduledAt.setUTCHours(pick([9, 10, 11, 13, 14, 15, 16, 17, 18, 19]), pick([0, 30]), 0, 0);

    const subj = tutorSubjects.find((s) => s.id === student.subjectId);
    const price = student.customPrice ?? subj.defaultPrice;
    const topics = TOPICS_BY_SUBJECT[subj.subjectName] ?? ['Общая тема'];

    let status;
    if (dayOffset > 0) status = pickWeighted([['planned', 85], ['cancelled', 15]]);
    else if (dayOffset === 0) status = pickWeighted([['planned', 60], ['completed', 30], ['on_hold', 10]]);
    else status = pickWeighted([['completed', 88], ['cancelled', 8], ['rescheduled', 4]]);

    const isCompleted = status === 'completed';
    const grade = isCompleted ? randInt(4, 10) : null;
    return {
      id: uuid('lsn'),
      tutorId,
      studentId: student.id,
      scheduledAt: scheduledAt.toISOString(),
      plannedDurationMin: 60,
      status,
      priceCharged: status === 'planned' || status === 'on_hold' || isCompleted ? price : null,
      actualDurationMin: isCompleted ? pick([45, 50, 60, 60, 60, 75]) : null,
      subjectId: isCompleted ? subj.id : status === 'planned' || status === 'on_hold' ? subj.id : null,
      topic: isCompleted ? pick(topics) : null,
      grade,
      comment: isCompleted ? commentForGrade(grade) : null,
      createdAt: addDays(scheduledAt, -randInt(1, 14)).toISOString(),
      updatedAt: scheduledAt.toISOString(),
    };
  }
}

// ── Payments (100) ──────────────────────────────────────────────────────
const PAYMENT_COUNT = 100;
const payments = [];
{
  const withHistory = students.filter((s) => lessons.some((l) => l.studentId === s.id && l.status === 'completed'));
  for (let i = 0; i < PAYMENT_COUNT; i++) {
    const student = pick(withHistory.length ? withHistory : students);
    const subj = tutorSubjects.find((s) => s.id === student.subjectId);
    const unitPrice = student.customPrice ?? subj.defaultPrice;
    const lessonsCovered = pick([1, 1, 1, 2, 2, 3, 4]);
    const daysAgo = randInt(0, 95);
    payments.push({
      id: uuid('pay'),
      tutorId,
      studentId: student.id,
      amount: unitPrice * lessonsCovered,
      paidAt: addDays(TODAY, -daysAgo).toISOString(),
      method: pickWeighted([['manual', 45], ['sbp', 35], ['yumoney', 10], ['other', 10]]),
      comment: null,
      createdAt: addDays(TODAY, -daysAgo).toISOString(),
    });
  }
}

// ── Reviews (25) ─────────────────────────────────────────────────────────
const REVIEW_COUNT = 25;
const reviews = Array.from({ length: REVIEW_COUNT }, () => {
  const student = pick(students);
  const subj = tutorSubjects.find((s) => s.id === student.subjectId);
  const isHidden = rand() < 0.16;
  const daysAgo = randInt(1, 400);
  return {
    id: uuid('rev'),
    tutorId,
    studentId: student.id,
    lessonId: null,
    rating: isHidden ? randInt(2, 6) : randInt(7, 10),
    reviewText: pick(REVIEW_TEXTS),
    reviewerDisplayName: student.name.split(' ')[0],
    reviewerAge: student.age,
    subjectName: subj.subjectName,
    isHidden,
    reviewToken: null,
    tokenUsed: true,
    createdAt: addDays(TODAY, -daysAgo).toISOString(),
  };
});

// ── Plans (5) — goal tracking ────────────────────────────────────────────
const plans = [
  { periodType: 'week', offsetDays: 0, targetStudents: 20, targetRevenue: 22000, targetLessons: 32, targetRating: 9.6 },
  { periodType: 'month', offsetDays: 0, targetStudents: 24, targetRevenue: 90000, targetLessons: 140, targetRating: 9.6 },
  { periodType: 'year', offsetDays: 0, targetStudents: 45, targetRevenue: 1080000, targetLessons: 1600, targetRating: 9.6 },
  { periodType: 'month', offsetDays: -30, targetStudents: 22, targetRevenue: 80000, targetLessons: 120, targetRating: 9.5 },
  { periodType: 'week', offsetDays: -7, targetStudents: 19, targetRevenue: 20000, targetLessons: 28, targetRating: 9.5 },
].map((p) => {
  const end = addDays(TODAY, p.offsetDays);
  const start =
    p.periodType === 'week' ? addDays(end, -7) : p.periodType === 'month' ? addDays(end, -30) : addDays(end, -365);
  return {
    id: uuid('plan'),
    tutorId,
    periodType: p.periodType,
    periodStart: isoDate(start),
    periodEnd: isoDate(end),
    targetStudents: p.targetStudents,
    targetRevenue: p.targetRevenue,
    targetLessons: p.targetLessons,
    targetRating: p.targetRating,
    subjectFilterId: null,
    createdAt: start.toISOString(),
  };
});

// ── Subscription plans (3) — static catalog ──────────────────────────────
const subscriptionPlans = [
  {
    id: uuid('subplan'),
    key: 'basic',
    name: 'Базовый',
    price: 990,
    billingPeriod: 'month',
    features: ['До 15 учеников', 'Напоминания о занятиях', 'История занятий'],
    isPopular: false,
    isActive: true,
    sortOrder: 1,
    createdAt: '2024-09-01T08:00:00Z',
  },
  {
    id: uuid('subplan'),
    key: 'pro',
    name: 'Профи',
    price: 1990,
    billingPeriod: 'month',
    features: ['Без ограничений по ученикам', 'AI-анализ успеваемости', 'Публичная страница репетитора'],
    isPopular: true,
    isActive: true,
    sortOrder: 2,
    createdAt: '2024-09-01T08:00:00Z',
  },
  {
    id: uuid('subplan'),
    key: 'pro_yearly',
    name: 'Профи · год',
    price: 17900,
    billingPeriod: 'year',
    features: ['Всё из плана «Профи»', 'Экономия ≈ 25% к месячной цене'],
    isPopular: false,
    isActive: true,
    sortOrder: 3,
    createdAt: '2024-09-01T08:00:00Z',
  },
];

const tutorSubscription = {
  id: uuid('tsub'),
  tutorId,
  planId: subscriptionPlans[1].id,
  status: 'active',
  currentPeriodStart: addDays(TODAY, -12).toISOString(),
  currentPeriodEnd: addDays(TODAY, 18).toISOString(),
  cancelAtPeriodEnd: false,
  discountPercent: null,
  discountUntil: null,
  createdAt: addDays(TODAY, -220).toISOString(),
  updatedAt: addDays(TODAY, -12).toISOString(),
};

// ── Small per-tutor config (not counted toward the 500) ──────────────────
const reminderSettings = [
  { id: uuid('rem'), tutorId, target: 'student', offsetMinutes: 1440, isEnabled: true, createdAt: '2024-09-01T08:00:00Z' },
  { id: uuid('rem'), tutorId, target: 'student', offsetMinutes: 120, isEnabled: true, createdAt: '2024-09-01T08:00:00Z' },
  { id: uuid('rem'), tutorId, target: 'tutor', offsetMinutes: 1440, isEnabled: true, createdAt: '2024-09-01T08:00:00Z' },
];
const paymentPolicy = { tutorId, maxUnpaidLessons: 2, blockEnabled: true, updatedAt: TODAY.toISOString() };
const paymentReminderSettings = {
  tutorId,
  isEnabled: true,
  startAfterDays: 1,
  repeatEveryDays: 3,
  maxReminders: 3,
  updatedAt: TODAY.toISOString(),
};
const promoCodes = [{ id: uuid('promo'), code: 'FIRST10', discountPercent: 10, isActive: true, expiresAt: null, createdAt: '2024-09-01T08:00:00Z' }];
const subscriptionPayments = [
  { id: uuid('subpay'), tutorSubscriptionId: tutorSubscription.id, amount: subscriptionPlans[1].price, method: 'card', status: 'succeeded', promoCode: null, paidAt: addDays(TODAY, -12).toISOString() },
];

// ── Assemble + write ──────────────────────────────────────────────────────
const dataset = {
  generatedAt: new Date().toISOString(),
  anchorDate: isoDate(TODAY),
  counts: {
    tutors: 1,
    tutorSubjects: tutorSubjects.length,
    students: students.length,
    lessons: lessons.length,
    payments: payments.length,
    reviews: reviews.length,
    plans: plans.length,
    subscriptionPlans: subscriptionPlans.length,
    total:
      1 +
      tutorSubjects.length +
      students.length +
      lessons.length +
      payments.length +
      reviews.length +
      plans.length +
      subscriptionPlans.length,
  },
  tutor,
  tutorSubjects,
  students,
  lessons,
  payments,
  reviews,
  plans,
  subscriptionPlans,
  tutorSubscription,
  subscriptionPayments,
  promoCodes,
  reminderSettings,
  paymentPolicy,
  paymentReminderSettings,
};

const json = JSON.stringify(dataset, null, 2);

const webTarget = join(ROOT, 'apps/web/src/demo/dataset.json');
mkdirSync(dirname(webTarget), { recursive: true });
writeFileSync(webTarget, json);

const dbTarget = join(ROOT, 'db/demo-data.json');
writeFileSync(dbTarget, json);

// Plain HTML/CSS/JS build actually deployed to GitHub Pages (see static/README.md).
const staticTarget = join(ROOT, 'static/data/dataset.json');
mkdirSync(dirname(staticTarget), { recursive: true });
writeFileSync(staticTarget, json);

console.log(`Generated ${dataset.counts.total} records:`, dataset.counts);
console.log(`Written to:\n  ${webTarget}\n  ${dbTarget}\n  ${staticTarget}`);
