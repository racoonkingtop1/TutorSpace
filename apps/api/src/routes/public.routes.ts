import { Router } from 'express';
import { pool } from '../db.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { toCamelRow, toCamelRows } from '../utils/case.js';

export const publicRouter = Router();

/** Backs Public Tutor Card.dc.html for the student-facing view: /:slug, no auth. */
publicRouter.get(
  '/tutors/:slug',
  asyncHandler(async (req, res) => {
    const tutorResult = await pool.query(
      `select t.id, t.name, t.age, t.age_visible, t.total_experience_years, t.photo_url,
              t.greeting_text, t.public_slug, t.contact_telegram, t.contact_whatsapp,
              t.contact_max, t.contact_email, t.contact_phone,
              r.rating, r.review_count
       from tutors t
       left join tutor_rating r on r.tutor_id = t.id
       where t.public_slug = $1`,
      [req.params.slug]
    );
    const tutor = tutorResult.rows[0];
    if (!tutor) throw new HttpError(404, 'Tutor not found');
    if (!tutor.age_visible) tutor.age = null;

    const [subjects, reviews] = await Promise.all([
      pool.query(
        `select subject_name, default_price from tutor_subjects
         where tutor_id = $1 and is_active = true order by created_at`,
        [tutor.id]
      ),
      pool.query(
        `select reviewer_display_name, reviewer_age, rating, review_text, subject_name, created_at
         from reviews where tutor_id = $1 and is_hidden = false order by created_at desc`,
        [tutor.id]
      ),
    ]);

    res.json({
      tutor: toCamelRow(tutor),
      subjects: toCamelRows(subjects.rows),
      reviews: toCamelRows(reviews.rows),
    });
  })
);
