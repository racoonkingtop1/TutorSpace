import { Router } from 'express';
import { completeLessonSchema, createLessonSchema } from '@tutor-service/shared';
import type { Lesson } from '@tutor-service/shared';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { toCamelRow, toCamelRows } from '../utils/case.js';

export const lessonsRouter = Router();
lessonsRouter.use(requireAuth);

/** Backs the Today screen: ?date=2026-08-01 returns that day's lessons + blocked flag per lesson. */
lessonsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { date, studentId } = req.query as { date?: string; studentId?: string };
    const conditions = ['l.tutor_id = $1'];
    const params: unknown[] = [req.auth!.tutorId];

    if (date) {
      params.push(date);
      conditions.push(`(l.scheduled_at at time zone 'utc')::date = $${params.length}`);
    }
    if (studentId) {
      params.push(studentId);
      conditions.push(`l.student_id = $${params.length}`);
    }

    const result = await pool.query(
      `select l.*, s.name as student_name, ts.subject_name,
              coalesce(d.is_blocked, false) as blocked
       from lessons l
       join students s on s.id = l.student_id
       left join tutor_subjects ts on ts.id = l.subject_id
       left join student_debt_status d on d.student_id = l.student_id
       where ${conditions.join(' and ')}
       order by l.scheduled_at`,
      params
    );
    res.json(toCamelRows(result.rows));
  })
);

lessonsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `select l.*, s.name as student_name, ts.subject_name,
              coalesce(d.is_blocked, false) as blocked
       from lessons l
       join students s on s.id = l.student_id
       left join tutor_subjects ts on ts.id = l.subject_id
       left join student_debt_status d on d.student_id = l.student_id
       where l.id = $1 and l.tutor_id = $2`,
      [req.params.id, req.auth!.tutorId]
    );
    if (!result.rows[0]) throw new HttpError(404, 'Lesson not found');
    res.json(toCamelRow(result.rows[0]));
  })
);

lessonsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = createLessonSchema.parse(req.body);

    // If the student is currently blocked for debt, land the lesson as on_hold
    // instead of planned (see lessons.status comment in db/schema.sql).
    const debt = await pool.query('select is_blocked from student_debt_status where student_id = $1', [
      body.studentId,
    ]);
    const status = debt.rows[0]?.is_blocked ? 'on_hold' : 'planned';

    // Auto-fill price from the student's effective price at creation time.
    const priceRow = await pool.query(
      `select coalesce(s.custom_price, ts.default_price) as price
       from students s left join tutor_subjects ts on ts.id = s.subject_id
       where s.id = $1`,
      [body.studentId]
    );

    const result = await pool.query(
      `insert into lessons (tutor_id, student_id, scheduled_at, planned_duration_min, subject_id, status, price_charged)
       values ($1, $2, $3, $4, $5, $6, $7) returning *`,
      [
        req.auth!.tutorId,
        body.studentId,
        body.scheduledAt,
        body.plannedDurationMin,
        body.subjectId ?? null,
        status,
        priceRow.rows[0]?.price ?? null,
      ]
    );
    res.status(201).json(toCamelRow<Lesson>(result.rows[0]));
  })
);

/** Flips the "Занятие проведено" toggle: fills post-lesson fields and marks completed. */
lessonsRouter.post(
  '/:id/complete',
  asyncHandler(async (req, res) => {
    const body = completeLessonSchema.parse(req.body);
    const result = await pool.query(
      `update lessons
       set status = 'completed', actual_duration_min = $3, topic = $4, grade = $5, comment = $6, updated_at = now()
       where id = $1 and tutor_id = $2 returning *`,
      [req.params.id, req.auth!.tutorId, body.actualDurationMin, body.topic, body.grade, body.comment ?? null]
    );
    if (!result.rows[0]) throw new HttpError(404, 'Lesson not found');
    res.json(toCamelRow<Lesson>(result.rows[0]));
  })
);

lessonsRouter.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `update lessons set status = 'cancelled', updated_at = now()
       where id = $1 and tutor_id = $2 returning *`,
      [req.params.id, req.auth!.tutorId]
    );
    if (!result.rows[0]) throw new HttpError(404, 'Lesson not found');
    res.json(toCamelRow<Lesson>(result.rows[0]));
  })
);
