import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  updateProfile
} from 'firebase/auth';
import { auth } from '../firebase/config';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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

    // Handle Google redirect result on app load.
    // signInWithRedirect() navigates the whole page to Google, then back.
    // getRedirectResult() picks up the credential after the return trip.
    getRedirectResult(auth).then(async (result) => {
      if (!result) return;
      try {
        const idToken = await result.user.getIdToken();
        const res = await axios.post(`${API_URL}/api/auth/google`, {
          idToken,
          googleId: result.user.uid,
          email: result.user.email,
          name: result.user.displayName,
          photoUrl: result.user.photoURL
        });
        const { token } = res.data.data;
        localStorage.setItem('token', token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        const meRes = await axios.get(`${API_URL}/api/auth/me`);
        setUser(meRes.data.data.user);
      } catch (err) {
        console.error('Google redirect login failed:', err);
      }
    }).catch(err => {
      console.error('getRedirectResult error:', err);
    });
  }, []);

  // ============================================
  // REGISTER with Firebase Email/Password
  // ============================================
  const register = async ({ name, email, password, phone, rollNumber, department, role }) => {
    try {
      // Create Firebase account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();
      
      // Update display name in Firebase
      await updateProfile(userCredential.user, { displayName: name });

      // Send Firebase token to our backend
      const res = await axios.post(`${API_URL}/api/auth/register`, {
        idToken,
        name,
        email: userCredential.user.email,
        phone,
        rollNumber,
        department,
        role: role || 'student'
      });

      const { token, user: userData } = res.data.data;
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(userData);
      
      return res.data;
    } catch (error) {
      // Parse Firebase errors
      const errorMessage = formatFirebaseError(error.code);
      throw new Error(errorMessage);
    }
  };

  // ============================================
  // LOGIN
  // Two paths:
  //  1. Backend email/password (officer-created accounts have no Firebase)
  //  2. Firebase email/password (legacy self-signup accounts)
  // We try backend first because Firebase will throw auth/user-not-found for
  // officer-created students. If the backend says "use Google" or the
  // account isn't a password account, we fall through to Firebase.
  // ============================================
  const login = async (email, password) => {
    // ----- Path 1: backend email/password -----
    try {
      const res = await axios.post(`${API_URL}/api/auth/login`, { email, password });
      const { token, user: userData } = res.data.data;
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // /login only returns the slim user — fetch the full record so
      // dashboards (especially studentProfile.*) get populated.
      const meRes = await axios.get(`${API_URL}/api/auth/me`);
      setUser(meRes.data.data.user);
      return meRes.data.data.user;
    } catch (backendErr) {
      // If the backend explicitly said "use Google", don't bother with
      // Firebase email/password — surface that message directly.
      const msg = backendErr?.response?.data?.message || '';
      if (msg.toLowerCase().includes('google sign-in')) throw new Error(msg);

      // Otherwise (account-not-found / invalid creds), fall through to
      // Firebase in case the user is a legacy self-signup account.
    }

    // ----- Path 2: Firebase email/password -----
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();

      const res = await axios.post(`${API_URL}/api/auth/login`, { email, idToken });
      const { token } = res.data.data;
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      const meRes = await axios.get(`${API_URL}/api/auth/me`);
      setUser(meRes.data.data.user);
      return meRes.data.data.user;
    } catch (error) {
      const errorMessage = formatFirebaseError(error.code);
      throw new Error(errorMessage);
    }
  };

  // ============================================
  // GOOGLE SIGN-IN (redirect flow — production-safe)
  // signInWithRedirect navigates the whole page to Google, so we can't
  // await the result here. The credential lands back in getRedirectResult
  // (in the useEffect above) on the next page load.
  // ============================================
  const googleLogin = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithRedirect(auth, provider);
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

  // ============================================
  // CHANGE PASSWORD (used by the forced-first-login flow)
  // The backend clears the mustChangePassword flag and returns a
  // fresh /me-shaped user, which we re-apply to context.
  // ============================================
  const changePassword = async (currentPassword, newPassword) => {
    const res = await axios.post(`${API_URL}/api/auth/change-password`, {
      currentPassword,
      newPassword,
    });
    if (res.data?.data?.user) setUser(res.data.data.user);
    return res.data;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, googleLogin, register, logout, updateProfile, changePassword, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// Helper: Format Firebase error codes to user-friendly messages
const formatFirebaseError = (code) => {
  const errorMap = {
    'auth/email-already-in-use': 'This email is already registered. Try signing in instead.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/user-not-found': 'No account found with this email. Please register first.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-credential': 'Invalid email or password. If you registered with Google, use "Sign in with Google" instead.',
    'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
    'auth/popup-closed-by-user': 'Sign-in popup was closed. Please try again.',
    'auth/network-request-failed': 'Network error. Check your internet connection.',
    'auth/unauthorized-domain': 'This domain is not authorized for sign-in.'
  };
  return errorMap[code] || 'Authentication failed. Please try again.';
};

export const useAuth = () => useContext(AuthContext);