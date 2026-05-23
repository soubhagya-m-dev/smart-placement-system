const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Job = require('../models/Job');

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    if (!decoded.role || (decoded.role !== 'officer' && decoded.role !== 'admin')) {
      return res.status(403).json({ success: false, message: 'Access denied. Officers only.' });
    }
    req.user = decoded;
    next();
  } catch { res.status(401).json({ success: false, message: 'Invalid token' }); }
};

router.get('/my-jobs', auth, async (req, res) => {
  try {
    // Return all jobs (posted by any officer) - officers can view and edit all jobs
    const jobs = await Job.find({ postedBy: { $exists: true } }).sort({ createdAt: -1 });
    res.json({ success: true, data: { jobs } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.get('/pending-verifications', auth, async (req, res) => {
  try {
    // Find students who:
    // 1. Have verified email (isVerified: true)
    // 2. Have completed their profile (isProfileComplete: true)
    // 3. Are not yet TPO-verified (studentProfile.verified: false)
    // 4. Are not rejected (status !== 'rejected')
    const students = await User.find({ 
      role: 'student', 
      isVerified: true,
      'studentProfile.isProfileComplete': true,
      'studentProfile.verified': false,
      status: { $ne: 'rejected' }
    }).select('name email studentProfile createdAt');
    res.json({ success: true, data: { students } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;
