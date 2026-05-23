import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { signInWithGoogle } from '../firebase/config';

const API_URL = import.meta.env.VITE_API_URL || 'https://placement-backend-sq0p.onrender.com';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      axios.get(`${API_URL}/api/auth/me`)
        .then(res => setUser(res.data.data.user))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await axios.post(`${API_URL}/api/auth/login`, { email, password });
    const { token, user: userData } = res.data.data;
    localStorage.setItem('token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(userData);
    return userData;
  };

  const googleLogin = async () => {
    const result = await signInWithGoogle();
    const idToken = await result.user.getIdToken();
    
    const res = await axios.post(`${API_URL}/api/auth/google`, {
      googleId: result.user.uid,
      email: result.user.email,
      name: result.user.displayName,
      photoUrl: result.user.photoURL,
      idToken
    });
    
    const { token, user: userData } = res.data.data;
    localStorage.setItem('token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(userData);
    return userData;
  };

  const register = async (data) => {
    const res = await axios.post(`${API_URL}/api/auth/register`, data);
    return res.data;
  };

  const verifyOTP = async (email, otp) => {
    const res = await axios.post(`${API_URL}/api/auth/verify-otp`, { email, otp });
    const { token, user: userData } = res.data.data;
    localStorage.setItem('token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const updateProfile = async (data) => {
    const res = await axios.patch(`${API_URL}/api/auth/profile`, data);
    setUser(res.data.data.user);
    return res.data;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, googleLogin, register, verifyOTP, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
