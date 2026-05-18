const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Job = require('../models/Job');

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'secret');
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
    const students = await User.find({ role: 'student', isVerified: false }).select('name email studentProfile');
    res.json({ success: true, data: { students } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;
