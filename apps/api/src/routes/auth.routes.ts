import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { signToken } from '../middleware/auth.js';
import { toCamelRow } from '../utils/case.js';
import type { Tutor } from '@tutor-service/shared';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(200),
  publicSlug: z
    .string()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'lowercase letters, digits, and hyphens only'),
});

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);
    const client = await pool.connect();
    try {
      await client.query('begin');

      const existing = await client.query('select id from app_users where email = $1', [body.email]);
      if (existing.rowCount) {
        throw new HttpError(409, 'Email already registered');
      }

      const passwordHash = await bcrypt.hash(body.password, 10);
      const userRow = await client.query(
        'insert into app_users (email, password_hash) values ($1, $2) returning id',
        [body.email, passwordHash]
      );
      const userId: string = userRow.rows[0].id;

      const tutorRow = await client.query(
        `insert into tutors (auth_user_id, name, public_slug)
         values ($1, $2, $3) returning *`,
        [userId, body.name, body.publicSlug]
      );
      await client.query('insert into payment_policy (tutor_id) values ($1)', [tutorRow.rows[0].id]);
      await client.query('insert into payment_reminder_settings (tutor_id) values ($1)', [
        tutorRow.rows[0].id,
      ]);

      await client.query('commit');

      const tutor = toCamelRow<Tutor>(tutorRow.rows[0]);
      const token = signToken({ userId, tutorId: tutor.id });
      res.status(201).json({ token, tutor });
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  })
);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const userResult = await pool.query('select * from app_users where email = $1', [body.email]);
    const user = userResult.rows[0];
    if (!user || !(await bcrypt.compare(body.password, user.password_hash))) {
      throw new HttpError(401, 'Invalid email or password');
    }
    const tutorResult = await pool.query('select * from tutors where auth_user_id = $1', [user.id]);
    const tutor = toCamelRow<Tutor>(tutorResult.rows[0]);
    const token = signToken({ userId: user.id, tutorId: tutor.id });
    res.json({ token, tutor });
  })
);
