const KEY = 'tutorspace-theme'; // 'light' | 'dark' | 'system'

export function getTheme() {
  return localStorage.getItem(KEY) || 'system';
}

export function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);
}

export function setTheme(mode) {
  localStorage.setItem(KEY, mode);
  applyTheme(mode);
}

export function initTheme() {
  applyTheme(getTheme());
}
