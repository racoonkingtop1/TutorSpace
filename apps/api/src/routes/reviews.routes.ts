import { Router } from 'express';
import { submitReviewSchema } from '@tutor-service/shared';
import type { Review } from '@tutor-service/shared';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { toCamelRow, toCamelRows } from '../utils/case.js';

export const reviewsRouter = Router();

/** Tutor-only: sees hidden reviews too (Public Tutor Card "Режим репетитора"). */
reviewsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      'select * from reviews where tutor_id = $1 order by created_at desc',
      [req.auth!.tutorId]
    );
    res.json(toCamelRows<Review>(result.rows));
  })
);

reviewsRouter.patch(
  '/:id/hidden',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { isHidden } = req.body as { isHidden: boolean };
    const result = await pool.query(
      `update reviews set is_hidden = $3 where id = $1 and tutor_id = $2 returning *`,
      [req.params.id, req.auth!.tutorId, isHidden]
    );
    if (!result.rows[0]) throw new HttpError(404, 'Review not found');
    res.json(toCamelRow<Review>(result.rows[0]));
  })
);

/** Public: a student redeems their one-time review link. No auth. */
reviewsRouter.post(
  '/submit',
  asyncHandler(async (req, res) => {
    const body = submitReviewSchema.parse(req.body);
    const existing = await pool.query('select * from reviews where review_token = $1', [body.reviewToken]);
    const review = existing.rows[0];
    if (!review) throw new HttpError(404, 'Review link not found');
    if (review.token_used) throw new HttpError(410, 'This review link has already been used');

    const result = await pool.query(
      `update reviews
       set rating = $2, review_text = $3, reviewer_display_name = $4, reviewer_age = $5, token_used = true
       where review_token = $1 returning *`,
      [body.reviewToken, body.rating, body.reviewText ?? null, body.reviewerDisplayName ?? null, body.reviewerAge ?? null]
    );
    res.json(toCamelRow<Review>(result.rows[0]));
  })
);
