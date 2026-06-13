const mongoose = require('mongoose');
const applicationSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'shortlisted', 'accepted', 'rejected'], default: 'pending' },
  // CTC the placement officer actually offered this student (in LPA), parsed from the
  // offer-letter notification's `metadata.ctc` string. Powers the "Avg Package" KPI on
  // the officer analytics page. Null until an offer letter is sent.
  offeredCtc: { type: Number, default: null },
  appliedAt: { type: Date, default: Date.now }
}, { timestamps: true });
applicationSchema.index({ job: 1, student: 1 }, { unique: true });
module.exports = mongoose.model('Application', applicationSchema);
