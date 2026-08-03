// Plain ES module — no bundler, loaded directly via <script type="module">.
// Owns the demo dataset: loads static/data/dataset.json once, applies any
// in-session edits (kept in sessionStorage so they survive navigating
// between pages, but reset per tab/session — this is a demo, not a backend),
// and exposes the same computed-value logic as db/views.sql /
// apps/web/src/demo/mockServer.ts so all three stay conceptually in sync.

const DATA_URL = new URL('../data/dataset.json', import.meta.url);
const STORAGE_KEY = 'tutorspace-demo-db-v1';

let dbPromise = null;

async function fetchBase() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error('Не удалось загрузить демо-данные');
  return res.json();
}

/** Returns the shared in-memory dataset, loading it (base + any session edits) on first call. */
export function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // fall through to a fresh load
        }
      }
      return fetchBase();
    })();
  }
  return dbPromise;
}

/** Persists the current dataset to sessionStorage so other pages in this tab see the change. */
export async function saveDb(db) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

/** Drops all session edits, back to the original generated dataset. */
export function resetDb() {
  sessionStorage.removeItem(STORAGE_KEY);
  dbPromise = null;
}

function uid(prefix) {
  return `${prefix}-demo-${Math.random().toString(36).slice(2, 10)}`;
}

// ── computed values — mirrors db/views.sql ──────────────────────────────
export function effectivePrice(db, student) {
  const subj = db.tutorSubjects.find((s) => s.id === student.subjectId);
  return student.customPrice ?? subj?.defaultPrice ?? 0;
}

export function studentBalance(db, studentId) {
  const totalPaid = db.payments.filter((p) => p.studentId === studentId).reduce((sum, p) => sum + p.amount, 0);
  const totalCharged = db.lessons
    .filter((l) => l.studentId === studentId && l.status === 'completed')
    .reduce((sum, l) => sum + (l.priceCharged ?? 0), 0);
  return { totalPaid, totalCharged, balance: totalPaid - totalCharged };
}

export function studentDebtStatus(db, studentId) {
  const student = db.students.find((s) => s.id === studentId);
  const { balance } = studentBalance(db, studentId);
  const price = student ? effectivePrice(db, student) : 0;
  const unpaidCount = price > 0 && balance < 0 ? Math.ceil(Math.abs(balance) / price) : 0;
  const policy = db.paymentPolicy;
  const isBlocked = policy.blockEnabled && unpaidCount >= policy.maxUnpaidLessons;
  return { studentId, balance, effectivePrice: price, unpaidCount, isBlocked };
}

export function reminderLabel(reminder) {
  if (reminder.custom) {
    const d = Math.floor(reminder.offsetMinutes / 1440);
    const h = Math.floor((reminder.offsetMinutes % 1440) / 60);
    const m = reminder.offsetMinutes % 60;
    const parts = [];
    if (d) parts.push(`${d} дн`);
    if (h) parts.push(`${h} ч`);
    if (m) parts.push(`${m} мин`);
    return `${parts.join(' ') || '0 мин'} до занятия`;
  }
  if (reminder.offsetMinutes >= 1440) return `${reminder.offsetMinutes / 1440} день до занятия`;
  if (reminder.offsetMinutes >= 60) return `${reminder.offsetMinutes / 60} ч до занятия`;
  return `${reminder.offsetMinutes} мин до занятия`;
}

/** Mirrors the API's GET /plans/:id/progress — computed on demand, never stored. */
export function planProgress(db, { periodStart, periodEnd, subjectId }) {
  const inRange = (iso) => iso.slice(0, 10) >= periodStart && iso.slice(0, 10) <= periodEnd;
  const currentStudents = db.students.filter((s) => inRange(s.createdAt)).length;
  const completed = db.lessons.filter(
    (l) => l.status === 'completed' && inRange(l.scheduledAt) && (subjectId ? l.subjectId === subjectId : true)
  );
  const currentRevenue = completed.reduce((sum, l) => sum + (l.priceCharged ?? 0), 0);
  const { rating } = tutorRating(db);
  return { currentStudents, currentRevenue, currentLessons: completed.length, currentRating: rating };
}

