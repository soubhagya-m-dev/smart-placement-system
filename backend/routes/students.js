const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Application = require('../models/Application');

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set');
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch { res.status(401).json({ success: false, message: 'Invalid token' }); }
};

// Middleware: Check if student has completed profile and been verified by TPO
const checkStudentAccess = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    
    // Check 1: Profile completed?
    const p = user.studentProfile || {};
    const requiredFields = [
      p.universityRollNumber, p.universityRegistrationNumber, p.collegeId,
      p.admissionType, p.fullName, p.stream, p.section, p.gender,
      p.dateOfBirth, p.tenthBoard, p.tenthPercentage, p.tenthPassingYear,
      p.twelfthBoard, p.twelfthPercentage, p.twelfthPassingYear,
      p.contactNumber, p.currentCGPA, p.numberOfBacklog
    ];
    const isProfileComplete = requiredFields.every(f => f !== undefined && f !== null && f !== '');
    
    if (!isProfileComplete) {
      return res.status(403).json({ 
        success: false, 
        code: 'PROFILE_INCOMPLETE',
        message: 'Please complete your profile first'
      });
    }
    
    // Check 2: TPO verified the account?
    if (!user.studentProfile?.verified) {
      return res.status(403).json({ 
        success: false, 
        code: 'PENDING_VERIFICATION',
        message: 'Your profile is pending verification by placement officer'
      });
    }
    
    // Check 3: Not rejected?
    if (user.status === 'rejected') {
      return res.status(403).json({ 
        success: false, 
        code: 'ACCOUNT_REJECTED',
        message: user.rejectionReason || 'Your account has been rejected by placement officer'
      });
    }
    
    next();
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// Check current student access status (public - works for any authenticated student)
router.get('/status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const p = user.studentProfile || {};
    
    const requiredFields = [
      p.universityRollNumber, p.universityRegistrationNumber, p.collegeId,
      p.admissionType, p.fullName, p.stream, p.section, p.gender,
      p.dateOfBirth, p.tenthBoard, p.tenthPercentage, p.tenthPassingYear,
      p.twelfthBoard, p.twelfthPercentage, p.twelfthPassingYear,
      p.contactNumber, p.currentCGPA, p.numberOfBacklog
    ];
    const isProfileComplete = requiredFields.every(f => f !== undefined && f !== null && f !== '');
    
    res.json({
      success: true,
      data: {
        isProfileComplete,
        isVerified: !!user.studentProfile?.verified,
        status: user.status,
        rejectionReason: user.rejectionReason || null
      }
    });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// Get all students pending verification (for TPO)
router.get('/pending', auth, async (req, res) => {
  try {
    // Only officers can access
    if (req.user.role !== 'officer' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    const students = await User.find({
      role: 'student',
      $or: [
        { 'studentProfile.verified': false },
        { 'studentProfile.verified': null },
        { 'studentProfile.verified': { $exists: false } }
      ],
      status: { $ne: 'rejected' }
    }).select('name email studentProfile status createdAt');

    // Decorate: prefer studentProfile.fullName / studentProfile.email over the
    // top-level Gmail-derived fields. Officer UI should always show what the
    // student typed into their profile, not what Firebase gave us at signup.
    const decorated = students.map(s => {
      const obj = s.toObject();
      obj.name = obj.studentProfile?.fullName || obj.name;
      obj.email = obj.studentProfile?.email || obj.email;
      return obj;
    });

    res.json({ success: true, data: { students: decorated } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// Verify a student (by TPO)
router.patch('/:id/verify', auth, async (req, res) => {
  try {
    if (req.user.role !== 'officer' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    await User.findByIdAndUpdate(req.params.id, { 
      'studentProfile.verified': true,
      isVerified: true,
      status: 'active' // Reset status so verified students can access features
    });

    // Send notification to student
    const student = await User.findById(req.params.id);
    const notification = await Notification.create({
      user: req.params.id,
      type: 'success',
      title: '✅ Account Verified!',
      message: `Congratulations ${student.name}! Your account has been verified by the Placement Officer. You now have full access to all features.`,
      link: '/student/dashboard'
    });

    res.json({ 
      success: true, 
      message: 'Student verified successfully',
      data: { notification }
    });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// Reject a student (by TPO)
router.patch('/:id/reject', auth, async (req, res) => {
  try {
    if (req.user.role !== 'officer' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    await User.findByIdAndUpdate(req.params.id, { 
      status: 'rejected',
      rejectionReason: req.body.reason || 'Profile rejected by placement officer'
    });

    // Send notification to student
    const student = await User.findById(req.params.id);
    await Notification.create({
      user: req.params.id,
      type: 'error',
      title: '❌ Account Rejected',
      message: `Your profile has been rejected by the Placement Officer. Reason: ${req.body.reason || 'Please contact the TPO for more information.'}`,
      link: '/student/profile'
    });

    res.json({ success: true, message: 'Student rejected' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// Get ALL students (for officer's Excel-like student directory)
// Query params:
//   verified=true  -> only verified students (default)
//   verified=false -> all students
// Each student is augmented with `placement` = { status, total, accepted, inProgress }
//   status: "placed"      — student has at least one application with status="accepted"
//   status: "trying"      — student has at least one application in ["pending","shortlisted"] (no acceptances)
//   status: "not_trying"  — student has zero applications OR every application is "rejected"
// The `accepted` status wins over `inProgress` so a student placed at Company A who is
// still interviewing at Company B is still reported as "placed" overall.
router.get('/all', auth, async (req, res) => {
  try {
    if (req.user.role !== 'officer' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const showOnlyVerified = req.query.verified !== 'false'; // default = true
    const filter = { role: 'student' };
    if (showOnlyVerified) {
      filter['studentProfile.verified'] = true;
    }
    const students = await User.find(filter)
      .select('name email phone status createdAt isVerified studentProfile')
      .sort({ createdAt: -1 });

    // Pull every application for these students in one query and bucket by student.
    // Doing it server-side (instead of N+1 or a client-side join) keeps the page
    // load to a single request and lets the frontend stay declarative.
    const studentIds = students.map(s => s._id);
    const apps = studentIds.length
      ? await Application.find({ student: { $in: studentIds } }).select('student status').lean()
      : [];

    // Group: { studentId: { accepted: N, inProgress: N, rejected: N, total: N } }
    const byStudent = new Map();
    for (const a of apps) {
      const sid = String(a.student);
      const bucket = byStudent.get(sid) || { accepted: 0, inProgress: 0, rejected: 0, total: 0 };
      bucket.total += 1;
      if (a.status === 'accepted')       bucket.accepted += 1;
      else if (a.status === 'pending' || a.status === 'shortlisted') bucket.inProgress += 1;
      else if (a.status === 'rejected')  bucket.rejected += 1;
      byStudent.set(sid, bucket);
    }

    const decorated = students.map(s => {
      const b = byStudent.get(String(s._id)) || { accepted: 0, inProgress: 0, rejected: 0, total: 0 };
      // Placement rule (highest status wins):
      //   1. any accepted      -> "placed"
      //   2. any in-progress   -> "trying"   (pending or shortlisted)
      //   3. otherwise         -> "not_trying" (no apps, or only rejections)
      const status = b.accepted > 0
        ? 'placed'
        : b.inProgress > 0
          ? 'trying'
          : 'not_trying';
      return {
        ...s.toObject(),
        placement: { status, ...b }
      };
    });

    res.json({ success: true, data: { students: decorated, total: decorated.length } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete a student (by TPO) — cascades to their applications & notifications.
// We hard-delete rather than soft-delete because the use case is "remove a
// duplicate / test / wrong-tenant account" where keeping a tombstone just
// shows up as clutter on the AllStudents page. The student's User record,
// every Application where they are the student, and every Notification
// addressed to them all get wiped in one shot. Officers only — students
// cannot delete other students.
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'officer' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const student = await User.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    // Guard: never let an officer delete a non-student user by ID (admins,
    // other officers) — only student records are deletable via this route.
    if (student.role !== 'student') {
      return res.status(403).json({ success: false, message: 'Only student accounts can be deleted via this endpoint' });
    }

    // Cascade: applications + notifications. Order doesn't matter for Mongo
    // (no FK constraints), but doing it explicitly avoids orphaned records
    // showing up in other officers' views.
    const [appResult, noteResult] = await Promise.all([
      Application.deleteMany({ student: student._id }),
      Notification.deleteMany({ user: student._id }),
    ]);
    await User.findByIdAndDelete(student._id);

    res.json({
      success: true,
      message: `Student ${student.name} deleted`,
      data: {
        deletedApplications: appResult.deletedCount,
        deletedNotifications: noteResult.deletedCount,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Export both for use in other routes
module.exports = router;
module.exports.checkStudentAccess = checkStudentAccess;