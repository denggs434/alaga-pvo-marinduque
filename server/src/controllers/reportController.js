/**
 * Online reporting: animal bites, missing pets, strays, welfare concerns.
 *
 * Privacy: a report is visible only to the person who filed it and to the PVO.
 * The only public view is /alerts: missing pets whose owner chose to share an
 * alert, showing the photo, area and description, never the reporter's contact.
 */
const Report = require('../models/Report');
const Pet = require('../models/Pet');
const HttpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');
const { str, oneOf, escapeRegex, paging, requireId, pick } = require('../utils/validate');
const { REPORT_TYPES, REPORT_STATUSES, OPEN_REPORT_STATUSES, MUNICIPALITIES } = require('../config/constants');

const POPULATE = [
  { path: 'pet', select: 'name species breed photos registrationNo' },
  { path: 'reporter', select: 'name email phone' },
];
const isAdmin = (u) => u?.role === 'admin';
const CLOSED = ['resolved', 'closed'];

/** A missing pet is "active" again once its report is resolved or closed. */
async function syncPetStatus(report) {
  if (report.type !== 'missing' || !report.pet) return;
  const petId = report.pet._id || report.pet;
  if (CLOSED.includes(report.status)) await Pet.updateOne({ _id: petId, status: 'missing' }, { status: 'active' });
  else await Pet.updateOne({ _id: petId, status: 'active' }, { status: 'missing' });
}

async function loadVisible(req) {
  const report = await Report.findById(requireId(req.params.id, 'Report')).populate(POPULATE);
  const mine = report && String(report.reporter?._id || report.reporter) === String(req.user._id);
  if (!report || (!mine && !isAdmin(req.user))) throw new HttpError(404, 'Report not found.');
  return report;
}

// POST /api/reports  (owner)
exports.createReport = asyncHandler(async (req, res) => {
  const data = pick(req.body, ['type', 'animalSpecies', 'description', 'incidentDate', 'location', 'photos', 'contact', 'publicAlert']);
  data.location = pick(data.location, ['municipality', 'barangay', 'details']);
  data.contact = pick(data.contact, ['name', 'phone', 'email']);
  if (data.contact.email === '') delete data.contact.email;
  data.publicAlert = data.type === 'missing' && data.publicAlert === true;

  // A missing report may point at one of the reporter's own registered pets.
  if (req.body.pet) {
    const pet = await Pet.findOne({ _id: requireId(String(req.body.pet), 'Pet'), owner: req.user._id }).select('species');
    if (!pet) throw new HttpError(400, 'Choose one of your own registered pets.', { pet: 'Choose one of your own registered pets.' });
    data.pet = pet._id;
    data.animalSpecies = pet.species;
  }
  if (data.type !== 'missing') delete data.pet;

  const report = await Report.create({ ...data, reporter: req.user._id });
  await syncPetStatus(report);
  await report.populate(POPULATE);
  res.status(201).json(report);
});

// GET /api/reports/mine
exports.myReports = asyncHandler(async (req, res) => {
  const reports = await Report.find({ reporter: req.user._id }).sort({ createdAt: -1 }).populate(POPULATE[0]).lean();
  res.json(reports);
});

// GET /api/reports/alerts  (public) — open missing-pet alerts the owner chose to share
exports.publicAlerts = asyncHandler(async (req, res) => {
  const reports = await Report.find({ type: 'missing', publicAlert: true, status: { $in: OPEN_REPORT_STATUSES } })
    .sort({ incidentDate: -1 })
    .limit(12)
    .populate(POPULATE[0])
    .lean();
  res.json(
    reports.map((r) => ({
      reference: r.reference,
      name: r.pet?.name || null,
      petId: r.pet?._id || null,
      species: r.animalSpecies,
      breed: r.pet?.breed || '',
      photo: r.photos?.[0] || r.pet?.photos?.[0] || null,
      municipality: r.location.municipality,
      barangay: r.location.barangay,
      lastSeen: r.incidentDate,
      description: r.description.length > 280 ? `${r.description.slice(0, 277)}…` : r.description,
    }))
  );
});

// GET /api/reports/:id  (reporter or admin)
exports.getReport = asyncHandler(async (req, res) => {
  res.json(await loadVisible(req));
});

// PATCH /api/reports/:id/withdraw  (reporter, only before the PVO starts work)
exports.withdrawReport = asyncHandler(async (req, res) => {
  const report = await Report.findOneAndUpdate(
    { _id: requireId(req.params.id, 'Report'), reporter: req.user._id, status: 'submitted' },
    { status: 'closed', $push: { history: { status: 'closed', note: 'Withdrawn by the reporter.', by: 'reporter' } } },
    { new: true }
  ).populate(POPULATE);
  if (!report) throw new HttpError(400, 'Only reports that the PVO has not started on can be withdrawn.');
  await syncPetStatus(report);
  res.json(report);
});

// GET /api/reports?status=open|<status>&type=&municipality=&q=  (admin)
exports.listReports = asyncHandler(async (req, res) => {
  const q = req.query;
  const filter = {};
  if (q.status === 'open') filter.status = { $in: OPEN_REPORT_STATUSES };
  else if (oneOf(q.status, REPORT_STATUSES)) filter.status = str(q.status);
  if (oneOf(q.type, REPORT_TYPES)) filter.type = str(q.type);
  if (oneOf(q.municipality, MUNICIPALITIES)) filter['location.municipality'] = str(q.municipality);
  if (str(q.q)) {
    const rx = new RegExp(escapeRegex(str(q.q)), 'i');
    filter.$or = [{ reference: rx }, { 'contact.name': rx }, { 'location.barangay': rx }];
  }
  const { limit, skip } = paging(q, { limit: 200, max: 500 });
  const reports = await Report.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate(POPULATE).lean();
  res.json(reports);
});

// PATCH /api/reports/:id  { status?, note?, publicAlert? }  (admin)
// One atomic update: the status change and its timeline entry are written together.
exports.updateReport = asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Report');
  const status = req.body.status === undefined ? undefined : oneOf(req.body.status, REPORT_STATUSES);
  if (req.body.status !== undefined && !status) throw new HttpError(400, 'Choose a valid status.');
  const note = str(req.body.note).slice(0, 500);

  const current = await Report.findById(id).select('status type').lean();
  if (!current) throw new HttpError(404, 'Report not found.');
  const changes = {};
  if (status && status !== current.status) changes.status = status;
  if (typeof req.body.publicAlert === 'boolean' && current.type === 'missing') changes.publicAlert = req.body.publicAlert;
  if (!changes.status && !note && !('publicAlert' in changes)) throw new HttpError(400, 'Change the status or add a note for the reporter.');

  const update = Object.keys(changes).length ? { $set: changes } : {};
  if (changes.status || note) update.$push = { history: { status: changes.status || current.status, note: note || undefined, by: 'pvo' } };

  // Only apply if nobody changed the status since we read it.
  const report = await Report.findOneAndUpdate({ _id: id, status: current.status }, update, { new: true, runValidators: true }).populate(POPULATE);
  if (!report) throw new HttpError(409, 'Someone else just updated this report. Reload to see the latest.');
  await syncPetStatus(report);
  res.json(report);
});
