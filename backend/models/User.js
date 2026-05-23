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
      universityRollNumber: { type: String, minlength: 11, maxlength: 11 },
      universityRegistrationNumber: { type: String, minlength: 12, maxlength: 14 },
      collegeId: { type: String, minlength: 11, maxlength: 12 },
      admissionType: { type: String, enum: ['Regular 4-year', 'Lateral 3-year'] },
      fullName: String,
      stream: { type: String, enum: ['CSE', 'CSE(AI&ML)', 'AUE', 'Civil', 'ECE', 'EE', 'ME', 'Robotics'] },
      section: { type: String, enum: ['A', 'B', 'C', 'D', 'E'] },
      gender: { type: String, enum: ['Male', 'Female'] },
      dateOfBirth: String,
      tenthBoard: { type: String, enum: ['CBSE', 'ICSE', 'State board'] },
      tenthMedium: { type: String, enum: ['bengali', 'english', 'hindi', 'other'] },
      tenthPercentage: { type: Number, min: 30, max: 100 },
      tenthPassingYear: Number,
      twelfthBoard: { type: String, enum: ['CBSE', 'ISC', 'State board'] },
      twelfthMedium: { type: String, enum: ['bengali', 'english', 'hindi', 'other'] },
      twelfthPercentage: { type: Number, min: 30, max: 100 },
      twelfthPassingYear: Number,
      contactNumber: String,
      currentCGPA: Number,
      numberOfBacklog: { type: Number, min: 0, max: 10 },
      skills: [String],
      tenthMarks: Number,
      twelfthMarks: Number,
      resume: String,
      verified: { type: Boolean, default: false },
      isProfileComplete: { type: Boolean, default: false }
    },
  status: { type: String, enum: ['active', 'rejected', 'suspended'], default: 'active' },
  rejectionReason: String,
  savedJobs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Job' }]
}, { timestamps: true });
module.exports = mongoose.model('User', userSchema);
