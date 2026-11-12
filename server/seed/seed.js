/**
 * Seeds the database with demo data for the Alaga pet community:
 * a PVO admin, six pet owners, sixteen pets with health records, wall posts,
 * announcements and scheduled activities, reports and contact messages.
 * Dates are relative to today so "upcoming" lists and charts always look current.
 *
 *   npm run seed
 *
 * WARNING: clears every collection this app uses (users, pets, posts,
 * announcements, reports, contact messages, counters) in the MONGO_URI database.
 * All people, pets and incidents here are fictional.
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const Pet = require('../src/models/Pet');
const Post = require('../src/models/Post');
const Announcement = require('../src/models/Announcement');
const Report = require('../src/models/Report');
const ContactMessage = require('../src/models/ContactMessage');
const Counter = require('../src/models/Counter');

const DAY = 864e5;
const daysAgo = (n, hour = 10) => {
  const d = new Date(Date.now() - n * DAY);
  // Past items get varied minutes so the feed looks natural; future events start on the hour.
  d.setHours(hour, n > 0 ? (n * 7) % 60 : 0, 0, 0);
  return d;
};
const daysFromNow = (n, hour = 8) => daysAgo(-n, hour);
const img = (name) => `assets/img/pets/${name}.jpg`;

/** Save with our own createdAt/updatedAt instead of "now". */
async function saveAt(doc, createdAt) {
  doc.createdAt = createdAt;
  doc.updatedAt = createdAt;
  return doc.save({ timestamps: false });
}

const OWNERS = [
  { key: 'maria', name: 'Maria Santos', email: 'maria@example.com', phone: '0917 555 0101', municipality: 'Boac', barangay: 'Isok I', joined: 150 },
  { key: 'jose', name: 'Jose Reyes', email: 'jose@example.com', phone: '0918 555 0102', municipality: 'Mogpog', barangay: 'Balanacan', joined: 140 },
  { key: 'ana', name: 'Ana Villanueva', email: 'ana@example.com', phone: '0919 555 0103', municipality: 'Gasan', barangay: 'Dawis', joined: 120 },
  { key: 'carlo', name: 'Carlo Mendoza', email: 'carlo@example.com', phone: '0920 555 0104', municipality: 'Santa Cruz', barangay: 'Lapu-Lapu', joined: 95 },
  { key: 'liza', name: 'Liza Manalo', email: 'liza@example.com', phone: '0921 555 0105', municipality: 'Buenavista', barangay: 'Daykitin', joined: 70 },
  { key: 'paolo', name: 'Paolo Garcia', email: 'paolo@example.com', phone: '0922 555 0106', municipality: 'Torrijos', barangay: 'Poctoy', joined: 40 },
];

const rabies = (given, verified = true) => ({ vaccine: 'Anti-rabies', dateGiven: daysAgo(given), nextDue: daysAgo(given - 365), administeredBy: verified ? 'PVO Marinduque' : 'Private clinic', verified });

