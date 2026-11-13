/**
 * Contact form -> POST /api/contact. Supports ?topic=<topic> links.
 */
import { api } from '../api.js';
import { getUser } from '../store.js';
import { SITE, CONTACT_TOPICS } from '../config.js';
import { initPage, toast, showFieldErrors, setBusy, options, esc, ICONS, $ } from '../ui.js';

initPage('contact');

const form = $('#contact-form');
const topic = new URLSearchParams(location.search).get('topic');
form.elements.topic.innerHTML = options(CONTACT_TOPICS, CONTACT_TOPICS[topic] ? topic : 'general');
$('#hotline').textContent = SITE.hotline;
$('#office').innerHTML = [
  [ICONS.pin, SITE.address],
  [ICONS.clock, SITE.hours],
  [ICONS.phone, SITE.phone],
  [ICONS.mail, `<a href="mailto:${SITE.email}">${SITE.email}</a>`],
].map(([icon, text]) => `<li>${icon}<span>${text}</span></li>`).join('');

const user = getUser();
if (user) {
  form.elements.name.value = user.name;
  form.elements.email.value = user.email;
  form.elements.phone.value = user.phone || '';
  $('#reply-note').innerHTML = 'Our reply will appear in <a href="messages.html">Messages</a>.';
} else {
  $('#reply-note').innerHTML = 'We reply by email, or <a href="account.html?next=contact.html">log in</a> to read it here.';
}
form.elements.message.addEventListener('input', () => ($('#msg-count').textContent = `${form.elements.message.value.length} / 2000`));

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = form.elements;
  const errors = {};
  if (!f.name.value.trim()) errors.name = 'Enter your name.';
  if (!/^\S+@\S+\.\S+$/.test(f.email.value.trim())) errors.email = 'Enter a valid email so we can reply.';
  if (f.phone.value.trim() && !/^[0-9+()\s-]{7,20}$/.test(f.phone.value.trim())) errors.phone = 'Enter a valid mobile number.';
  if (f.message.value.trim().length < 10) errors.message = 'Tell us a little more (at least 10 characters).';
  showFieldErrors(form, errors);
  if (Object.keys(errors).length) return;

  const btn = form.querySelector('[type=submit]');
  $('#contact-error').hidden = true;
  setBusy(btn, true, 'Sending…');
  try {
    const sent = await api('/contact', {
      method: 'POST',
      body: { name: f.name.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim(), topic: f.topic.value, message: f.message.value.trim() },
    });
    form.innerHTML = `<div class="stack" style="justify-items:start">
      <h2>Thanks, ${esc(f.name.value.trim().split(' ')[0])}!</h2>
      <p>${sent.linked
        ? 'We usually reply within one working day. You will find the reply on the Messages page.'
        : `We will reply to ${esc(f.email.value.trim())} within one working day.`}</p>
      <div class="row">${sent.linked ? '<a class="btn btn-primary" href="messages.html">Go to my messages</a>' : ''}<a class="btn btn-ghost" href="index.html">Back to the community wall</a></div></div>`;
    toast('Message sent.');
  } catch (err) {
    $('#contact-error').textContent = err.message;
    $('#contact-error').hidden = false;
    if (err.details) showFieldErrors(form, err.details);
    setBusy(btn, false);
  }
});
