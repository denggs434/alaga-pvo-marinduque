/** Inline SVG icons (stroke = currentColor) and the Voltyard brand mark. */
const icon = (d) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const ICONS = {
  cart: icon('<path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6.2"/><circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/>'),
  user: icon('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
  menu: icon('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  close: icon('<path d="M6 6l12 12M18 6 6 18"/>'),
  search: icon('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>'),
  chevron: icon('<path d="m6 9 6 6 6-6"/>'),
  arrow: icon('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  sun: icon('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: icon('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>'),
  bolt: icon('<path d="M13 2 4.5 13.5H12L11 22l8.5-11.5H12z"/>'),
  pin: icon('<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  phone: icon('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>'),
  logout: icon('<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4"/>'),
  orders: icon('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>'),
  shield: icon('<path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>'),
};

export const BRAND_MARK = `<svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
  <rect x="1" y="1" width="30" height="30" rx="7" fill="var(--ink)"/>
  <path d="M8 9h4.2L16 19.5 19.8 9H24l-6 15h-4z" fill="var(--bg)"/>
  <path d="M17.5 4.5 15 10h3l-2.5 5.5" fill="none" stroke="var(--accent)" stroke-width="1.6" stroke-linejoin="round"/>
</svg>`;
