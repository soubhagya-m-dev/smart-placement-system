const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const admin = require('firebase-admin');

// Initialize Firebase Admin
let firebaseInitialized = false;
try {
  if (admin.apps.length === 0 && process.env.FIREBASE_PROJECT_ID) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL
      })
    });
    firebaseInitialized = true;
    console.log('✅ Firebase Admin initialized');
  } else if (admin.apps.length > 0) {
    firebaseInitialized = true;
  }
} catch (err) {
  console.log('⚠️ Firebase Admin not initialized:', err.message);
}

// Helper: Create JWT token
const createToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Helper: Kick off a deadline reminder scan for one user, fire-and-forget.
// Called after a successful student login so any reminders that should
// have fired while the server was asleep (Render free tier sleeps after
// 15min idle) get flushed the moment a student actually uses the app.
//
// We schedule via `setImmediate` so the scan doesn't run on the same
// tick as the login response — that would add latency to the response.
// We never `await` it from the login handler, so even if the scan
// throws, the login response is unaffected.
const { runDeadlineReminderScan } = require('../services/deadlineReminders');
function triggerReminderScanForUser(_userId) {
  setImmediate(async () => {
    try {
      // Currently the scan is a "scan everyone" job, not a per-user
      // job. That's fine: the dedupe key (per student, per job, per
      // day) keeps the work bounded — most students will get zero new
      // rows, and the cost is one User.find + one Application.find
      // per *job in the 3-day window*, which is tiny in the steady
      // state. If this ever gets hot, swap to a per-user scan that
      // hits User.savedJobs first.
      await runDeadlineReminderScan();
    } catch (err) {
      console.error('[deadline-reminders] login-triggered scan failed:', err.message);
    }
  });
}

