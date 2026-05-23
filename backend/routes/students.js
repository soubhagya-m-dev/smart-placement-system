const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Notification = require('../models/Notification');

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    next();
  } catch { res.status(401).json({ success: false, message: 'Invalid token' }); }
};

// Middleware: Check if student has completed profile and been verified by TPO
const checkStudentAccess = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    
    // Check 1: Profile completed?
    const p = user.studentProfile || {};
    const requiredFields = [
      p.universityRollNumber, p.universityRegistrationNumber, p.collegeId,
      p.admissionType, p.fullName, p.stream, p.section, p.gender,
      p.dateOfBirth, p.tenthBoard, p.tenthPercentage, p.tenthPassingYear,
      p.twelfthBoard, p.twelfthPercentage, p.twelfthPassingYear,
      p.contactNumber, p.currentCGPA, p.numberOfBacklog
    ];
    const isProfileComplete = requiredFields.every(f => f !== undefined && f !== null && f !== '');
    
    if (!isProfileComplete) {
      return res.status(403).json({ 
        success: false, 
        code: 'PROFILE_INCOMPLETE',
        message: 'Please complete your profile first'
      });
    }
    
    // Check 2: TPO verified the account?
    if (!user.studentProfile?.verified) {
      return res.status(403).json({ 
        success: false, 
        code: 'PENDING_VERIFICATION',
        message: 'Your profile is pending verification by placement officer'
      });
    }
    
    // Check 3: Not rejected?
    if (user.status === 'rejected') {
      return res.status(403).json({ 
        success: false, 
        code: 'ACCOUNT_REJECTED',
        message: user.rejectionReason || 'Your account has been rejected by placement officer'
      });
    }
    
    next();
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// Check current student access status (public - works for any authenticated student)
router.get('/status', auth, async (req, res) => {
  try {
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
    
    res.json({
      success: true,
      data: {
        isProfileComplete,
        isVerified: !!user.studentProfile?.verified,
        status: user.status,
        rejectionReason: user.rejectionReason || null
      }
    });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// Get all students pending verification (for TPO)
router.get('/pending', auth, async (req, res) => {
  try {
    // Only officers can access
    if (req.user.role !== 'officer' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    const students = await User.find({ 
      role: 'student',
      $or: [
        { 'studentProfile.verified': false },
        { 'studentProfile.verified': null },
        { 'studentProfile.verified': { $exists: false } }
      ],
      status: { $ne: 'rejected' }
    }).select('name email studentProfile status createdAt');
    
    res.json({ success: true, data: { students } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// Verify a student (by TPO)
router.patch('/:id/verify', auth, async (req, res) => {
  try {
    if (req.user.role !== 'officer' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    await User.findByIdAndUpdate(req.params.id, { 
      'studentProfile.verified': true,
      isVerified: true,
      status: 'active' // Reset status so verified students can access features
    });

    // Send notification to student
    const student = await User.findById(req.params.id);
    const notification = await Notification.create({
      user: req.params.id,
      type: 'success',
      title: '✅ Account Verified!',
      message: `Congratulations ${student.name}! Your account has been verified by the Placement Officer. You now have full access to all features.`,
      link: '/student/dashboard'
    });

    res.json({ 
      success: true, 
      message: 'Student verified successfully',
      data: { notification }
    });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// Reject a student (by TPO)
router.patch('/:id/reject', auth, async (req, res) => {
  try {
    if (req.user.role !== 'officer' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    await User.findByIdAndUpdate(req.params.id, { 
      status: 'rejected',
      rejectionReason: req.body.reason || 'Profile rejected by placement officer'
    });

    // Send notification to student
    const student = await User.findById(req.params.id);
    await Notification.create({
      user: req.params.id,
      type: 'error',
      title: '❌ Account Rejected',
      message: `Your profile has been rejected by the Placement Officer. Reason: ${req.body.reason || 'Please contact the TPO for more information.'}`,
      link: '/student/profile'
    });

    res.json({ success: true, message: 'Student rejected' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// Export both for use in other routes
module.exports = router;
module.exports.checkStudentAccess = checkStudentAccess;