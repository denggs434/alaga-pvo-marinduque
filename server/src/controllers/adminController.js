/**
 * GET /api/admin/stats — numbers for the PVO dashboard, computed in MongoDB.
 *  - pets: total, by species, verified vs pending, private, missing
 *  - owners: total and banned
 *  - vaccinations: records, given in the last 30 days, anti-rabies coverage,
 *    upcoming scheduled activities
 *  - reports: by status, by type, open / high-priority / resolved
 *  - monthly: new registrations, vaccinations given and reports filed for the
 *    last 6 months (Manila time), zero-filled
 */
const Pet = require('../models/Pet');
const User = require('../models/User');
const Report = require('../models/Report');
const Post = require('../models/Post');
const Announcement = require('../models/Announcement');
const ContactMessage = require('../models/ContactMessage');
const asyncHandler = require('../utils/asyncHandler');
const { OPEN_REPORT_STATUSES } = require('../config/constants');

const TZ = 'Asia/Manila';
const MONTHS = 6;
const monthKey = (field) => ({ $dateToString: { format: '%Y-%m', date: field, timezone: TZ } });

/** The last N month keys ("2026-06" … "2026-11") in Manila time, oldest first. */
function lastMonths(n) {
  const now = new Date(Date.now() + 8 * 36e5); // shift to Manila, then read UTC parts
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (n - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

const toMap = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.n]));

exports.getStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const months = lastMonths(MONTHS);
  const since = new Date(`${months[0]}-01T00:00:00+08:00`);
  const days30 = new Date(now.getTime() - 30 * 864e5);
  const rabiesRx = /rabies/i;

  const [
    petTotals, bySpecies, owners, banned, rabies, vaxTotals, upcoming,
    reportsByStatus, reportsByType, highOpen, regMonthly, vaxMonthly, reportMonthly,
    recentReports, pendingPets, posts, newMessages,
  ] = await Promise.all([
    Pet.aggregate([{
      $group: {
        _id: null,
        total: { $sum: 1 },
        verified: { $sum: { $cond: [{ $eq: ['$registrationStatus', 'verified'] }, 1, 0] } },
        private: { $sum: { $cond: ['$isPublic', 0, 1] } },
        missing: { $sum: { $cond: [{ $eq: ['$status', 'missing'] }, 1, 0] } },
      },
    }]),
    Pet.aggregate([{ $group: { _id: '$species', n: { $sum: 1 } } }]),
    User.countDocuments({ role: 'owner' }),
    User.countDocuments({ role: 'owner', banned: true }),
    // Anti-rabies coverage: living pets whose latest rabies shot is still valid.
    Pet.aggregate([
      { $match: { status: { $ne: 'deceased' }, species: { $in: ['dog', 'cat'] } } },
      { $project: { shots: { $filter: { input: '$vaccinations', as: 'v', cond: { $regexMatch: { input: '$$v.vaccine', regex: rabiesRx } } } } } },
      { $project: { due: { $max: { $map: { input: '$shots', as: 'v', in: { $ifNull: ['$$v.nextDue', { $dateAdd: { startDate: '$$v.dateGiven', unit: 'year', amount: 1 } }] } } } } } },
      { $group: { _id: null, eligible: { $sum: 1 }, current: { $sum: { $cond: [{ $gte: ['$due', now] }, 1, 0] } } } },
    ]),
    Pet.aggregate([
      { $unwind: '$vaccinations' },
      { $group: { _id: null, records: { $sum: 1 }, last30: { $sum: { $cond: [{ $gte: ['$vaccinations.dateGiven', days30] }, 1, 0] } }, unverified: { $sum: { $cond: ['$vaccinations.verified', 0, 1] } } } },
    ]),
    Announcement.countDocuments({ published: true, 'event.startsAt': { $gte: now } }),
    Report.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Report.aggregate([{ $group: { _id: '$type', n: { $sum: 1 } } }]),
    Report.countDocuments({ priority: 'high', status: { $in: OPEN_REPORT_STATUSES } }),
    Pet.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: monthKey('$createdAt'), n: { $sum: 1 } } }]),
    Pet.aggregate([
      { $unwind: '$vaccinations' },
      { $match: { 'vaccinations.dateGiven': { $gte: since } } },
      { $group: { _id: monthKey('$vaccinations.dateGiven'), n: { $sum: 1 } } },
    ]),
    Report.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { m: monthKey('$createdAt'), t: '$type' }, n: { $sum: 1 } } },
    ]),
    Report.find({ status: { $in: OPEN_REPORT_STATUSES } }).sort({ priority: 1, createdAt: -1 }).limit(6)
      .select('reference type status priority location incidentDate createdAt').lean(),
    Pet.countDocuments({ registrationStatus: 'pending' }),
    Post.countDocuments(),
    ContactMessage.countDocuments({ status: 'new' }),
  ]);

  const p = petTotals[0] || {};
  const status = toMap(reportsByStatus);
  const vax = vaxTotals[0] || {};
  const cov = rabies[0] || { eligible: 0, current: 0 };
  const reg = toMap(regMonthly);
  const vaxM = toMap(vaxMonthly);

  res.json({
    pets: { total: p.total || 0, verified: p.verified || 0, pending: pendingPets, private: p.private || 0, missing: p.missing || 0, bySpecies: toMap(bySpecies) },
    owners: { total: owners, banned },
    vaccinations: {
      records: vax.records || 0,
      last30: vax.last30 || 0,
      unverified: vax.unverified || 0,
      rabiesCurrent: cov.current,
      rabiesEligible: cov.eligible,
      upcomingActivities: upcoming,
    },
    reports: {
      byStatus: status,
      byType: toMap(reportsByType),
      open: OPEN_REPORT_STATUSES.reduce((s, k) => s + (status[k] || 0), 0),
      pending: status.submitted || 0,
      resolved: status.resolved || 0,
      highPriorityOpen: highOpen,
      recent: recentReports,
    },
    monthly: months.map((m) => ({
      month: m,
      registrations: reg[m] || 0,
      vaccinations: vaxM[m] || 0,
      reports: Object.fromEntries(['bite', 'missing', 'stray', 'welfare'].map((t) => [t, reportMonthly.find((r) => r._id.m === m && r._id.t === t)?.n || 0])),
    })),
    posts,
    newMessages,
  });
});
