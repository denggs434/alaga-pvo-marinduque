/**
 * Alagai, the pet-care helper.
 *
 * POST /api/assistant/chat  { messages: [{ role: 'user' | 'assistant', content }] }
 *   -> { reply, urgent }
 *
 * With GEMINI_API_KEY set, answers come from Google Gemini, grounded in live
 * data: the user's own pets and their anti-rabies status, the next PVO
 * activities, and the shop's in-stock products (so it can suggest real items
 * with a link). Without a key, or if Gemini fails, Alagai answers from the
 * vetted pet-care topics below. It answers any pet or animal question, never
 * claims a diagnosis or gives prescription doses, and urgent words (poisoning,
 * seizures, bleeding, bites…) always get the hotline banner, with the model told
 * to lead with first aid (the fixed emergency answer is used when AI is unavailable).
 */
const Pet = require('../models/Pet');
const Announcement = require('../models/Announcement');
const Product = require('../models/Product');
const HttpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');

const MAX_CHARS = 1500;
const OFFICE = {
  phone: '(042) 123-4567',
  hotline: '0917 000 0000',
  address: 'Provincial Capitol Compound, Boac',
  hours: 'Monday to Friday, 8:00 AM to 5:00 PM',
};
const NOT_A_VET = 'Alagai is a pet-care helper, not a veterinarian. For anything serious, visit a licensed vet.';

