import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { get, post } from '../api/client';
import { inputStyle, buttonStyle } from './Login';

interface StudentOption {
  id: string;
  name: string;
}

interface LessonDetail {
  id: string;
  studentId: string;
  studentName: string;
  subjectName: string | null;
  scheduledAt: string;
  status: string;
  grade: number | null;
  topic: string | null;
  comment: string | null;
}

/** Handles both /lessons/new?studentId=... (create) and /lessons/:id (mark completed). */
export function LessonForm() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = id === undefined;

  const [students, setStudents] = useState<StudentOption[]>([]);
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [studentId, setStudentId] = useState(searchParams.get('studentId') ?? '');
  const [scheduledAt, setScheduledAt] = useState(() => new Date().toISOString().slice(0, 16));

  const [topic, setTopic] = useState('');
  const [grade, setGrade] = useState(8);
  const [comment, setComment] = useState('');
  const [actualDurationMin, setActualDurationMin] = useState(60);

  useEffect(() => {
    if (isNew) {
      get<StudentOption[]>('/students').then(setStudents).catch((e) => setError(e.message));
    } else {
      get<LessonDetail>(`/lessons/${id}`)
        .then(setLesson)
        .catch((e) => setError(e.message));
    }
  }, [id, isNew]);

  async function createLesson() {
    setError(null);
    try {
      await post('/lessons', { studentId, scheduledAt: new Date(scheduledAt).toISOString() });
      navigate(`/students/${studentId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить занятие');
    }
  }

  async function completeLesson() {
    if (!lesson) return;
    setError(null);
    try {
      await post(`/lessons/${lesson.id}/complete`, { actualDurationMin, topic, grade, comment: comment || null });
      navigate(`/students/${lesson.studentId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отметить занятие');
    }
  }

  if (error) return <div style={{ padding: 18, color: 'var(--danger)' }}>{error}</div>;

  if (isNew) {
    return (
      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2>Новое занятие</h2>
        <label style={{ fontSize: 11.5, color: 'var(--muted)' }}>Ученик</label>
        <select value={studentId} onChange={(e) => setStudentId(e.target.value)} style={inputStyle}>
          <option value="">— выберите —</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <label style={{ fontSize: 11.5, color: 'var(--muted)' }}>Дата и время</label>
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          style={inputStyle}
        />
        <button onClick={createLesson} disabled={!studentId} style={buttonStyle}>
          Сохранить занятие
        </button>
      </div>
    );
  }

  if (!lesson) return <div style={{ padding: 18, color: 'var(--muted)' }}>Загрузка…</div>;

  return (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2 style={{ marginBottom: 0 }}>Занятие</h2>
      <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
        {lesson.studentName} · {lesson.subjectName}
      </div>

      {lesson.status === 'completed' ? (
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          Уже отмечено проведённым. Оценка {lesson.grade}/10 · {lesson.topic}
        </div>
      ) : (
        <>
          <label style={{ fontSize: 11.5, color: 'var(--muted)' }}>Фактическая продолжительность (мин)</label>
          <input
            type="number"
            value={actualDurationMin}
            onChange={(e) => setActualDurationMin(Number(e.target.value))}
            style={inputStyle}
          />
          <label style={{ fontSize: 11.5, color: 'var(--muted)' }}>Тема занятия</label>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} style={inputStyle} />
          <label style={{ fontSize: 11.5, color: 'var(--muted)' }}>Оценка (1–10)</label>
          <input
            type="number"
            min={1}
            max={10}
            value={grade}
            onChange={(e) => setGrade(Number(e.target.value))}
            style={inputStyle}
          />
          <label style={{ fontSize: 11.5, color: 'var(--muted)' }}>Комментарий</label>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} style={{ ...inputStyle, minHeight: 70 }} />
          <button onClick={completeLesson} disabled={!topic} style={buttonStyle}>
            Сохранить занятие
          </button>
        </>
      )}
    </div>
  );
}
