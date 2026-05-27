const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');
const Notification = require('../models/Notification');

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || user.role !== 'officer') return res.status(403).json({ success: false, message: 'Access denied' });
    req.user = user;
    next();
  } catch (error) { res.status(401).json({ success: false, message: 'Invalid token' }); }
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
    // Find students who:
    // 1. Have verified email (isVerified: true)
    // 2. Have completed their profile (isProfileComplete: true)
    // 3. Are not yet TPO-verified (studentProfile.verified is false/null/undefined)
    // 4. Are not rejected (status !== 'rejected')
    const students = await User.find({ 
      role: 'student', 
      isVerified: true,
      'studentProfile.isProfileComplete': true,
      $or: [
        { 'studentProfile.verified': false },
        { 'studentProfile.verified': null },
        { 'studentProfile.verified': { $exists: false } }
      ],
      status: { $ne: 'rejected' }
    }).select('name email studentProfile createdAt');
    res.json({ success: true, data: { students } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// Get applicants for a specific job
router.get('/job-applicants/:jobId', auth, async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // Verify job exists
    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    
    // Get all applications for this job with student details
    const applications = await Application.find({ job: jobId })
      .populate('student', 'name email phone studentProfile universityRollNo rollNo department stream section cgpa class12Percentage class10Percentage dateOfBirth gender category aadharCard address fatherName motherName emergencyContact annualIncome contactNumber')
      .sort({ appliedAt: -1 });

    const applicants = applications.map(app => ({
      applicationId: app._id,
      status: app.status,
      appliedAt: app.appliedAt,
      student: {
        id: app.student._id,
        name: app.student.name,
        email: app.student.email,
        phone: app.student.phone || app.student.studentProfile?.contactNumber || null,
        contactNumber: app.student.studentProfile?.contactNumber || null,
        universityRollNo: app.student.universityRollNo,
        rollNo: app.student.rollNo,
        studentProfile: app.student.studentProfile,
        department: app.student.department,
        stream: app.student.stream,
        section: app.student.section,
        cgpa: app.student.cgpa,
        class12Percentage: app.student.class12Percentage,
        class10Percentage: app.student.class10Percentage,
        dateOfBirth: app.student.dateOfBirth,
        gender: app.student.gender,
        category: app.student.category,
        aadharCard: app.student.aadharCard,
        address: app.student.address,
        fatherName: app.student.fatherName,
        motherName: app.student.motherName,
        emergencyContact: app.student.emergencyContact,
        annualIncome: app.student.annualIncome
      }
    }));
    
    res.json({ 
      success: true, 
      data: { 
        job: { id: job._id, title: job.title, company: job.company, eligibility: job.eligibility },
        applicants,
        totalCount: applicants.length
      } 
    });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// Update application status (shortlist/reject)
router.patch('/application/:applicationId', auth, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { status } = req.body;
    
    if (!['pending', 'shortlisted', 'accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    
    const application = await Application.findByIdAndUpdate(
      applicationId,
      { status },
      { new: true }
    ).populate('student', 'name email studentProfile').populate('job', 'title companyName');
    
    if (!application) return res.status(404).json({ success: false, message: 'Application not found' });
    
    // Create notification for status update
      let notificationTitle, notificationMessage;
      if (status === 'shortlisted') {
        notificationTitle = 'Congratulations! You are shortlisted!';
        notificationMessage = `You have been shortlisted for ${application.job.title} at ${application.job.companyName}.`;
      } else if (status === 'accepted') {
        notificationTitle = 'Congratulations! You are accepted!';
        notificationMessage = `You have been accepted for ${application.job.title} at ${application.job.companyName}. Please check your email for further details.`;
      } else {
        notificationTitle = 'Application Update';
        notificationMessage = `Your application for ${application.job.title} at ${application.job.companyName} has been rejected.`;
      }

      const notification = new Notification({
        user: application.student._id,
        type: 'application_update',
        title: notificationTitle,
        message: notificationMessage,
        link: '/student/my-applications',
        read: false
      });
      await notification.save();
      
      // Send email notification to student
      if (status === 'shortlisted' || status === 'rejected' || status === 'accepted') {
        const { sendApplicationStatusEmail } = require('../services/emailService');
        sendApplicationStatusEmail(
          application.student.email,
          application.student.name,
          application.job.title,
          application.job.companyName,
          status
        ).catch(err => console.error('Failed to send status email:', err.message));
      }
    
    res.json({ success: true, data: { application } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;
