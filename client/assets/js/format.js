/**
 * Small, dependency-free helpers shared by every module:
 * dates, ages, HTML escaping and DOM shortcuts. All dates show in Manila time.
 */
const TZ = 'Asia/Manila';

export const formatNumber = (n) => new Intl.NumberFormat('en-PH').format(n || 0);
export const formatDate = (d) => (d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', timeZone: TZ }) : '');
export const formatDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ }) : '';
export const formatTime = (d) => new Date(d).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: TZ });

/** Parts for a calendar "date tile": { day: '14', month: 'Nov', weekday: 'Fri' } */
export function dateParts(d) {
  const date = new Date(d);
  const part = (o) => date.toLocaleDateString('en-PH', { ...o, timeZone: TZ });
  return { day: part({ day: 'numeric' }), month: part({ month: 'short' }), weekday: part({ weekday: 'short' }) };
}

/** "just now", "5 min ago", "3 h ago", "2 d ago", then a date. */
export function timeAgo(d) {
  const sec = Math.round((Date.now() - new Date(d)) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} h ago`;
  if (sec < 7 * 86400) return `${Math.floor(sec / 86400)} d ago`;
  return formatDate(d);
}

/** Age from a birth date: "3 yrs", "7 mos", "3 wks". */
export function ageText(birth) {
  if (!birth) return '';
  const b = new Date(birth);
  const now = new Date();
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) months -= 1;
  if (months >= 24) return `${Math.floor(months / 12)} yrs`;
  if (months >= 12) return '1 yr';
  if (months >= 2) return `${months} mos`;
  const weeks = Math.max(1, Math.floor((now - b) / (7 * 864e5)));
  return `${weeks} wk${weeks === 1 ? '' : 's'}`;
}

/** yyyy-mm-dd for <input type="date"> (Manila date). */
export const toDateInput = (d) => (d ? new Date(d).toLocaleDateString('en-CA', { timeZone: TZ }) : '');
/** yyyy-mm-ddThh:mm for <input type="datetime-local"> (Manila time). */
export function toDateTimeInput(d) {
  if (!d) return '';
  const local = new Date(new Date(d).getTime() + 8 * 36e5);
  return local.toISOString().slice(0, 16);
}
/** Read a datetime-local value as Manila time. */
export const fromDateTimeInput = (v) => (v ? new Date(`${v}:00+08:00`).toISOString() : '');
/**
 * Read a date input as noon Manila time (avoids off-by-one days).
 * For today's date before noon, noon is still in the future and the server would
 * reject "date cannot be in the future", so today becomes "now" instead.
 */
export function fromDateInput(v) {
  if (!v) return '';
  const noon = new Date(`${v}T12:00:00+08:00`);
  const now = new Date();
  return (v === toDateInput(now) && noon > now ? now : noon).toISOString();
}

export const initials = (name = '') => name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
export const plural = (n, word, many = `${word}s`) => `${formatNumber(n)} ${n === 1 ? word : many}`;

/** Escape text before putting it into innerHTML. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function debounce(fn, ms = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