// [owner, data, registered days ago]
const PETS = [
  ['maria', { name: 'Tisay', species: 'dog', breed: 'Aspin', sex: 'female', birthDate: daysAgo(1460), color: 'Tan', neutered: true, photos: [img('bantay-aspin')],
    bio: 'Barangay Isok\'s unofficial security guard. Loves morning walks along the Boac river and anyone holding pandesal.',
    registrationStatus: 'verified', vaccinations: [rabies(400), rabies(35), { vaccine: '5-in-1 (DHPPiL)', dateGiven: daysAgo(35), administeredBy: 'PVO Marinduque', verified: true }],
    medicalHistory: [{ date: daysAgo(120), type: 'deworming', title: 'Routine deworming', vet: 'PVO deworming day, Boac' }, { date: daysAgo(300), type: 'surgery', title: 'Neutered (Kapon program)', notes: 'Recovered well, stitches removed after 10 days.', vet: 'PVO Kapon program' }] }, 148],
  ['maria', { name: 'Kisses', species: 'dog', breed: 'Aspin', sex: 'female', birthDate: daysAgo(150), color: 'Cream', photos: [img('kisses-aspin-puppy')],
    bio: 'Rescued from the Boac market at 6 weeks old. Now chews everything, especially slippers.',
    registrationStatus: 'verified', vaccinations: [{ vaccine: '5-in-1 (DHPPiL)', dateGiven: daysAgo(60), nextDue: daysFromNow(20), administeredBy: 'Private clinic', verified: false }],
    medicalHistory: [{ date: daysAgo(90), type: 'checkup', title: 'First check-up after rescue', notes: 'Mild ear mites, treated.', vet: 'Boac Animal Clinic' }] }, 85],
  ['maria', { name: 'Kahel', species: 'cat', breed: 'Puspin', sex: 'male', birthDate: daysAgo(1100), color: 'Orange tabby', neutered: true, photos: [img('kahel-orange-cat'), img('kahel-walk')],
    bio: 'Orange, round, and proud of it. Sleeps 18 hours a day and supervises the other 6.',
    registrationStatus: 'verified', vaccinations: [rabies(200)] }, 140],
  ['jose', { name: 'Cooper', species: 'dog', breed: 'Beagle', sex: 'male', birthDate: daysAgo(900), color: 'Tricolor', photos: [img('cooper-beagle'), img('cooper-fence')],
    bio: 'Professional sniffer. Has never met a fence he did not try to dig under.',
    registrationStatus: 'verified', vaccinations: [rabies(180)] }, 132],
  ['jose', { name: 'Blackie', species: 'dog', breed: 'Labrador Retriever', sex: 'male', birthDate: daysAgo(1800), color: 'Black', neutered: true, photos: [img('blackie-labrador'), img('blackie-rest')],
    bio: 'Gentle giant. Wears an orange collar and answers to his name and to the sound of a rice cooker.',
    registrationStatus: 'verified', status: 'missing', vaccinations: [rabies(90)] }, 130],
  ['ana', { name: 'Muning', species: 'cat', breed: 'Puspin (calico)', sex: 'female', birthDate: daysAgo(1500), color: 'Calico', neutered: true, photos: [img('muning-calico')],
    bio: 'Queen of the sari-sari store doorstep in Dawis. Accepts tribute in the form of dried fish.',
    registrationStatus: 'verified', vaccinations: [rabies(250)] }, 118],
  ['ana', { name: 'Mochi', species: 'cat', breed: 'Puspin', sex: 'female', birthDate: daysAgo(80), color: 'Orange and white', photos: [img('mochi-kitten')],
    bio: 'Tiny, loud, and already the boss of the house.', registrationStatus: 'pending' }, 6],
  ['ana', { name: 'Princess', species: 'dog', breed: 'Shih Tzu', sex: 'female', birthDate: daysAgo(1300), color: 'Brown and white', photos: [img('princess-shihtzu')],
    bio: 'Gets a new bow every fiesta. Refuses to walk on wet grass.',
    registrationStatus: 'verified', vaccinations: [rabies(60), { vaccine: '5-in-1 (DHPPiL)', dateGiven: daysAgo(60), administeredBy: 'PVO Marinduque', verified: true }] }, 100],
  ['carlo', { name: 'Hotdog', species: 'dog', breed: 'Dachshund', sex: 'male', birthDate: daysAgo(700), color: 'Black and tan', photos: [img('hotdog-dachshund'), img('hotdog-playdate')],
    bio: 'Short legs, big opinions. Best friends with every beagle in Santa Cruz.',
    registrationStatus: 'verified', vaccinations: [rabies(20)] }, 92],
  ['carlo', { name: 'Choco', species: 'dog', breed: 'Pomeranian', sex: 'male', birthDate: daysAgo(1000), color: 'Orange sable', photos: [img('choco-pomeranian')],
    bio: 'Looks like a cloud, barks like a guard dog.', registrationStatus: 'verified', vaccinations: [rabies(150)] }, 88],
  ['carlo', { name: 'Luna', species: 'cat', breed: 'Birman', sex: 'female', birthDate: daysAgo(1200), color: 'Seal point', neutered: true, photos: [img('luna-birman')],
    bio: 'Private profile: only visible to her owner and the PVO.', isPublic: false, registrationStatus: 'verified', vaccinations: [rabies(100)] }, 60],
  ['liza', { name: 'Goldie', species: 'dog', breed: 'Golden Retriever', sex: 'female', birthDate: daysAgo(2000), color: 'Golden', neutered: true, photos: [img('goldie-golden'), img('goldie-profile')],
    bio: 'Therapy dog in training. Visits the Buenavista day care every Friday.',
    registrationStatus: 'verified', vaccinations: [rabies(45)], medicalHistory: [{ date: daysAgo(45), type: 'checkup', title: 'Annual check-up', notes: 'Healthy. Slight tartar, brushing advised.', vet: 'PVO Marinduque' }] }, 68],
  ['liza', { name: 'Yuki', species: 'cat', breed: 'Turkish Angora mix', sex: 'female', birthDate: daysAgo(800), color: 'White', photos: [img('yuki-white-cat')],
    bio: 'One blue eye, one gold eye, zero patience for being picked up.', registrationStatus: 'pending', vaccinations: [rabies(30, false)] }, 12],
  ['paolo', { name: 'Tiger', species: 'cat', breed: 'Puspin', sex: 'male', birthDate: daysAgo(70), color: 'Brown tabby', photos: [img('tiger-kitten')],
    bio: 'Found under our jeepney. Now drives the household.', registrationStatus: 'pending' }, 3],
  ['paolo', { name: 'Garfield', species: 'cat', breed: 'Puspin', sex: 'male', birthDate: daysAgo(2500), color: 'Grey tabby', photos: [img('garfield-tabby')],
    bio: 'Senior gentleman. Prefers sunny windowsills and quiet afternoons.', registrationStatus: 'verified', vaccinations: [rabies(420)] }, 38],
  ['paolo', { name: 'Bun', species: 'rabbit', breed: 'Holland Lop', sex: 'female', birthDate: daysAgo(400), color: 'Grey', photos: [img('bun-holland-lop'), img('bun-garden')],
    bio: 'Eats kangkong stems like a pro. Binkies when happy.', registrationStatus: 'verified',
    medicalHistory: [{ date: daysAgo(30), type: 'checkup', title: 'Teeth check', notes: 'Teeth fine; more hay recommended.', vet: 'Torrijos Vet Clinic' }] }, 36],
];

