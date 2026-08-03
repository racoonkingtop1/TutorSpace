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
export async function createLesson(db, { studentId, scheduledAt, plannedDurationMin, subjectId }) {
  const student = db.students.find((s) => s.id === studentId);
  if (!student) throw new Error('Ученик не найден');
  const debt = studentDebtStatus(db, studentId);
  const lesson = {
    id: uid('lsn'),
    tutorId: db.tutor.id,
    studentId,
    scheduledAt,
    plannedDurationMin: plannedDurationMin ?? 60,
    status: debt.isBlocked ? 'on_hold' : 'planned',
    priceCharged: effectivePrice(db, student),
    actualDurationMin: null,
    subjectId: subjectId ?? student.subjectId,
    topic: null,
    grade: null,
    comment: null,
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

export async function updatePaymentPolicy(db, patch) {
  Object.assign(db.paymentPolicy, patch, { updatedAt: new Date().toISOString() });
  await saveDb(db);
  return db.paymentPolicy;
}

export async function checkoutSubscription(db, planKey) {
  const plan = db.subscriptionPlans.find((p) => p.key === planKey);
  if (!plan) throw new Error('План не найден');
  db.tutorSubscription.planId = plan.id;
  db.tutorSubscription.status = 'active';
  db.tutorSubscription.cancelAtPeriodEnd = false;
  db.tutorSubscription.updatedAt = new Date().toISOString();
  await saveDb(db);
  return db.tutorSubscription;
}
