import type {
  Lesson,
  Payment,
  Plan,
  PaymentPolicy,
  PaymentReminderSettings,
  ReminderSetting,
  Review,
  Student,
  SubscriptionPlan,
  Tutor,
  TutorSubject,
  TutorSubscription,
} from '@tutor-service/shared';
import rawJson from './dataset.json';

// The JSON module's inferred type is a union of every literal shape seen in
// the (500-record) array, which is far too narrow to push new records into
// (e.g. `status: 'active'` instead of `StudentStatus`). Recast once to the
// real shared entity types instead of fighting TS-inferred JSON literals.
interface DemoDataset {
  tutor: Tutor;
  tutorSubjects: TutorSubject[];
  students: Student[];
  lessons: Lesson[];
  payments: Payment[];
  reviews: Review[];
  plans: Plan[];
  subscriptionPlans: SubscriptionPlan[];
  tutorSubscription: TutorSubscription;
  reminderSettings: ReminderSetting[];
  paymentPolicy: PaymentPolicy;
  paymentReminderSettings: PaymentReminderSettings;
}

const raw = rawJson as unknown as DemoDataset;

/**
 * In-browser stand-in for apps/api, used only when VITE_DEMO_MODE=true (the
 * GitHub Pages build). GitHub Pages can only serve static files — there's no
 * Express/Postgres to talk to — so this replays the same route surface
 * against the bundled 500-record dataset (see scripts/generate-demo-data.mjs)
 * instead. Mutations (marking a lesson complete, editing a payment policy,
 * etc.) live only in this tab's memory and reset on reload; that's expected
 * for a demo, not a bug.
 *
 * Route handlers here intentionally mirror apps/api/src/routes/*.ts as
 * closely as possible so the two don't drift silently — if you add an
 * endpoint to the real API that a page calls, add the matching case here too.
 */

export class MockHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Deep-clone once per page load so edits don't mutate the imported JSON module itself.
const db = structuredClone(raw) as typeof raw;
const tutorId = db.tutor.id;

function uid(prefix: string) {
  return `${prefix}-demo-${Math.random().toString(36).slice(2, 10)}`;
}

// ── computed values, mirroring db/views.sql ────────────────────────────
function effectivePrice(student: (typeof db.students)[number]) {
  const subj = db.tutorSubjects.find((s) => s.id === student.subjectId);
  return student.customPrice ?? subj?.defaultPrice ?? 0;
}

function studentBalance(studentId: string) {
  const totalPaid = db.payments.filter((p) => p.studentId === studentId).reduce((sum, p) => sum + p.amount, 0);
  const totalCharged = db.lessons
    .filter((l) => l.studentId === studentId && l.status === 'completed')
    .reduce((sum, l) => sum + (l.priceCharged ?? 0), 0);
  return { totalPaid, totalCharged, balance: totalPaid - totalCharged };
}

function studentDebtStatus(studentId: string) {
  const student = db.students.find((s) => s.id === studentId);
  const { balance } = studentBalance(studentId);
  const price = student ? effectivePrice(student) : 0;
  const unpaidCount = price > 0 && balance < 0 ? Math.ceil(Math.abs(balance) / price) : 0;
  const policy = db.paymentPolicy;
  const isBlocked = policy.blockEnabled && unpaidCount >= policy.maxUnpaidLessons;
  return {
    studentId,
    tutorId,
    balance,
    effectivePrice: price,
    unpaidCount,
    maxUnpaidLessons: policy.maxUnpaidLessons,
    blockEnabled: policy.blockEnabled,
    isBlocked,
  };
}

function tutorRating() {
  const visible = db.reviews.filter((r) => !r.isHidden);
  if (visible.length === 0) return { rating: null, reviewCount: 0 };
  const avg = visible.reduce((sum, r) => sum + r.rating, 0) / visible.length;
  return { rating: Math.round(avg * 10) / 10, reviewCount: visible.length };
}