// [pet, author key, days ago, text, photo?, likers, comments [[who, text]]]
const POSTS = [
  ['Tisay', 'maria', 1, 'Tisay got her anti-rabies shot at the PVO drive today and she did not even cry. Much. The free treats helped. Thank you to the PVO team! 💉🐕', null, ['jose', 'ana', 'carlo', 'liza'], [['ana', 'Brave girl! Muning still hides under the bed on vaccine day.'], ['jose', 'Cooper is scheduled for next week in Mogpog.']]],
  ['Tiger', 'paolo', 2, 'Hello Alaga! New here. We found Tiger hiding under a jeepney in Poctoy and now he lives like royalty. Just registered him, waiting for the PVO to verify 🙏', null, ['maria', 'ana', 'liza'], [['maria', 'Welcome Tiger! 🧡']]],
  ['Goldie', 'liza', 3, 'Friday visit to the Buenavista day care with Goldie. The kids read her a story about a carabao and she listened to the whole thing. Two paws up.', img('goldie-profile'), ['maria', 'carlo', 'paolo', 'ana', 'jose'], [['carlo', 'Goldie is the best therapy dog on the island!']]],
  ['Hotdog', 'carlo', 4, 'Playdate at the plaza with Hotdog and his beagle buddies. He may be short but he won the race (I think they let him).', img('hotdog-playdate'), ['jose', 'liza'], [['jose', 'Cooper says rematch next Sunday.']]],
  ['Kahel', 'maria', 5, 'Kahel and his best friend walked the whole neighbourhood this morning and inspected every doorstep on the street. All acceptable, apparently.', img('kahel-walk'), ['ana', 'paolo'], []],
  ['Bun', 'paolo', 6, 'Garden time with Bun! Reminder for rabbit owners: they need hay, fresh greens and shade, especially in this heat. 🥬', img('bun-garden'), ['liza', 'maria', 'ana'], [['liza', 'So fluffy!']]],
  ['Cooper', 'jose', 8, 'Cooper found a new hole in the fence. I found it too. We are both disappointed for different reasons.', img('cooper-fence'), ['carlo', 'maria'], [['carlo', 'Hotdog approves of this hole.']]],
  ['Mochi', 'ana', 9, 'Mochi\'s first day home. She has already claimed the laundry basket. It is hers now.', null, ['maria', 'liza', 'paolo', 'jose'], []],
  ['Princess', 'ana', 12, 'Princess in her fiesta look 🎀 She also got her 5-in-1 booster from the PVO this week. Fabulous and protected.', null, ['carlo', 'liza'], [['liza', 'Love the bow!']]],
  ['Choco', 'carlo', 15, 'Choco is groomed and fluffy again. Please do not ask how the bath went. We do not talk about the bath.', null, ['ana'], []],
  ['Blackie', 'jose', 18, 'Beach day in Balanacan with Blackie before the rains. Best boy.', img('blackie-rest'), ['maria', 'ana', 'carlo', 'liza', 'paolo'], [['maria', 'Praying he comes home soon, Jose. Sharing the alert in our GC.']]],
  ['Garfield', 'paolo', 21, 'Senior cat tip from Garfield\'s house: a soft blanket in a sunny window is worth more than any expensive cat bed.', null, ['maria'], []],
];

