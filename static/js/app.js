import { route, startRouter } from './router.js';
import { initTheme } from './theme.js';
import { renderToday } from './pages/today.js';
import { renderStudents } from './pages/students.js';
import { renderLessonsHistory } from './pages/lessonsHistory.js';
import { renderStudentProfile } from './pages/student.js';
import { renderLessonForm } from './pages/lesson.js';
import { renderPlan } from './pages/plan.js';
import { renderSettings } from './pages/settings.js';
import { renderSubscription } from './pages/subscription.js';
import { renderTutorCard } from './pages/tutorCard.js';

initTheme();

route('/today', renderToday);
route('/students', renderStudents);
route('/lessons-history', renderLessonsHistory);
route('/students/:id', renderStudentProfile);
route('/lesson/:id', renderLessonForm); // :id is literally 'new' for lesson creation, see pages/lesson.js
route('/plan', renderPlan);
route('/settings', renderSettings);
route('/subscription', renderSubscription);
route('/t/:slug', renderTutorCard);

startRouter();
