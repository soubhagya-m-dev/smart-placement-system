const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');

const adminAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const user = await User.findById(decoded.id);
    if (!user || user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    req.user = user;
    next();
  } catch { res.status(401).json({ success: false, message: 'Invalid token' }); }
};

// Get all officers
router.get('/officers', adminAuth, async (req, res) => {
  try {
    const officers = await User.find({ role: 'officer' }).select('-password');
    res.json({ success: true, data: { officers } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// Create new officer
router.post('/officers', adminAuth, async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already registered' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const officer = await User.create({ name, email, password: hashedPassword, phone, role: 'officer', isVerified: true });
    res.json({ success: true, message: 'Officer created successfully', data: { officer: { ...officer.toObject(), password: undefined } } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// Delete officer
router.delete('/officers/:id', adminAuth, async (req, res) => {
  try {
    const officer = await User.findOne({ _id: req.params.id, role: 'officer' });
    if (!officer) return res.status(404).json({ success: false, message: 'Officer not found' });
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Officer removed' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// Get all students
router.get('/students', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, verified } = req.query;
    let query = { role: 'student' };
    if (search) query.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];
    if (verified !== undefined) query.isVerified = verified === 'true';
    const students = await User.find(query).select('-password').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit));
    const total = await User.countDocuments(query);
    res.json({ success: true, data: { students, total, page: parseInt(page), pages: Math.ceil(total / limit) } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// Delete student
router.delete('/students/:id', adminAuth, async (req, res) => {
  try {
    const student = await User.findOne({ _id: req.params.id, role: 'student' });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    await Application.deleteMany({ student: req.params.id });
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Student removed' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// Verify/unverify student
router.patch('/students/:id/verify', adminAuth, async (req, res) => {
  try {
    const { verified } = req.body;
    const student = await User.findOneAndUpdate({ _id: req.params.id, role: 'student' }, { isVerified: verified }, { new: true }).select('-password');
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, data: { student } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// Get all jobs
router.get('/jobs', adminAuth, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    let query = {};
    if (status) query.status = status;
    const jobs = await Job.find(query).populate('postedBy', 'name email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit));
    const total = await Job.countDocuments(query);
    res.json({ success: true, data: { jobs, total, page: parseInt(page), pages: Math.ceil(total / limit) } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// Delete job
router.delete('/jobs/:id', adminAuth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    await Application.deleteMany({ job: req.params.id });
    await Job.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Job removed' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// Get all applications
router.get('/applications', adminAuth, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    let query = {};
    if (status) query.status = status;
    const applications = await Application.find(query).populate('student', 'name email studentProfile').populate('job', 'title companyName').sort({ appliedAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit));
    const total = await Application.countDocuments(query);
    res.json({ success: true, data: { applications, total, page: parseInt(page), pages: Math.ceil(total / limit) } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// Get system stats
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const [totalStudents, verifiedStudents, totalOfficers, activeJobs, totalApplications, placed] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'student', isVerified: true }),
      User.countDocuments({ role: 'officer' }),
      Job.countDocuments({ status: 'active' }),
      Application.countDocuments(),
      Application.countDocuments({ status: 'accepted' })
    ]);
    res.json({ success: true, data: { totalStudents, verifiedStudents, totalOfficers, activeJobs, totalApplications, placed } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;