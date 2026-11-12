/**
 * Alagai, the AI pet-care assistant.
 *
 * POST /api/assistant/chat  { messages: [{ role: 'user' | 'assistant', content }] }
 *   -> { reply, urgent, offline }
 *
 * The model is reached through an OpenAI-compatible Chat Completions endpoint:
 *  - default: Vercel AI Gateway. Credentials, in order: AI_GATEWAY_API_KEY, the
 *    per-request OIDC token Vercel adds to function requests, or
 *    VERCEL_OIDC_TOKEN pulled with `vercel env pull` for local development.
 *  - or any other compatible provider: set ALAGAI_API_URL, ALAGAI_API_KEY and
 *    ALAGAI_MODEL (for example Google Gemini's OpenAI-compatible endpoint).
 *
 * Safety does not rest on the model alone:
 *  - the system prompt forbids diagnoses, medicines and doses
 *  - urgent words (poisoning, seizures, bleeding…) are detected on the server
 *    and the page shows the emergency banner regardless of the reply
 *  - when the gateway cannot be reached, Alagai answers from a short list of
 *    vetted basics instead of failing silently, and says it is offline
 */
const Pet = require('../models/Pet');
const Announcement = require('../models/Announcement');
const HttpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');

const GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1/chat/completions';
const API_URL = () => process.env.ALAGAI_API_URL || GATEWAY_URL;
const MODEL = () => process.env.ALAGAI_MODEL || 'anthropic/claude-haiku-5.5';
const MAX_TURNS = 16;
const MAX_CHARS = 1500;

const OFFICE = {
  phone: '(042) 123-4567',
  hotline: '0917 000 0000',
  address: 'Provincial Capitol Compound, Boac, Marinduque',
  hours: 'Monday to Friday, 8:00 AM to 5:00 PM',
};

const SYSTEM_PROMPT = `You are Alagai, the friendly pet-care assistant of Alaga, the pet community of the Provincial Veterinary Office (PVO) of Marinduque, Philippines.

Who you are
- You are an AI assistant, not a licensed veterinarian. Say so plainly whenever a question is about health, symptoms or treatment, and when asked who you are.
- Warm, clear and practical. Plain English that a pet owner in the province understands; a Tagalog word now and then is fine ("alaga" means care). No baby talk.

What you help with
- Everyday pet care: feeding and nutrition, grooming and hygiene, behaviour and training, exercise, safe homes, care for puppies, kittens and older pets.
- Preventive care: vaccination schedules in general terms (puppies and kittens start their vaccine series from about 6 to 8 weeks; anti-rabies from 3 months, then every year as Philippine law requires), deworming, tick and flea prevention, spay and neuter.
- Understanding common symptoms in general terms, and how urgent they may be.
- Responsible pet ownership: registration, anti-rabies vaccination (Republic Act 9482, the Anti-Rabies Act), not letting pets roam, animal welfare (Republic Act 8485, the Animal Welfare Act).
- PVO services and programs (below), and how to use the Alaga site.

Hard rules
- Never give a definitive diagnosis. Describe possibilities in general terms and say only a veterinarian can examine and diagnose.
- Never prescribe or name a specific medicine dose, and never suggest giving human medicines (paracetamol, ibuprofen and others are poisonous to pets).
- Emergencies come first. For poisoning, seizures, trouble breathing, heavy bleeding, a suspected broken bone, being hit by a vehicle, heatstroke, a swollen hard belly, not eating or drinking for over a day, collapse, or any animal bite to a person: tell the owner to go to a licensed veterinarian or call the PVO right away, give one or two safe first steps at most, and keep the rest short.
- Animal bite to a person: wash the wound with soap and running water for 15 minutes, go to an Animal Bite Treatment Center the same day, and report it to the PVO; watch the animal for 14 days.
- Put animal welfare first. Refuse to help with anything that harms animals.
- If you do not know, say so and suggest asking the PVO.
- Stay on pets, animals and the PVO. For anything else, say kindly that you can only help with pet care.

PVO Marinduque (sample contact details for this student project)
- Office: ${OFFICE.address}. Open ${OFFICE.hours}. Telephone ${OFFICE.phone}.
- Animal bite hotline: ${OFFICE.hotline}.
- Free services: pet registration (on Alaga or at the office), anti-rabies vaccination drives in all six municipalities (Boac, Buenavista, Gasan, Mogpog, Santa Cruz, Torrijos), deworming and vitamins, spay and neuter (kapon) programs, animal bite response, stray and welfare cases, consultation and health certificates.
- On Alaga: register pets under Account; report bites, missing pets, strays and welfare concerns on the Report page; schedules are on Announcements; message the office on Contact.

How to answer
- Keep it short: usually 2 to 5 sentences, or a few "- " bullet points for steps. Use **bold** sparingly for the key point. No headings, no tables.
- Ask one short follow-up question when the pet's species, age or the details matter.
- End health answers with when to see a vet.`;