export function tutorRating(db) {
  const visible = db.reviews.filter((r) => !r.isHidden);
  if (visible.length === 0) return { rating: null, reviewCount: 0 };
  const avg = visible.reduce((sum, r) => sum + r.rating, 0) / visible.length;
  return { rating: Math.round(avg * 10) / 10, reviewCount: visible.length };
}

export function enrichLesson(db, lesson) {
  const student = db.students.find((s) => s.id === lesson.studentId);
  const subj = db.tutorSubjects.find((s) => s.id === lesson.subjectId);
  const debt = lesson.studentId ? studentDebtStatus(db, lesson.studentId) : null;
  return {
    ...lesson,
    studentName: student?.name ?? '',
    subjectName: subj?.subjectName ?? null,
    blocked: debt?.isBlocked ?? false,
  };
}

export function enrichStudent(db, student) {
  const subj = db.tutorSubjects.find((s) => s.id === student.subjectId);
  const debt = studentDebtStatus(db, student.id);
  return {
    ...student,
    subjectName: subj?.subjectName ?? null,
    defaultPrice: subj?.defaultPrice ?? null,
    balance: debt.balance,
    unpaidCount: debt.unpaidCount,
    isBlocked: debt.isBlocked,
  };
}

// ── mutations — each saves the dataset back to sessionStorage ───────────

/** completedFields is optional — the unified lesson form can create a lesson
 * that's already marked "проведено" in one step, matching Create Edit Lesson.dc.html. */
