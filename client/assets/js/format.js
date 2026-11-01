/**
 * Small, dependency-free helpers shared by every module:
 * number/date formatting, HTML escaping and DOM shortcuts.
 */
const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('en-PH');

export const formatPrice = (n) => peso.format(n || 0);
export const formatNumber = (n) => num.format(n || 0);
export const formatDate = (d) =>
  new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });

/** Short peso amount for tight spaces: 2150000 -> "₱2.15M", 38500 -> "₱38.5k". */
export function formatPriceShort(n) {
  if (n >= 1e6) return `₱${+(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `₱${+(n / 1e3).toFixed(1)}k`;
  return `₱${n}`;
}

/** Escape text before putting it into innerHTML. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
