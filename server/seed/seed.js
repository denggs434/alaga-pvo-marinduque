/**
 * Seeds the database with demo data for the Alaga pet community:
 * a PVO admin, six pet owners, sixteen pets with health records, wall posts,
 * announcements and scheduled activities, reports, contact messages, and shop
 * products with a few orders.
 * Dates are relative to today so "upcoming" lists and charts always look current.
 *
 *   npm run seed
 *
 * WARNING: clears every collection this app uses (users, pets, posts,
 * announcements, reports, contact messages, products, orders, counters) in the MONGO_URI database.
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
const Product = require('../src/models/Product');
const Order = require('../src/models/Order');

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
  { title: 'Libreng bakuna kontra rabies sa Boac', category: 'anti-rabies', pinned: true, posted: 3,
    body: 'Magandang araw, mga taga-Boac! Libre ang bakuna kontra rabies para sa mga aso at pusa na 3 buwan pataas.\n\nDalhin ang alaga na nakatali o nasa carrier. Kung may Alaga registration number na, ipakita lang sa staff para ma-record agad ang bakuna sa profile. Puwede ring magpa-register doon mismo.\n\nPaalala: kung may sakit o buntis ang alaga, sa susunod na schedule na lang po.',
    event: { startsAt: daysFromNow(4, 8), endsAt: daysFromNow(4, 15), venue: 'Boac Town Plaza (beside the Cathedral)', municipality: 'Boac' } },
  { title: 'Iskedyul ng bakuna sa mga barangay ng Mogpog', category: 'vaccination', posted: 6,
    body: 'Iikot ang mobile team namin sa Mogpog:\n\nUmaga (8 hanggang 11 AM): Balanacan, Mendez, Janagdong\nHapon (1 hanggang 4 PM): Poblacion, Bintakay\n\nLibre ang anti-rabies. May 5-in-1 din sa murang halaga habang may supply pa.',
    event: { startsAt: daysFromNow(11, 8), endsAt: daysFromNow(11, 16), venue: 'Balanacan Barangay Hall, then Mogpog Poblacion covered court', municipality: 'Mogpog' } },
  { title: 'Libreng purga ng aso at pusa sa Gasan', category: 'deworming', posted: 8,
    body: 'Libreng purga para sa aso at pusa! Puwede na ang mga tuta at kuting na 2 linggo pataas.\n\nKung alam ninyo ang timbang ng alaga, sabihin lang sa staff, kasi nakadepende sa timbang ang dose. Kung napurga na ang alaga nitong huling 3 buwan, sa susunod na round na lang.',
    event: { startsAt: daysFromNow(18, 8), endsAt: daysFromNow(18, 12), venue: 'Gasan Municipal Gymnasium', municipality: 'Gasan' } },
  { title: 'Libreng kapon: 40 slots, magpa-reserve na', category: 'free-program', posted: 10,
    body: 'Libreng kapon (spay at neuter) para sa aso at pusa na 6 na buwan pataas. 40 slots lang ito.\n\nPara mag-reserve, i-register muna ang alaga sa Alaga, tapos mag-message sa amin (topic: Pet registration) kasama ang registration number. Huwag pakainin ang alaga 8 oras bago ang operasyon.',
    event: { startsAt: daysFromNow(25, 7), endsAt: daysFromNow(25, 17), venue: 'Santa Cruz Rural Health Unit grounds', municipality: 'Santa Cruz' } },
  { title: 'Online na ang pet registration', category: 'services', posted: 20,
    body: 'Puwede nang i-register online ang mga alaga. Gumawa ng account, idagdag ang alaga kasama ang litrato, at makukuha agad ang registration number.\n\nSusuriin ng PVO ang bawat registration. Ang mga bakunang ibinigay sa drive ay naka-record sa profile ng alaga, kaya hindi na mawawala ang record kahit maiwala ang vaccination card.' },
  { title: 'Heat advisory: ingatan ang alaga sa init', category: 'advisory', posted: 2,
    body: 'Sobrang init ngayong linggo, kaya ingatan ang mga alaga.\n\nBigyan sila ng lilim at malinis na tubig buong araw. Ilakad ang aso nang maaga o paglubog ng araw, kasi napapaso ang paa nila sa mainit na semento. Huwag iwanan ang alaga sa loob ng nakaparadang sasakyan.\n\nKapag hingal na hingal, naglalaway at nanghihina ang alaga, ilipat agad sa lilim, basain ng tubig (hindi yelo) at dalhin sa vet.' },
  { title: 'Nakagat ng aso o pusa? Ito ang gagawin', category: 'advisory', posted: 30,
    body: '1. Hugasan ang sugat ng sabon at tubig na umaagos nang 15 minuto.\n2. Pumunta sa pinakamalapit na Animal Bite Treatment Center sa araw ding iyon.\n3. Huwag patayin ang hayop. Kung alaga ito, obserbahan nang 14 na araw.\n4. Mag-file ng Animal bite report sa Alaga para ma-follow up ng PVO ang bakuna ng hayop.' },
  { title: 'Salamat, Torrijos! 212 alaga ang nabakunahan', category: 'anti-rabies', posted: 9,
    body: 'Maraming salamat sa lahat ng sumali sa anti-rabies drive sa Torrijos! 212 aso at pusa ang nabakunahan at 48 bagong alaga ang na-register. Kita-kits sa susunod na drive!',
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

// More sample cases so every stage of the admin's report list (Pending, In progress, History) has some.
REPORTS.push(...require('./moreReports'));

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

// Shop catalog: [name, category, species, brand, price, stock, sold, description]
const PRODUCTS = [
  ['Adult dog food, chicken and rice, 3 kg', 'food', ['dog'], 'Pedigree', 489, 24, 0, 'Complete food for adult dogs of all sizes. Chicken and rice with added calcium for strong bones. Mix with rice or feed on its own.'],
  ['Puppy food, milk and beef, 1.5 kg', 'food', ['dog'], 'Pedigree', 299, 18, 0, 'Small kibble for puppies from 2 months old, with DHA for brain development. Soak in warm water for very young puppies.'],
  ['Cat food, tuna, 1.2 kg', 'food', ['cat'], 'Whiskas', 329, 20, 0, 'Dry food for adult cats with real tuna and taurine for healthy eyes and heart. Keep fresh water out at all times.'],
  ['Kitten food, ocean fish, 450 g', 'food', ['cat'], 'Whiskas', 149, 15, 0, 'Crunchy bites sized for kittens from 2 to 12 months, with milk for growing bones.'],
  ['Rabbit pellets with timothy hay, 1 kg', 'food', ['rabbit'], 'Vitakraft', 259, 8, 0, 'High-fibre pellets for adult rabbits. Feed with unlimited fresh hay and a handful of leafy greens.'],
  ['Bird seed mix for lovebirds, 1 kg', 'food', ['bird'], 'Vitakraft', 139, 12, 0, 'Millet, canary seed, oats and sunflower seeds for lovebirds and other small parrots.'],
  ['Chicken jerky dog treats, 100 g', 'treats', ['dog'], 'Goodies', 119, 30, 0, 'Air-dried chicken strips for training rewards. Break into small pieces for small dogs.'],
  ['Creamy cat treats, tuna, 4 sticks', 'treats', ['cat'], 'Ciao Churu', 99, 40, 0, 'Lickable tuna purée cats love. Squeeze straight from the stick or over dry food. Handy for giving pills.'],
  ['Rope tug toy, large', 'toys', ['dog'], 'Alaga Pet Supply', 129, 16, 0, 'Braided cotton rope for tug and fetch. Helps clean teeth while your dog chews. Replace when frayed.'],
  ['Feather wand with bell', 'toys', ['cat'], 'Alaga Pet Supply', 89, 22, 0, 'A long wand with feathers and a bell that keeps indoor cats active. Put away after play so the string is not chewed.'],
  ['Adjustable nylon collar with ID tag', 'accessories', ['dog', 'cat'], 'Alaga Pet Supply', 159, 25, 0, 'Fits necks from 25 to 40 cm. Comes with a blank tag: write your phone number and your pet\'s Alaga registration number.'],
  ['Retractable leash, 5 m', 'accessories', ['dog'], 'Flexi', 549, 6, 0, 'One-button brake and lock, for dogs up to 20 kg. Keep it short near roads and other dogs.'],
  ['Pet carrier with ventilation, medium', 'accessories', ['cat', 'dog', 'rabbit'], 'Alaga Pet Supply', 899, 5, 0, 'Hard-shell carrier with a steel door and side vents, for cats and small dogs up to 7 kg. Required for cats at PVO vaccination drives.'],
  ['Stainless steel food bowl set', 'accessories', [], 'Alaga Pet Supply', 199, 20, 0, 'Two 500 ml non-slip bowls for food and water. Dishwasher safe and does not hold smells.'],
  ['Tick and flea shampoo, 250 ml', 'grooming', ['dog'], 'Madre de Cacao', 179, 14, 0, 'Made with madre de cacao, a local plant extract that drives off ticks and fleas. Lather and leave for 5 minutes before rinsing.'],
  ['Slicker brush for long and short coats', 'grooming', ['dog', 'cat', 'rabbit'], 'Alaga Pet Supply', 149, 10, 0, 'Fine bent pins that lift loose fur and small tangles. Brush gently in the direction the coat grows.'],
  ['Nail clipper with safety guard', 'grooming', [], 'Alaga Pet Supply', 129, 9, 0, 'Clips nails for dogs, cats and rabbits. The guard stops you from cutting too deep into the quick.'],
  ['Dewormer tablets for dogs and cats, 4 pcs', 'health', ['dog', 'cat'], 'Drontal', 260, 12, 0, 'Treats roundworm, hookworm and tapeworm. Ask a PVO vet for the right dose for your pet\'s weight, and deworm every 3 months.'],
  ['Pet first-aid kit', 'health', [], 'Alaga Pet Supply', 450, 4, 0, 'Gauze, bandage, antiseptic, tweezers for ticks and a guide card. For small wounds only: call the PVO for bites and deep cuts.'],
  ['Washable pet bed, medium', 'beds', ['dog', 'cat'], 'Alaga Pet Supply', 699, 7, 0, 'Soft raised edges with a removable cover that goes in the washing machine. For pets up to 12 kg.'],
];

// Product photos (Wikimedia Commons, see client/assets/img/credits.json), same order as PRODUCTS.
const PRODUCT_PHOTOS = ['dog-food', 'puppy-food', 'cat-food', 'kitten-food', 'rabbit-pellets', 'bird-seed', 'dog-treats', 'cat-treats', 'rope-toy', 'cat-toy',
  'collar', 'leash', 'carrier', 'bowls', 'shampoo', 'brush', 'nail-clipper', 'dewormer', 'first-aid', 'pet-bed'].map((n) => `assets/img/shop/${n}.jpg`);

// Owners who sell: their shop, and which PRODUCTS (by index) they list. The rest are the PVO's official store.
const SHOPS = {
  ana: { name: "Ana's Paws & Crafts", about: 'Handmade collars, toys and beds from Gasan. Pick up in Dawis or have it delivered.', products: [9, 10, 19] },
  carlo: { name: "Carlo's Pet Corner", about: 'Pet food and treats in Santa Cruz at sari-sari prices.', products: [2, 3, 6, 7] },
  liza: { name: 'Furry Needs Buenavista', about: 'Grooming supplies and food for rabbits and birds.', products: [4, 5, 14, 15, 16] },
};

// Past orders: [buyer, [[product index, qty]], fulfillment, status steps [[status, note, daysAgo]], placed daysAgo]
const ORDERS = [
  ['maria', [[0, 1], [6, 2], [10, 1]], 'pickup', [['confirmed', '', 20], ['ready', 'Ready at the PVO office, Boac.', 19], ['completed', '', 18]], 21],
  ['jose', [[0, 1], [14, 1], [6, 1]], 'delivery', [['confirmed', '', 15], ['ready', 'Out for delivery.', 14], ['completed', '', 13]], 16],
  ['ana', [[2, 1], [7, 3], [8, 1]], 'pickup', [['confirmed', '', 11], ['ready', '', 10], ['completed', '', 9]], 12],
  ['carlo', [[0, 2], [10, 1], [12, 1]], 'delivery', [['confirmed', '', 8], ['ready', 'Out for delivery.', 7], ['completed', '', 6]], 9],
  ['liza', [[1, 1], [10, 1], [8, 1]], 'pickup', [['confirmed', '', 4]], 5],
  ['paolo', [[17, 1], [14, 1]], 'delivery', [], 1],
  ['maria', [[3, 1], [7, 1]], 'pickup', [], 0],
];

async function seed() {
  await connectDB(process.env.MONGO_URI);
  await Promise.all([User, Pet, Post, Announcement, Report, ContactMessage, Product, Order, Counter].map((M) => M.deleteMany({})));

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

  const sellerOf = {};
  for (const [key, shop] of Object.entries(SHOPS)) {
    users[key].shop = { name: shop.name, about: shop.about };
    await users[key].save({ timestamps: false });
    shop.products.forEach((i) => { sellerOf[i] = users[key]; });
  }
  const products = [];
  for (const [i, [name, category, species, brand, price, stock, sold, description]] of PRODUCTS.entries()) {
    products.push(await saveAt(new Product({ name, category, species, brand, price, stock, sold, description, photos: [PRODUCT_PHOTOS[i]], seller: sellerOf[i]?._id }), daysAgo(60 - i)));
  }
  // Each cart becomes one order per shop, as at checkout.
  let orderCount = 0;
  for (const [who, lines, fulfillment, steps, at] of ORDERS) {
    const u = users[who];
    const groups = new Map();
    for (const [i, qty] of lines) {
      const seller = sellerOf[i] || null;
      const key = seller ? String(seller._id) : 'official';
      if (!groups.has(key)) groups.set(key, { seller, items: [] });
      groups.get(key).items.push({ product: products[i]._id, name: products[i].name, price: products[i].price, photo: products[i].photos[0], qty });
    }
    for (const { seller, items } of groups.values()) {
      const subtotal = items.reduce((s, l) => s + l.price * l.qty, 0);
      const deliveryFee = fulfillment === 'delivery' && subtotal < 1000 ? 60 : 0;
      const order = new Order({
        buyer: u._id, seller: seller?._id, shopName: seller ? seller.shop.name : 'Alaga Official Store',
        items, subtotal, deliveryFee, total: subtotal + deliveryFee, fulfillment,
        contact: { name: u.name, phone: u.phone },
        address: fulfillment === 'delivery' ? { municipality: u.municipality, barangay: u.barangay } : {},
      });
      await order.validate(); // first history entry
      order.history[0].at = daysAgo(at, 11);
      for (const [status, note, ago] of steps) {
        order.status = status;
        order.history.push({ status, note: note || undefined, by: seller ? 'seller' : 'pvo', at: daysAgo(ago, 15) });
      }
      await saveAt(order, daysAgo(at, 11));
      for (const l of items) await Product.updateOne({ _id: l.product }, { $inc: { sold: l.qty } });
      orderCount += 1;
    }
  }

  console.log(`Seeded ${OWNERS.length} owners, ${PETS.length} pets, ${POSTS.length} posts, ${ANNOUNCEMENTS.length} announcements, ${REPORTS.length} reports, ${PRODUCTS.length} products in ${Object.keys(SHOPS).length + 1} shops, ${orderCount} orders.`);
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
