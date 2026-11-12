/**
 * Ten more sample reports, so every stage of the admin's report list has cases:
 * 4 Pending (submitted), 3 In progress (under review / in progress), 3 History (resolved / closed).
 * Format: [reporter key, report fields, days ago filed, PVO updates [[status, note, days ago]]].
 * All people, places and incidents are fictional sample data.
 */
module.exports = [
  // ---- Pending: new, nobody has picked them up yet ----
  ['ana', { type: 'bite', animalSpecies: 'cat', description: 'A stray cat scratched and bit my son\'s hand when he tried to feed it near our gate. We washed the wound for 15 minutes. The cat is grey with a white chest and still comes around at night.', location: { municipality: 'Gasan', barangay: 'Banot', details: 'Beside the chapel' } },
    1, []],
  ['carlo', { type: 'stray', animalSpecies: 'dog', description: 'Three puppies were left in a box at the public market parking area this morning. They look about 6 weeks old and are hungry. A vendor is giving them water for now.', location: { municipality: 'Santa Cruz', barangay: 'Poblacion', details: 'Public market parking area' } },
    1, []],
  ['liza', { type: 'welfare', animalSpecies: 'dog', description: 'A dog on our street has a deep wound on its back leg that looks infected. It limps and the owner says they cannot afford a vet. Please advise or check on it.', location: { municipality: 'Buenavista', barangay: 'Sihi' } },
    2, []],
  ['paolo', { type: 'stray', animalSpecies: 'dog', description: 'A pack of four stray dogs has been chasing children walking to school along the national road every morning. Nobody has been bitten yet but parents are worried.', location: { municipality: 'Torrijos', barangay: 'Malibago', details: 'National road near the elementary school' } },
    2, []],

  // ---- In progress: under review or being worked on ----
  ['maria', { type: 'bite', animalSpecies: 'dog', description: 'I was bitten on the ankle by a brown dog while jogging along the seawall. The dog has a red collar so it may have an owner. I went to the Animal Bite Treatment Center and got my first shot.', location: { municipality: 'Boac', barangay: 'Caganhao', details: 'Seawall jogging path' } },
    4, [['under-review', 'Thank you for reporting. Please complete all your anti-rabies shots. We are looking for the dog and its owner.', 3]]],
  ['jose', { type: 'welfare', animalSpecies: 'other', description: 'A carabao has been tied under the sun without shade or water for several days beside the rice field. It looks weak and thin.', location: { municipality: 'Mogpog', barangay: 'Janagdong', details: 'Rice field behind the barangay hall' } },
    6, [['under-review', 'Forwarded to the municipal agriculturist.', 5], ['in-progress', 'Our team spoke with the owner. A shaded area and water are being set up today. We will check again this week.', 3]]],
  ['ana', { type: 'stray', animalSpecies: 'cat', description: 'Around ten cats are living in the abandoned house next to ours and having kittens. Some look sick with eye discharge. We would like help with kapon and care.', location: { municipality: 'Gasan', barangay: 'Tabionan' } },
    9, [['under-review', 'Thank you. We will include this area in the next free kapon schedule in Gasan.', 8], ['in-progress', 'Volunteers will trap the adult cats for kapon on the next Gasan program day.', 5]]],

  // ---- History: resolved or closed ----
  ['carlo', { type: 'bite', animalSpecies: 'dog', description: 'Our neighbour\'s dog bit my father on the hand while he was fixing the fence. The dog is vaccinated according to the owner. My father has started his anti-rabies shots.', location: { municipality: 'Santa Cruz', barangay: 'Lapu-Lapu' } },
    25, [['under-review', 'We will check the dog\'s vaccination record with the owner.', 24], ['in-progress', 'The dog is under 14-day observation at the owner\'s home.', 22], ['resolved', 'The dog stayed healthy for the full 14 days. The owner showed a valid anti-rabies card. Please finish your father\'s shots. Case closed.', 10]]],
  ['liza', { type: 'stray', animalSpecies: 'dog', description: 'A friendly white dog with no collar has been sleeping at the barangay health center for a week. It seems lost and might belong to someone.', location: { municipality: 'Buenavista', barangay: 'Bagacay', details: 'Barangay health center' } },
    35, [['under-review', 'We posted a notice at the barangay hall.', 34], ['resolved', 'The owner saw the notice and took the dog home. It has now been registered on Alaga.', 30]]],
  ['paolo', { type: 'welfare', animalSpecies: 'dog', description: 'I heard a dog crying for two days inside a locked house. I think the owners went to Manila. The dog may not have food.', location: { municipality: 'Torrijos', barangay: 'Bangwayin' } },
    50, [['under-review', 'We contacted the barangay captain.', 49], ['closed', 'The owner\'s relative already feeds the dog twice a day and has a key. The dog is fine. No further action needed.', 48]]],
];
