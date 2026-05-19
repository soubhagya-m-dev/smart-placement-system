const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String }, // Optional for Google auth
  googleId: { type: String }, // Google OAuth identifier
  isGoogleAuth: { type: Boolean, default: false },
  role: { type: String, enum: ['student', 'officer', 'admin'], default: 'student' },
  phone: String,
  isVerified: { type: Boolean, default: false },
  verificationOTP: { code: String, expiresAt: Date },
  studentProfile: {
    rollNumber: String, department: String, skills: [String],
    tenthMarks: Number, twelfthMarks: Number, currentCGPA: Number,
    resume: String, verified: { type: Boolean, default: false }
  },
  status: { type: String, enum: ['active', 'rejected', 'suspended'], default: 'active' },
  rejectionReason: String,
  savedJobs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Job' }]
}, { timestamps: true });
module.exports = mongoose.model('User', userSchema);
