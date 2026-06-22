import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { FaEnvelope, FaUser, FaLock, FaEye, FaEyeSlash } from 'react-icons/fa';

export default function Signup() {
  const { signup, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState('form'); // 'form' | 'otp'
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef([]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown(r => r - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendCooldown]);

  const handleSignup = async (e) => {
    e.preventDefault();
    const { name, email, password, confirmPassword } = form;

    if (!name.trim()) { toast.error('Full name is required'); return; }
    if (!email.trim()) { toast.error('Email is required'); return; }
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return; }

    setLoading(true);
    try {
      await signup(name.trim(), email.toLowerCase().trim(), password);
      toast.success('OTP sent to your email!');
      setStep('otp');
      setResendCooldown(30);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const code = otp.join('');
    if (code.length !== 6) { toast.error('Enter the full 6-digit code'); return; }
    setLoading(true);
    try {
      const user = await verifyOtp(form.email.toLowerCase().trim(), code);
      toast.success(`Welcome, ${user.name || 'Student'}!`);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed');
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    try {
      await signup(form.name, form.email, form.password);
      toast.success('OTP resent!');
      setResendCooldown(30);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (value && !/^\d$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
    if (e.key === 'Enter') handleVerifyOtp();
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const data = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (data.length === 6) {
      setOtp(data.split(''));
      otpRefs.current[5]?.focus();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">Placement Hub</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            {step === 'form' ? 'Create your student account' : 'Verify your email'}
          </p>
        </div>

        {step === 'form' && (
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
              <div className="relative">
                <FaUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                <input type="text" className="input pl-9" placeholder="John Doe" required
                  value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <div className="relative">
                <FaEnvelope className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                <input type="email" className="input pl-9" placeholder="your@email.com" required
                  value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
              <div className="relative">
                <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                <input type={showPassword ? 'text' : 'password'} className="input pl-9 pr-10" placeholder="At least 6 characters" required
                  value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700">
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm Password</label>
              <div className="relative">
                <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                <input type={showConfirm ? 'text' : 'password'} className="input pl-9 pr-10" placeholder="Repeat password" required
                  value={form.confirmPassword} onChange={e => setForm({...form, confirmPassword: e.target.value})} />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700">
                  {showConfirm ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="btn-primary w-full py-3 text-base">
              {loading ? 'Sending OTP...' : 'Create Account'}
            </button>

            <p className="text-center text-sm text-gray-600 dark:text-gray-400">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">Sign in</Link>
            </p>
          </form>
        )}

        {step === 'otp' && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center mx-auto mb-3">
                <FaEnvelope className="text-blue-600 dark:text-blue-400 text-xl" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Enter the 6-digit code sent to<br />
                <strong className="text-gray-800 dark:text-gray-200">{form.email}</strong>
              </p>
            </div>

            <div className="flex justify-center gap-2 py-4" onPaste={handleOtpPaste}>
              {otp.map((digit, i) => (
                <input key={i}
                  ref={el => otpRefs.current[i] = el}
                  type="text" inputMode="numeric" maxLength={1}
                  value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  className="w-11 h-12 text-center text-lg font-bold border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              ))}
            </div>

            <button onClick={handleVerifyOtp} disabled={loading || otp.join('').length !== 6}
              className="btn-primary w-full py-3 text-base">
              {loading ? 'Verifying...' : 'Verify & Create Account'}
            </button>

            <div className="text-center text-sm">
              {resendCooldown > 0 ? (
                <span className="text-gray-400 dark:text-gray-500">Resend in {resendCooldown}s</span>
              ) : (
                <button onClick={handleResend} disabled={loading}
                  className="text-blue-600 dark:text-blue-400 hover:underline">
                  Resend code
                </button>
              )}
            </div>

            <button onClick={() => setStep('form')}
              className="w-full text-sm text-gray-500 dark:text-gray-400 hover:underline">
              Change details
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
