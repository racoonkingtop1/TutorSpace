// Mirrors db/schema.sql 1:1. Keep these two files in sync by hand — there is
// no codegen step in this repo yet (see docs/db-schema-analysis.md, item on tooling).

export type ThemePreference = 'light' | 'dark' | 'system';

export interface Tutor {
  id: string;
  authUserId: string;
  name: string;
  age: number | null;
  ageVisible: boolean;
  totalExperienceYears: number | null;
  photoUrl: string | null;
  education: string | null;
  awards: string | null;
  greetingText: string | null;
  publicSlug: string;
  contactTelegram: string | null;
  contactWhatsapp: string | null;
  contactMax: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  themePreference: ThemePreference;
  createdAt: string;
  updatedAt: string;
}

export interface TutorSubject {
  id: string;
  tutorId: string;
  subjectName: string;
  experienceYears: number | null;
  defaultPrice: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type StudentStatus = 'active' | 'paused' | 'archived';

export interface Student {
  id: string;
  tutorId: string;
  name: string;
  age: number | null;
  contactTelegram: string | null;
  contactPhone: string | null;
  subjectId: string | null;
  customPrice: number | null;
  status: StudentStatus;
  graduated: boolean;
  createdAt: string;
  updatedAt: string;
}

export type LessonStatus = 'planned' | 'completed' | 'cancelled' | 'rescheduled' | 'on_hold';

export interface Lesson {
  id: string;
  tutorId: string;
  studentId: string;
  scheduledAt: string;
  plannedDurationMin: number;
  status: LessonStatus;
  priceCharged: number | null;
  actualDurationMin: number | null;
  subjectId: string | null;
  topic: string | null;
  grade: number | null;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PaymentMethod = 'manual' | 'sbp' | 'yumoney' | 'other';

export interface Payment {
  id: string;
  tutorId: string;
  studentId: string;
  amount: number;
  paidAt: string;
  method: PaymentMethod | null;
  comment: string | null;
  createdAt: string;
}

export interface Review {
  id: string;
  tutorId: string;
  studentId: string;
  lessonId: string | null;
  rating: number;
  reviewText: string | null;
  reviewerDisplayName: string | null;
  reviewerAge: number | null;
  subjectName: string | null;
  isHidden: boolean;
  reviewToken: string | null;
  tokenUsed: boolean;
  createdAt: string;
}

export type PlanPeriodType = 'week' | 'month' | 'year';

export interface Plan {
  id: string;
  tutorId: string;
  periodType: PlanPeriodType;
  periodStart: string;
  periodEnd: string;
  targetStudents: number | null;
  targetRevenue: number | null;
  targetLessons: number | null;
  targetRating: number | null;
  subjectFilterId: string | null;
  createdAt: string;
}

export type ReminderTarget = 'student' | 'tutor';

export interface ReminderSetting {
  id: string;
  tutorId: string;
  target: ReminderTarget;
  offsetMinutes: number;
  isEnabled: boolean;
  createdAt: string;
}

export interface PaymentPolicy {
  tutorId: string;
  maxUnpaidLessons: number;
  blockEnabled: boolean;
  updatedAt: string;
}

export interface PaymentReminderSettings {
  tutorId: string;
  isEnabled: boolean;
  startAfterDays: number;
  repeatEveryDays: number;
  maxReminders: number;
  updatedAt: string;
}

export type BillingPeriod = 'month' | 'year';

export interface SubscriptionPlan {
  id: string;
  key: string;
  name: string;
  price: number;
  billingPeriod: BillingPeriod;
  features: string[];
  isPopular: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled';

export interface TutorSubscription {
  id: string;
  tutorId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  discountPercent: number | null;
  discountUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SubscriptionPaymentMethod = 'card' | 'sbp';
export type SubscriptionPaymentStatus = 'succeeded' | 'failed';

export interface SubscriptionPayment {
  id: string;
  tutorSubscriptionId: string;
  amount: number;
  method: SubscriptionPaymentMethod;
  status: SubscriptionPaymentStatus;
  promoCode: string | null;
  paidAt: string;
}

export interface PromoCode {
  id: string;
  code: string;
  discountPercent: number;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}
