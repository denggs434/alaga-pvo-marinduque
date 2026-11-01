/**
 * About page: photo credits from credits.json, audience icons,
 * and opening the credits panel when linked to with #credits.
 */
import { initPage, esc, ICONS, $, $$ } from '../ui.js';

initPage('about');

// Audience card icons
$$('[data-icon]').forEach((el) => (el.innerHTML = ICONS[el.dataset.icon] || ''));

// Footer "Photo credits" links to #credits: open the panel so the list is visible.
const details = $('.credits-box');
if (location.hash === '#credits') details.open = true;
addEventListener('hashchange', () => { if (location.hash === '#credits') details.open = true; });

// credits.json is generated alongside the images and lists author, licence and source.
fetch('assets/img/credits.json')
  .then((r) => r.json())
  .then((list) => {
    $('#credit-list').innerHTML = list
      .map(
        (c) => `<li>
          <img src="${esc(c.image)}" alt="" loading="lazy" width="56" height="56">
          <span><strong>${esc(c.title.replace(/\.(jpe?g|png)$/i, ''))}</strong><br>
          <span class="muted">${esc(c.author)} · <a href="${esc(c.licenseUrl)}" target="_blank" rel="noopener">${esc(c.license)}</a> · <a href="${esc(c.source)}" target="_blank" rel="noopener">source</a></span></span>
        </li>`
      )
      .join('');
  })
  .catch(() => ($('#credit-list').innerHTML = '<li>Credits could not be loaded.</li>'));
