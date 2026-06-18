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
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          // Surfaced so the frontend can redirect the student to the
          // change-password screen before letting them into the app.
          mustChangePassword: !!user.mustChangePassword
        }
      }
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

    res.json({
      success: true,
      data: {
        user: {
          ...user.toObject(),
          mustChangePassword: !!user.mustChangePassword,
          // Decorate: prefer the profile values the student typed, fall back
          // to the Gmail-derived top-level fields for accounts that haven't
          // filled out their profile yet.
          name: user.studentProfile?.fullName || user.name,
          email: user.studentProfile?.email || user.email,
        }
      }
    });
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
        'universityRollNumber', 'universityRegistrationNumber', 'collegeId',
        'admissionType', 'fullName', 'stream', 'section', 'gender',
        'dateOfBirth', 'tenthBoard', 'tenthPercentage', 'tenthPassingYear',
        'twelfthBoard', 'twelfthPercentage', 'twelfthPassingYear',
        'contactNumber', 'currentCGPA', 'numberOfBacklog',
        'graduationPassingYear'
      ];
      const missingFields = requiredFields.filter(
        f => p[f] === undefined || p[f] === null || p[f] === ''
      );
      // Field-format checks (apply to all save paths, not just first-save)
      const formatErrors = [];
      if (p.universityRollNumber !== undefined && p.universityRollNumber !== null && p.universityRollNumber !== '') {
        if (!/^\d{11}$/.test(String(p.universityRollNumber))) formatErrors.push('universityRollNumber must be exactly 11 digits');
      }
      if (p.universityRegistrationNumber !== undefined && p.universityRegistrationNumber !== null && p.universityRegistrationNumber !== '') {
        if (!/^\d{12}$/.test(String(p.universityRegistrationNumber))) formatErrors.push('universityRegistrationNumber must be exactly 12 digits');
      }
      if (p.contactNumber !== undefined && p.contactNumber !== null && p.contactNumber !== '') {
        if (!/^\d{10}$/.test(String(p.contactNumber))) formatErrors.push('contactNumber must be exactly 10 digits');
      }
      if (p.collegeId !== undefined && p.collegeId !== null && p.collegeId !== '') {
        if (!/^DSC\d{8}$/i.test(String(p.collegeId))) formatErrors.push('collegeId must be DSC followed by 8 digits');
      }
      if (p.tenthPercentage !== undefined && p.tenthPercentage !== null && p.tenthPercentage !== '') {
        const pct = Number(p.tenthPercentage);
        if (isNaN(pct) || pct < 30 || pct > 100) formatErrors.push('tenthPercentage must be between 30 and 100');
      }
      if (p.twelfthPercentage !== undefined && p.twelfthPercentage !== null && p.twelfthPercentage !== '') {
        const pct = Number(p.twelfthPercentage);
        if (isNaN(pct) || pct < 30 || pct > 100) formatErrors.push('twelfthPercentage must be between 30 and 100');
      }
      // CGPA range check (skipped when a backlog is reported — backlog forces CGPA=0)
      const hasBacklog = Number(p.numberOfBacklog) > 0;
      if (!hasBacklog && p.currentCGPA !== undefined && p.currentCGPA !== null && p.currentCGPA !== '') {
        const cgpa = Number(p.currentCGPA);
        if (isNaN(cgpa) || cgpa < 4 || cgpa > 10) formatErrors.push('currentCGPA must be between 4 and 10');
      }
      const isProfileComplete = missingFields.length === 0 && formatErrors.length === 0;

      // Decide hard-fail vs soft-fail:
      //   First save  → studentProfile.isProfileComplete is false AND not yet verified.
      //                 Block the save entirely if anything is missing — student must
      //                 fill everything before officer review is even possible.
      //   Edit        → already-complete profile, or rejected and resubmitting.
      //                 Save as a draft so they don't lose their work.
      const existing = await User.findById(decoded.id).select('studentProfile.isProfileComplete studentProfile.verified status');
      const isFirstSave =
        !existing?.studentProfile?.isProfileComplete &&
        !existing?.studentProfile?.verified;

      if (isFirstSave && !isProfileComplete) {
        return res.status(400).json({
          success: false,
          code: 'PROFILE_INCOMPLETE',
          message: 'Please fill all the required fields before saving your profile for verification.',
          missingFields,
          formatErrors
        });
      }

      // Reject any save (first or edit) if format is wrong — no partial writes.
      if (formatErrors.length > 0) {
        return res.status(400).json({
          success: false,
          code: 'PROFILE_INVALID',
          message: formatErrors[0],
          formatErrors
        });
      }

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

