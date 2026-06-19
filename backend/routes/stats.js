const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    next();
  } catch { res.status(401).json({ success: false, message: 'Invalid token' }); }
};

// Filter chip values come in as query params: ?year=&branch=&section=&gender=
// `all` or missing means no filter on that dimension.
// These fields live inside the `studentProfile` subdocument on the User model.
function buildStudentMatch(q) {
  const m = { role: 'student' };
  if (q.year && q.year !== 'all') m['studentProfile.graduationPassingYear'] = Number(q.year);
  if (q.branch && q.branch !== 'all') m['studentProfile.stream'] = q.branch;
  if (q.section && q.section !== 'all') m['studentProfile.section'] = q.section;
  if (q.gender && q.gender !== 'all') m['studentProfile.gender'] = q.gender;
  return m;
}

router.get('/dashboard', auth, async (req, res) => {
  try {
    // Per-student stats (unchanged behaviour for student-role tokens)
    if (req.user.role === 'student') {
      const studentId = req.user.id;
      const [totalApplications, shortlisted, placed] = await Promise.all([
        Application.countDocuments({ student: studentId }),
        Application.countDocuments({ student: studentId, status: 'shortlisted' }),
        Application.countDocuments({ student: studentId, status: 'accepted' })
      ]);
      return res.json({ success: true, data: { totalApplications, shortlisted, placed } });
    }
    // Officer/admin: 4 tiles — Total Students / Verified / Pending / Active Jobs.
    // Returns the FLAT shape the OfficerDashboard component expects
    // (data.totalStudents, data.verifiedStudents, data.activeJobs). Kept separate from
    // /analytics so the dashboard doesn't pull the heavy breakdowns on every page load.
    const [totalStudents, verifiedStudents, activeJobs, placed] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'student', 'studentProfile.verified': true }),
      Job.countDocuments({ status: 'active' }),
      Application.countDocuments({ status: 'accepted' })
    ]);
    // Average package (LPA) across all accepted offers that have a stored CTC.
    // Mirrors the same computation in /analytics so the dashboard tile matches
    // the stats page. offeredCtc is set when the officer sends the offer-letter
    // notification (parsed from the free-form "8 LPA" / "₹12,50,000" string).
    const [pkgAgg] = await Application.aggregate([
      { $match: { status: 'accepted', offeredCtc: { $type: 'number', $gt: 0 } } },
      { $group: { _id: null, avgPackageLpa: { $avg: '$offeredCtc' } } }
    ]);
    const avgPackageLpa = pkgAgg?.avgPackageLpa ? +pkgAgg.avgPackageLpa.toFixed(2) : 0;
    return res.json({
      success: true,
      data: { totalStudents, verifiedStudents, activeJobs, placed, avgPackageLpa }
    });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.get('/analytics', auth, async (req, res) => {
  try {
    const studentMatch = buildStudentMatch(req.query);
    const hasFilter = Object.keys(studentMatch).length > 1; // > { role: 'student' }

    // If a filter is active, restrict to those students' applications; otherwise
    // operate on every application in the system.
    const studentIds = hasFilter
      ? (await User.find(studentMatch, { _id: 1 }).lean()).map(u => u._id)
      : null;
    const appMatch = studentIds ? { student: { $in: studentIds } } : {};

    // Single $facet pipeline — one round trip, all breakdowns in parallel.
    const [facet] = await Application.aggregate([
      { $match: appMatch },
      {
        $facet: {
          statusCounts: [
            { $group: { _id: '$status', count: { $sum: 1 } } }
          ],
          offersPerStudent: [
            { $match: { status: 'accepted' } },
            { $group: { _id: '$student', offers: { $sum: 1 } } },
            { $group: { _id: null, avgOffers: { $avg: '$offers' } } }
          ],
          topRecruiters: [
            { $match: { status: 'accepted' } },
            { $group: { _id: '$job', offers: { $sum: 1 } } },
            { $lookup: { from: 'jobs', localField: '_id', foreignField: '_id', as: 'job' } },
            { $unwind: '$job' },
            { $project: { _id: 0, company: '$job.companyName', offers: 1, avgCtc: { $avg: ['$job.salary.min', '$job.salary.max'] } } },
            { $sort: { offers: -1 } },
            { $limit: 10 }
          ]
        }
      }
    ]);

    const statusMap = Object.fromEntries(facet.statusCounts.map(s => [s._id, s.count]));
    const placed = statusMap.accepted || 0;
    // "Trying" (a.k.a. Active) counts UNIQUE students with at least one active
    // (pending/shortlisted) application AND who are not already placed. A placed
    // student is counted in `placed` only — highest-status-wins. Without this
    // filter, a student with one `accepted` app and one `pending` app would be
    // counted in BOTH buckets, inflating the sum above totalStudents.
    // We compute placedStudentIds first (see further down) and exclude them here.
    const placedStudentIdsForActive = new Set(
      (await Application.aggregate([
        { $match: { ...appMatch, status: 'accepted' } },
        { $group: { _id: '$student' } }
      ])).map(d => String(d._id))
    );
    const tryingStudentIds = new Set(
      (await Application.aggregate([
        { $match: { ...appMatch, status: { $in: ['pending', 'shortlisted'] } } },
        { $group: { _id: '$student' } }
      ])).map(d => String(d._id)).filter(id => !placedStudentIdsForActive.has(id))
    );
    const trying = tryingStudentIds.size;
    const totalApplications = facet.statusCounts.reduce((a, s) => a + s.count, 0);
    const avgOffers = facet.offersPerStudent[0]?.avgOffers || 0;

    // Average package (LPA) — the actual CTC the placement officer sent to each
    // selected applicant via the offer-letter notification. We store it on the
    // Application as `offeredCtc` at notification-send time (parsed from the
    // free-form "8 LPA" / "₹12,50,000" string), so the average reflects what
    // students were *offered* — not the job's posted salary range.
    // Only counts accepted applications with a stored CTC (filter is in $group).
    const [pkgAgg] = await Application.aggregate([
      { $match: { ...appMatch, status: 'accepted', offeredCtc: { $type: 'number', $gt: 0 } } },
      { $group: { _id: null, avgPackageLpa: { $avg: '$offeredCtc' }, offerCount: { $sum: 1 } } }
    ]);
    const avgPackageLpa = pkgAgg?.avgPackageLpa || 0;
    const offerCount = pkgAgg?.offerCount || 0;

    // Total students under the current filter
    // "Verified" = officer has approved the profile (studentProfile.verified), which is the
    // same definition the AllStudents directory uses by default — keeps the dashboard tile
    // in sync with the page it links to.
    const verifiedMatch = { ...studentMatch, 'studentProfile.verified': true };
    const [totalStudents, verifiedStudents, activeJobs, zeroAppCount] = await Promise.all([
      User.countDocuments(studentMatch),
      User.countDocuments(verifiedMatch),
      Job.countDocuments({ status: 'active' }),
      User.aggregate([
        { $match: studentMatch },
        { $lookup: { from: 'applications', localField: '_id', foreignField: 'student', as: 'apps' } },
        { $match: { apps: { $size: 0 } } },
        { $count: 'n' }
      ]).then(r => r[0]?.n || 0)
    ]);
    const pendingStudents = Math.max(0, totalStudents - verifiedStudents);

    // Placement % = placed students / total students (a student with multiple accepts still counts as 1).
    // Reuses the placedStudentIdsForActive Set computed above for the "trying" filter.
    const placedStudentIds = placedStudentIdsForActive;
    const placedStudents = placedStudentIds.size;
    const notTryingStudents = Math.max(0, zeroAppCount);
    const placementPct = totalStudents > 0 ? (placedStudents / totalStudents) * 100 : 0;

    // ----- Branch breakdown (uses students' stream, joins to apps) -----
    const branchAgg = await User.aggregate([
      { $match: studentMatch },
      { $match: { 'studentProfile.stream': { $exists: true, $nin: [null, ''] } } },
      { $lookup: { from: 'applications', localField: '_id', foreignField: 'student', as: 'apps' } },
      { $project: { stream: '$studentProfile.stream', placed: { $cond: [{ $in: ['accepted', '$apps.status'] }, 1, 0] } } },
      { $group: { _id: '$stream', total: { $sum: 1 }, placed: { $sum: '$placed' } } },
      { $project: {
          _id: 0,
          branch: { $ifNull: ['$_id', 'Unspecified'] },
          total: 1, placed: 1,
          placementPct: { $cond: [{ $gt: ['$total', 0] }, { $multiply: [{ $divide: ['$placed', '$total'] }, 100] }, 0] }
      } },
      { $sort: { placementPct: -1, total: -1 } }
    ]);

    // ----- Batch (graduation year) breakdown -----
    const yearAgg = await User.aggregate([
      { $match: studentMatch },
      { $lookup: { from: 'applications', localField: '_id', foreignField: 'student', as: 'apps' } },
      { $project: { year: '$studentProfile.graduationPassingYear', placed: { $cond: [{ $in: ['accepted', '$apps.status'] }, 1, 0] } } },
      { $group: { _id: '$year', total: { $sum: 1 }, placed: { $sum: '$placed' } } },
      { $project: {
          _id: 0,
          year: { $ifNull: ['$_id', 0] },
          total: 1, placed: 1,
          placementPct: { $cond: [{ $gt: ['$total', 0] }, { $multiply: [{ $divide: ['$placed', '$total'] }, 100] }, 0] }
      } },
      { $sort: { year: 1 } }
    ]);

    // ----- Branch × Year grid -----
    const gridAgg = await User.aggregate([
      { $match: studentMatch },
      { $match: { 'studentProfile.stream': { $exists: true, $nin: [null, ''] } } },
      { $lookup: { from: 'applications', localField: '_id', foreignField: 'student', as: 'apps' } },
      { $project: { branch: '$studentProfile.stream', year: '$studentProfile.graduationPassingYear', placed: { $cond: [{ $in: ['accepted', '$apps.status'] }, 1, 0] } } },
      { $group: { _id: { branch: '$branch', year: '$year' }, total: { $sum: 1 }, placed: { $sum: '$placed' } } },
      { $project: {
          _id: 0,
          branch: { $ifNull: ['$_id.branch', 'Unspecified'] },
          year: { $ifNull: ['$_id.year', 0] },
          total: 1, placed: 1,
          placementPct: { $cond: [{ $gt: ['$total', 0] }, { $multiply: [{ $divide: ['$placed', '$total'] }, 100] }, 0] }
      } },
      { $sort: { branch: 1, year: 1 } }
    ]);

    // ----- Trend (per year, per branch) for the line chart -----
    const trendAgg = await User.aggregate([
      { $match: studentMatch },
      { $match: { 'studentProfile.stream': { $exists: true, $nin: [null, ''] } } },
      { $lookup: { from: 'applications', localField: '_id', foreignField: 'student', as: 'apps' } },
      { $project: { branch: '$studentProfile.stream', year: '$studentProfile.graduationPassingYear', placed: { $cond: [{ $in: ['accepted', '$apps.status'] }, 1, 0] } } },
      { $group: { _id: { branch: '$branch', year: '$year' }, total: { $sum: 1 }, placed: { $sum: '$placed' } } },
      { $sort: { '_id.year': 1 } }
    ]);

    const branches = [...new Set(trendAgg.map(t => t._id.branch || 'Unspecified'))].sort();
    const years = [...new Set(trendAgg.map(t => t._id.year))].filter(Boolean).sort((a, b) => a - b);
    const trend = years.map(y => {
      const row = { year: y };
      branches.forEach(b => {
        const cell = trendAgg.find(t => t._id.year === y && (t._id.branch || 'Unspecified') === b);
        row[b] = cell && cell.total > 0 ? +((cell.placed / cell.total) * 100).toFixed(1) : 0;
      });
      return row;
    });

    // ----- Distinct option lists for filter chips -----
    // These fields live inside the `studentProfile` subdocument.
    const [yearOptions, branchOptions, sectionOptions, genderOptions] = await Promise.all([
      User.distinct('studentProfile.graduationPassingYear', { role: 'student' }),
      User.distinct('studentProfile.stream', { role: 'student' }),
      User.distinct('studentProfile.section', { role: 'student' }),
      User.distinct('studentProfile.gender', { role: 'student' })
    ]);

    res.json({
      success: true,
      data: {
        kpis: {
          totalStudents,
          verifiedStudents,
          pendingStudents,
          activeJobs,
          placedStudents,
          placementPct: +placementPct.toFixed(1),
          avgOffers: +avgOffers.toFixed(2),
          avgPackageLpa: +avgPackageLpa.toFixed(2),
          offerCount
        },
        statusBreakdown: {
          placed: placedStudents,
          trying,
          notTrying: notTryingStudents
        },
        byBranch: branchAgg,
        byYear: yearAgg,
        branchYearGrid: gridAgg,
        trend: { years, branches, data: trend },
        topRecruiters: facet.topRecruiters.map(r => ({
          company: r.company,
          offers: r.offers,
          avgCtc: r.avgCtc ? +(r.avgCtc / 100000).toFixed(2) : null
        })),
        filterOptions: {
          years: yearOptions.filter(Boolean).sort((a, b) => a - b),
          branches: branchOptions.filter(Boolean).sort(),
          sections: sectionOptions.filter(Boolean).sort(),
          genders: genderOptions.filter(Boolean).sort()
        }
      }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
