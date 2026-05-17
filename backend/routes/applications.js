const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Application = require('../models/Application');

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    next();
  } catch { res.status(401).json({ success: false, message: 'Invalid token' }); }
};

router.post('/', auth, async (req, res) => {
  try {
    const existing = await Application.findOne({ job: req.body.jobId, student: req.user.id });
    if (existing) return res.status(400).json({ success: false, message: 'Already applied' });
    const app = await Application.create({ job: req.body.jobId, student: req.user.id });
    res.json({ success: true, data: { application: app } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.get('/my', auth, async (req, res) => {
  try {
    const apps = await Application.find({ student: req.user.id }).populate('job').sort({ appliedAt: -1 });
    res.json({ success: true, data: { applications: apps } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;
