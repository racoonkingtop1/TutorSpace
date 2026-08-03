export function money(n) {
  const sign = n > 0 ? '+' : '';
  return `${sign}${Math.round(n).toLocaleString('ru-RU')} ₽`;
}

export function time(iso) {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function date(iso) {
  return new Date(iso).toLocaleDateString('ru-RU');
}

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
