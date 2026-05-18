const mongoose = require('mongoose');
const jobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  companyName: { type: String, required: true },
  location: String, 
  jobType: { type: String, enum: ['full-time', 'internship', 'part-time'], default: 'full-time' },
  description: String, 
  salary: { min: { type: Number, default: 0 }, max: { type: Number, default: 0 } },
  requiredSkills: [String], 
  qualification: [String],
  eligibility: {
    minCGPA: { type: Number, min: 4, max: 10 },
    class12Percentage: { type: Number, min: 0, max: 100 },
    class10Percentage: { type: Number, min: 0, max: 100 }
  },
  vacancies: { type: Number, default: 1 }, 
  applicationDeadline: Date,
  status: { type: String, enum: ['active', 'closed'], default: 'active' },
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
module.exports = mongoose.model('Job', jobSchema);