const URGENT = /\b(poison|poisoned|lason|rat ?bait|chocolate|grapes?|antifreeze|seiz|convuls|kumbulsyon|not breathing|can'?t breathe|hirap huminga|choking|bleed|dugo|hit by|nabangga|broken (bone|leg)|fracture|unconscious|collaps|heat ?stroke|bloat|swollen (belly|stomach)|vomiting blood|blood in (stool|poop|vomit)|paralys|bit (me|my|a|him|her|someone)|bitten|nakagat|kagat)\b/i;

const EMERGENCY = `**This may be an emergency. Please go to a licensed veterinarian now**, or call the PVO at ${OFFICE.phone} (animal bite hotline ${OFFICE.hotline}).

- Do not give your pet any human medicine or try to make it vomit unless a vet tells you to.
- Keep your pet calm and warm, and bring the packaging of anything it may have eaten.
- If a person was bitten: wash the wound with soap and running water for 15 minutes and go to an Animal Bite Treatment Center today. Report the bite to the PVO and watch the animal for 14 days.`;

/* Topics, checked in order. Each answer is general guidance written for owners in Marinduque. */
const TOPICS = [
  { re: /\b(rabies|anti-?rabies)\b/i, text: `**Anti-rabies** is given from 3 months old, then every year. It is required by the Anti-Rabies Act (RA 9482) and free at PVO drives in all six towns. Bring your pet's vaccination card so staff can update its record on Alaga.` },
  { re: /\b(vaccin|bakuna|shot|booster|5-in-1|6-in-1|4-in-1|dhpp|fvrcp)/i, text: `Puppies usually start their vaccine series (5-in-1 or 6-in-1) at 6 to 8 weeks, with boosters every 3 to 4 weeks until about 16 weeks; kittens get 4-in-1 (FVRCP) on a similar schedule. After that, boosters are usually yearly. **Anti-rabies** is given from 3 months old and every year, free at PVO drives. Your vet will set the exact schedule.` },
  { re: /\b(deworm|worms?|bulate|purga)\b/i, text: `Puppies and kittens are usually dewormed every 2 weeks until about 3 months old, then monthly until 6 months, then every 3 to 6 months. The PVO holds free deworming days (see Announcements). Ask a vet for the right product and dose for your pet's weight.` },
  { re: /\b(tick|flea|garapata|pulgas|mange|galis|scratch|itch|kati)/i, text: `Scratching is often caused by fleas, ticks, mites or skin allergies. Check the fur and ears, wash bedding in hot water, and keep the yard clean. Ask a vet about a tick and flea preventive that suits your pet. See a vet if there are bald patches, wounds, a bad smell, or ear shaking that does not stop.` },
  { re: /\b(puppy|tuta|kitten|kuting)\b.*\b(feed|food|eat|kain|pagkain)|\b(feed|food|eat|kain|pagkain)\b.*\b(puppy|tuta|kitten|kuting)\b/i, text: `Feed puppies and kittens a food made for their age, 3 to 4 small meals a day until about 6 months, then 2 meals a day. Keep clean water out all day. Avoid cow's milk, bones, chocolate, onions, garlic and grapes.` },
  { re: /\b(feed|food|eat|diet|pagkain|kain|nutrition|treat|milk|gatas|rice|kanin)\b/i, text: `Feed a complete pet food made for your pet's species and age, usually twice a day for adults, and keep clean water out all day. Plain rice with cooked meat is fine now and then, but not as the only food. **Never give** chocolate, grapes or raisins, onions, garlic, cooked bones, or very salty or fatty leftovers. If your pet stops eating for more than a day, see a vet.` },
  { re: /\b(groom|bath|ligo|paligo|shampoo|fur|balahibo|nail|kuko|brush|teeth|ngipin)\b/i, text: `Brush your pet a few times a week and bathe dogs about once a month with a pet shampoo (human shampoo dries their skin). Trim nails every few weeks, clean ears gently with a vet-approved cleaner, and brush teeth with pet toothpaste if your pet allows it. Cats rarely need baths.` },
  { re: /\b(kapon|spay|neuter|castrat|heat|landi)\b/i, text: `Spaying and neutering (kapon) prevents unwanted litters, reduces roaming and fighting, and lowers the risk of some cancers. Most pets can be spayed or neutered from about 6 months old. The PVO runs **free kapon programs**; watch Announcements and register early because slots fill up.` },
  { re: /\b(vomit|suka|diarrh|tae|poop|stool|not eating|ayaw kumain|lethargic|matamlay|fever|lagnat|cough|ubo|sneez|limp|pilay|sick|sakit)/i, text: `Mild stomach upset can pass in a day: give small amounts of water and a bland meal. **See a vet the same day** if there is blood, repeated vomiting, a swollen belly, weakness, no eating or drinking for over a day, or if it is a puppy, kitten or older pet. Coughing, fever or limping that lasts more than a day or two also needs a vet check. Alagai cannot tell what is causing it.` },
  { re: /\b(behav|bark|tahol|bite|kagat|chew|train|aggress|anxious|takot|scared|pee|ihi|potty)/i, text: `Most behaviour problems improve with routine, daily exercise and play, and rewarding the behaviour you want with treats and praise instead of punishing. For house training, take your pet out after meals and naps and reward it right away. A sudden change in behaviour can mean pain or illness, so a vet check is a good first step.` },
  { re: /\b(register|registration|rehistro|registration number)\b/i, text: `Register your pet on Alaga under **Account → Register a pet**. You get a PVO registration number right away, and PVO staff verify it at your next office visit or vaccination drive. Registration is free.` },
  { re: /\b(report|missing|nawawala|lost|stray|ligaw|abuse|welfare|neglect)\b/i, text: `Use the **Report** page to report an animal bite, a missing pet, a stray or a welfare concern. You get a reference number and can follow the case under Account → My reports. For a missing pet, you can also share a public alert on the wall.` },
  { re: /\b(office|open|hours|oras|address|where|saan|contact|call|phone|tawag)\b/i, text: `The PVO office is at the ${OFFICE.address}, open ${OFFICE.hours}. Telephone ${OFFICE.phone}; animal bite hotline ${OFFICE.hotline}. You can also send a message on the Contact page and read the reply on the Messages page.` },
  { re: /\b(service|program|free|libre|consult|certificate)\b/i, text: `The PVO offers free pet registration, anti-rabies vaccination drives, deworming and vitamins, spay and neuter (kapon) programs, animal bite response, stray and welfare cases, and consultations and health certificates. See the Services page for details.` },
  { re: /\b(adopt|ampon)\b/i, text: `Adopting is a lifelong promise. Before adopting, make sure you have time, space and budget for food, vaccines and vet visits. Register and vaccinate your new pet, and plan for kapon once it is old enough. Ask the PVO about animals from rescued stray cases.` },
  { re: /\b(hot|init|heat|summer|tag-init)\b/i, text: `In hot weather, keep pets in the shade with plenty of fresh water, walk dogs early in the morning or late afternoon, and never leave a pet in a parked vehicle. Heavy panting, drooling, weakness or collapse can be heatstroke: cool the pet with tap water (not ice) and go to a vet right away.` },
];

const FALLBACK = `I'm not sure about that one yet. I can help with **feeding, grooming, vaccines and anti-rabies, deworming, ticks and fleas, behaviour, kapon, common signs of sickness**, and PVO services, schedules and registration. Try asking about one of those, or send the PVO a message on the Contact page.`;

const fmt = (d) => new Date(d).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });

/** Questions answered from live data: the PVO schedule and the owner's own pets. */
async function dataAnswer(text, user) {
  if (/\b(next|upcoming|nearest)\b.*\b(drive|activit|event|program|vaccination|deworming|kapon)|\b(schedules?|iskedyul)\b|\bwhen is the (next|drive)|\bkailan ang\b/i.test(text)) {
    const events = await Announcement.find({ published: true, 'event.startsAt': { $gte: new Date() } })
      .sort({ 'event.startsAt': 1 }).limit(4).select('title event').lean();
    const lines = events.map((e) => `- **${fmt(e.event.startsAt)}**: ${e.title}${e.event.venue ? `, ${e.event.venue}` : ''}${e.event.municipality ? ` (${e.event.municipality})` : ''}`);
    return lines.length
      ? `Here are the next PVO activities:\n\n${lines.join('\n')}\n\nSee Announcements for details, and add them to your calendar from there.`
      : 'No PVO activities are scheduled right now. New drives are posted on the Announcements page.';
  }
  if (user.role === 'owner' && /\b(my|aking|ko)\b/i.test(text) && /\b(due|overdue|up to date|status|records?|expire)/i.test(text)) {
    const pets = await Pet.find({ owner: user._id, status: { $ne: 'deceased' } }).select('name vaccinations').lean();
    if (!pets.length) return 'You have no registered pets yet. Register one under Account → Register a pet to keep its vaccination record here.';
    const lines = pets.map((p) => {
      const r = Pet.rabiesStatus(p);
      return `- **${p.name}**: ${r.status === 'current' ? `anti-rabies up to date until ${fmt(r.due)}` : r.status === 'overdue' ? 'anti-rabies booster **overdue**' : 'no anti-rabies shot on record'}`;
    });
    return `Here is your pets' anti-rabies status:\n\n${lines.join('\n')}\n\nAnti-rabies shots are free at PVO drives. Ask "when is the next drive?" to see the schedule.`;
  }
  return null;
}

/** Topic answer for the question; for a short follow-up ("and adult dogs?"), use the previous question too. */
function topicAnswer(question, previous) {
  const hit = TOPICS.find((t) => t.re.test(question)) || (question.length < 60 && previous && TOPICS.find((t) => t.re.test(previous)));
  return hit?.text || null;
}

function readMessages(body) {
  const list = Array.isArray(body?.messages) ? body.messages : null;
  if (!list?.length) throw new HttpError(400, 'Ask Alagai a question first.');
  const clean = list.slice(-16).map((m) => ({
    role: m?.role === 'assistant' ? 'assistant' : 'user',
    content: typeof m?.content === 'string' ? m.content.trim().slice(0, MAX_CHARS) : '',
  })).filter((m) => m.content);
  if (clean[clean.length - 1]?.role !== 'user') throw new HttpError(400, 'Ask Alagai a question first.');
  return clean;
}