const ANNOUNCEMENTS = [
  { title: 'Free anti-rabies vaccination drive in Boac', category: 'anti-rabies', pinned: true, posted: 3,
    body: 'The Provincial Veterinary Office will vaccinate dogs and cats against rabies for free.\n\nWho can join: dogs and cats 3 months and older, healthy on the day.\nWhat to bring: your pet on a leash or in a carrier, and your Alaga registration number if you have one. Unregistered pets can be registered on site.\n\nVaccinations given at the drive are recorded on your pet\'s Alaga profile by PVO staff.',
    event: { startsAt: daysFromNow(4, 8), endsAt: daysFromNow(4, 15), venue: 'Boac Town Plaza (beside the Cathedral)', municipality: 'Boac' } },
  { title: 'Barangay vaccination schedule: Mogpog', category: 'vaccination', posted: 6,
    body: 'Our mobile team will visit Mogpog barangays for anti-rabies and 5-in-1 vaccination.\n\nMorning: Balanacan, Mendez, Janagdong\nAfternoon: Poblacion, Bintakay\n\nAnti-rabies is free. 5-in-1 is available at a subsidised price while supplies last.',
    event: { startsAt: daysFromNow(11, 8), endsAt: daysFromNow(11, 16), venue: 'Balanacan Barangay Hall, then Mogpog Poblacion covered court', municipality: 'Mogpog' } },
  { title: 'Free deworming day for dogs and cats in Gasan', category: 'deworming', posted: 8,
    body: 'Bring your dogs and cats for free deworming. Puppies and kittens from 2 weeks old are welcome.\n\nPlease bring your pet\'s approximate weight if you know it; the dose depends on weight. Pets that were dewormed in the last 3 months should skip this round.',
    event: { startsAt: daysFromNow(18, 8), endsAt: daysFromNow(18, 12), venue: 'Gasan Municipal Gymnasium', municipality: 'Gasan' } },
  { title: 'Kapon program: free spay and neuter, slots open', category: 'free-program', posted: 10,
    body: 'Free spay and neuter surgery for dogs and cats, 6 months and older. Limited to 40 pets.\n\nTo reserve a slot, register your pet on Alaga and send us a message with the topic "Registration" and your pet\'s registration number. Pets must fast for 8 hours before surgery.',
    event: { startsAt: daysFromNow(25, 7), endsAt: daysFromNow(25, 17), venue: 'Santa Cruz Rural Health Unit grounds', municipality: 'Santa Cruz' } },
  { title: 'Register your pets online with Alaga', category: 'services', posted: 20,
    body: 'Pet registration is now online. Create an account, add your pet with a photo, and you will receive a registration number right away.\n\nPVO staff verify each registration and record vaccinations given at our drives directly on your pet\'s profile, so your pet\'s health record is always with you.' },
  { title: 'Heat advisory: keep pets cool and hydrated', category: 'advisory', posted: 2,
    body: 'High temperatures are expected this week.\n\n• Give pets shade and fresh water at all times.\n• Walk dogs early in the morning or after sunset; hot pavement burns paws.\n• Never leave a pet inside a parked vehicle.\n• Signs of heatstroke: heavy panting, drooling, weakness. Move the pet to shade, wet it with cool (not ice-cold) water and call a vet.' },
  { title: 'Rabies is 100% preventable: what to do after a bite', category: 'advisory', posted: 30,
    body: '1. Wash the wound with soap and running water for 15 minutes.\n2. Go to the nearest Animal Bite Treatment Center the same day.\n3. Do not kill the animal. Observe it for 14 days if it is a pet.\n4. File an Animal Bite report on Alaga so the PVO can follow up on the animal\'s vaccination status.' },
  { title: 'Thank you, Torrijos! 212 pets vaccinated', category: 'anti-rabies', posted: 9,
    body: 'Thank you to everyone who joined the anti-rabies drive in Torrijos. Our team vaccinated 212 dogs and cats and registered 48 new pets. See you at the next drive!',
    event: { startsAt: daysAgo(10, 8), endsAt: daysAgo(10, 15), venue: 'Torrijos Municipal Plaza', municipality: 'Torrijos' } },
];

