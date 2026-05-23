const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');

  // Create admin account
  const adminPassword = await bcrypt.hash('admin123', 10);
  await User.findOneAndUpdate(
    { email: 'admin@placement.com' },
    { 
      name: 'Admin', 
      email: 'admin@placement.com', 
      password: adminPassword, 
      role: 'admin', 
      isVerified: true 
    },
    { upsert: true, new: true }
  );
  console.log('✅ Admin account created');

  // Create placement officer account
  const officerPassword = await bcrypt.hash('officer123', 10);
  await User.findOneAndUpdate(
    { email: 'officer@placement.com' },
    { 
      name: 'Placement Officer', 
      email: 'officer@placement.com', 
      password: officerPassword, 
      role: 'officer', 
      isVerified: true 
    },
    { upsert: true, new: true }
  );
  console.log('✅ Placement Officer account created');

  // Create a test student
  const studentPassword = await bcrypt.hash('student123', 10);
  await User.findOneAndUpdate(
    { email: 'student@placement.com' },
    { 
      name: 'Test Student', 
      email: 'student@placement.com', 
      password: studentPassword, 
      role: 'student', 
      isVerified: true,
      studentProfile: { 
        rollNumber: '2024CS001', 
        department: 'Computer Science', 
        skills: ['JavaScript', 'React', 'Node.js'], 
        currentCGPA: 8.5 
      }
    },
    { upsert: true, new: true }
  );
  console.log('✅ Test student account created');

  console.log('\n=== ACCOUNTS CREATED ===');
  console.log('');
  console.log('👤 ADMIN:');
  console.log('   Email: admin@placement.com');
  console.log('   Password: admin123');
  console.log('');
  console.log('👤 PLACEMENT OFFICER:');
  console.log('   Email: officer@placement.com');
  console.log('   Password: officer123');
  console.log('');
  console.log('👤 STUDENT:');
  console.log('   Email: student@placement.com');
  console.log('   Password: student123');
  console.log('');

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB');
}

seed().catch(err => {
  console.error('Seed error:', err.message);
  process.exit(1);
});