// ============================================
// REGISTER (email/password via Firebase)
// ============================================
router.post('/register', async (req, res) => {
  try {
    const { idToken, name, email, phone, rollNumber, department, role } = req.body;
    
    if (!idToken) return res.status(400).json({ success: false, message: 'Firebase ID token required' });
    
    let firebaseUid, verifiedEmail;
    
    if (firebaseInitialized) {
      const decoded = await admin.auth().verifyIdToken(idToken);
      firebaseUid = decoded.uid;
      verifiedEmail = decoded.email;
      
      if (verifiedEmail !== email) {
        return res.status(400).json({ success: false, message: 'Email mismatch with Firebase token' });
      }
    } else {
      // Dev mode - accept email directly
      verifiedEmail = email;
      firebaseUid = 'dev-' + email;
    }

    // Check if user already exists
    let user = await User.findOne({ email: verifiedEmail });
    
    if (user) {
      // Link Firebase UID if not already linked
      if (!user.firebaseUid) {
        user.firebaseUid = firebaseUid;
        if (name) user.name = name;
        await user.save();
      }
    } else {
      // Create new user
      user = new User({
        name: name || verifiedEmail.split('@')[0],
        email: verifiedEmail,
        phone,
        role: role || 'student',
        firebaseUid,
        isVerified: true, // Firebase verified the email
        studentProfile: { rollNumber, department }
      });
      await user.save();
    }

    const token = createToken(user);
    
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error('Register error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// GOOGLE SIGN-IN
// ============================================
router.post('/google', async (req, res) => {
  try {
    const { idToken, googleId, email, name, photoUrl } = req.body;
    
    if (!idToken && !googleId) {
      return res.status(400).json({ success: false, message: 'Token or Google ID required' });
    }

    let firebaseUid = googleId;
    let verifiedEmail = email;

    if (firebaseInitialized && idToken) {
      const decoded = await admin.auth().verifyIdToken(idToken);
      firebaseUid = decoded.uid;
      verifiedEmail = decoded.email;
    }

    // Find or create user
    let user = await User.findOne({ 
      $or: [{ email: verifiedEmail }, { firebaseUid }] 
    });

    if (!user) {
      user = new User({
        name: name || verifiedEmail.split('@')[0],
        email: verifiedEmail,
        photoUrl,
        firebaseUid,
        isVerified: true,
        role: 'student',
        studentProfile: {}
      });
      await user.save();
    } else {
      if (!user.firebaseUid && firebaseUid) {
        user.firebaseUid = firebaseUid;
      }
      if (photoUrl) user.photoUrl = photoUrl;
      await user.save();
    }

    const token = createToken(user);
    
    res.json({
      success: true,
      data: { token, user: { id: user._id, name: user.name, email: user.email, role: user.role, photoUrl: user.photoUrl } }
    });
  } catch (error) {
    console.error('Google auth error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// ADMIN LOGIN (direct email/password - no Firebase)
// ============================================
router.post('/admin-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    
    // Check if user has a password (seed accounts do)
    if (!user.password) {
      return res.status(400).json({ success: false, message: 'Please use Google Sign-in for this account' });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = createToken(user);
    res.json({
      success: true,
      data: { token, user: { id: user._id, name: user.name, email: user.email, role: user.role } }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// LOGIN (Firebase token or email/password)
// ============================================
router.post('/login', async (req, res) => {
  try {
    const { email, password, idToken } = req.body;
    
    // Firebase ID token provided
    if (idToken && firebaseInitialized) {
      const decoded = await admin.auth().verifyIdToken(idToken);
      
      const user = await User.findOne({ 
        $or: [{ email: decoded.email }, { firebaseUid: decoded.uid }] 
      });
      
      if (!user) {
        return res.status(404).json({ success: false, message: 'Account not found. Please register first.' });
      }

      const token = createToken(user);
      // Fire-and-forget deadline reminder scan. We don't await it so the
      // login response is snappy. Any pending reminders get sent in the
      // background and the student will see them on their next bell badge
      // refresh. Wrapped in a try/catch + setImmediate so an error here
      // can never bubble back to the login promise chain.
      triggerReminderScanForUser(user._id);
      return res.json({
        success: true,
        data: { token, user: { id: user._id, name: user.name, email: user.email, role: user.role } }
      });
    }

    // Email/password login (fallback for testing without Firebase)
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    // Users with Firebase but no password should use Google sign-in
    if (user.firebaseUid && !user.password) {
      return res.status(400).json({ success: false, message: 'Please use Google Sign-in for this account' });
    }

    if (user.password) {
      const isMatch = await require('bcryptjs').compare(password, user.password);
      if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = createToken(user);
    triggerReminderScanForUser(user._id);
    res.json({
      success: true,
      data: { token, user: { id: user._id, name: user.name, email: user.email, role: user.role } }
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// GET CURRENT USER
// ============================================
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    res.json({ success: true, data: { user } });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

// ============================================
// UPDATE PROFILE
// ============================================
router.patch('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const { name, phone, studentProfile } = req.body;
    
    if (studentProfile) {
      const p = studentProfile;
      const requiredFields = [
        p.universityRollNumber, p.universityRegistrationNumber, p.collegeId,
        p.admissionType, p.fullName, p.stream, p.section, p.gender,
        p.dateOfBirth, p.tenthBoard, p.tenthPercentage, p.tenthPassingYear,
        p.twelfthBoard, p.twelfthPercentage, p.twelfthPassingYear,
        p.contactNumber, p.currentCGPA, p.numberOfBacklog
      ];
      const isProfileComplete = requiredFields.every(f => f !== undefined && f !== null && f !== '');
      
      // Explicitly set each field including isProfileComplete
      // Also reset status to 'active' if student is updating their profile (allows re-verification after rejection)
      const updateFields = {
        'studentProfile.universityRollNumber': studentProfile.universityRollNumber,
        'studentProfile.universityRegistrationNumber': studentProfile.universityRegistrationNumber,
        'studentProfile.collegeId': studentProfile.collegeId,
        'studentProfile.admissionType': studentProfile.admissionType,
        'studentProfile.fullName': studentProfile.fullName,
        'studentProfile.stream': studentProfile.stream,
        'studentProfile.section': studentProfile.section,
        'studentProfile.gender': studentProfile.gender,
        'studentProfile.dateOfBirth': studentProfile.dateOfBirth,
        'studentProfile.tenthBoard': studentProfile.tenthBoard,
        'studentProfile.tenthMedium': studentProfile.tenthMedium,
        'studentProfile.tenthPercentage': studentProfile.tenthPercentage,
        'studentProfile.tenthPassingYear': studentProfile.tenthPassingYear,
        'studentProfile.twelfthBoard': studentProfile.twelfthBoard,
        'studentProfile.twelfthMedium': studentProfile.twelfthMedium,
        'studentProfile.twelfthPercentage': studentProfile.twelfthPercentage,
        'studentProfile.twelfthPassingYear': studentProfile.twelfthPassingYear,
        'studentProfile.contactNumber': studentProfile.contactNumber,
        'studentProfile.currentCGPA': studentProfile.currentCGPA,
        'studentProfile.numberOfBacklog': studentProfile.numberOfBacklog,
        'studentProfile.graduationPassingYear': studentProfile.graduationPassingYear,
        'studentProfile.skills': studentProfile.skills,
        'studentProfile.isProfileComplete': isProfileComplete,
        'studentProfile.verified': false, // Reset verification when student updates profile
        'status': 'active', // Reset status so student can be re-verified
        name, phone
      };
      
      const user = await User.findByIdAndUpdate(
        decoded.id,
        { $set: updateFields },
        { new: true }
      ).select('-password');
      
      return res.json({ success: true, data: { user } });
    }
    
    const user = await User.findByIdAndUpdate(
      decoded.id,
      { name, phone },
      { new: true }
    ).select('-password');
    
    res.json({ success: true, data: { user } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;