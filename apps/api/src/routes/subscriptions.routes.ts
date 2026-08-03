import { Router } from 'express';
import { startSubscriptionCheckoutSchema } from '@tutor-service/shared';
import type { SubscriptionPlan, TutorSubscription } from '@tutor-service/shared';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { toCamelRow, toCamelRows } from '../utils/case.js';

export const subscriptionsRouter = Router();

subscriptionsRouter.get(
  '/plans',
  asyncHandler(async (_req, res) => {
    const result = await pool.query(
      'select * from subscription_plans where is_active = true order by sort_order'
    );
    res.json(toCamelRows<SubscriptionPlan>(result.rows));
  })
);

subscriptionsRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `select ts.*, sp.key as plan_key, sp.name as plan_name, sp.price as plan_price, sp.billing_period
       from tutor_subscriptions ts
       join subscription_plans sp on sp.id = ts.plan_id
       where ts.tutor_id = $1`,
      [req.auth!.tutorId]
    );
    res.json(toCamelRow(result.rows[0] ?? {}));
  })
);

/**
 * No real payment gateway is wired up (see docs/db-schema-analysis.md). This
 * mirrors what Subscription.dc.html's mocked "Оплатить" button does: it
 * always succeeds and immediately activates the period. Swap the body of
 * this handler for a real provider call (YooKassa/CloudPayments/etc.) later.
 */
subscriptionsRouter.post(
  '/checkout',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = startSubscriptionCheckoutSchema.parse(req.body);

    const planResult = await pool.query('select * from subscription_plans where key = $1 and is_active', [
      body.planKey,
    ]);
    const plan = planResult.rows[0];
    if (!plan) throw new HttpError(404, 'Plan not found');

    let discountPercent = 0;
    if (body.promoCode) {
      const promo = await pool.query(
        'select * from promo_codes where code = $1 and is_active and (expires_at is null or expires_at > now())',
        [body.promoCode.toUpperCase()]
      );
      if (!promo.rows[0]) throw new HttpError(400, 'Invalid promo code');
      discountPercent = Number(promo.rows[0].discount_percent);
    }

    const amount = Math.round(Number(plan.price) * (1 - discountPercent / 100));
    const periodEnd = new Date();
    if (plan.billing_period === 'year') periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else periodEnd.setMonth(periodEnd.getMonth() + 1);

    const client = await pool.connect();
    try {
      await client.query('begin');
      const subResult = await client.query(
        `insert into tutor_subscriptions (tutor_id, plan_id, status, current_period_end)
         values ($1, $2, 'active', $3)
         on conflict (tutor_id) do update
           set plan_id = excluded.plan_id, status = 'active',
               current_period_start = now(), current_period_end = excluded.current_period_end,
               cancel_at_period_end = false, updated_at = now()
         returning *`,
        [req.auth!.tutorId, plan.id, periodEnd.toISOString()]
      );
      await client.query(
        `insert into subscription_payments (tutor_subscription_id, amount, method, status, promo_code)
         values ($1, $2, $3, 'succeeded', $4)`,
        [subResult.rows[0].id, amount, body.method, body.promoCode ?? null]
      );
      await client.query('commit');
      res.status(201).json(toCamelRow<TutorSubscription>(subResult.rows[0]));
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  })
);

/** "Отменить подписку" — access remains until current_period_end (not an immediate cutoff). */
subscriptionsRouter.post(
  '/cancel',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `update tutor_subscriptions set cancel_at_period_end = true, updated_at = now()
       where tutor_id = $1 returning *`,
      [req.auth!.tutorId]
    );
    if (!result.rows[0]) throw new HttpError(404, 'No subscription found');
    res.json(toCamelRow<TutorSubscription>(result.rows[0]));
  })
);
