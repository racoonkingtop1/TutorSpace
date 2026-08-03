import { Router } from 'express';
import {
  updatePaymentPolicySchema,
  updatePaymentReminderSettingsSchema,
  upsertReminderSchema,
} from '@tutor-service/shared';
import type { PaymentPolicy, PaymentReminderSettings, ReminderSetting } from '@tutor-service/shared';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { toCamelRow, toCamelRows } from '../utils/case.js';

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

settingsRouter.get(
  '/reminders',
  asyncHandler(async (req, res) => {
    const result = await pool.query('select * from reminder_settings where tutor_id = $1 order by created_at', [
      req.auth!.tutorId,
    ]);
    res.json(toCamelRows<ReminderSetting>(result.rows));
  })
);

/** The Settings screen's day/hour/minute stepper collapses into a single offset_minutes row. */
settingsRouter.post(
  '/reminders',
  asyncHandler(async (req, res) => {
    const body = upsertReminderSchema.parse(req.body);
    const offsetMinutes = body.days * 1440 + body.hours * 60 + body.minutes;
    const result = await pool.query(
      `insert into reminder_settings (tutor_id, target, offset_minutes, is_enabled)
       values ($1, $2, $3, $4) returning *`,
      [req.auth!.tutorId, body.target, offsetMinutes, body.isEnabled]
    );
    res.status(201).json(toCamelRow<ReminderSetting>(result.rows[0]));
  })
);

settingsRouter.delete(
  '/reminders/:id',
  asyncHandler(async (req, res) => {
    await pool.query('delete from reminder_settings where id = $1 and tutor_id = $2', [
      req.params.id,
      req.auth!.tutorId,
    ]);
    res.status(204).end();
  })
);

settingsRouter.get(
  '/payment-policy',
  asyncHandler(async (req, res) => {
    const result = await pool.query('select * from payment_policy where tutor_id = $1', [req.auth!.tutorId]);
    if (!result.rows[0]) throw new HttpError(404, 'Payment policy not initialized');
    res.json(toCamelRow<PaymentPolicy>(result.rows[0]));
  })
);

settingsRouter.put(
  '/payment-policy',
  asyncHandler(async (req, res) => {
    const body = updatePaymentPolicySchema.parse(req.body);
    const result = await pool.query(
      `update payment_policy set max_unpaid_lessons = $2, block_enabled = $3, updated_at = now()
       where tutor_id = $1 returning *`,
      [req.auth!.tutorId, body.maxUnpaidLessons, body.blockEnabled]
    );
    res.json(toCamelRow<PaymentPolicy>(result.rows[0]));
  })
);

settingsRouter.get(
  '/payment-reminders',
  asyncHandler(async (req, res) => {
    const result = await pool.query('select * from payment_reminder_settings where tutor_id = $1', [
      req.auth!.tutorId,
    ]);
    if (!result.rows[0]) throw new HttpError(404, 'Payment reminder settings not initialized');
    res.json(toCamelRow<PaymentReminderSettings>(result.rows[0]));
  })
);

settingsRouter.put(
  '/payment-reminders',
  asyncHandler(async (req, res) => {
    const body = updatePaymentReminderSettingsSchema.parse(req.body);
    const result = await pool.query(
      `update payment_reminder_settings
       set is_enabled = $2, start_after_days = $3, repeat_every_days = $4, max_reminders = $5, updated_at = now()
       where tutor_id = $1 returning *`,
      [req.auth!.tutorId, body.isEnabled, body.startAfterDays, body.repeatEveryDays, body.maxReminders]
    );
    res.json(toCamelRow<PaymentReminderSettings>(result.rows[0]));
  })
);
