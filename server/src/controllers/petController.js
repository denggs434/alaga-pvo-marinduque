/**
 * Pets: public directory, profiles, registration and health records.
 *
 * What each viewer gets (see serializePet):
 *  - visitor / other owners: profile, rabies status, owner's public name + municipality
 *  - the owner:              + vaccination record and medical history
 *  - PVO admin:              + owner's contact details, private pets included
 *
 * PVO staff review registrations and vaccination entries (approve or reject);
 * they never edit, add to or delete what the owner submitted.
 */
const Pet = require('../models/Pet');
const Post = require('../models/Post');
const HttpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');
const { str, oneOf, escapeRegex, paging, requireId, pick, publicName } = require('../utils/validate');
const { SPECIES, SEXES, MUNICIPALITIES, PET_STATUSES } = require('../config/constants');

const OWNER_POPULATE = { path: 'owner', select: 'name municipality barangay email phone' };
const EDITABLE = ['name', 'species', 'breed', 'sex', 'birthDate', 'color', 'neutered', 'photos', 'bio', 'municipality', 'isPublic'];
const MAX_PETS_PER_OWNER = 20;

const isAdmin = (user) => user?.role === 'admin';
const ownsPet = (user, pet) => !!user && String(pet.owner?._id || pet.owner) === String(user._id);

