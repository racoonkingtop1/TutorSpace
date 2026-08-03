// Mirrors db/views.sql. These are never written to directly — the API reads
// them and returns them alongside the entities above.

export interface StudentBalance {
  studentId: string;
  tutorId: string;
  totalPaid: number;
  totalCharged: number;
  balance: number;
}

export interface StudentDebtStatus {
  studentId: string;
  tutorId: string;
  balance: number;
  effectivePrice: number;
  unpaidCount: number;
  maxUnpaidLessons: number;
  blockEnabled: boolean;
  isBlocked: boolean;
}

export interface TutorRating {
  tutorId: string;
  rating: number | null;
  reviewCount: number;
}

export interface TutorGraduatedCount {
  tutorId: string;
  graduatedStudentsCount: number;
}

export interface LessonDaySummary {
  tutorId: string;
  lessonDate: string;
  lessonCount: number;
  unpaidCount: number;
}

/** Assembled server-side for GET /plans/:id — not a DB view, computed per-request. */
export interface PlanProgress {
  planId: string;
  currentStudents: number;
  currentRevenue: number;
  currentLessons: number;
  currentRating: number | null;
}
