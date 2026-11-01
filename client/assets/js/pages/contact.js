/**
 * Contact form -> POST /api/contact.
 * Supports ?topic=test-drive&product=<id> links from product pages.
 */
import { api, qs } from '../api.js';
import { getUser } from '../store.js';
import { initPage, esc, toast, showFieldErrors, setBusy, $ } from '../ui.js';

initPage('contact');

const form = $('#contact-form');
const params = new URLSearchParams(location.search);
const topic = params.get('topic');
if (topic && form.querySelector(`input[name=topic][value="${CSS.escape(topic)}"]`)) form.elements.topic.value = topic;

// Prefill from the logged-in account.
const user = getUser();
if (user) {
  form.elements.name.value = user.name;
  form.elements.email.value = user.email;
  form.elements.phone.value = user.phone || '';
}

// Earliest test-drive date is tomorrow.
const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
form.elements.preferredDate.min = tomorrow;
const syncDate = () => ($('#date-field').hidden = !['test-drive', 'trade-in'].includes(form.elements.topic.value));
form.addEventListener('change', (e) => e.target.name === 'topic' && syncDate());
syncDate();

// Vehicle dropdown from the API.
api(`/products${qs({ category: 'vehicle', limit: 100, sort: 'price-asc' })}`)
  .then(({ items }) => {
    const sel = form.elements.product;
    sel.insertAdjacentHTML(
      'beforeend',
      items.map((p) => `<option value="${p._id}">${esc(p.name)} · ${esc(p.stockNumber)}</option>`).join('')
    );
    if (params.get('product')) sel.value = params.get('product');
  })
  .catch(() => {});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = form.elements;
  const errors = {};
  if (!f.name.value.trim()) errors.name = 'Enter your name.';
  if (!/^\S+@\S+\.\S+$/.test(f.email.value.trim())) errors.email = 'Enter a valid email so we can reply.';
  if (f.message.value.trim().length < 10) errors.message = 'Tell us a little more (at least 10 characters).';
  showFieldErrors(form, errors);
  if (Object.keys(errors).length) return;

  const btn = form.querySelector('[type=submit]');
  $('#contact-error').hidden = true;
  setBusy(btn, true, 'Sending…');
  try {
    await api('/contact', {
      method: 'POST',
      auth: false,
      body: {
        topic: f.topic.value,
        name: f.name.value.trim(),
        email: f.email.value.trim(),
        phone: f.phone.value.trim(),
        product: f.product.value || undefined,
        preferredDate: $('#date-field').hidden ? undefined : f.preferredDate.value || undefined,
        message: f.message.value.trim(),
      },
    });
    form.innerHTML = `<div class="stack">
      <span class="label">Message received</span>
      <h2 style="font-size:var(--step-2)">Thanks, ${esc(f.name.value.trim().split(' ')[0])}.</h2>
      <p>We will reply to ${esc(f.email.value.trim())} within one business day.</p>
      <a class="btn btn-ghost" href="products.html" style="justify-self:start">Back to inventory</a></div>`;
    toast('Message sent.');
  } catch (err) {
    $('#contact-error').textContent = err.message;
    $('#contact-error').hidden = false;
    if (err.details) showFieldErrors(form, err.details);
    setBusy(btn, false);
  }
});