// ============================================
// CREATE STUDIENT (officer/admin only, no Firebase)
// Officer provides name, email, password → student account is created
// without going through the Firebase signup flow. The student then logs
// in with email + password and completes their own profile.
// ============================================
const officerOrAdminAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || (user.role !== 'officer' && user.role !== 'admin')) {
      return res.status(403).json({ success: false, message: 'Officer or admin only' });
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// Generates a random 8-char password with at least one letter and one digit.
// Used when officer leaves the password field blank in the "Add Student"
// form — the generated password is shown to the officer exactly once
// so they can share it with the student, then cleared from the user
// doc the moment the student changes it.
const generateTempPassword = () => {
  const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';
  const digits = '23456789';
  const all = letters + digits;
  let pw = '';
  // guarantee at least one letter and one digit so it passes any
  // reasonable "must contain letter + number" rule the student might
  // be told about later
  pw += letters[Math.floor(Math.random() * letters.length)];
  pw += digits[Math.floor(Math.random() * digits.length)];
  for (let i = 0; i < 6; i++) {
    pw += all[Math.floor(Math.random() * all.length)];
  }
  return pw;
};

router.post('/create-student', officerOrAdminAuth, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and email are required' });
    }

    // Basic email shape check — keep it loose, just blocks obvious garbage
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    // Reject if a user with this email already exists — keeps the flow
    // predictable (officer can't accidentally create a duplicate that
    // would later fail at login). The officer can re-use the existing
    // account or delete it first.
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `An account with email ${email} already exists (role: ${existing.role})`
      });
    }

    // Use the officer-supplied password if they typed one, otherwise
    // generate a temp one. Either way, mustChangePassword=true so the
    // student is forced to set their own on first login.
    const finalPassword = (password && password.length >= 6) ? password : generateTempPassword();
    const wasGenerated = !(password && password.length >= 6);
    const hashed = await bcrypt.hash(finalPassword, 10);

    const student = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashed,
      role: 'student',
      isVerified: true,
      mustChangePassword: true,
      // Store the plain temp password so we can return it to the officer
      // in THIS response (the only time it's ever readable). Cleared by
      // /change-password the first time the student updates it.
      tempPassword: finalPassword,
      studentProfile: {
        isProfileComplete: false
      }
    });

    res.status(201).json({
      success: true,
      message: 'Student account created',
      data: {
        student: {
          id: student._id,
          name: student.name,
          email: student.email,
          role: student.role,
          mustChangePassword: student.mustChangePassword
        },
        // Returned exactly once — the officer must save/share it now.
        // NOT stored in plaintext anywhere except in the response and in
        // the user doc's tempPassword field (cleared on first change).
        temporaryPassword: finalPassword,
        passwordWasGenerated: wasGenerated
      }
    });
  } catch (error) {
    console.error('create-student error:', error.message);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Email already in use' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// CHANGE PASSWORD
// Authenticated student changes their own password. Used both for the
// forced-first-login flow (mustChangePassword=true) and for ordinary
// password updates later. Clears the temp password and the
// mustChangePassword flag on success.
// ============================================
router.post('/change-password', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    // Pull the user WITH the password fields so we can verify the
    // current password and overwrite it. The default `select: false`
    // on `password` and `tempPassword` would otherwise hide them.
    const user = await User.findById(decoded.id).select('+password +tempPassword');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // If the user is in the forced-change flow, require them to pass
    // the current (temp) password so a hijacked session still can't
    // silently reset it. For ordinary users the same rule applies —
    // they must know their current password to change it.
    if (!currentPassword) {
      return res.status(400).json({ success: false, message: 'Current password is required' });
    }
    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ success: false, message: 'New password must be different from current password' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.mustChangePassword = false;
    user.tempPassword = null;
    await user.save();

    // Return the fresh user so the frontend can refresh its context
    // and the forced-password-change modal can dismiss immediately.
    // The wrapper in AuthContext calls setUser() with this payload.
    res.json({
      success: true,
      message: 'Password changed successfully',
      data: {
        user: user.toObject(),
        tempPasswordCleared: true,
      },
    });
  } catch (error) {
    console.error('change-password error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;