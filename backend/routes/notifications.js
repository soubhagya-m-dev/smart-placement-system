const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Notification = require('../models/Notification');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set');
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch { res.status(401).json({ success: false, message: 'Invalid token' }); }
};

// Get all notifications for current user
router.get('/', auth, async (req, res) => {
  try {
    const filter = { user: req.user.id };
    if (req.query.jobId) {
      filter.job = req.query.jobId;
    }
    const notifications = await Notification.find(filter)
      // Populate `job` so the frontend can show a "View job" button on
      // job-related notifications (e.g. interview scheduled, shortlist,
      // offer letter) and link straight to the matching application in
      // the student's Applications page.
      // We only project a few fields to keep the response light.
      .populate('job', 'title companyName')
      .populate('application', 'status')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, data: { notifications } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// Send notification to a student
router.post('/send', auth, async (req, res) => {
  try {
    const { studentId, jobId, applicationId, type, title, message, metadata, eventDate } = req.body;
    
    if (!studentId || !type || !title) {
      return res.status(400).json({ 
        success: false, 
        message: 'studentId, type, and title are required' 
      });
    }

    // Validate type
    const validTypes = ['interview', 'exam', 'offer_letter', 'rejection', 'shortlist', 'general'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid type. Must be one of: ${validTypes.join(', ')}` 
      });
    }

    // If jobId provided, verify officer owns this job
    if (jobId) {
      const Job = require('../models/Job');
      const job = await Job.findById(jobId);
      if (!job) {
        return res.status(404).json({ success: false, message: 'Job not found' });
      }
      if (job.postedBy.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Not authorized for this job' });
      }
    }

    const notification = new Notification({
      user: studentId,
      officer: req.user.id,
      job: jobId || null,
      application: applicationId || null,
      type,
      title,
      message: message || '',
      metadata: metadata || {},
      eventDate: eventDate ? new Date(eventDate) : null
    });

    await notification.save();

    // Auto-update application status based on notification type.
    // For offer_letter, also persist the parsed CTC (LPA) on the Application so the
    // analytics page can compute average package across accepted offers.
    if (applicationId) {
      const Application = require('../models/Application');
      let newStatus = null;

      if (type === 'shortlist') {
        newStatus = 'shortlisted';
      } else if (type === 'rejection') {
        newStatus = 'rejected';
      } else if (type === 'offer_letter') {
        newStatus = 'accepted';
      }

      if (newStatus) {
        const update = { status: newStatus };
        if (type === 'offer_letter' && metadata && metadata.ctc) {
          const { parseCtcToLpa } = require('../utils/parseCtc');
          const lpa = parseCtcToLpa(metadata.ctc);
          if (lpa != null) update.offeredCtc = lpa;
        }
        await Application.findByIdAndUpdate(applicationId, update);
      }
    }

    res.json({ 
      success: true, 
      data: { notification },
      message: 'Notification sent successfully' 
    });
  } catch (error) { 
    res.status(500).json({ success: false, message: error.message }); 
  }
});

// Send bulk notifications
router.post('/send-bulk', auth, async (req, res) => {
  try {
    const { studentIds, jobId, applicationIds, type, title, message, metadata, eventDate } = req.body;

    // Accept either studentIds array or applicationIds array (of strings)
    const isAppIds = applicationIds && Array.isArray(applicationIds) && applicationIds.length > 0;
    const isStudentIds = studentIds && Array.isArray(studentIds) && studentIds.length > 0;

    if (!isAppIds && !isStudentIds) {
      return res.status(400).json({
        success: false,
        message: 'applicationIds (string array) or studentIds (string array) is required'
      });
    }

    if (!type || !title) {
      return res.status(400).json({
        success: false,
        message: 'type and title are required'
      });
    }

    let notifications = [];
    let appsToUpdate = [];

    if (isAppIds) {
      // applicationIds are strings — fetch applications to get studentIds
      const Application = require('../models/Application');
      const apps = await Application.find({ _id: { $in: applicationIds } });
      appsToUpdate = apps.map(a => a._id);

      notifications = apps.map(app => ({
        user: app.student,
        officer: req.user.id,
        job: jobId || null,
        application: app._id,
        type,
        title,
        message: message || '',
        metadata: metadata || {},
        eventDate: eventDate ? new Date(eventDate) : null
      }));
    } else {
      notifications = studentIds.map(studentId => ({
        user: studentId,
        officer: req.user.id,
        job: jobId || null,
        application: null,
        type,
        title,
        message: message || '',
        metadata: metadata || {},
        eventDate: eventDate ? new Date(eventDate) : null
      }));
    }

    await Notification.insertMany(notifications);

    // Auto-update application statuses.
    // For offer_letter, also persist the parsed CTC (LPA) on each Application so the
    // analytics page can compute average package across accepted offers.
    if (appsToUpdate.length > 0) {
      const Application = require('../models/Application');
      let newStatus = null;

      if (type === 'shortlist') {
        newStatus = 'shortlisted';
      } else if (type === 'rejection') {
        newStatus = 'rejected';
      } else if (type === 'offer_letter') {
        newStatus = 'accepted';
      }

      if (newStatus) {
        const update = { status: newStatus };
        if (type === 'offer_letter' && metadata && metadata.ctc) {
          const { parseCtcToLpa } = require('../utils/parseCtc');
          const lpa = parseCtcToLpa(metadata.ctc);
          if (lpa != null) update.offeredCtc = lpa;
        }
        await Application.updateMany(
          { _id: { $in: appsToUpdate } },
          { $set: update }
        );
      }
    }

    res.json({
      success: true,
      data: { count: notifications.length },
      message: `Sent notifications to ${notifications.length} students`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Mark as read
router.patch('/:id/read', auth, async (req, res) => {
  try { 
    await Notification.findByIdAndUpdate(req.params.id, { read: true }); 
    res.json({ success: true }); 
  }
  catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// Mark all as read
router.patch('/mark-all-read', auth, async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user.id, read: false }, { read: true });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// Delete notification
router.delete('/:id', auth, async (req, res) => {
  try {
    await Notification.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;