/* ---------- Urgency check (independent of the model) ---------- */
const URGENT = /\b(poison|poisoned|lason|rat ?bait|chocolate|grapes?|antifreeze|seiz|convuls|kumbulsyon|not breathing|can'?t breathe|hirap huminga|choking|bleed|dugo|hit by|nabangga|broken (bone|leg)|fracture|unconscious|collaps|heat ?stroke|bloat|swollen (belly|stomach)|vomiting blood|blood in (stool|poop|vomit)|paralys|bit (me|my|a|him|her|someone)|bitten|nakagat|kagat|rabies)\b/i;

/* ---------- Offline answers ---------- */
const OFFLINE = [
  [/\b(vaccin|bakuna|rabies|shot|booster)/i, 'Puppies and kittens usually start their vaccine series at about 6 to 8 weeks old, with boosters every few weeks. **Anti-rabies** is given from 3 months old and then every year, and it is free at PVO drives. Check the Announcements page for the next drive in your town, and keep the vaccination card.'],
  [/\b(deworm|worm|bulate|purga)/i, 'Puppies and kittens are usually dewormed every 2 weeks until about 3 months old, then every 3 to 6 months as advised by a vet. The PVO holds free deworming days; see Announcements. Ask a vet for the right product and dose for your pet\'s weight.'],
  [/\b(feed|food|eat|diet|pagkain|kain|nutrition)/i, 'Feed a complete pet food made for your pet\'s species and age, keep clean water out all day, and avoid chocolate, grapes, onions, garlic, cooked bones and very salty or fatty leftovers. If your pet stops eating for more than a day, see a vet.'],
  [/\b(groom|bath|ligo|fur|nail|tick|flea|garapata|pulgas)/i, 'Brush your pet a few times a week, bathe dogs about once a month with a pet shampoo, and check for ticks and fleas, especially after walks. Ask a vet about a tick and flea preventive that suits your pet.'],
  [/\b(kapon|spay|neuter|castrat)/i, 'Spaying and neutering (kapon) prevents unwanted litters and some illnesses. The PVO runs free kapon programs; watch the Announcements page and register early because slots fill up.'],
  [/\b(register|registration|rehistro)/i, 'Register your pet under Account → Register a pet. You get a PVO registration number right away, and staff verify it at your next visit or vaccination drive.'],
  [/\b(behav|bark|bite|scratch|train|aggress|anxious|tahol)/i, 'Most behaviour problems improve with routine, daily exercise, and rewarding the behaviour you want instead of punishing. Sudden changes in behaviour can mean pain or illness, so a vet check is a good first step.'],
];

function offlineAnswer(text) {
  if (URGENT.test(text)) {
    return `**This may be an emergency. Please go to a licensed veterinarian now**, or call the PVO at ${OFFICE.phone} (animal bite hotline ${OFFICE.hotline}).\n\n- Do not give your pet any human medicine or try to make it vomit unless a vet tells you to.\n- Keep your pet calm and warm, and bring the packaging of anything it may have eaten.\n- If a person was bitten: wash the wound with soap and running water for 15 minutes and go to an Animal Bite Treatment Center today.\n\nI am an AI assistant, not a veterinarian.`;
  }
  const hit = OFFLINE.find(([re]) => re.test(text));
  return `${hit ? hit[1] : 'I can help with feeding, grooming, vaccination, deworming, behaviour, kapon programs and PVO services. Try asking about one of those.'}\n\nI am an AI assistant, not a veterinarian. For anything serious, visit a licensed vet or call the PVO at ${OFFICE.phone}.`;
}

/* ---------- Context about this owner (kept short) ---------- */
async function contextFor(user) {
  const now = new Date();
  const [pets, events] = await Promise.all([
    user.role === 'owner' ? Pet.find({ owner: user._id, status: { $ne: 'deceased' } }).select('name species breed sex birthDate vaccinations neutered').limit(10).lean() : [],
    Announcement.find({ published: true, 'event.startsAt': { $gte: now } }).sort({ 'event.startsAt': 1 }).limit(5).select('title event').lean(),
  ]);
  const fmt = (d) => new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' });
  const petLines = pets.map((p) => {
    const r = Pet.rabiesStatus(p);
    const age = p.birthDate ? `${Math.max(0, Math.floor((now - new Date(p.birthDate)) / (30.44 * 864e5)))} months old` : 'age unknown';
    const rabies = r.status === 'current' ? `anti-rabies current until ${fmt(r.due)}` : r.status === 'overdue' ? 'anti-rabies overdue' : 'no anti-rabies on record';
    return `- ${p.name}: ${p.species}${p.breed ? `, ${p.breed}` : ''}, ${p.sex}, ${age}${p.neutered ? ', neutered' : ''}, ${rabies}`;
  });
  const eventLines = events.map((e) => `- ${fmt(e.event.startsAt)}: ${e.title}${e.event.venue ? ` (${e.event.venue}${e.event.municipality ? `, ${e.event.municipality}` : ''})` : ''}`);
  return [
    `Today is ${fmt(now)}. You are talking with ${user.name.split(' ')[0]}${user.municipality ? ` from ${user.municipality}` : ''}.`,
    petLines.length ? `Their registered pets:\n${petLines.join('\n')}` : 'They have no registered pets yet.',
    eventLines.length ? `Upcoming PVO activities:\n${eventLines.join('\n')}` : 'No PVO activities are scheduled right now.',
  ].join('\n\n');
}

function apiToken(req) {
  if (process.env.ALAGAI_API_URL) return process.env.ALAGAI_API_KEY || null;
  return process.env.AI_GATEWAY_API_KEY || req.headers['x-vercel-oidc-token'] || process.env.VERCEL_OIDC_TOKEN || null;
}

/** Validate and trim the conversation the page sends. */
function readMessages(body) {
  const list = Array.isArray(body?.messages) ? body.messages : null;
  if (!list?.length) throw new HttpError(400, 'Ask Alagai a question first.');
  const clean = list.slice(-MAX_TURNS).map((m) => ({
    role: m?.role === 'assistant' ? 'assistant' : 'user',
    content: typeof m?.content === 'string' ? m.content.trim().slice(0, MAX_CHARS) : '',
  })).filter((m) => m.content);
  const last = clean[clean.length - 1];
  if (!last || last.role !== 'user') throw new HttpError(400, 'Ask Alagai a question first.');
  // The conversation must start with the user for the model.
  while (clean.length && clean[0].role !== 'user') clean.shift();
  return clean;
}

// POST /api/assistant/chat
exports.chat = asyncHandler(async (req, res) => {
  const messages = readMessages(req.body);
  const question = messages[messages.length - 1].content;
  const urgent = URGENT.test(question);
  const token = apiToken(req);

  if (!token) return res.json({ reply: offlineAnswer(question), urgent, offline: true });

  let reply;
  try {
    const context = await contextFor(req.user);
    const r = await fetch(API_URL(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL(),
        max_tokens: 700,
        temperature: 0.4,
        ...(API_URL() === GATEWAY_URL && { user: String(req.user._id) }),
        messages: [{ role: 'system', content: `${SYSTEM_PROMPT}\n\n${context}` }, ...messages],
      }),
      signal: AbortSignal.timeout(25000),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error(`[alagai] model API ${r.status}: ${data?.error?.type || data?.error?.code || ''} ${String(data?.error?.message || '').slice(0, 200)}`);
      if (r.status === 429) throw new HttpError(429, 'Alagai is answering a lot of questions right now. Try again in a minute.');
      return res.json({ reply: offlineAnswer(question), urgent, offline: true });
    }
    reply = data.choices?.[0]?.message?.content?.trim();
  } catch (err) {
    if (err instanceof HttpError) throw err;
    console.error(`[alagai] ${err.name}: ${err.message}`);
    return res.json({ reply: offlineAnswer(question), urgent, offline: true });
  }
  if (!reply) return res.json({ reply: offlineAnswer(question), urgent, offline: true });
  res.json({ reply, urgent, offline: false });
});
