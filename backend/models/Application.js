const mongoose = require('mongoose');
const applicationSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'shortlisted', 'accepted', 'rejected'], default: 'pending' },
  appliedAt: { type: Date, default: Date.now }
}, { timestamps: true });
applicationSchema.index({ job: 1, student: 1 }, { unique: true });
module.exports = mongoose.model('Application', applicationSchema);
