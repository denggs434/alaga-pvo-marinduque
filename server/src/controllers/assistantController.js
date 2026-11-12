/**
 * Alagai, the pet-care helper.
 *
 * POST /api/assistant/chat  { messages: [{ role: 'user' | 'assistant', content }] }
 *   -> { reply, urgent }
 *
 * No AI: Alagai answers from a vetted list of pet-care topics written for this
 * site, plus live data (the owner's pets and the PVO schedule). It never
 * diagnoses or prescribes, and urgent words (poisoning, seizures, bleeding,
 * bites…) always get the emergency answer first.
 */
const Pet = require('../models/Pet');
const Announcement = require('../models/Announcement');
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
  { re: /\b(office|open|hours|oras|address|where|saan|contact|call|phone|tawag)\b/i, text: `The PVO office is at the ${OFFICE.address}, open ${OFFICE.hours}. Telephone ${OFFICE.phone}; animal bite hotline ${OFFICE.hotline}. You can also send a message on the Contact page and read the reply under Account → Messages.` },
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

// POST /api/assistant/chat
exports.chat = asyncHandler(async (req, res) => {
  const messages = readMessages(req.body);
  const question = messages[messages.length - 1].content;
  const previous = [...messages].reverse().slice(1).find((m) => m.role === 'user')?.content;

  if (URGENT.test(question)) return res.json({ reply: `${EMERGENCY}\n\n${NOT_A_VET}`, urgent: true });
  if (/^\s*(hi|hello|hey|kumusta|kamusta|good (morning|afternoon|evening))\b/i.test(question) && question.length < 40) {
    return res.json({ reply: `Hi ${req.user.name.split(' ')[0]}! Ask me about feeding, grooming, vaccines, deworming, behaviour, or PVO services and schedules.`, urgent: false });
  }
  const reply = (await dataAnswer(question, req.user)) || topicAnswer(question, previous) || FALLBACK;
  res.json({ reply: `${reply}\n\n${NOT_A_VET}`, urgent: false });
});
