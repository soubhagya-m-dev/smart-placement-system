import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { FaGoogle, FaEye, FaEyeSlash } from 'react-icons/fa';

export default function Register() {
  const { register, verifyOTP, googleLogin } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', role: 'student', phone: '', rollNumber: '', department: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState('');
  const [email, setEmail] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) return toast.error('Passwords do not match');
    setLoading(true);
    try {
      await register(form);
      setEmail(form.email);
      setStep(2);
      toast.success('OTP sent to your email');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await verifyOTP(email, otp);
      toast.success('Email verified! You can now login.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setLoading(true);
    try {
      const user = await googleLogin();
      toast.success(`Welcome, ${user.name}!`);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Google registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600">Join Placement Hub</h1>
          <p className="text-gray-500 mt-2">{step === 1 ? 'Create your account' : 'Verify your email'}</p>
        </div>
        {step === 1 ? (
          <>
            <form onSubmit={handleRegister} className="space-y-4">
              <input type="text" className="input" placeholder="Full Name" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              <input type="email" className="input" placeholder="Email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              <input type="tel" className="input" placeholder="Phone Number" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              {form.role === 'student' && (
                <>
                  <input type="text" className="input" placeholder="Roll Number" value={form.rollNumber} onChange={e => setForm({...form, rollNumber: e.target.value})} />
                  <select className="input" value={form.department} onChange={e => setForm({...form, department: e.target.value})}>
                    <option value="">Select Department</option>
                    <option value="Computer Science">Computer Science</option>
                    <option value="Information Technology">Information Technology</option>
                    <option value="Electronics">Electronics</option>
                    <option value="Mechanical">Mechanical</option>
                    <option value="Civil">Civil</option>
                  </select>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} className="input pr-10" placeholder="Password" required value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700">
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <div className="relative">
                  <input type={showConfirmPassword ? "text" : "password"} className="input pr-10" placeholder="Confirm Password" required value={form.confirmPassword} onChange={e => setForm({...form, confirmPassword: e.target.value})} />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700">
                    {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full py-3">{loading ? 'Creating...' : 'Create Account'}</button>
            </form>
            
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>
            
            <button 
              onClick={handleGoogleRegister} 
              disabled={loading}
              className="w-full py-3 px-4 bg-white border border-gray-300 rounded-lg shadow-sm text-gray-700 font-medium hover:bg-gray-50 flex items-center justify-center gap-2 transition-colors"
            >
              <FaGoogle className="text-red-500" />
              Sign up with Google
            </button>
          </>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <p className="text-center text-gray-600">Enter the OTP sent to <strong>{email}</strong></p>
            <input type="text" className="input text-center text-2xl tracking-widest" placeholder="000000" maxLength={6} required value={otp} onChange={e => setOtp(e.target.value)} />
            <button type="submit" disabled={loading} className="btn-primary w-full py-3">{loading ? 'Verifying...' : 'Verify OTP'}</button>
          </form>
        )}
        <p className="text-center mt-6 text-gray-500">Already have an account? <Link to="/login" className="text-blue-600 hover:underline">Sign In</Link></p>
      </div>
    </div>
  );
}