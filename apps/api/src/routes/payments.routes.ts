import { Router } from 'express';
import { createPaymentSchema } from '@tutor-service/shared';
import type { Payment } from '@tutor-service/shared';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { toCamelRow, toCamelRows } from '../utils/case.js';

export const paymentsRouter = Router();
paymentsRouter.use(requireAuth);

paymentsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { studentId } = req.query as { studentId?: string };
    const conditions = ['tutor_id = $1'];
    const params: unknown[] = [req.auth!.tutorId];
    if (studentId) {
      params.push(studentId);
      conditions.push(`student_id = $${params.length}`);
    }
    const result = await pool.query(
      `select * from payments where ${conditions.join(' and ')} order by paid_at desc`,
      params
    );
    res.json(toCamelRows<Payment>(result.rows));
  })
);

paymentsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = createPaymentSchema.parse(req.body);
    const result = await pool.query(
      `insert into payments (tutor_id, student_id, amount, paid_at, method, comment)
       values ($1, $2, $3, coalesce($4, now()), coalesce($5, 'manual'), $6) returning *`,
      [req.auth!.tutorId, body.studentId, body.amount, body.paidAt ?? null, body.method ?? null, body.comment ?? null]
    );
    res.status(201).json(toCamelRow<Payment>(result.rows[0]));
  })
);
