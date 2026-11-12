/**
 * Breed suggestions for the pet form, by species. Each list is sorted A to Z
 * when it is used, so new names can be added anywhere. Owners can still type
 * a breed that is not listed.
 */
const LISTS = {
  dog: [
    'Affenpinscher', 'Afghan Hound', 'Airedale Terrier', 'Akita', 'Alaskan Malamute', 'American Bulldog',
    'American Bully', 'American Cocker Spaniel', 'American Eskimo Dog', 'American Pit Bull Terrier',
    'American Staffordshire Terrier', 'Aspin (Asong Pinoy)', 'Australian Cattle Dog', 'Australian Shepherd',
    'Basenji', 'Basset Hound', 'Beagle', 'Bearded Collie', 'Belgian Malinois', 'Bernese Mountain Dog',
    'Bichon Frise', 'Bloodhound', 'Border Collie', 'Border Terrier', 'Boston Terrier', 'Boxer', 'Brittany',
    'Brussels Griffon', 'Bull Terrier', 'Bulldog (English Bulldog)', 'Bullmastiff', 'Cairn Terrier',
    'Cane Corso', 'Cavalier King Charles Spaniel', 'Chihuahua', 'Chinese Crested', 'Chow Chow',
    'Cocker Spaniel (English)', 'Collie', 'Corgi (Pembroke Welsh)', 'Dachshund', 'Dalmatian',
    'Doberman Pinscher', 'Dogo Argentino', 'French Bulldog', 'German Shepherd', 'German Shorthaired Pointer',
    'Golden Retriever', 'Goldendoodle', 'Great Dane', 'Great Pyrenees', 'Greyhound', 'Havanese',
    'Irish Setter', 'Italian Greyhound', 'Jack Russell Terrier', 'Japanese Spitz', 'Labradoodle',
    'Labrador Retriever', 'Lhasa Apso', 'Maltese', 'Maltipoo', 'Mastiff', 'Miniature Pinscher',
    'Miniature Schnauzer', 'Mixed breed', 'Newfoundland', 'Old English Sheepdog', 'Papillon', 'Pekingese',
    'Pomeranian', 'Poodle (Standard)', 'Poodle (Miniature)', 'Poodle (Toy)', 'Pug', 'Rhodesian Ridgeback',
    'Rottweiler', 'Saint Bernard', 'Saluki', 'Samoyed', 'Schnauzer (Standard)', 'Scottish Terrier',
    'Shar Pei', 'Shetland Sheepdog', 'Shiba Inu', 'Shih Tzu', 'Siberian Husky', 'Spitz', 'Staffordshire Bull Terrier',
    'Tibetan Mastiff', 'Vizsla', 'Weimaraner', 'West Highland White Terrier', 'Whippet', 'Yorkshire Terrier',
  ],
  cat: [
    'Abyssinian', 'American Bobtail', 'American Curl', 'American Shorthair', 'American Wirehair', 'Balinese',
    'Bengal', 'Birman', 'Bombay', 'British Longhair', 'British Shorthair', 'Burmese', 'Burmilla',
    'Chartreux', 'Cornish Rex', 'Devon Rex', 'Egyptian Mau', 'European Shorthair', 'Exotic Shorthair',
    'Havana Brown', 'Himalayan', 'Japanese Bobtail', 'Khao Manee', 'Korat', 'LaPerm', 'Maine Coon', 'Manx',
    'Mixed breed', 'Munchkin', 'Nebelung', 'Norwegian Forest Cat', 'Ocicat', 'Oriental Shorthair', 'Persian',
    'Peterbald', 'Puspin (Pusang Pinoy)', 'Ragamuffin', 'Ragdoll', 'Russian Blue', 'Savannah', 'Scottish Fold',
    'Selkirk Rex', 'Siamese', 'Siberian', 'Singapura', 'Snowshoe', 'Somali', 'Sphynx', 'Tonkinese',
    'Toyger', 'Turkish Angora', 'Turkish Van',
  ],
  rabbit: [
    'American Fuzzy Lop', 'Angora (English)', 'Angora (French)', 'Belgian Hare', 'Britannia Petite',
    'Californian', 'Champagne d\'Argent', 'Checkered Giant', 'Chinchilla', 'Dutch', 'Dwarf Hotot',
    'English Lop', 'English Spot', 'Flemish Giant', 'French Lop', 'Harlequin', 'Havana', 'Himalayan',
    'Holland Lop', 'Jersey Wooly', 'Lionhead', 'Mini Lop', 'Mini Rex', 'Mini Satin', 'Mixed breed',
    'Netherland Dwarf', 'New Zealand', 'Polish', 'Rex', 'Satin', 'Silver Fox', 'Tan', 'Thrianta',
  ],
  bird: [
    'African Grey Parrot', 'Amazon Parrot', 'Budgerigar (Budgie)', 'Bourke\'s Parakeet', 'Caique',
    'Canary', 'Cockatiel', 'Cockatoo', 'Conure (Green-cheeked)', 'Conure (Sun)', 'Dove', 'Eclectus Parrot',
    'Finch (Society)', 'Finch (Zebra)', 'Indian Ringneck Parakeet', 'Java Sparrow', 'Lorikeet', 'Lovebird',
    'Macaw', 'Mynah', 'Parrotlet', 'Pigeon', 'Quaker Parrot (Monk Parakeet)', 'Senegal Parrot',
  ],
  other: [
    'Bearded Dragon', 'Chicken', 'Duck', 'Ferret', 'Gecko (Leopard)', 'Gerbil', 'Goat', 'Goldfish',
    'Guinea Pig', 'Hamster (Dwarf)', 'Hamster (Syrian)', 'Hedgehog', 'Iguana', 'Koi', 'Mouse', 'Pig',
    'Rat', 'Snake (Ball Python)', 'Snake (Corn Snake)', 'Sugar Glider', 'Tortoise', 'Turtle',
  ],
};

const sorted = Object.fromEntries(
  Object.entries(LISTS).map(([species, list]) => [species, [...new Set(list)].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))])
);

/** Breeds for a species, A to Z ([] for an unknown species). */
export const breedsFor = (species) => sorted[species] || [];