// [reporter, data, filed days ago, [status, note, days ago][]]
const REPORTS = [
  ['jose', { type: 'missing', petName: 'Blackie', description: 'Blackie went missing after fireworks on the night of the barangay fiesta. Black Labrador, orange collar, very friendly. Last seen walking toward Balanacan port road.', location: { municipality: 'Mogpog', barangay: 'Balanacan', details: 'Near the port road waiting shed' }, publicAlert: true },
    5, [['under-review', 'We received your report and shared it with the Mogpog barangay animal control team.', 4], ['in-progress', 'Barangay tanods are checking the port area. We will update you on any sighting.', 2]]],
  ['maria', { type: 'bite', animalSpecies: 'dog', description: 'A stray brown dog bit my neighbour\'s child on the leg near the elementary school gate at about 3 PM. The wound was washed and the child was brought to the Animal Bite Center. The dog is still around the school.', location: { municipality: 'Boac', barangay: 'Isok I', details: 'Isok Elementary School gate' } },
    1, [['under-review', 'Our team will visit the area tomorrow morning to locate and observe the dog. Please keep children away from it.', 0]]],
  ['ana', { type: 'stray', animalSpecies: 'dog', description: 'Three stray puppies have been staying under the waiting shed for a week. They look thin and one is limping. Some residents feed them but no one can take them in.', location: { municipality: 'Gasan', barangay: 'Dawis', details: 'Waiting shed along the national road' } },
    3, []],
  ['carlo', { type: 'welfare', animalSpecies: 'dog', description: 'A dog is chained all day under the sun with no shade or water behind a house on our street. It cries most afternoons and looks very thin.', location: { municipality: 'Santa Cruz', barangay: 'Lapu-Lapu' } },
    20, [['under-review', 'Thank you. We will coordinate with the barangay.', 19], ['in-progress', 'Inspection done. The owner was advised and given a notice to provide shelter and water.', 15], ['resolved', 'Follow-up visit: the dog now has a shaded area, water and a longer lead. Case closed. Thank you for caring.', 8]]],
  ['liza', { type: 'stray', animalSpecies: 'cat', description: 'A mother cat and four kittens are living inside the public market drainage. Vendors are worried the kittens will drown when it rains.', location: { municipality: 'Buenavista', barangay: 'Poblacion', details: 'Public market, fish section' } },
    12, [['under-review', 'Forwarded to the municipal agriculture office.', 11], ['resolved', 'The cats were moved to a foster volunteer. The kittens will be offered for adoption once vaccinated.', 6]]],
  ['paolo', { type: 'welfare', animalSpecies: 'other', description: 'Roosters and goats are kept in a very small cage at the back of a house with lots of waste. The smell is strong and the animals look unwell.', location: { municipality: 'Torrijos', barangay: 'Poctoy' } },
    30, [['closed', 'Inspected; the animals are livestock in acceptable condition. Referred the sanitation concern to the barangay health office.', 26]]],
  ['maria', { type: 'missing', animalSpecies: 'cat', description: 'My orange cat Kahel did not come home last night. He is neutered, very round, and loves sleeping on car hoods.', location: { municipality: 'Boac', barangay: 'Isok I' }, petName: 'Kahel' },
    45, [['resolved', 'Good news: Kahel was found asleep in a neighbour\'s garage. Glad he is home!', 44]]],
];

const MESSAGES = [
  { name: 'Rosa Dimaano', email: 'rosa@example.com', topic: 'registration', message: 'Can I register a pet for my elderly mother who does not have an email address?', status: 'new', at: 1 },
  { name: 'Ben Torres', email: 'ben@example.com', phone: '0917 555 0199', topic: 'vaccination', message: 'Is the 5-in-1 vaccine also free during the Mogpog schedule, or only anti-rabies?', status: 'new', at: 2 },
  { name: 'Grace Lim', email: 'grace@example.com', topic: 'general', message: 'Thank you for the deworming drive last month. Will there be one in Buenavista soon?', at: 9,
    replies: [['Thank you, Grace! The next Buenavista deworming day is on our announcements page. Bring your pets before 11 AM.', 8]] },
  // Sent while logged in, so Maria can read the reply under Account → Messages.
  { owner: 'maria', topic: 'vaccination', message: 'Kisses is five months old. Can she get her first anti-rabies shot at the next Boac drive, or is she too young?', at: 4,
    replies: [['Hi Maria! Puppies can get their first anti-rabies shot from three months old, so Kisses can join the next Boac drive. Bring her vaccination card if she has one.', 3]], unread: true },
  { name: 'Archived Example', email: 'old@example.com', topic: 'general', message: 'Is the office open on holidays? I wanted to drop by with my cat.', at: 40,
    replies: [['The office is closed on national holidays. For emergencies, call the animal bite hotline.', 39]], archived: true },
];

