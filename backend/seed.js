const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/placement_system');
  
  // Create officer account
  const hashedPassword = await bcrypt.hash('officer123', 10);
  const officer = await User.findOneAndUpdate(
    { email: 'officer@college.edu' },
    { 
      name: 'Placement Officer', 
      email: 'officer@college.edu', 
      password: hashedPassword, 
      role: 'officer', 
      isVerified: true 
    },
    { upsert: true, new: true }
  );
  
  // Create a test student
  const studentPassword = await bcrypt.hash('student123', 10);
  const student = await User.findOneAndUpdate(
    { email: 'student@college.edu' },
    { 
      name: 'Test Student', 
      email: 'student@college.edu', 
      password: studentPassword, 
      role: 'student', 
      isVerified: true,
      studentProfile: { rollNumber: '2024CS001', department: 'Computer Science', skills: ['JavaScript', 'React', 'Node.js'], currentCGPA: 8.5 }
    },
    { upsert: true, new: true }
  );
  
  console.log('✅ Seed complete!');
  console.log('');
  console.log('=== OFFICER ACCOUNT ===');
  console.log('Email: officer@college.edu');
  console.log('Password: officer123');
  console.log('');
  console.log('=== STUDENT ACCOUNT ===');
  console.log('Email: student@college.edu');
  console.log('Password: student123');
  
  await mongoose.disconnect();
}

seed().catch(console.error);
