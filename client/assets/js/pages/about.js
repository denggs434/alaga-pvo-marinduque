/**
 * About page: office details from config, and photo credits from credits.json.
 */
import { SITE } from '../config.js';
import { initPage, esc, ICONS, $ } from '../ui.js';

initPage('about');

$('#office').innerHTML = [
  [ICONS.pin, `${SITE.office}<br><span class="muted">${SITE.address}</span>`],
  [ICONS.clock, SITE.hours],
  [ICONS.phone, `${SITE.phone} · animal bite hotline ${SITE.hotline}`],
  [ICONS.mail, `<a href="mailto:${SITE.email}">${SITE.email}</a>`],
].map(([icon, text]) => `<li>${icon}<span>${text}</span></li>`).join('');

fetch('assets/img/credits.json')
  .then((r) => r.json())
  .then((list) => {
    $('#credit-list').innerHTML = list.map((c) => `<li>
      <img src="${esc(c.image)}" alt="" loading="lazy" width="48" height="48">
      <span><strong>${esc(c.title.replace(/\.(jpe?g|png)$/i, ''))}</strong><br>
      <span class="muted">${esc(c.author)} · ${c.licenseUrl ? `<a href="${esc(c.licenseUrl)}" target="_blank" rel="noopener">${esc(c.license)}</a>` : esc(c.license)} · <a href="${esc(c.source)}" target="_blank" rel="noopener">source</a></span></span>
    </li>`).join('');
  })
  .catch(() => ($('#credit-list').innerHTML = '<li>Could not load the credits.</li>'));
