const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Notification = require('../models/Notification');

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    next();
  } catch { res.status(401).json({ success: false, message: 'Invalid token' }); }
};

router.get('/', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, data: { notifications } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.patch('/:id/read', auth, async (req, res) => {
  try { await Notification.findByIdAndUpdate(req.params.id, { read: true }); res.json({ success: true }); }
  catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;
