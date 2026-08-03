import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { authRouter } from './routes/auth.routes.js';
import { tutorsRouter } from './routes/tutors.routes.js';
import { studentsRouter } from './routes/students.routes.js';
import { lessonsRouter } from './routes/lessons.routes.js';
import { paymentsRouter } from './routes/payments.routes.js';
import { reviewsRouter } from './routes/reviews.routes.js';
import { plansRouter } from './routes/plans.routes.js';
import { settingsRouter } from './routes/settings.routes.js';
import { subscriptionsRouter } from './routes/subscriptions.routes.js';
import { publicRouter } from './routes/public.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173' }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/auth', authRouter);
app.use('/tutors', tutorsRouter);
app.use('/students', studentsRouter);
app.use('/lessons', lessonsRouter);
app.use('/payments', paymentsRouter);
app.use('/reviews', reviewsRouter);
app.use('/plans', plansRouter);
app.use('/settings', settingsRouter);
app.use('/subscriptions', subscriptionsRouter);
app.use('/public', publicRouter);

app.use(notFoundHandler);
app.use(errorHandler);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
