const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    next();
  } catch { res.status(401).json({ success: false, message: 'Invalid token' }); }
};

router.patch('/:id/verify', auth, async (req, res) => {
  try { await User.findByIdAndUpdate(req.params.id, { 'studentProfile.verified': true, isVerified: true }); res.json({ success: true, message: 'Student verified' }); }
  catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.patch('/:id/reject', auth, async (req, res) => {
  try { await User.findByIdAndUpdate(req.params.id, { status: 'rejected', rejectionReason: req.body.reason }); res.json({ success: true, message: 'Student rejected' }); }
  catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;
