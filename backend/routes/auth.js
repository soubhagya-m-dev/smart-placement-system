const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, phone, rollNumber, department } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ success: false, message: 'Email already registered' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    
    const user = await User.create({
      name, email, password: hashedPassword, role: role || 'student',
      phone, studentProfile: { rollNumber, department },
      verificationOTP: { code: otp, expiresAt: otpExpiry }
    });
    
    console.log(`OTP for ${email}: ${otp}`); // In production, send via email
    
    res.json({ success: true, message: 'OTP sent to email', email });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.verificationOTP.code !== otp || user.verificationOTP.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }
    
    user.isVerified = true;
    user.verificationOTP = undefined;
    await user.save();
    
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    
    res.json({ success: true, data: { token, user } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    if (!user.isVerified) return res.status(403).json({ success: false, message: 'Please verify your email first' });
    
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    
    res.json({ success: true, data: { token, user } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Google Auth
router.post('/google', async (req, res) => {
  try {
    const { googleId, email, name, photoUrl } = req.body;
    
    let user = await User.findOne({ email });
    
    if (!user) {
      // Create new user
      user = await User.create({
        name,
        email,
        googleId,
        isGoogleAuth: true,
        isVerified: true, // Google already verified
        role: 'student'
      });
    } else if (!user.isGoogleAuth) {
      // Existing user with email but not Google auth
      return res.status(400).json({ success: false, message: 'Email already registered. Please login with password.' });
    }
    
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    
    res.json({ success: true, data: { token, user } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const user = await User.findById(decoded.id).select('-password');
    
    res.json({ success: true, data: { user } });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

// Update profile
router.patch('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    
    const { name, phone, studentProfile } = req.body;
    const user = await User.findByIdAndUpdate(decoded.id, { name, phone, ...(studentProfile && { studentProfile }) }, { new: true }).select('-password');
    
    res.json({ success: true, data: { user } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
