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
  vaccination: { label: 'Vaccination schedule', tag: '', icon: 'syringe' },
  'anti-rabies': { label: 'Anti-rabies campaign', tag: '', icon: 'shieldCheck' },
  'free-program': { label: 'Free program', tag: '', icon: 'gift' },
  deworming: { label: 'Deworming', tag: '', icon: 'pill' },
  services: { label: 'Veterinary services', tag: '', icon: 'building' },
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

/** Shop: categories, order statuses and how orders are paid and handed over. */
export const PRODUCT_CATEGORIES = {
  food: { label: 'Food', icon: 'bowl' },
  treats: { label: 'Treats', icon: 'bone' },
  toys: { label: 'Toys', icon: 'ball' },
  accessories: { label: 'Collars & gear', icon: 'paw' },
  grooming: { label: 'Grooming', icon: 'scissors' },
  health: { label: 'Health care', icon: 'pill' },
  beds: { label: 'Beds', icon: 'bed' },
};

export const ORDER_STATUSES = {
  placed: { label: 'Placed', tag: '', step: 1 },
  confirmed: { label: 'Confirmed', tag: 'tag-blue', step: 2 },
  ready: { label: 'Ready', tag: 'tag-amber', step: 3 },
  completed: { label: 'Completed', tag: 'tag-green', step: 4 },
  cancelled: { label: 'Cancelled', tag: 'tag-red', step: 4 },
};

export const SHOP = {
  deliveryFee: 60,
  freeDeliveryFrom: 1000,
  pickup: 'PVO office, Provincial Capitol Compound, Boac',
  hours: 'Monday to Friday, 8:00 AM – 5:00 PM',
};

export const peso = (n) => `₱${new Intl.NumberFormat('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n || 0)}`;

export const CONTACT_TOPICS = { general: 'General question', registration: 'Pet registration', vaccination: 'Vaccination', report: 'About a report', other: 'Something else' };
