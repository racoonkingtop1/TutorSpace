import { Router } from 'express';
import { createStudentSchema, updateStudentSchema } from '@tutor-service/shared';
import type { Lesson, Payment, Student, StudentDebtStatus } from '@tutor-service/shared';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { toCamelRow, toCamelRows } from '../utils/case.js';

export const studentsRouter = Router();
studentsRouter.use(requireAuth);

/** Backs the Students screen list: search box, subject filter, "Долг" checkbox. */
studentsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { search, subjectId, onlyDebt } = req.query as {
      search?: string;
      subjectId?: string;
      onlyDebt?: string;
    };

    const conditions = ['s.tutor_id = $1'];
    const params: unknown[] = [req.auth!.tutorId];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`s.name ilike $${params.length}`);
    }
    if (subjectId) {
      params.push(subjectId);
      conditions.push(`s.subject_id = $${params.length}`);
    }

    const havingDebt = onlyDebt === 'true' ? 'having bool_or(coalesce(d.is_blocked, false))' : '';

    const result = await pool.query(
      `select s.*, ts.subject_name, ts.default_price,
              d.balance, d.unpaid_count, d.is_blocked
       from students s
       left join tutor_subjects ts on ts.id = s.subject_id
       left join student_debt_status d on d.student_id = s.id
       where ${conditions.join(' and ')}
       group by s.id, ts.subject_name, ts.default_price, d.balance, d.unpaid_count, d.is_blocked
       ${havingDebt}
       order by s.name`,
      params
    );
    res.json(toCamelRows(result.rows));
  })
);

studentsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = createStudentSchema.parse(req.body);
    const result = await pool.query(
      `insert into students (tutor_id, name, age, contact_telegram, contact_phone, subject_id, custom_price)
       values ($1, $2, $3, $4, $5, $6, $7) returning *`,
      [
        req.auth!.tutorId,
        body.name,
        body.age ?? null,
        body.contactTelegram ?? null,
        body.contactPhone ?? null,
        body.subjectId ?? null,
        body.customPrice ?? null,
      ]
    );
    res.status(201).json(toCamelRow<Student>(result.rows[0]));
  })
);

/** Backs the Student Profile screen: balance card, subject averages, lesson history, payments. */
studentsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const [student, debt, lessons, payments, subjectAverages] = await Promise.all([
      pool.query(
        `select s.*, ts.subject_name from students s
         left join tutor_subjects ts on ts.id = s.subject_id
         where s.id = $1 and s.tutor_id = $2`,
        [req.params.id, req.auth!.tutorId]
      ),
      pool.query('select * from student_debt_status where student_id = $1', [req.params.id]),
      pool.query(
        `select * from lessons where student_id = $1 and tutor_id = $2 order by scheduled_at desc`,
        [req.params.id, req.auth!.tutorId]
      ),
      pool.query(
        `select * from payments where student_id = $1 and tutor_id = $2 order by paid_at desc`,
        [req.params.id, req.auth!.tutorId]
      ),
      pool.query(
        `select ts.subject_name, round(avg(l.grade)::numeric, 1) as avg_grade
         from lessons l join tutor_subjects ts on ts.id = l.subject_id
         where l.student_id = $1 and l.status = 'completed' and l.grade is not null
         group by ts.subject_name`,
        [req.params.id]
      ),
    ]);

    if (!student.rows[0]) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    res.json({
      student: toCamelRow<Student>(student.rows[0]),
      debt: toCamelRow<StudentDebtStatus>(debt.rows[0] ?? {}),
      lessons: toCamelRows<Lesson>(lessons.rows),
      payments: toCamelRows<Payment>(payments.rows),
      subjectAverages: toCamelRows(subjectAverages.rows),
    });
  })
);

studentsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = updateStudentSchema.parse(req.body);
    const entries = Object.entries(body);
    if (entries.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }
    const setClauses = entries.map(([key], i) => `${camelToSnake(key)} = $${i + 3}`);
    const values = entries.map(([, value]) => value);
    const result = await pool.query(
      `update students set ${setClauses.join(', ')}, updated_at = now()
       where id = $1 and tutor_id = $2 returning *`,
      [req.params.id, req.auth!.tutorId, ...values]
    );
    res.json(toCamelRow<Student>(result.rows[0]));
  })
);

function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}