// ── route dispatch ──────────────────────────────────────────────────────
export async function mockRequest(method: string, rawPath: string, body?: unknown): Promise<unknown> {
  const url = new URL(rawPath, 'https://demo.local');
  const path = url.pathname;
  const q = url.searchParams;
  const segs = path.split('/').filter(Boolean);

  // POST /auth/login, /auth/register — demo mode always "succeeds" as the seeded tutor.
  if (method === 'POST' && (path === '/auth/login' || path === '/auth/register')) {
    return { token: 'demo-token', tutor: db.tutor };
  }

  // GET /tutors/me
  if (method === 'GET' && path === '/tutors/me') {
    const r = tutorRating();
    return { ...db.tutor, rating: r.rating, reviewCount: r.reviewCount };
  }

  // GET /lessons?date=&studentId=
  if (method === 'GET' && path === '/lessons') {
    const date = q.get('date');
    const studentId = q.get('studentId');
    return db.lessons
      .filter((l) => (date ? l.scheduledAt.slice(0, 10) === date : true))
      .filter((l) => (studentId ? l.studentId === studentId : true))
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
      .map((l) => enrichLesson(l));
  }

  // GET /lessons/:id
  if (method === 'GET' && segs[0] === 'lessons' && segs.length === 2) {
    const lesson = db.lessons.find((l) => l.id === segs[1]);
    if (!lesson) throw new MockHttpError(404, 'Lesson not found');
    return enrichLesson(lesson);
  }

  // POST /lessons
  if (method === 'POST' && path === '/lessons') {
    const b = body as { studentId: string; scheduledAt: string; plannedDurationMin?: number; subjectId?: string | null };
    const student = db.students.find((s) => s.id === b.studentId);
    if (!student) throw new MockHttpError(404, 'Student not found');
    const debt = studentDebtStatus(b.studentId);
    const price = effectivePrice(student);
    const lesson: Lesson = {
      id: uid('lsn'),
      tutorId,
      studentId: b.studentId,
      scheduledAt: b.scheduledAt,
      plannedDurationMin: b.plannedDurationMin ?? 60,
      status: debt.isBlocked ? 'on_hold' : 'planned',
      priceCharged: price,
      actualDurationMin: null,
      subjectId: b.subjectId ?? student.subjectId,
      topic: null,
      grade: null,
      comment: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.lessons.push(lesson);
    return enrichLesson(lesson);
  }

  // POST /lessons/:id/complete
  if (method === 'POST' && segs[0] === 'lessons' && segs[2] === 'complete') {
    const lesson = db.lessons.find((l) => l.id === segs[1]);
    if (!lesson) throw new MockHttpError(404, 'Lesson not found');
    const b = body as { actualDurationMin: number; topic: string; grade: number; comment?: string | null };
    Object.assign(lesson, {
      status: 'completed',
      actualDurationMin: b.actualDurationMin,
      topic: b.topic,
      grade: b.grade,
      comment: b.comment ?? null,
      updatedAt: new Date().toISOString(),
    });
    return enrichLesson(lesson);
  }

  // POST /lessons/:id/cancel
  if (method === 'POST' && segs[0] === 'lessons' && segs[2] === 'cancel') {
    const lesson = db.lessons.find((l) => l.id === segs[1]);
    if (!lesson) throw new MockHttpError(404, 'Lesson not found');
    lesson.status = 'cancelled';
    return enrichLesson(lesson);
  }

  // GET /students?search=&subjectId=&onlyDebt=
  if (method === 'GET' && path === '/students') {
    const search = q.get('search')?.toLowerCase();
    const subjectId = q.get('subjectId');
    const onlyDebt = q.get('onlyDebt') === 'true';
    return db.students
      .filter((s) => (search ? s.name.toLowerCase().includes(search) : true))
      .filter((s) => (subjectId ? s.subjectId === subjectId : true))
      .map((s) => enrichStudent(s))
      .filter((s) => (onlyDebt ? s.isBlocked : true))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }

  // POST /students
  if (method === 'POST' && path === '/students') {
    const b = body as Record<string, unknown>;
    const student = {
      id: uid('stud'),
      tutorId,
      name: b.name as string,
      age: (b.age as number) ?? null,
      contactTelegram: (b.contactTelegram as string) ?? null,
      contactPhone: (b.contactPhone as string) ?? null,
      subjectId: (b.subjectId as string) ?? null,
      customPrice: (b.customPrice as number) ?? null,
      status: 'active' as const,
      graduated: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.students.push(student);
    return student;
  }

  // GET /students/:id
  if (method === 'GET' && segs[0] === 'students' && segs.length === 2) {
    const student = db.students.find((s) => s.id === segs[1]);
    if (!student) throw new MockHttpError(404, 'Student not found');
    const subj = db.tutorSubjects.find((s) => s.id === student.subjectId);
    const lessons = db.lessons
      .filter((l) => l.studentId === student.id)
      .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
    const payments = db.payments
      .filter((p) => p.studentId === student.id)
      .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
    const grades = lessons.filter((l) => l.status === 'completed' && l.grade != null);
    const subjectAverages = subj
      ? [
          {
            subjectName: subj.subjectName,
            avgGrade: grades.length
              ? Math.round((grades.reduce((sum, l) => sum + (l.grade ?? 0), 0) / grades.length) * 10) / 10
              : 0,
          },
        ]
      : [];
    return {
      student: { ...student, subjectName: subj?.subjectName ?? null },
      debt: studentDebtStatus(student.id),
      lessons,
      payments,
      subjectAverages,
    };
  }

  // PATCH /students/:id
  if (method === 'PATCH' && segs[0] === 'students' && segs.length === 2) {
    const student = db.students.find((s) => s.id === segs[1]);
    if (!student) throw new MockHttpError(404, 'Student not found');
    Object.assign(student, body, { updatedAt: new Date().toISOString() });
    return student;
  }

  // GET/POST /payments
  if (method === 'GET' && path === '/payments') {
    const studentId = q.get('studentId');
    return db.payments
      .filter((p) => (studentId ? p.studentId === studentId : true))
      .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  }
  if (method === 'POST' && path === '/payments') {
    const b = body as Record<string, unknown>;
    const payment: Payment = {
      id: uid('pay'),
      tutorId,
      studentId: b.studentId as string,
      amount: b.amount as number,
      paidAt: (b.paidAt as string) ?? new Date().toISOString(),
      method: (b.method as Payment['method']) ?? 'manual',
      comment: (b.comment as string) ?? null,
      createdAt: new Date().toISOString(),
    };
    db.payments.push(payment);
    return payment;
  }

  // GET /reviews, PATCH /reviews/:id/hidden
  if (method === 'GET' && path === '/reviews') {
    return [...db.reviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  if (method === 'PATCH' && segs[0] === 'reviews' && segs[2] === 'hidden') {
    const review = db.reviews.find((r) => r.id === segs[1]);
    if (!review) throw new MockHttpError(404, 'Review not found');
    review.isHidden = (body as { isHidden: boolean }).isHidden;
    return review;
  }

  // GET/POST /plans, GET /plans/:id/progress
  if (method === 'GET' && path === '/plans') {
    return [...db.plans].sort((a, b) => b.periodStart.localeCompare(a.periodStart));
  }
  if (method === 'POST' && path === '/plans') {
    const b = body as Record<string, unknown>;
    const plan = { id: uid('plan'), tutorId, createdAt: new Date().toISOString(), ...b };
    db.plans.push(plan as (typeof db.plans)[number]);
    return plan;
  }
  if (method === 'GET' && segs[0] === 'plans' && segs[2] === 'progress') {
    const plan = db.plans.find((p) => p.id === segs[1]);
    if (!plan) throw new MockHttpError(404, 'Plan not found');
    const inRange = (iso: string) => iso.slice(0, 10) >= plan.periodStart && iso.slice(0, 10) <= plan.periodEnd;
    const currentStudents = db.students.filter((s) => inRange(s.createdAt)).length;
    const completedInRange = db.lessons.filter((l) => l.status === 'completed' && inRange(l.scheduledAt));
    const currentRevenue = completedInRange.reduce((sum, l) => sum + (l.priceCharged ?? 0), 0);
    const { rating } = tutorRating();
    return {
      planId: plan.id,
      currentStudents,
      currentRevenue,
      currentLessons: completedInRange.length,
      currentRating: rating,
    };
  }

  // GET/PUT /settings/payment-policy
  if (method === 'GET' && path === '/settings/payment-policy') return db.paymentPolicy;
  if (method === 'PUT' && path === '/settings/payment-policy') {
    Object.assign(db.paymentPolicy, body, { updatedAt: new Date().toISOString() });
    return db.paymentPolicy;
  }

  // GET/PUT /settings/payment-reminders
  if (method === 'GET' && path === '/settings/payment-reminders') return db.paymentReminderSettings;
  if (method === 'PUT' && path === '/settings/payment-reminders') {
    Object.assign(db.paymentReminderSettings, body, { updatedAt: new Date().toISOString() });
    return db.paymentReminderSettings;
  }

  // GET /settings/reminders, POST, DELETE
  if (method === 'GET' && path === '/settings/reminders') return db.reminderSettings;
  if (method === 'POST' && path === '/settings/reminders') {
    const b = body as { target: 'student' | 'tutor'; days: number; hours: number; minutes: number; isEnabled: boolean };
    const reminder = {
      id: uid('rem'),
      tutorId,
      target: b.target,
      offsetMinutes: b.days * 1440 + b.hours * 60 + b.minutes,
      isEnabled: b.isEnabled,
      createdAt: new Date().toISOString(),
    };
    db.reminderSettings.push(reminder);
    return reminder;
  }
  if (method === 'DELETE' && segs[0] === 'settings' && segs[1] === 'reminders') {
    db.reminderSettings = db.reminderSettings.filter((r) => r.id !== segs[2]);
    return undefined;
  }

  // GET /subscriptions/plans, GET /subscriptions/me, POST checkout/cancel
  if (method === 'GET' && path === '/subscriptions/plans') {
    return db.subscriptionPlans.filter((p) => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  }
  if (method === 'GET' && path === '/subscriptions/me') {
    const plan = db.subscriptionPlans.find((p) => p.id === db.tutorSubscription.planId);
    return { ...db.tutorSubscription, planKey: plan?.key, planName: plan?.name, planPrice: plan?.price, billingPeriod: plan?.billingPeriod };
  }
  if (method === 'POST' && path === '/subscriptions/checkout') {
    const b = body as { planKey: string };
    const plan = db.subscriptionPlans.find((p) => p.key === b.planKey);
    if (!plan) throw new MockHttpError(404, 'Plan not found');
    db.tutorSubscription.planId = plan.id;
    db.tutorSubscription.status = 'active';
    db.tutorSubscription.cancelAtPeriodEnd = false;
    db.tutorSubscription.updatedAt = new Date().toISOString();
    return db.tutorSubscription;
  }
  if (method === 'POST' && path === '/subscriptions/cancel') {
    db.tutorSubscription.cancelAtPeriodEnd = true;
    return db.tutorSubscription;
  }

  // GET /public/tutors/:slug
  if (method === 'GET' && segs[0] === 'public' && segs[1] === 'tutors') {
    const slug = segs[2];
    if (db.tutor.publicSlug !== slug) throw new MockHttpError(404, 'Tutor not found');
    const { rating, reviewCount } = tutorRating();
    const t = db.tutor;
    return {
      tutor: {
        name: t.name,
        age: t.ageVisible ? t.age : null,
        totalExperienceYears: t.totalExperienceYears,
        greetingText: t.greetingText,
        rating,
        reviewCount,
        contactTelegram: t.contactTelegram || null,
        contactWhatsapp: t.contactWhatsapp || null,
        contactEmail: t.contactEmail || null,
        contactPhone: t.contactPhone || null,
      },
      subjects: db.tutorSubjects
        .filter((s) => s.isActive)
        .map((s) => ({ subjectName: s.subjectName, defaultPrice: s.defaultPrice })),
      reviews: db.reviews
        .filter((r) => !r.isHidden)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((r) => ({
          reviewerDisplayName: r.reviewerDisplayName,
          reviewerAge: r.reviewerAge,
          rating: r.rating,
          reviewText: r.reviewText,
        })),
    };
  }

  throw new MockHttpError(404, `Demo mode: no mock handler for ${method} ${path}`);
}

function enrichLesson(lesson: (typeof db.lessons)[number]) {
  const student = db.students.find((s) => s.id === lesson.studentId);
  const subj = db.tutorSubjects.find((s) => s.id === lesson.subjectId);
  const debt = lesson.studentId ? studentDebtStatus(lesson.studentId) : null;
  return {
    ...lesson,
    studentName: student?.name ?? '',
    subjectName: subj?.subjectName ?? null,
    blocked: debt?.isBlocked ?? false,
  };
}

function enrichStudent(student: (typeof db.students)[number]) {
  const subj = db.tutorSubjects.find((s) => s.id === student.subjectId);
  const debt = studentDebtStatus(student.id);
  return {
    ...student,
    subjectName: subj?.subjectName ?? null,
    defaultPrice: subj?.defaultPrice ?? null,
    balance: debt.balance,
    unpaidCount: debt.unpaidCount,
    isBlocked: debt.isBlocked,
  };
}
