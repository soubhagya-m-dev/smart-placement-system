const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const register = async (req, res) => {
  const { name, email, password, role, phone, rollNumber, department } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, salt);

    const user = new User({
      name,
      email,
      password: hashedPassword,
      role: role || 'student',
      phone,
      studentProfile: { rollNumber, department },
      verificationOTP: { code: hashedOtp, expiresAt: new Date(Date.now() + 10 * 60 * 1000) } // 10 mins
    });

    await user.save();

    // In production, send email. For now, log it.
    console.log(`\n🟢 OTP for ${email}: ${otp}\n`);

    res.status(201).json({ message: 'Registration successful. Please verify your OTP.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const verifyOTP = async (req, res) => {
  const { email, otp } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    if (user.isVerified) return res.status(400).json({ message: 'User already verified' });

    const isValidOtp = await bcrypt.compare(otp, user.verificationOTP.code);
    if (!isValidOtp) return res.status(400).json({ message: 'Invalid or expired OTP' });

    user.isVerified = true;
    user.verificationOTP = undefined;
    await user.save();

    res.status(200).json({ message: 'Verification successful' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    if (!user.isVerified) return res.status(401).json({ message: 'Please verify your account first' });
    if (user.role === 'student' && !user.studentProfile.verified) return res.status(403).json({ message: 'Profile pending verification by officer' });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { register, verifyOTP, login };