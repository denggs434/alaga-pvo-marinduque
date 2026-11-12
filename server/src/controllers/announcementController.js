/**
 * PVO announcements and scheduled activities (vaccination drives, deworming days…).
 * Public: published items. Admin: everything, plus create / update / delete.
 */
const Announcement = require('../models/Announcement');
const HttpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');
const { str, oneOf, escapeRegex, paging, requireId, pick } = require('../utils/validate');
const { ANNOUNCEMENT_CATEGORIES, MUNICIPALITIES } = require('../config/constants');

const EDITABLE = ['title', 'category', 'body', 'image', 'event', 'pinned', 'published'];
const isAdmin = (u) => u?.role === 'admin';

/** Start of today in Manila (UTC+8, no daylight saving), so an event stays "upcoming" all day. */
function startOfToday() {
  const DAY = 864e5;
  const OFFSET = 8 * 36e5;
  return new Date(Math.floor((Date.now() + OFFSET) / DAY) * DAY - OFFSET);
}

/** Normalise the event block from a form (blank strings -> unset). */
function cleanEvent(event) {
  if (!event || typeof event !== 'object') return undefined;
  const e = pick(event, ['startsAt', 'endsAt', 'venue', 'municipality']);
  Object.keys(e).forEach((k) => e[k] === '' && delete e[k]);
  return Object.keys(e).length ? e : undefined;
}

// GET /api/announcements?category=&upcoming=true&municipality=&q=&page=&limit=   (admin: &all=true)
exports.listAnnouncements = asyncHandler(async (req, res) => {
  const q = req.query;
  const filter = isAdmin(req.user) && q.all === 'true' ? {} : { published: true };
  const category = oneOf(q.category, ANNOUNCEMENT_CATEGORIES);
  const municipality = oneOf(q.municipality, MUNICIPALITIES);
  if (category) filter.category = category;
  if (municipality) filter['event.municipality'] = municipality;
  if (str(q.q)) filter.title = new RegExp(escapeRegex(str(q.q)), 'i');

  const upcoming = q.upcoming === 'true';
  if (upcoming) {
    const today = startOfToday();
    // Still running or yet to start.
    filter.$or = [{ 'event.endsAt': { $gte: new Date() } }, { 'event.endsAt': { $exists: false }, 'event.startsAt': { $gte: today } }];
  }
  const sort = upcoming ? { 'event.startsAt': 1 } : { pinned: -1, createdAt: -1 };
  const { limit, page, skip } = paging(q, { limit: 10, max: 100 });

  const [items, total] = await Promise.all([
    Announcement.find(filter).sort({ ...sort, _id: -1 }).skip(skip).limit(limit).lean(),
    Announcement.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) || 1 });
});

// GET /api/announcements/:id
exports.getAnnouncement = asyncHandler(async (req, res) => {
  const a = await Announcement.findById(requireId(req.params.id, 'Announcement')).lean();
  if (!a || (!a.published && !isAdmin(req.user))) throw new HttpError(404, 'Announcement not found.');
  res.json(a);
});

// POST /api/announcements  (admin)
exports.createAnnouncement = asyncHandler(async (req, res) => {
  const data = pick(req.body, EDITABLE);
  data.event = cleanEvent(data.event);
  if (data.image === '') delete data.image;
  const a = await Announcement.create({ ...data, author: req.user._id });
  res.status(201).json(a);
});

// PUT /api/announcements/:id  (admin)
exports.updateAnnouncement = asyncHandler(async (req, res) => {
  const a = await Announcement.findById(requireId(req.params.id, 'Announcement'));
  if (!a) throw new HttpError(404, 'Announcement not found.');
  const data = pick(req.body, EDITABLE);
  if ('event' in data) data.event = cleanEvent(data.event) || {}; // {} clears the schedule
  if (data.image === '') data.image = undefined;
  Object.assign(a, data);
  await a.save();
  res.json(a);
});

// DELETE /api/announcements/:id  (admin)
exports.deleteAnnouncement = asyncHandler(async (req, res) => {
  const a = await Announcement.findByIdAndDelete(requireId(req.params.id, 'Announcement'));
  if (!a) throw new HttpError(404, 'Announcement not found.');
  res.json({ message: 'Announcement deleted.' });
});
