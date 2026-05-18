const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
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

router.get('/', auth, async (req, res) => {
  try {
    const { search, jobType, location, salaryMin, salaryMax, page = 1, limit = 20 } = req.query;
    let query = { status: 'active' };
    if (search) query.$or = [{ title: { $regex: search, $options: 'i' } }, { companyName: { $regex: search, $options: 'i' } }];
    if (jobType) query.jobType = jobType;
    if (location) query.location = { $regex: location, $options: 'i' };
    const jobs = await Job.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit));
    const total = await Job.countDocuments(query);
    res.json({ success: true, data: { jobs, total, page: parseInt(page), pages: Math.ceil(total / limit) } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    const hasApplied = await Application.findOne({ job: req.params.id, student: req.user.id });
    res.json({ success: true, data: { job: { ...job.toObject(), hasApplied: !!hasApplied } } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const job = await Job.create({ ...req.body, postedBy: req.user.id });
    res.json({ success: true, data: { job } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try { 
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    // Any officer can delete any job
    await Job.findByIdAndDelete(req.params.id); 
    res.json({ success: true, message: 'Job deleted' }); 
  }
  catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// Update job
router.put('/:id', auth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    
    // Any officer can edit any job
    const updatedJob = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data: { job: updatedJob } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;
