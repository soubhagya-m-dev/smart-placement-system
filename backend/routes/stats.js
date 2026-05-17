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

router.get('/dashboard', auth, async (req, res) => {
  try {
    const [totalStudents, verifiedStudents, activeJobs, totalApplications, placed] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'student', isVerified: true }),
      Job.countDocuments({ status: 'active' }),
      Application.countDocuments(),
      Application.countDocuments({ status: 'accepted' })
    ]);
    res.json({ success: true, data: { totalStudents, verifiedStudents, activeJobs, totalApplications, placed } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;
