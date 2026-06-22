/**
 * Email Service using Nodemailer
 * Supports any SMTP provider (Gmail, SendGrid, Mailgun, etc.)
 */

const nodemailer = require('nodemailer');

/**
 * Create transporter based on email provider
 * Supports: SendGrid (default), Gmail SMTP, or any SMTP
 */
const createTransporter = () => {
  const provider = process.env.EMAIL_PROVIDER || 'sendgrid';

  if (provider === 'sendgrid') {
    // SendGrid: only needs API key, no username/password
    return nodemailer.createTransport({
      service: 'SendGrid',
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY
      },
      connectionTimeout: 5000,  // 5s — fail fast instead of hanging
      greetingTimeout: 5000,
      socketTimeout: 8000
    });
  }

  if (provider === 'local') {
    // MailHog - local email testing (no verification needed)
    // Run MailHog: `docker run -p 1025:1025 -p 8025:8025 mailhog/mailhog`
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '1025'),
      secure: false,
      auth: null
    });
  }

  // Fallback: custom SMTP (Gmail, etc.)
  const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.EMAIL_PORT || '587');
  const secure = process.env.EMAIL_SECURE === 'true' || port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

/**
 * Send an email
 * @param {Object} options - { to, subject, text, html }
 */
const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Placement System'}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html: html || text
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send OTP verification email
 * @param {string} email - recipient email address
 * @param {string} otp - 6-digit OTP code
 * @param {string} name - student name (optional, for personalization)
 */
const sendVerificationEmail = async (email, otp, name = 'Student') => {
  const subject = 'Verify your College Placement Account';
  
  const text = `
Hi ${name},

Your verification code is: ${otp}

This code expires in 10 minutes.

If you didn't request this, please ignore this email.

- Training & Placement Cell
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
    .container { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 600; }
    .body { padding: 30px; text-align: center; }
    .otp-box { background: #f8f9ff; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .otp { font-size: 36px; font-weight: 700; color: #667eea; letter-spacing: 8px; }
    .note { color: #888; font-size: 13px; margin-top: 15px; }
    .footer { background: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎓 Placement Portal</h1>
    </div>
    <div class="body">
      <p style="font-size: 16px; color: #333;">Hi <strong>${name}</strong>,</p>
      <p style="color: #555;">Your verification code is:</p>
      <div class="otp-box">
        <div class="otp">${otp}</div>
      </div>
      <p class="note">⏱️ This code expires in <strong>10 minutes</strong></p>
    </div>
    <div class="footer">
      Training & Placement Cell — College Placement System
    </div>
  </div>
</body>
</html>
  `.trim();

  // ALWAYS log OTP to console for local testing (regardless of EMAIL_PROVIDER)
  console.log(`\n========================================`);
  console.log(`📧 OTP for ${email}: ${otp}`);
  console.log(`========================================\n`);

  // Try to send email, but don't fail if it doesn't work
  try {
    const result = await sendEmail({ to: email, subject, text, html });
    if (result.success) {
      console.log(`✅ Email sent to ${email}`);
    } else {
      console.log(`⚠️ Email failed but OTP is shown above`);
    }
    return result;
  } catch (error) {
    console.log(`⚠️ Email error: ${error.message}. OTP is shown above.`);
    return { success: false, error: error.message };
  }
};

/**
 * Send welcome email (after OTP verification)
 */
const sendWelcomeEmail = async (email, name = 'Student') => {
  const subject = 'Welcome to College Placement Portal!';
  
  const text = `
Hi ${name},

Your account has been verified successfully!

You can now log in and complete your student profile.

- Training & Placement Cell
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
    .container { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; }
    .body { padding: 30px; text-align: center; }
    .check { font-size: 60px; }
    .footer { background: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>🎓 Placement Portal</h1></div>
    <div class="body">
      <div class="check">✅</div>
      <h2 style="color: #333;">Email Verified!</h2>
      <p style="color: #555;">Hi <strong>${name}</strong>,</p>
      <p style="color: #555;">Your account has been verified. Complete your profile to apply for placements!</p>
    </div>
    <div class="footer">Training & Placement Cell — College Placement System</div>
  </div>
</body>
</html>
  `.trim();

  return sendEmail({ to: email, subject, text, html });
};

/**
 * Send application status update email (shortlist/reject)
 */
const sendApplicationStatusEmail = async (email, name, jobTitle, companyName, status) => {
  const statusText = status === 'shortlisted' ? 'Shortlisted' : 'Rejected';
  const statusColor = status === 'shortlisted' ? '#10b981' : '#ef4444';
  const statusEmoji = status === 'shortlisted' ? '🎉' : '😔';
  
  const subject = `Application Update: ${statusText} for ${jobTitle}`;
  
  const text = `
Hi ${name},

${statusText === 'Shortlisted' 
  ? `Congratulations! You have been shortlisted for ${jobTitle} at ${companyName}.` 
  : `We regret to inform you that your application for ${jobTitle} at ${companyName} has not been shortlisted.`
}

${statusText === 'Shortlisted' 
  ? 'Our team will contact you soon with further details about the interview process.' 
  : 'Thank you for your interest. We encourage you to apply for other positions that match your profile.'
}

Best regards,
Training & Placement Cell
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
    .container { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: ${statusColor}; color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 600; }
    .body { padding: 30px; text-align: center; }
    .emoji { font-size: 60px; margin-bottom: 20px; }
    .status-badge { display: inline-block; background: ${statusColor}; color: white; padding: 8px 20px; border-radius: 20px; font-size: 14px; font-weight: 600; }
    .job-info { background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: left; }
    .job-info p { margin: 5px 0; color: #555; }
    .job-info strong { color: #333; }
    .footer { background: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${statusEmoji} Application Update</h1>
    </div>
    <div class="body">
      <div class="emoji">${statusEmoji}</div>
      <span class="status-badge">${statusText}</span>
      <p style="font-size: 16px; color: #333; margin-top: 20px;">Hi <strong>${name}</strong>,</p>
      <p style="color: #555;">
        ${statusText === 'Shortlisted' 
          ? `Congratulations! You have been <strong>shortlisted</strong> for the position.` 
          : `We regret to inform you that your application has not been shortlisted.`
        }
      </p>
      <div class="job-info">
        <p><strong>Position:</strong> ${jobTitle}</p>
        <p><strong>Company:</strong> ${companyName}</p>
        <p><strong>Status:</strong> ${statusText}</p>
      </div>
      <p style="color: #555; font-size: 14px;">
        ${statusText === 'Shortlisted' 
          ? 'Our team will contact you soon with further details.' 
          : 'Thank you for your interest. Keep checking for new opportunities.'
        }
      </p>
    </div>
    <div class="footer">
      Training & Placement Cell — College Placement System
    </div>
  </div>
</body>
</html>
  `.trim();

  return sendEmail({ to: email, subject, text, html });
};

module.exports = { sendEmail, sendVerificationEmail, sendWelcomeEmail, sendApplicationStatusEmail };