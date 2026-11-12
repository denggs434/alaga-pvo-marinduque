/**
 * Site settings and the human-readable labels for every enum the API uses.
 * Contact details are placeholders for this student project.
 */
export const SITE = {
  name: 'Alaga',
  office: 'Provincial Veterinary Office',
  province: 'Marinduque',
  phone: '(042) 123-4567',
  hotline: '0917 000 0000',
  email: 'pvo@alaga.example',
  address: 'Provincial Capitol Compound, Boac, Marinduque 4900',
  hours: 'Monday to Friday, 8:00 AM – 5:00 PM',
};

export const MUNICIPALITIES = ['Boac', 'Buenavista', 'Gasan', 'Mogpog', 'Santa Cruz', 'Torrijos'];

export const SPECIES = { dog: 'Dog', cat: 'Cat', rabbit: 'Rabbit', bird: 'Bird', other: 'Other' };
/** Icon for each species (icons.js); "other" keeps the paw. */
export const SPECIES_ICON = { dog: 'dog', cat: 'cat', rabbit: 'rabbit', bird: 'bird', other: 'paw' };
export const SPECIES_PLURAL = { dog: 'Dogs', cat: 'Cats', rabbit: 'Rabbits', bird: 'Birds', other: 'Others' };

export const MEDICAL_TYPES = { checkup: 'Check-up', illness: 'Illness', injury: 'Injury', surgery: 'Surgery', deworming: 'Deworming', other: 'Other' };

export const VACCINES = ['Anti-rabies', '5-in-1 (DHPPiL)', '6-in-1 (DHPPiL + Corona)', '4-in-1 (FVRCP)', 'Kennel cough (Bordetella)', 'Leptospirosis'];

export const CATEGORIES = {
  vaccination: { label: 'Vaccination schedule', tag: 'tag-blue', icon: 'syringe' },
  'anti-rabies': { label: 'Anti-rabies campaign', tag: 'tag-red', icon: 'shieldCheck' },
  'free-program': { label: 'Free program', tag: 'tag-green', icon: 'gift' },
  deworming: { label: 'Deworming', tag: 'tag-amber', icon: 'pill' },
  services: { label: 'Veterinary services', tag: 'tag-plum', icon: 'building' },
  advisory: { label: 'Health advisory', tag: '', icon: 'info' },
};

export const REPORT_TYPES = {
  bite: { label: 'Animal bite', tag: 'tag-red', icon: 'alert', hint: 'Someone was bitten or scratched by a dog, cat or other animal.' },
  missing: { label: 'Missing pet', tag: 'tag-amber', icon: 'search', hint: 'Your pet is lost. You can share a public alert with the community.' },
  stray: { label: 'Stray or abandoned', tag: 'tag-blue', icon: 'paw', hint: 'An animal with no owner, or one that was left behind.' },
  welfare: { label: 'Animal welfare', tag: 'tag-plum', icon: 'heart', hint: 'An animal being neglected, hurt or kept in poor conditions.' },
};

export const REPORT_STATUSES = {
  submitted: { label: 'Submitted', tag: '', step: 1 },
  'under-review': { label: 'Under review', tag: 'tag-blue', step: 2 },
  'in-progress': { label: 'In progress', tag: 'tag-amber', step: 3 },
  resolved: { label: 'Resolved', tag: 'tag-green', step: 4 },
  closed: { label: 'Closed', tag: '', step: 4 },
};

export const CONTACT_TOPICS = { general: 'General question', registration: 'Pet registration', vaccination: 'Vaccination', report: 'About a report', other: 'Something else' };
