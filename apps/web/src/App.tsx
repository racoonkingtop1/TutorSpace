import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { LessonForm } from './pages/LessonForm';
import { Login } from './pages/Login';
import { Plan } from './pages/Plan';
import { PublicTutorCard } from './pages/PublicTutorCard';
import { Register } from './pages/Register';
import { Settings } from './pages/Settings';
import { StudentProfile } from './pages/StudentProfile';
import { Students } from './pages/Students';
import { Subscription } from './pages/Subscription';
import { Today } from './pages/Today';
import { useAuth } from './state/AuthContext';

function RequireAuth({ children }: { children: ReactNode }) {
  const { tutor } = useAuth();
  if (!tutor) return <Navigate to="/login" replace />;
  return <AppShell>{children}</AppShell>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/t/:slug" element={<PublicTutorCard />} />

      <Route path="/today" element={<RequireAuth><Today /></RequireAuth>} />
      <Route path="/students" element={<RequireAuth><Students /></RequireAuth>} />
      <Route path="/students/:id" element={<RequireAuth><StudentProfile /></RequireAuth>} />
      <Route path="/lessons/new" element={<RequireAuth><LessonForm /></RequireAuth>} />
      <Route path="/lessons/:id" element={<RequireAuth><LessonForm /></RequireAuth>} />
      <Route path="/plan" element={<RequireAuth><Plan /></RequireAuth>} />
      <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
      <Route path="/subscription" element={<RequireAuth><Subscription /></RequireAuth>} />

      <Route path="/" element={<Navigate to="/today" replace />} />
      <Route path="*" element={<Navigate to="/today" replace />} />
    </Routes>
  );
}
