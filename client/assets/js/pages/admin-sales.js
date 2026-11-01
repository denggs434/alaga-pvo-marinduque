/**
 * Admin Sales view: headline figures, a weekly stacked bar chart (SVG, drawn by
 * hand, no library), revenue by model, orders by status and a table view.
 *
 * Chart rules followed (dataviz skill):
 *  - one hue: solid accent = completed, lighter step of the same hue = still open
 *    (both steps validated for contrast against light and dark surfaces)
 *  - one y-axis, recessive grid, 4px rounded data ends, 2px gap between segments
 *  - legend always shown for the two series; tooltip on hover/focus; table view
 */
import { api, qs } from '../api.js';
import { formatPrice, formatPriceShort, formatNumber, esc, $, $$ } from '../format.js';
import { countUp } from '../motion.js';

const STATUS = [
  { key: 'pending', label: 'Pending', tone: 'warn' },
  { key: 'confirmed', label: 'Confirmed', tone: 'accent' },
  { key: 'ready', label: 'Ready for handover', tone: 'good' },
  { key: 'completed', label: 'Completed', tone: 'good' },
  { key: 'cancelled', label: 'Cancelled', tone: 'bad' },
];

const dayFmt = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });

/** Round a maximum up to a "nice" axis value: 1, 2, 2.5 or 5 × 10^k. */
function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/** Rectangle path with only the top corners rounded (the data end). */
function topRounded(x, y, w, h, r) {
  if (h <= 0) return '';
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function createSalesView() {
  let weeks = 12;
  let data = null;
  const chartEl = $('#weekly-chart');
  const tip = $('#chart-tip');

  /* ---------- Headline figures ---------- */
  function renderKpis() {
    const t = data.totals;
    const live = (data.byStatus.pending?.count || 0) + (data.byStatus.confirmed?.count || 0) + (data.byStatus.ready?.count || 0);
    const done = data.byStatus.completed?.count || 0;
    const items = [
      { label: 'Sales completed', value: t.completed, money: true, sub: `${done} ${done === 1 ? 'order' : 'orders'} handed over` },
      { label: 'Deposits & payments taken', value: t.deposits, money: true, sub: 'Collected at reservation' },
      { label: 'Open pipeline', value: t.pipeline, money: true, sub: `${live} ${live === 1 ? 'order' : 'orders'} in progress` },
      { label: 'Cars sold', value: t.carsSold, money: false, sub: `Average order ${formatPriceShort(t.average)}` },
    ];
    $('#kpis').innerHTML = items
      .map((k, i) => `<div><dt>${k.label}</dt><dd data-kpi="${i}" title="${k.money ? formatPrice(k.value) : k.value}">${k.money ? formatPriceShort(k.value) : k.value}</dd><span>${k.sub}</span></div>`)
      .join('');
    items.forEach((k, i) => countUp($(`[data-kpi="${i}"]`), k.value, k.money ? (n) => formatPriceShort(Math.round(n)) : (n) => String(Math.round(n)), 1000));
  }

  /* ---------- Weekly stacked bars (SVG) ---------- */
  /** @param {boolean} animate grow the bars in (only right after new data loads, not on resize) */
  function renderWeekly(animate = false) {
    chartEl.classList.toggle('no-anim', !animate);
    const rows = data.weekly;
    const W = Math.max(chartEl.clientWidth, 320);
    const H = 280;
    const m = { top: 14, right: 8, bottom: 30, left: 58 };
    const pw = W - m.left - m.right;
    const ph = H - m.top - m.bottom;
    const max = niceMax(Math.max(...rows.map((r) => r.booked), 1));
    const y = (v) => m.top + ph - (v / max) * ph;
    const band = pw / rows.length;
    const bw = Math.min(band * 0.62, 46);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
    const every = rows.length > 16 ? 4 : rows.length > 8 ? 2 : 1;

    const grid = ticks
      .map((v) => `<line x1="${m.left}" x2="${W - m.right}" y1="${y(v)}" y2="${y(v)}" class="${v === 0 ? 'axis' : 'grid'}"/>
        <text x="${m.left - 10}" y="${y(v) + 4}" text-anchor="end" class="tick">${v === 0 ? '0' : formatPriceShort(v)}</text>`)
      .join('');

    const bars = rows
      .map((r, i) => {
        const cx = m.left + band * i + band / 2;
        const x = cx - bw / 2;
        const done = r.completed;
        const open = Math.max(r.booked - r.completed, 0);
        const hDone = (done / max) * ph;
        const hOpen = (open / max) * ph;
        const gap = done && open ? 2 : 0; // 2px surface gap between stacked fills
        const isLast = i === rows.length - 1;
        // Only the top-most segment gets rounded data-end corners.
        const doneShape = open ? `<rect x="${x}" y="${y(done)}" width="${bw}" height="${Math.max(hDone, 0)}" class="seg-done"/>` : `<path d="${topRounded(x, y(done), bw, hDone, 4)}" class="seg-done"/>`;
        const openShape = open ? `<path d="${topRounded(x, y(done) - gap - hOpen, bw, hOpen, 4)}" class="seg-open"/>` : '';
        const label = i % every === 0 || isLast
          ? `<text x="${cx}" y="${H - 10}" text-anchor="middle" class="tick ${isLast ? 'tick-now' : ''}">${isLast ? 'This week' : dayFmt.format(new Date(r.weekStart))}</text>`
          : '';
        return `<g class="bar" style="--i:${i}">
          ${done ? doneShape : ''}${openShape}
          ${label}
          <rect class="hit" x="${m.left + band * i}" y="${m.top}" width="${band}" height="${ph}" data-i="${i}" tabindex="0"
            aria-label="Week of ${dayFmt.format(new Date(r.weekStart))}: ${formatPrice(r.booked)} booked, ${formatPrice(r.completed)} completed"/>
        </g>`;
      })
      .join('');

    chartEl.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="weekly-title">${grid}${bars}</svg>`;

    const show = (el) => {
      const i = Number(el.dataset.i);
      const r = rows[i];
      const end = new Date(new Date(r.weekStart).getTime() + 6 * 864e5);
      $$('.bar', chartEl).forEach((b, n) => b.classList.toggle('is-dim', n !== i));
      tip.innerHTML = `<strong>${dayFmt.format(new Date(r.weekStart))} – ${dayFmt.format(end)}</strong>
        <span><i class="sw-done"></i>Completed <b>${formatPrice(r.completed)}</b></span>
        <span><i class="sw-open"></i>Still open <b>${formatPrice(Math.max(r.booked - r.completed, 0))}</b></span>
        <span class="tip-total">${r.orders} ${r.orders === 1 ? 'order' : 'orders'} · ${formatPrice(r.booked)} booked</span>`;
      tip.hidden = false;
      const box = el.getBoundingClientRect();
      const host = chartEl.parentElement.getBoundingClientRect();
      const left = Math.min(Math.max(box.left - host.left + box.width / 2 - tip.offsetWidth / 2, 8), host.width - tip.offsetWidth - 8);
      tip.style.left = `${left}px`;
      tip.style.top = `${Math.max(y(r.booked) - tip.offsetHeight - 12 + (chartEl.offsetTop), 8)}px`;
    };
    const hide = () => { tip.hidden = true; $$('.bar', chartEl).forEach((b) => b.classList.remove('is-dim')); };
    $$('.hit', chartEl).forEach((h) => {
      h.addEventListener('pointerenter', () => show(h));
      h.addEventListener('focus', () => show(h));
      h.addEventListener('blur', hide);
    });
    chartEl.addEventListener('pointerleave', hide);

    // Table view of the same numbers
    $('#weekly-table').innerHTML = `<thead><tr><th>Week of</th><th class="num">Orders</th><th class="num">Completed</th><th class="num">Still open</th><th class="num">Booked</th></tr></thead>
      <tbody>${rows.map((r) => `<tr><td>${dayFmt.format(new Date(r.weekStart))}</td><td class="num">${r.orders}</td><td class="num">${formatPrice(r.completed)}</td><td class="num">${formatPrice(Math.max(r.booked - r.completed, 0))}</td><td class="num">${formatPrice(r.booked)}</td></tr>`).join('')}</tbody>`;
  }

  /* ---------- Revenue by model ---------- */
  function renderByModel() {
    const max = Math.max(...data.byModel.map((m) => m.revenue), 1);
    $('#by-model').innerHTML = data.byModel
      .map((m, i) => `<li style="--i:${i}">
        <span class="hb-label">${esc(m.label)}<small>${formatNumber(m.units)} ${m.label === 'Charging & parts' ? 'items' : m.units === 1 ? 'car' : 'cars'}</small></span>
        <span class="hb-track"><span class="hb-bar" style="--w:${((m.revenue / max) * 100).toFixed(2)}%"></span></span>
        <span class="hb-value mono">${formatPriceShort(m.revenue)}</span>
      </li>`)
      .join('') || '<li class="q-empty">No sales yet.</li>';
  }

  /* ---------- Orders by status (labelled rows; never colour alone) ---------- */
  function renderByStatus() {
    const total = STATUS.reduce((s, st) => s + (data.byStatus[st.key]?.count || 0), 0) || 1;
    $('#by-status').innerHTML = STATUS.map((st) => {
      const s = data.byStatus[st.key] || { count: 0, value: 0 };
      return `<li class="tone-${st.tone}">
        <span class="sr-dot" aria-hidden="true"></span>
        <span class="sr-label">${st.label}</span>
        <span class="sr-count mono">${s.count}</span>
        <span class="sr-share"><span style="--w:${((s.count / total) * 100).toFixed(1)}%"></span></span>
        <span class="sr-value mono">${formatPriceShort(s.value)}</span>
      </li>`;
    }).join('');
  }

  async function load() {
    try {
      data = await api(`/admin/sales${qs({ weeks })}`);
      renderKpis();
      renderWeekly(true);
      renderByModel();
      renderByStatus();
    } catch (err) {
      $('#kpis').innerHTML = `<p class="notice notice-error">${esc(err.message)}</p>`;
    }
  }

  $$('[data-weeks]').forEach((b) => b.addEventListener('click', () => {
    weeks = Number(b.dataset.weeks);
    $$('[data-weeks]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    load();
  }));

  // Redraw the SVG at the new width when the window or sidebar changes size.
  let raf;
  new ResizeObserver(() => {
    if (!data || chartEl.offsetParent === null) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => renderWeekly(false));
  }).observe(chartEl);

  return { load, redraw: () => data && renderWeekly() };
}