async function seed() {
  await connectDB(process.env.MONGO_URI);
  await Promise.all([User, Pet, Post, Announcement, Report, ContactMessage, Counter].map((M) => M.deleteMany({})));

  const admin = await User.create({
    name: 'PVO Records Officer',
    email: process.env.ADMIN_EMAIL || 'admin@alaga.ph',
    password: process.env.ADMIN_PASSWORD || 'Admin123!',
    role: 'admin',
    municipality: 'Boac',
  });

  const users = {};
  for (const o of OWNERS) {
    users[o.key] = await saveAt(new User({ ...o, password: 'Owner123!', role: 'owner' }), daysAgo(o.joined));
  }

  // Oldest first, so registration numbers follow the order pets joined.
  const pets = {};
  for (const [owner, data, at] of [...PETS].sort((a, b) => b[2] - a[2])) {
    const u = users[owner];
    pets[data.name] = await saveAt(new Pet({ ...data, owner: u._id, municipality: u.municipality, verifiedAt: data.registrationStatus === 'verified' ? daysAgo(at - 1) : undefined }), daysAgo(at, 9));
  }

  for (const [petName, who, at, text, photo, likers, comments] of POSTS) {
    const created = daysAgo(at, 8 + (at % 9));
    await saveAt(new Post({
      author: users[who]._id,
      pet: pets[petName]._id,
      text,
      photos: photo ? [photo] : [],
      likes: likers.map((k) => users[k]._id),
      comments: comments.map(([k, t], i) => ({ user: users[k]._id, text: t, createdAt: new Date(created.getTime() + (i + 1) * 36e5) })),
    }), created);
  }

  for (const { posted, ...a } of ANNOUNCEMENTS) {
    await saveAt(new Announcement({ ...a, author: admin._id }), daysAgo(posted, 9));
  }

  for (const [who, { petName, ...data }, at, steps] of [...REPORTS].sort((a, b) => b[2] - a[2])) {
    const u = users[who];
    const pet = petName ? pets[petName] : null;
    const report = new Report({
      ...data,
      reporter: u._id,
      pet: pet?._id,
      animalSpecies: pet ? pet.species : data.animalSpecies,
      incidentDate: daysAgo(at + 1, 18),
      contact: { name: u.name, phone: u.phone, email: u.email },
    });
    await report.validate(); // assigns reference, priority and first history entry
    report.history[0].at = daysAgo(at);
    for (const [status, note, ago] of steps) {
      report.status = status;
      report.history.push({ status, note, by: 'pvo', at: daysAgo(ago, 14) });
    }
    await saveAt(report, daysAgo(at));
  }

  for (const { at, owner, replies = [], unread, archived, ...m } of MESSAGES) {
    const u = owner && users[owner];
    const doc = new ContactMessage({
      ...m,
      ...(u && { user: u._id, name: u.name, email: u.email, phone: u.phone }),
      status: replies.length ? 'replied' : 'new',
      replies: replies.map(([text, ago]) => ({ by: admin._id, byName: admin.name, text, createdAt: daysAgo(ago, 15) })),
      unreadByUser: !!unread,
      archived: !!archived,
      archivedAt: archived ? daysAgo(at - 2) : undefined,
    });
    await saveAt(doc, daysAgo(at));
  }

  console.log(`Seeded ${OWNERS.length} owners, ${PETS.length} pets, ${POSTS.length} posts, ${ANNOUNCEMENTS.length} announcements, ${REPORTS.length} reports.`);
  console.log(`PVO admin login:  ${admin.email}`);
  console.log('Pet owner login:  maria@example.com / Owner123!  (also jose@, ana@, carlo@, liza@, paolo@ with the same password)');
}

seed()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());

// Keep the photo credits file next to the seed in sync (sanity check only).
if (!fs.existsSync(path.join(__dirname, '..', '..', 'client', 'assets', 'img', 'credits.json'))) {
  console.warn('client/assets/img/credits.json is missing: photo credits will not show on the About page.');
}
