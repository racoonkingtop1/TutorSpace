import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Production builds target GitHub Pages at github.com/racoonkingtop1/TutorSpace,
// served from https://racoonkingtop1.github.io/TutorSpace/ — assets need the
// /TutorSpace/ prefix. Local dev keeps serving from /.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/TutorSpace/' : '/',
  server: { port: 5173 },
}));