export async function createLesson(db, { studentId, scheduledAt, plannedDurationMin, subjectId, completedFields }) {
  const student = db.students.find((s) => s.id === studentId);
  if (!student) throw new Error('Ученик не найден');
  const debt = studentDebtStatus(db, studentId);
  const lesson = {
    id: uid('lsn'),
    tutorId: db.tutor.id,
    studentId,
    scheduledAt,
    plannedDurationMin: plannedDurationMin ?? 60,
    status: completedFields ? 'completed' : debt.isBlocked ? 'on_hold' : 'planned',
    priceCharged: effectivePrice(db, student),
    actualDurationMin: completedFields?.actualDurationMin ?? null,
    subjectId: subjectId ?? student.subjectId,
    topic: completedFields?.topic ?? null,
    grade: completedFields?.grade ?? null,
    comment: completedFields?.comment || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.lessons.push(lesson);
  await saveDb(db);
  return lesson;
}

export async function completeLesson(db, lessonId, { actualDurationMin, topic, grade, comment }) {
  const lesson = db.lessons.find((l) => l.id === lessonId);
  if (!lesson) throw new Error('Занятие не найдено');
  Object.assign(lesson, {
    status: 'completed',
    actualDurationMin,
    topic,
    grade,
    comment: comment || null,
    updatedAt: new Date().toISOString(),
  });
  await saveDb(db);
  return lesson;
}

export async function cancelLesson(db, lessonId) {
  const lesson = db.lessons.find((l) => l.id === lessonId);
  if (!lesson) throw new Error('Занятие не найдено');
  lesson.status = 'cancelled';
  lesson.updatedAt = new Date().toISOString();
  await saveDb(db);
  return lesson;
}

export async function createStudent(db, { name, age, subjectId, contactTelegram, contactPhone }) {
  const student = {
    id: uid('stud'),
    tutorId: db.tutor.id,
    name,
    age: age ?? null,
    contactTelegram: contactTelegram || null,
    contactPhone: contactPhone || null,
    subjectId: subjectId ?? null,
    customPrice: null,
    status: 'active',
    graduated: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.students.push(student);
  await saveDb(db);
  return student;
}

export async function toggleReviewHidden(db, reviewId) {
  const review = db.reviews.find((r) => r.id === reviewId);
  if (!review) throw new Error('Отзыв не найден');
  review.isHidden = !review.isHidden;
  await saveDb(db);
  return review;
}

const OFFSET_PRESETS = {
  '15 минут': 15,
  '1 час': 60,
  '2 часа': 120,
  '1 день': 1440,
};

export async function addReminder(db, { target, presetLabel, days, hours, minutes }) {
  const isCustom = presetLabel === 'Свой вариант';
  const reminder = isCustom
    ? { id: uid('rem'), tutorId: db.tutor.id, target, offsetMinutes: days * 1440 + hours * 60 + minutes, isEnabled: true, custom: true, createdAt: new Date().toISOString() }
    : { id: uid('rem'), tutorId: db.tutor.id, target, offsetMinutes: OFFSET_PRESETS[presetLabel] ?? 60, isEnabled: true, createdAt: new Date().toISOString() };
  db.reminderSettings.push(reminder);
  await saveDb(db);
  return reminder;
}

export async function deleteReminder(db, id) {
  db.reminderSettings = db.reminderSettings.filter((r) => r.id !== id);
  await saveDb(db);
}

export async function updateCustomReminder(db, id, { days, hours, minutes }) {
  const reminder = db.reminderSettings.find((r) => r.id === id);
  if (!reminder) throw new Error('Напоминание не найдено');
  reminder.offsetMinutes = days * 1440 + hours * 60 + minutes;
  await saveDb(db);
  return reminder;
}

export async function updatePaymentPolicy(db, patch) {
  Object.assign(db.paymentPolicy, patch, { updatedAt: new Date().toISOString() });
  await saveDb(db);
  return db.paymentPolicy;
}

export async function updatePaymentReminderSettings(db, patch) {
  Object.assign(db.paymentReminderSettings, patch, { updatedAt: new Date().toISOString() });
  await saveDb(db);
  return db.paymentReminderSettings;
}

export function validatePromoCode(db, code) {
  const promo = db.promoCodes?.find((p) => p.code === code.trim().toUpperCase() && p.isActive);
  return promo ? { valid: true, discountPercent: Number(promo.discountPercent) } : { valid: false, discountPercent: 0 };
}

export async function checkoutSubscription(db, { planKey, method, discountPercent = 0, promoCode }) {
  const plan = db.subscriptionPlans.find((p) => p.key === planKey);
  if (!plan) throw new Error('План не найден');
  const periodEnd = new Date();
  plan.billingPeriod === 'year' ? periodEnd.setFullYear(periodEnd.getFullYear() + 1) : periodEnd.setMonth(periodEnd.getMonth() + 1);

  db.tutorSubscription.planId = plan.id;
  db.tutorSubscription.status = 'active';
  db.tutorSubscription.cancelAtPeriodEnd = false;
  db.tutorSubscription.currentPeriodStart = new Date().toISOString();
  db.tutorSubscription.currentPeriodEnd = periodEnd.toISOString();
  db.tutorSubscription.discountPercent = null;
  db.tutorSubscription.discountUntil = null;
  db.tutorSubscription.updatedAt = new Date().toISOString();

  db.subscriptionPayments.push({
    id: uid('subpay'),
    tutorSubscriptionId: db.tutorSubscription.id,
    amount: Math.round(plan.price * (1 - discountPercent / 100)),
    method,
    status: 'succeeded',
    promoCode: promoCode || null,
    paidAt: new Date().toISOString(),
  });

  await saveDb(db);
  return db.tutorSubscription;
}

export async function cancelSubscription(db) {
  db.tutorSubscription.cancelAtPeriodEnd = true;
  db.tutorSubscription.updatedAt = new Date().toISOString();
  await saveDb(db);
  return db.tutorSubscription;
}

export async function acceptRetention(db) {
  db.tutorSubscription.discountPercent = 30;
  db.tutorSubscription.discountUntil = new Date(Date.now() + 90 * 86400000).toISOString();
  db.tutorSubscription.cancelAtPeriodEnd = false;
  db.tutorSubscription.updatedAt = new Date().toISOString();
  await saveDb(db);
  return db.tutorSubscription;
}
