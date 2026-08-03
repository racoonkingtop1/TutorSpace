// Demo banner + bottom tab bar, shared by every authenticated screen.
// Re-rendered on every navigation (cheap — it's a handful of DOM nodes) so
// the active tab always matches the current hash route.

const TABS = [
  { key: 'today', href: '#/today', label: 'Сегодня', prefixes: ['/today'] },
  { key: 'students', href: '#/students', label: 'Ученики', prefixes: ['/students', '/lessons-history'] },
  { key: 'plan', href: '#/plan', label: 'План', prefixes: ['/plan'] },
  { key: 'settings', href: '#/settings', label: 'Настройки', prefixes: ['/settings', '/subscription'] },
];

/** hasChrome=false renders bare content only (used by the public tutor card, "без навигации" in the original design). */
export function renderShell(path, { hasChrome = true } = {}) {
  const top = document.getElementById('shell-top');
  const bottom = document.getElementById('shell-bottom');
  if (!hasChrome) {
    top.innerHTML = '';
    bottom.innerHTML = '';
    return;
  }
  top.innerHTML = `<div class="demo-banner">Демо-режим · данные условны, изменения сохраняются только в этой вкладке браузера</div>`;
  bottom.innerHTML = `<nav class="bottom-nav">${TABS.map(
    (t) => `<a href="${t.href}" class="${t.prefixes.some((p) => path.startsWith(p)) ? 'active' : ''}">${t.label}</a>`
  ).join('')}</nav>`;
}