/* ---------- Gemini ---------- */
const GEMINI_URL = (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
const CATEGORY_LABEL = { food: 'Food', treats: 'Treats', toys: 'Toys', accessories: 'Collars & gear', grooming: 'Grooming', health: 'Health care', beds: 'Beds' };

/** Facts the model may use: the user's pets, the PVO schedule, the shop catalog. */
async function context(user) {
  const [pets, events, products] = await Promise.all([
    user.role === 'owner' ? Pet.find({ owner: user._id, status: { $ne: 'deceased' } }).select('name species breed birthDate sex neutered vaccinations status').lean() : [],
    Announcement.find({ published: true, 'event.startsAt': { $gte: new Date() } }).sort({ 'event.startsAt': 1 }).limit(5).select('title event').lean(),
    Product.find({ active: true, stock: { $gt: 0 } }).sort({ sold: -1 }).limit(40).select('name category species price brand').lean(),
  ]);
  const petLines = pets.map((p) => {
    const r = Pet.rabiesStatus(p);
    const rabies = r.status === 'current' ? `anti-rabies valid until ${fmt(r.due)}` : r.status === 'overdue' ? 'anti-rabies OVERDUE' : 'no anti-rabies on record';
    return `- ${p.name}: ${p.species}${p.breed ? `, ${p.breed}` : ''}${p.sex ? `, ${p.sex}` : ''}${p.birthDate ? `, born ${fmt(p.birthDate)}` : ''}${p.neutered ? ', kapon done' : ''}${p.status === 'missing' ? ', currently MISSING' : ''}; ${rabies}`;
  });
  const eventLines = events.map((e) => `- ${fmt(e.event.startsAt)}: ${e.title}${e.event.venue ? `, ${e.event.venue}` : ''}${e.event.municipality ? ` (${e.event.municipality})` : ''}`);
  const productLines = products.map((p) => `- [${p.name}](/market?p=${p._id}) · ${CATEGORY_LABEL[p.category] || p.category} · for ${p.species.length ? p.species.join('/') : 'any pet'} · ₱${p.price}${p.brand ? ` · ${p.brand}` : ''}`);
  return `TODAY: ${fmt(new Date())}
USER: ${user.name.split(' ')[0]}${user.role === 'admin' ? ' (PVO staff)' : ''}${user.municipality ? `, lives in ${user.municipality}` : ''}
USER'S PETS:
${petLines.join('\n') || '- none registered'}
NEXT PVO ACTIVITIES:
${eventLines.join('\n') || '- none scheduled'}
ALAGA SHOP (in stock; cash on pickup at the PVO office or delivery anywhere in Marinduque, ₱60, free from ₱1,000):
${productLines.join('\n') || '- shop is empty'}`;
}

const SYSTEM = `You are Alagai, the friendly and knowledgeable pet expert of Alaga, the pet community website of the Provincial Veterinary Office (PVO) of Marinduque, Philippines.

Answer EVERY question about pets and animals fully and helpfully: dogs, cats, rabbits, birds, fish, hamsters, farm animals, strays; breeds and choosing a pet, feeding and safe or unsafe foods, care, grooming, training and behaviour, health signs and what they can mean, vaccines, deworming, kapon, pregnancy and puppies or kittens, costs, travel, adoption, pet laws, and this website. Greetings and small talk are fine: reply warmly and offer help. Only for topics with no link at all to animals or this website, say briefly that you are here for pet questions.

Style:
- Reply in the user's language: English, Filipino/Tagalog or Taglish, matching how they write.
- Be warm and practical. Usually 3 to 8 sentences or a short bulleted list; give real, specific advice (amounts, steps, timings) when it helps. Use **bold** for key points. No headings, no tables.
- Health: explain the common possible causes and what the owner can safely do at home, and say clearly when and how soon to see a vet. You are not a veterinarian: do not claim a definite diagnosis and do not give prescription drug doses.
- If CONTEXT says the situation is URGENT (possible poisoning, bite, bleeding, seizure, breathing trouble…), start with what to do right now and to go to a vet or call the PVO hotline, then answer the question.
- Use the facts in CONTEXT: call the user's pets by name when relevant, and use the real PVO schedule. Never invent pets, dates, prices or products.
- When a product from ALAGA SHOP genuinely fits the question, you may suggest up to 3, written exactly as the markdown link given, with the price. Only for the right species. Never push products in urgent answers.
- PVO office: ${OFFICE.address}, ${OFFICE.hours}. Telephone ${OFFICE.phone}; animal bite hotline ${OFFICE.hotline}. Anti-rabies vaccination is free at PVO drives and required yearly from 3 months old (RA 9482). People bitten or scratched: wash the wound with soap and running water for 15 minutes and go to an Animal Bite Treatment Center the same day.
- Site features you can point to: Register a pet (Account), Report page (bites, missing pets, strays, welfare), Announcements (schedules), Shop, Contact page.`;

/** Ask Gemini; returns the reply text, or null when it is not configured or fails. */
async function geminiAnswer(messages, user, urgent = false) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(GEMINI_URL(process.env.GEMINI_MODEL || 'gemini-2.5-flash'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `${SYSTEM}\n\nCONTEXT\n${urgent ? 'URGENT: the latest question may be an emergency.\n' : ''}${await context(user)}` }] },
        contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: { temperature: 0.6, maxOutputTokens: 1500, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
    return text || null;
  } catch (err) {
    console.error(`[alagai] Gemini failed, using built-in answers: ${err.message}`);
    return null;
  }
}

// POST /api/assistant/chat
exports.chat = asyncHandler(async (req, res) => {
  const messages = readMessages(req.body);
  const question = messages[messages.length - 1].content;
  const previous = [...messages].reverse().slice(1).find((m) => m.role === 'user')?.content;

  // Possible emergencies still get an AI answer, told to lead with first aid; the
  // panel shows the hotline banner. Without AI they get the fixed emergency answer.
  const urgent = URGENT.test(question);
  const ai = await geminiAnswer(messages, req.user, urgent);
  if (ai) return res.json({ reply: ai, urgent, ai: true });
  if (urgent) return res.json({ reply: `${EMERGENCY}\n\n${NOT_A_VET}`, urgent: true });
  if (/^\s*(hi|hello|hey|kumusta|kamusta|good (morning|afternoon|evening))\b/i.test(question) && question.length < 40) {
    return res.json({ reply: `Hi ${req.user.name.split(' ')[0]}! Ask me about feeding, grooming, vaccines, deworming, behaviour, or PVO services and schedules.`, urgent: false });
  }
  const reply = (await dataAnswer(question, req.user)) || topicAnswer(question, previous) || FALLBACK;
  res.json({ reply: `${reply}\n\n${NOT_A_VET}`, urgent: false });
});
