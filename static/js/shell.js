// Renders the demo banner + bottom tab bar shared by every authenticated
// page. Each page just needs `<div id="shell-top"></div>` /
// `<div id="shell-bottom"></div>` placeholders and a call to
// `renderShell('today')` (or whichever tab is current).

const TABS = [
  { key: 'today', href: 'index.html', label: 'Сегодня' },
  { key: 'students', href: 'students.html', label: 'Ученики' },
  { key: 'plan', href: 'plan.html', label: 'План' },
  { key: 'settings', href: 'settings.html', label: 'Настройки' },
];

export function renderShell(activeKey) {
  const top = document.getElementById('shell-top');
  if (top) {
    top.innerHTML = `<div class="demo-banner">Демо-режим · данные условны, изменения сохраняются только в этой вкладке браузера</div>`;
  }
  const bottom = document.getElementById('shell-bottom');
  if (bottom) {
    bottom.innerHTML = `<nav class="bottom-nav">${TABS.map(
      (t) => `<a href="${t.href}" class="${t.key === activeKey ? 'active' : ''}">${t.label}</a>`
    ).join('')}</nav>`;
  }
}
