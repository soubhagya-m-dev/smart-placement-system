const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  officer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
  application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application' },
  
  // Type: interview, exam, offer_letter, rejection, status_update, general
  type: { type: String, required: true, default: 'general' },
  
  // Structured data based on type
  title: { type: String, required: true },
  message: { type: String },
  
  // Type-specific metadata
  metadata: {
    // For interview
    interviewDate: Date,
    interviewTime: String,
    interviewLocation: String,
    interviewMode: { type: String, enum: ['virtual', 'in-person', 'phone'] },
    interviewLink: String,
    panelInfo: String,
    
    // For exam
    examDate: Date,
    examTime: String,
    examDuration: String,
    examMode: { type: String, enum: ['online', 'offline'] },
    examLocation: String,
    
    // For offer letter
    ctc: String,
    role: String,
    joiningDate: Date,
    documentsRequired: [String],
    
    // For rejection
    reason: String,
    
    // For status update
    previousStatus: String,
    newStatus: String,
    
    // Generic additional data
    additionalData: mongoose.Schema.Types.Mixed
  },
  
  read: { type: Boolean, default: false },

  // Event date for student timeline tracking
  eventDate: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
