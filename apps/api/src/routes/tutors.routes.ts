import { Router } from 'express';
import { createTutorSubjectSchema, updateTutorSchema } from '@tutor-service/shared';
import type { Tutor, TutorSubject } from '@tutor-service/shared';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { toCamelRow, toCamelRows } from '../utils/case.js';

export const tutorsRouter = Router();
tutorsRouter.use(requireAuth);

tutorsRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `select t.*, r.rating, r.review_count, g.graduated_students_count
       from tutors t
       left join tutor_rating r on r.tutor_id = t.id
       left join tutor_graduated_count g on g.tutor_id = t.id
       where t.id = $1`,
      [req.auth!.tutorId]
    );
    res.json(toCamelRow<Tutor>(result.rows[0]));
  })
);

tutorsRouter.patch(
  '/me',
  asyncHandler(async (req, res) => {
    const body = updateTutorSchema.parse(req.body);
    const entries = Object.entries(body);
    if (entries.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }
    const setClauses = entries.map(([key], i) => `${camelToSnake(key)} = $${i + 2}`);
    const values = entries.map(([, value]) => value);
    const result = await pool.query(
      `update tutors set ${setClauses.join(', ')}, updated_at = now()
       where id = $1 returning *`,
      [req.auth!.tutorId, ...values]
    );
    res.json(toCamelRow<Tutor>(result.rows[0]));
  })
);

tutorsRouter.get(
  '/me/subjects',
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      'select * from tutor_subjects where tutor_id = $1 order by created_at',
      [req.auth!.tutorId]
    );
    res.json(toCamelRows<TutorSubject>(result.rows));
  })
);

tutorsRouter.post(
  '/me/subjects',
  asyncHandler(async (req, res) => {
    const body = createTutorSubjectSchema.parse(req.body);
    const result = await pool.query(
      `insert into tutor_subjects (tutor_id, subject_name, experience_years, default_price, is_active)
       values ($1, $2, $3, $4, coalesce($5, true)) returning *`,
      [req.auth!.tutorId, body.subjectName, body.experienceYears ?? null, body.defaultPrice, body.isActive]
    );
    res.status(201).json(toCamelRow<TutorSubject>(result.rows[0]));
  })
);

tutorsRouter.patch(
  '/me/subjects/:id',
  asyncHandler(async (req, res) => {
    const body = createTutorSubjectSchema.partial().parse(req.body);
    const entries = Object.entries(body);
    if (entries.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }
    const setClauses = entries.map(([key], i) => `${camelToSnake(key)} = $${i + 3}`);
    const values = entries.map(([, value]) => value);
    const result = await pool.query(
      `update tutor_subjects set ${setClauses.join(', ')}, updated_at = now()
       where id = $1 and tutor_id = $2 returning *`,
      [req.params.id, req.auth!.tutorId, ...values]
    );
    res.json(toCamelRow<TutorSubject>(result.rows[0]));
  })
);

function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}
