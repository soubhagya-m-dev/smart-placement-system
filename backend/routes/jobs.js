const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Job = require('../models/Job');
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

// Middleware: Students must complete profile + be verified by TPO before accessing jobs/applications
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

router.get('/', auth, checkStudentAccess, async (req, res) => {
  try {
    const { jobTitle, companyName, location, skills, jobType, salaryMin, page = 1, limit = 20 } = req.query;
    let query = { status: 'active' };
    
    if (jobTitle) query.title = { $regex: jobTitle, $options: 'i' };
    if (companyName) query.companyName = { $regex: companyName, $options: 'i' };
    if (location) query.location = { $regex: location, $options: 'i' };
    if (jobType) query.jobType = jobType;
    
    if (skills) {
      const skillsArray = skills.split(',').map(s => s.trim()).filter(s => s);
      if (skillsArray.length > 0) {
        query.requiredSkills = { $elemMatch: { $regex: skillsArray.join('|'), $options: 'i' } };
      }
    }
    
    if (salaryMin) {
      query['salary.min'] = { $gte: parseFloat(salaryMin) };
    }
    
    const jobs = await Job.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit));
    const total = await Job.countDocuments(query);
    res.json({ success: true, data: { jobs, total, page: parseInt(page), pages: Math.ceil(total / limit) } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// ===== SAVED JOBS ROUTES (MUST be before /:id to avoid route conflict) =====

// Get user's saved jobs
router.get('/saved', auth, checkStudentAccess, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('savedJobs');
    res.json({ success: true, data: { jobs: user.savedJobs } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// Toggle save/unsave a job
router.post('/saved/:jobId', auth, checkStudentAccess, async (req, res) => {
  try {
    const userId = req.user.id;
    const jobId = req.params.jobId;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const savedJobIds = user.savedJobs.map(id => id.toString());
    const isSaved = savedJobIds.includes(jobId.toString());

    if (isSaved) {
      user.savedJobs.pull(jobId);
    } else {
      user.savedJobs.push(jobId);
    }
    await user.save();
    
    res.json({ success: true, data: { saved: !isSaved } });
  } catch (error) { 
    res.status(500).json({ success: false, message: error.message }); 
  }
});

// ===== JOB CRUD ROUTES (/:id routes) - AFTER /saved routes =====

router.get('/:id', auth, checkStudentAccess, async (req, res) => {
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
    await Job.findByIdAndDelete(req.params.id); 
    res.json({ success: true, message: 'Job deleted' }); 
  }
  catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    const updatedJob = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data: { job: updatedJob } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;