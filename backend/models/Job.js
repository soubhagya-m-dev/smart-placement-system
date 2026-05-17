const mongoose = require('mongoose');
const jobSchema = new mongoose.Schema({
  title: { type: String, required: true }, companyName: { type: String, required: true },
  location: String, jobType: { type: String, enum: ['full-time', 'internship', 'part-time'], default: 'full-time' },
  description: String, salary: { min: Number, max: Number },
  requiredSkills: [String], qualification: [String],
  vacancies: { type: Number, default: 1 }, applicationDeadline: Date,
  status: { type: String, enum: ['active', 'closed'], default: 'active' },
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
module.exports = mongoose.model('Job', jobSchema);
