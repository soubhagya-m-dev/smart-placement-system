const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String }, // Optional for Google/Firebase auth
  firebaseUid: { type: String }, // Firebase UID
  photoUrl: { type: String }, // Profile photo from Google/Firebase
  role: { type: String, enum: ['student', 'officer', 'admin'], default: 'student' },
  phone: String,
  isVerified: { type: Boolean, default: true }, // Firebase verifies email automatically
  verificationOTP: { code: String, expiresAt: Date },
  studentProfile: {
    universityRollNumber: { type: String },
    universityRegistrationNumber: { type: String },
    collegeId: { type: String },
    admissionType: { type: String },
    fullName: String,
    stream: { type: String },
    section: { type: String },
    gender: { type: String },
    dateOfBirth: String,
    tenthBoard: { type: String },
    tenthMedium: { type: String },
    tenthPercentage: { type: Number },
    tenthPassingYear: Number,
    twelfthBoard: { type: String },
    twelfthMedium: { type: String },
    twelfthPercentage: { type: Number },
    twelfthPassingYear: Number,
    contactNumber: String,
    currentCGPA: Number,
    numberOfBacklog: { type: Number },
    skills: [String],
    tenthMarks: Number,
    twelfthMarks: Number,
    resume: String,
    verified: { type: Boolean, default: false },
    isProfileComplete: { type: Boolean, default: false }
  },
  // Flattened fields for easier querying
  universityRollNo: String,
  rollNo: String,
  department: String,
  cgpa: Number,
  class12Percentage: Number,
  class10Percentage: Number,
  category: String,
  aadharCard: String,
  address: String,
  fatherName: String,
  motherName: String,
  emergencyContact: String,
  annualIncome: String,
  status: { type: String, enum: ['active', 'rejected', 'suspended'], default: 'active' },
  rejectionReason: String,
  savedJobs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Job' }]
}, { timestamps: true });
module.exports = mongoose.model('User', userSchema);