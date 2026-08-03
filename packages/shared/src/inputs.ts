import { z } from 'zod';

// Request-body validation shared between the Express API (server-side) and
// the React forms (client-side, same rules before submit).

export const themePreferenceSchema = z.enum(['light', 'dark', 'system']);

export const updateTutorSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  age: z.number().int().min(16).max(100).nullable().optional(),
  ageVisible: z.boolean().optional(),
  totalExperienceYears: z.number().int().min(0).max(80).nullable().optional(),
  photoUrl: z.string().url().nullable().optional(),
  education: z.string().max(2000).nullable().optional(),
  awards: z.string().max(2000).nullable().optional(),
  greetingText: z.string().max(4000).nullable().optional(),
  contactTelegram: z.string().max(200).nullable().optional(),
  contactWhatsapp: z.string().max(200).nullable().optional(),
  contactMax: z.string().max(200).nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
  contactPhone: z.string().max(50).nullable().optional(),
  themePreference: themePreferenceSchema.optional(),
});
export type UpdateTutorInput = z.infer<typeof updateTutorSchema>;

export const createTutorSubjectSchema = z.object({
  subjectName: z.string().min(1).max(120),
  experienceYears: z.number().int().min(0).max(80).nullable().optional(),
  defaultPrice: z.number().positive(),
  isActive: z.boolean().optional(),
});
export type CreateTutorSubjectInput = z.infer<typeof createTutorSubjectSchema>;

export const createStudentSchema = z.object({
  name: z.string().min(1).max(200),
  age: z.number().int().min(3).max(100).nullable().optional(),
  contactTelegram: z.string().max(200).nullable().optional(),
  contactPhone: z.string().max(50).nullable().optional(),
  subjectId: z.string().uuid().nullable().optional(),
  customPrice: z.number().positive().nullable().optional(),
});
export type CreateStudentInput = z.infer<typeof createStudentSchema>;

export const updateStudentSchema = createStudentSchema.partial().extend({
  status: z.enum(['active', 'paused', 'archived']).optional(),
  graduated: z.boolean().optional(),
});
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;

export const createLessonSchema = z.object({
  studentId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  plannedDurationMin: z.number().int().positive().default(60),
  subjectId: z.string().uuid().nullable().optional(),
});
export type CreateLessonInput = z.infer<typeof createLessonSchema>;

/** Fields unlocked by the "Занятие проведено" toggle in Create/Edit Lesson. */
export const completeLessonSchema = z.object({
  actualDurationMin: z.number().int().positive(),
  topic: z.string().min(1).max(500),
  grade: z.number().int().min(1).max(10),
  comment: z.string().max(2000).nullable().optional(),
});
export type CompleteLessonInput = z.infer<typeof completeLessonSchema>;

export const createPaymentSchema = z.object({
  studentId: z.string().uuid(),
  amount: z.number().positive(),
  paidAt: z.string().datetime().optional(),
  method: z.enum(['manual', 'sbp', 'yumoney', 'other']).optional(),
  comment: z.string().max(500).nullable().optional(),
});
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export const submitReviewSchema = z.object({
  reviewToken: z.string().uuid(),
  rating: z.number().int().min(1).max(10),
  reviewText: z.string().max(2000).nullable().optional(),
  reviewerDisplayName: z.string().max(200).nullable().optional(),
  reviewerAge: z.number().int().min(3).max(100).nullable().optional(),
});
export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;

export const createPlanSchema = z.object({
  periodType: z.enum(['week', 'month', 'year']),
  periodStart: z.string().date(),
  periodEnd: z.string().date(),
  targetStudents: z.number().int().positive().nullable().optional(),
  targetRevenue: z.number().positive().nullable().optional(),
  targetLessons: z.number().int().positive().nullable().optional(),
  targetRating: z.number().min(1).max(10).nullable().optional(),
  subjectFilterId: z.string().uuid().nullable().optional(),
});
export type CreatePlanInput = z.infer<typeof createPlanSchema>;

/** The Settings screen's day/hour/minute stepper — converted to offset_minutes server-side. */
export const upsertReminderSchema = z.object({
  target: z.enum(['student', 'tutor']),
  days: z.number().int().min(0).max(30).default(0),
  hours: z.number().int().min(0).max(23).default(0),
  minutes: z.number().int().min(0).max(59).default(0),
  isEnabled: z.boolean().default(true),
});
export type UpsertReminderInput = z.infer<typeof upsertReminderSchema>;

export const updatePaymentPolicySchema = z.object({
  maxUnpaidLessons: z.number().int().min(1).max(20),
  blockEnabled: z.boolean(),
});
export type UpdatePaymentPolicyInput = z.infer<typeof updatePaymentPolicySchema>;

export const updatePaymentReminderSettingsSchema = z.object({
  isEnabled: z.boolean(),
  startAfterDays: z.number().int().min(0).max(30),
  repeatEveryDays: z.number().int().min(1).max(30),
  maxReminders: z.number().int().min(1).max(10),
});
export type UpdatePaymentReminderSettingsInput = z.infer<typeof updatePaymentReminderSettingsSchema>;

export const startSubscriptionCheckoutSchema = z.object({
  planKey: z.string().min(1),
  method: z.enum(['card', 'sbp']),
  promoCode: z.string().max(50).nullable().optional(),
});
export type StartSubscriptionCheckoutInput = z.infer<typeof startSubscriptionCheckoutSchema>;