/** Shape a pet for a given viewer. Health records and contact details stay private. */
function serializePet(pet, viewer) {
  const owner = pet.owner || {};
  const mine = ownsPet(viewer, pet);
  const staff = isAdmin(viewer);
  const out = {
    _id: pet._id,
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    sex: pet.sex,
    birthDate: pet.birthDate,
    color: pet.color,
    neutered: pet.neutered,
    photos: pet.photos,
    bio: pet.bio,
    municipality: pet.municipality,
    registrationNo: pet.registrationNo,
    registrationStatus: pet.registrationStatus,
    isPublic: pet.isPublic,
    status: pet.status,
    createdAt: pet.createdAt,
    rabies: Pet.rabiesStatus(pet),
    owner: { _id: owner._id, name: mine || staff ? owner.name : publicName(owner.name), municipality: owner.municipality },
    canEdit: mine,
    canReview: staff,
  };
  if (mine || staff) {
    out.vaccinationStatus = Pet.vaccinationStatus(pet);
    out.rejectionReason = pet.rejectionReason;
    out.reviewedAt = pet.reviewedAt;
    out.vaccinations = [...(pet.vaccinations || [])].sort((a, b) => new Date(b.dateGiven) - new Date(a.dateGiven));
    out.medicalHistory = [...(pet.medicalHistory || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
  }
  if (staff) Object.assign(out.owner, { email: owner.email, phone: owner.phone, barangay: owner.barangay });
  return out;
}

/** Load a pet the current user may change: only its owner. PVO staff review, they do not edit. */
async function loadEditable(req) {
  const pet = await Pet.findById(requireId(req.params.id, 'Pet'));
  if (!pet) throw new HttpError(404, 'Pet not found.');
  if (!ownsPet(req.user, pet)) {
    throw new HttpError(403, isAdmin(req.user)
      ? "PVO staff review registrations but cannot change the owner's pet details."
      : 'Only the owner can change this pet.');
  }
  return pet;
}

/** Re-read with the owner populated, then serialize for the response. */
async function respond(res, pet, viewer, status = 200) {
  await pet.populate(OWNER_POPULATE);
  res.status(status).json(serializePet(pet, viewer));
}

// GET /api/pets?q=&species=&municipality=&sex=&sort=&page=&limit=   (admin: &all=true&registration=pending)
exports.listPets = asyncHandler(async (req, res) => {
  const q = req.query;
  const staffView = isAdmin(req.user) && q.all === 'true';
  const filter = staffView ? {} : { isPublic: true, status: { $ne: 'deceased' } };

  const species = oneOf(q.species, SPECIES);
  const sex = oneOf(q.sex, SEXES);
  const municipality = oneOf(q.municipality, MUNICIPALITIES);
  if (species) filter.species = species;
  if (sex) filter.sex = sex;
  if (municipality) filter.municipality = municipality;
  // Visitors may filter by active/missing only: deceased pets stay out of the public directory.
  const status = oneOf(q.status, staffView ? PET_STATUSES : ['active', 'missing']);
  if (status) filter.status = status;
  if (staffView && oneOf(q.registration, ['pending', 'verified'])) filter.registrationStatus = str(q.registration);
  if (str(q.q)) {
    const rx = new RegExp(escapeRegex(str(q.q)), 'i');
    filter.$or = [{ name: rx }, { breed: rx }, { color: rx }, { registrationNo: rx }];
  }

  const sort = { name: { name: 1 }, oldest: { createdAt: 1 } }[str(q.sort)] || { createdAt: -1 };
  const { limit, page, skip } = paging(q, { limit: 12, max: staffView ? 500 : 48 });

  const [pets, total, bySpecies] = await Promise.all([
    Pet.find(filter).sort({ ...sort, _id: 1 }).skip(skip).limit(limit).populate(OWNER_POPULATE).lean(),
    Pet.countDocuments(filter),
    // Counts for the filter chips (ignores the species filter itself).
    Pet.aggregate([{ $match: { ...filter, species: { $exists: true } } }, { $group: { _id: '$species', n: { $sum: 1 } } }]),
  ]);

  res.json({
    items: pets.map((p) => serializePet(p, req.user)),
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
    facets: { species: Object.fromEntries(bySpecies.map((s) => [s._id, s.n])) },
  });
});

// GET /api/pets/mine  (logged in)
exports.myPets = asyncHandler(async (req, res) => {
  const pets = await Pet.find({ owner: req.user._id }).sort({ createdAt: -1 }).populate(OWNER_POPULATE).lean();
  res.json(pets.map((p) => serializePet(p, req.user)));
});

// GET /api/pets/:id  (public; private pets only for their owner and the PVO)
exports.getPet = asyncHandler(async (req, res) => {
  const pet = await Pet.findById(requireId(req.params.id, 'Pet')).populate(OWNER_POPULATE).lean();
  const visible = pet && (pet.isPublic || ownsPet(req.user, pet) || isAdmin(req.user));
  if (!visible) throw new HttpError(404, 'This pet profile does not exist or is private.');
  const postCount = await Post.countDocuments({ pet: pet._id });
  res.json({ ...serializePet(pet, req.user), postCount });
});

// POST /api/pets  (owner)
exports.createPet = asyncHandler(async (req, res) => {
  const count = await Pet.countDocuments({ owner: req.user._id });
  if (count >= MAX_PETS_PER_OWNER) throw new HttpError(400, `An account can register up to ${MAX_PETS_PER_OWNER} pets. Contact the PVO for kennels or shelters.`);
  const data = pick(req.body, EDITABLE);
  const pet = await Pet.create({ ...data, municipality: data.municipality || req.user.municipality || undefined, owner: req.user._id });
  await respond(res, pet, req.user, 201);
});

// PUT /api/pets/:id  (owner only)
exports.updatePet = asyncHandler(async (req, res) => {
  const pet = await loadEditable(req);
  Object.assign(pet, pick(req.body, [...EDITABLE, 'status']));
  // Fixing a rejected registration sends it back to the PVO for review.
  if (pet.registrationStatus === 'rejected') {
    pet.registrationStatus = 'pending';
    pet.rejectionReason = undefined;
  }
  await pet.save();
  await respond(res, pet, req.user);
});

// DELETE /api/pets/:id  (owner only) — also removes the pet's posts
exports.deletePet = asyncHandler(async (req, res) => {
  const pet = await loadEditable(req);
  await Promise.all([Post.deleteMany({ pet: pet._id }), pet.deleteOne()]);
  res.json({ message: `${pet.name}'s profile was removed.` });
});

// PATCH /api/pets/:id/verify  { decision: 'approve' | 'reject', reason? }  (admin)
// Only the review fields change: the owner's submitted details stay exactly as they are.
exports.verifyPet = asyncHandler(async (req, res) => {
  const decision = req.body.decision || (req.body.verified === false ? 'reject' : 'approve');
  if (!['approve', 'reject'].includes(decision)) throw new HttpError(400, 'Choose approve or reject.');
  const reason = str(req.body.reason).slice(0, 300);
  if (decision === 'reject' && reason.length < 5) {
    throw new HttpError(400, 'Tell the owner why the registration was rejected.', { reason: 'Tell the owner why the registration was rejected.' });
  }
  const now = new Date();
  const update = decision === 'approve'
    ? { $set: { registrationStatus: 'verified', verifiedAt: now, reviewedAt: now }, $unset: { rejectionReason: 1 } }
    : { $set: { registrationStatus: 'rejected', rejectionReason: reason, reviewedAt: now }, $unset: { verifiedAt: 1 } };
  const pet = await Pet.findByIdAndUpdate(requireId(req.params.id, 'Pet'), update, { new: true });
  if (!pet) throw new HttpError(404, 'Pet not found.');
  await respond(res, pet, req.user);
});

/* ---------- Vaccination record ---------- */

// POST /api/pets/:id/vaccinations  (owner; entries wait for PVO verification)
exports.addVaccination = asyncHandler(async (req, res) => {
  const pet = await loadEditable(req);
  const entry = pick(req.body, ['vaccine', 'dateGiven', 'nextDue', 'administeredBy']);
  if (entry.nextDue === '') delete entry.nextDue;
  pet.vaccinations.push({ ...entry, verified: false });
  await pet.save();
  await respond(res, pet, req.user, 201);
});

// PATCH /api/pets/:id/vaccinations/:vid/verify  { decision: 'approve' | 'reject' }  (admin)
// Marks the owner's entry verified or rejected; the entry itself is not changed.
exports.verifyVaccination = asyncHandler(async (req, res) => {
  const decision = req.body.decision || 'approve';
  if (!['approve', 'reject'].includes(decision)) throw new HttpError(400, 'Choose approve or reject.');
  const approve = decision === 'approve';
  const pet = await Pet.findOneAndUpdate(
    { _id: requireId(req.params.id, 'Pet'), 'vaccinations._id': requireId(req.params.vid, 'Vaccination') },
    { $set: { 'vaccinations.$.verified': approve, 'vaccinations.$.rejected': !approve, 'vaccinations.$.reviewedAt': new Date() } },
    { new: true }
  );
  if (!pet) throw new HttpError(404, 'Vaccination not found.');
  await respond(res, pet, req.user);
});

// DELETE /api/pets/:id/vaccinations/:vid  (owner: own entries the PVO has not verified)
exports.removeVaccination = asyncHandler(async (req, res) => {
  const pet = await loadEditable(req);
  const v = pet.vaccinations.id(requireId(req.params.vid, 'Vaccination'));
  if (!v) throw new HttpError(404, 'Vaccination not found.');
  if (v.verified) throw new HttpError(403, 'PVO-verified vaccinations stay on the record.');
  v.deleteOne();
  await pet.save();
  await respond(res, pet, req.user);
});

/* ---------- Medical history ---------- */

// POST /api/pets/:id/medical  (owner only)
exports.addMedical = asyncHandler(async (req, res) => {
  const pet = await loadEditable(req);
  pet.medicalHistory.push(pick(req.body, ['date', 'type', 'title', 'notes', 'vet']));
  await pet.save();
  await respond(res, pet, req.user, 201);
});

// DELETE /api/pets/:id/medical/:mid  (owner only)
exports.removeMedical = asyncHandler(async (req, res) => {
  const pet = await loadEditable(req);
  const m = pet.medicalHistory.id(requireId(req.params.mid, 'Record'));
  if (!m) throw new HttpError(404, 'Record not found.');
  m.deleteOne();
  await pet.save();
  await respond(res, pet, req.user);
});

exports.serializePet = serializePet;
