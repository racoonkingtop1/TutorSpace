import { Router } from 'express';
import { createPlanSchema } from '@tutor-service/shared';
import type { Plan, PlanProgress } from '@tutor-service/shared';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { toCamelRow, toCamelRows } from '../utils/case.js';

export const plansRouter = Router();
plansRouter.use(requireAuth);

plansRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await pool.query('select * from plans where tutor_id = $1 order by period_start desc', [
      req.auth!.tutorId,
    ]);
    res.json(toCamelRows<Plan>(result.rows));
  })
);

plansRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = createPlanSchema.parse(req.body);
    const result = await pool.query(
      `insert into plans (tutor_id, period_type, period_start, period_end, target_students, target_revenue, target_lessons, target_rating, subject_filter_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning *`,
      [
        req.auth!.tutorId,
        body.periodType,
        body.periodStart,
        body.periodEnd,
        body.targetStudents ?? null,
        body.targetRevenue ?? null,
        body.targetLessons ?? null,
        body.targetRating ?? null,
        body.subjectFilterId ?? null,
      ]
    );
    res.status(201).json(toCamelRow<Plan>(result.rows[0]));
  })
);

/** Progress against a plan's targets — computed on demand, never stored (Statistics screen's donut + metric bars). */
plansRouter.get(
  '/:id/progress',
  asyncHandler(async (req, res) => {
    const planResult = await pool.query('select * from plans where id = $1 and tutor_id = $2', [
      req.params.id,
      req.auth!.tutorId,
    ]);
    const plan = planResult.rows[0];
    if (!plan) throw new HttpError(404, 'Plan not found');

    const subjectFilter = plan.subject_filter_id ? 'and l.subject_id = $4' : '';
    const params = [req.auth!.tutorId, plan.period_start, plan.period_end];
    if (plan.subject_filter_id) params.push(plan.subject_filter_id);

    const [studentsResult, lessonsAndRevenue, ratingResult] = await Promise.all([
      pool.query(
        `select count(distinct id) as count from students
         where tutor_id = $1 and created_at::date between $2 and $3`,
        [req.auth!.tutorId, plan.period_start, plan.period_end]
      ),
      pool.query(
        `select count(*) as lesson_count, coalesce(sum(l.price_charged), 0) as revenue
         from lessons l
         where l.tutor_id = $1 and l.status = 'completed'
           and (l.scheduled_at at time zone 'utc')::date between $2 and $3
           ${subjectFilter}`,
        params
      ),
      pool.query('select rating from tutor_rating where tutor_id = $1', [req.auth!.tutorId]),
    ]);

    const progress: PlanProgress = {
      planId: plan.id,
      currentStudents: Number(studentsResult.rows[0].count),
      currentRevenue: Number(lessonsAndRevenue.rows[0].revenue),
      currentLessons: Number(lessonsAndRevenue.rows[0].lesson_count),
      currentRating: ratingResult.rows[0]?.rating ?? null,
    };
    res.json(progress);
  })
);
