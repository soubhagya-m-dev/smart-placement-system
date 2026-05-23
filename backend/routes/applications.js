const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Application = require('../models/Application');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    next();
  } catch { res.status(401).json({ success: false, message: 'Invalid token' }); }
};

// Middleware: Students must complete profile + be verified by TPO before accessing applications
const checkStudentAccess = async (req, res, next) => {
  try {
    if (req.user.role !== 'student') { next(); return; }
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
    if (!isProfileComplete) return res.status(403).json({ success: false, code: 'PROFILE_INCOMPLETE', message: 'Please complete your profile first' });
    if (!user.studentProfile?.verified) return res.status(403).json({ success: false, code: 'PENDING_VERIFICATION', message: 'Your profile is pending verification by placement officer' });
    if (user.status === 'rejected') return res.status(403).json({ success: false, code: 'ACCOUNT_REJECTED', message: user.rejectionReason || 'Your account has been rejected' });
    next();
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

router.post('/', auth, checkStudentAccess, async (req, res) => {
  try {
    const existing = await Application.findOne({ job: req.body.jobId, student: req.user.id });
    if (existing) return res.status(400).json({ success: false, message: 'Already applied' });
    const app = await Application.create({ job: req.body.jobId, student: req.user.id });
    res.json({ success: true, data: { application: app } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.get('/my', auth, checkStudentAccess, async (req, res) => {
  try {
    const apps = await Application.find({ student: req.user.id }).populate('job').sort({ appliedAt: -1 });
    res.json({ success: true, data: { applications: apps } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;