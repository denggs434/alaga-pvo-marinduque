/**
 * Small SVG bar charts for the admin overview (no chart library).
 * Following the dataviz rules used across the console:
 *  - one y-axis, recessive grid, thin bars with 4px rounded tops on a square baseline
 *  - categorical colours in a fixed order (--series-1..4, validated for colour-blind
 *    separation in light and dark); a legend for 2+ series, never colour alone
 *  - 2px surface gap between stacked segments
 *  - every bar has a hover/focus tooltip, and each chart has a table view
 */
import { esc } from '../format.js';

const W = 560;
const H = 220;
const PAD = { top: 12, right: 8, bottom: 26, left: 32 };

const monthLabel = (key) => new Date(`${key}-01T12:00:00Z`).toLocaleDateString('en-PH', { month: 'short' });
const monthLong = (key) => new Date(`${key}-01T12:00:00Z`).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });

/** A round axis maximum and 4 tick steps. */
function scale(max) {
  const raw = Math.max(max, 4) / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  return { top: step * 4, step };
}

/** Bar with rounded top corners and a flat base. */
function bar(x, y, w, h, r = 4) {
  if (h <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

function frame(top, step, plotH, innerW) {
  let g = '';
  for (let v = 0; v <= top; v += step) {
    const y = PAD.top + plotH - (v / top) * plotH;
    g += `<line class="${v ? 'grid-line' : 'axis'}" x1="${PAD.left}" x2="${PAD.left + innerW}" y1="${y}" y2="${y}"/>
      <text x="${PAD.left - 6}" y="${y + 4}" text-anchor="end">${v}</text>`;
  }
  return g;
}

const legend = (series) => `<ul class="legend" style="margin-top:8px">${series.map((s) => `<li><i class="${s.cls}"></i>${esc(s.label)}</li>`).join('')}</ul>`;

function table(months, series) {
  return `<div class="table-wrap chart-table" hidden><table class="table"><thead><tr><th>Month</th>${series.map((s) => `<th class="num">${esc(s.label)}</th>`).join('')}</tr></thead>
    <tbody>${months.map((m, i) => `<tr><td>${monthLong(m)}</td>${series.map((s) => `<td class="num">${s.values[i]}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

/** Side-by-side bars per month. series: [{ label, cls: 's1', values: [] }] */
export function groupedBars(el, months, series, title) {
  const innerW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const { top, step } = scale(Math.max(...series.flatMap((s) => s.values)));
  const band = innerW / months.length;
  const bw = Math.min(18, (band * 0.7) / series.length);
  let bars = '';
  months.forEach((m, i) => {
    const groupX = PAD.left + band * i + (band - bw * series.length - 2 * (series.length - 1)) / 2;
    series.forEach((s, j) => {
      const v = s.values[i];
      const h = (v / top) * plotH;
      const tip = `${monthLong(m)}\n${s.label}: ${v}`;
      bars += `<path class="${s.cls}" d="${bar(groupX + j * (bw + 2), PAD.top + plotH - h, bw, h)}"/>`;
      // Hit target: the full column height, bigger than the mark.
      bars += `<rect x="${groupX + j * (bw + 2)}" y="${PAD.top}" width="${bw + 2}" height="${plotH}" fill="transparent" data-tip="${esc(tip)}" tabindex="0" aria-label="${esc(tip.replace('\n', ', '))}"/>`;
    });
    bars += `<text x="${PAD.left + band * i + band / 2}" y="${H - 8}" text-anchor="middle">${monthLabel(m)}</text>`;
  });
  el.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${frame(top, step, plotH, innerW)}${bars}</svg>${legend(series)}${table(months, series)}`;
}

/** Stacked bars per month. series in fixed order, bottom to top. */
export function stackedBars(el, months, series, title) {
  const innerW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const totals = months.map((_, i) => series.reduce((sum, s) => sum + s.values[i], 0));
  const { top, step } = scale(Math.max(...totals));
  const band = innerW / months.length;
  const bw = Math.min(28, band * 0.5);
  let bars = '';
  months.forEach((m, i) => {
    const x = PAD.left + band * i + (band - bw) / 2;
    let y = PAD.top + plotH;
    const parts = series.filter((s) => s.values[i] > 0);
    parts.forEach((s, j) => {
      const h = (s.values[i] / top) * plotH;
      y -= h;
      const isTop = j === parts.length - 1;
      bars += isTop
        ? `<path class="${s.cls} gap" d="${bar(x, y, bw, h)}"/>`
        : `<rect class="${s.cls} gap" x="${x}" y="${y}" width="${bw}" height="${h}"/>`;
    });
    const tip = `${monthLong(m)}: ${totals[i]} ${totals[i] === 1 ? 'report' : 'reports'}\n${series.map((s) => `${s.label}: ${s.values[i]}`).join('\n')}`;
    bars += `<rect x="${PAD.left + band * i}" y="${PAD.top}" width="${band}" height="${plotH}" fill="transparent" data-tip="${esc(tip)}" tabindex="0" aria-label="${esc(tip.replace(/\n/g, ', '))}"/>`;
    bars += `<text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${monthLabel(m)}</text>`;
  });
  el.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${frame(top, step, plotH, innerW)}${bars}</svg>${legend(series)}${table(months, series)}`;
}

/* ---------- One tooltip for every chart ---------- */
const tip = document.createElement('div');
tip.className = 'chart-tip';
tip.hidden = true;
tip.setAttribute('role', 'status');
document.body.append(tip);

function show(target, x, y) {
  tip.textContent = target.dataset.tip;
  tip.hidden = false;
  const r = tip.getBoundingClientRect();
  tip.style.left = `${Math.min(innerWidth - r.width - 8, Math.max(8, x - r.width / 2))}px`;
  tip.style.top = `${Math.max(8, y - r.height - 12)}px`;
}
document.addEventListener('pointermove', (e) => {
  const t = e.target.closest?.('[data-tip]');
  if (t) show(t, e.clientX, e.clientY);
  else tip.hidden = true;
});
document.addEventListener('focusin', (e) => {
  const t = e.target.closest?.('[data-tip]');
  if (!t) return void (tip.hidden = true);
  const r = t.getBoundingClientRect();
  show(t, r.left + r.width / 2, r.top);
});
document.addEventListener('focusout', () => (tip.hidden = true));

/** "View as table" toggles for chart panels. */
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-table-toggle]');
  if (!b) return;
  const panel = b.closest('.panel');
  const tbl = panel.querySelector('.chart-table');
  const svg = panel.querySelector('svg.chart');
  const showTable = tbl.hidden;
  tbl.hidden = !showTable;
  svg.style.display = showTable ? 'none' : '';
  b.textContent = showTable ? 'View as chart' : 'View as table';
});
