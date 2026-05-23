const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Firebase Admin SDK - verify Firebase tokens
const admin = require('firebase-admin');

let firebaseInitialized = false;
try {
  if (admin.apps.length === 0) {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL
    };
    if (serviceAccount.projectId && serviceAccount.privateKey && serviceAccount.clientEmail) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      firebaseInitialized = true;
      console.log('✅ Firebase Admin initialized');
    }
  } else {
    firebaseInitialized = true;
  }
} catch (err) {
  console.log('⚠️ Firebase Admin not initialized:', err.message);
}

// Helper: Create JWT token for our system after Firebase verification
const createOurToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, firebaseUid: user.firebaseUid },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// ============================================
// EMAIL/PASSWORD REGISTER (via Firebase ID token)
// ============================================
const register = async (req, res) => {
  const { idToken, name, email, phone, rollNumber, department, role } = req.body;
  
  try {
    // Verify Firebase ID token
    if (!idToken) return res.status(400).json({ message: 'Firebase ID token required' });
    
    let firebaseUid, verifiedEmail;
    if (firebaseInitialized) {
      const decoded = await admin.auth().verifyIdToken(idToken);
      firebaseUid = decoded.uid;
      verifiedEmail = decoded.email;
      
      // Verify the email matches
      if (verifiedEmail !== email) {
        return res.status(400).json({ message: 'Email mismatch with Firebase token' });
      }
    } else {
      // Firebase not configured - in dev mode, accept email directly
      verifiedEmail = email;
    }

    // Check if user already exists by email or firebaseUid
    let user = await User.findOne({ email: verifiedEmail });
    
    if (user) {
      // User exists - check if they're verified or already have firebaseUid
      if (!user.firebaseUid) {
        // Link Firebase UID to existing user
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
        isVerified: true, // Firebase already verified the email
        studentProfile: { rollNumber, department }
      });
      await user.save();
    }

    const token = createOurToken(user);
    
    res.status(201).json({
      message: 'Registration successful',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Registration error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// ============================================
// GOOGLE SIGN-IN (via Firebase ID token)
// ============================================
const googleAuth = async (req, res) => {
  const { idToken, googleId, email, name, photoUrl } = req.body;
  
  try {
    // Verify Firebase ID token
    if (!idToken && !googleId) {
      return res.status(400).json({ message: 'Token or Google ID required' });
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
      // Update Firebase UID if not set
      if (!user.firebaseUid && firebaseUid) {
        user.firebaseUid = firebaseUid;
      }
      if (photoUrl) user.photoUrl = photoUrl;
      await user.save();
    }

    const token = createOurToken(user);
    
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, photoUrl: user.photoUrl }
    });
  } catch (err) {
    console.error('Google auth error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// ============================================
// LOGIN (email/password via Firebase)
// ============================================
const login = async (req, res) => {
  const { email, password, idToken } = req.body;
  
  try {
    // If Firebase ID token provided, verify it
    if (idToken && firebaseInitialized) {
      const decoded = await admin.auth().verifyIdToken(idToken);
      const firebaseUid = decoded.uid;
      
      // Find user by email or firebaseUid
      const user = await User.findOne({ 
        $or: [{ email: decoded.email }, { firebaseUid }] 
      });
      
      if (!user) {
        return res.status(404).json({ message: 'Account not found. Please register first.' });
      }

      const token = createOurToken(user);
      return res.json({
        token,
        user: { id: user._id, name: user.name, email: user.email, role: user.role }
      });
    }

    // Fallback: Simple email/password login (for testing without Firebase)
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    // For users without Firebase UID, check password
    if (user.firebaseUid && !user.password) {
      return res.status(400).json({ message: 'Please use Google Sign-in for this account' });
    }

    if (user.password) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check if student and not verified by TPO
    if (user.role === 'student' && !user.studentProfile?.verified) {
      return res.status(403).json({ message: 'Profile pending verification by TPO officer' });
    }

    const token = createOurToken(user);
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// ============================================
// GET CURRENT USER
// ============================================
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ data: { user } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ============================================
// UPDATE PROFILE
// ============================================
const updateProfile = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).select('-password');
    
    res.json({ data: { user } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { register, login, googleAuth, getMe, updateProfile };