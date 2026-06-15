import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { FaGoogle, FaEye, FaEyeSlash, FaUserShield } from 'react-icons/fa';

export default function Login() {
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back, ${user.name}!`);
      navigate('/');
    } catch (err) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    // Redirect flow: signInWithRedirect navigates the whole page to Google.
    // The result is picked up on the next page load (see AuthContext useEffect).
    // We don't await a user here — googleLogin() resolves once the redirect
    // has been initiated, and the rest of the login (token + redirect to /)
    // happens after the user comes back from Google.
    setLoading(true);
    try {
      await googleLogin();
      // On success the page navigates away — code below never runs.
    } catch (err) {
      toast.error(err.message || 'Google login failed');
    } finally {
      // If we're still on this page (redirect didn't fire — e.g. unauthorized
      // domain), reset loading so the button isn't stuck disabled.
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600">Placement Hub</h1>
          <p className="text-gray-500 mt-2">College Placement Management System</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" className="input" placeholder="your@email.com" required value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input type={showPassword ? "text" : "password"} className="input pr-10" placeholder="••••••••" required value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700">
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-3">{loading ? 'Signing in...' : 'Sign In'}</button>
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
          onClick={handleGoogleLogin} 
          disabled={loading}
          className="w-full py-3 px-4 bg-white border border-gray-300 rounded-lg shadow-sm text-gray-700 font-medium hover:bg-gray-50 flex items-center justify-center gap-2 transition-colors"
        >
          <FaGoogle className="text-red-500" />
          Sign in with Google
        </button>
        <p className="text-center mt-6 text-gray-500 text-sm">
          Accounts are created by your placement officer. Contact them if you can't sign in.
        </p>
        <div className="mt-4 pt-4 border-t border-gray-200 text-center">
          <Link to="/admin-login" className="text-sm text-blue-600 hover:underline flex items-center justify-center gap-1">
            <FaUserShield className="text-xs" /> Admin / Placement Officer Login
          </Link>
        </div>
      </div>
    </div>
  );
}
