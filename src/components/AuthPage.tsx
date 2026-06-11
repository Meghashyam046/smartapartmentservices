import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { 
  Lock, Mail, User as UserIcon, Building, Phone, 
  KeyRound, ShieldAlert, Hammer, ArrowRight, 
  CheckCircle2, AlertCircle, RefreshCw, Undo2, 
  Eye, EyeOff, Check, X
} from 'lucide-react';

interface AuthPageProps {
  onLoginSuccess: (user: User, token: string) => void;
}

export default function AuthPage({ onLoginSuccess }: AuthPageProps) {
  // viewState can be 'login' | 'register' | 'forgot' | 'reset'
  const [viewState, setViewState] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [role, setRole] = useState<UserRole>('resident');
  
  // Login input
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  
  // Registration inputs
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [block, setBlock] = useState('A');
  const [floor, setFloor] = useState('1');
  const [doorNo, setDoorNo] = useState('101');
  const [skillType, setSkillType] = useState<'Electrician' | 'Plumber' | 'Carpenter' | 'Other'>('Electrician');

  // Forgot password inputs
  const [forgotEmail, setForgotEmail] = useState('');
  // Simulated inbox display to the user for easy iframe clicking
  const [simulatedInbox, setSimulatedInbox] = useState<{ token: string; link: string; email: string } | null>(null);

  // Reset password inputs
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Form state
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  // Handle message communication from Google Sign-In popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setGoogleLoading(false);
        setSuccessMsg('Google Authentication Completed Successfully.');
        onLoginSuccess(event.data.user, event.data.token);
      } else if (event.data?.type === 'OAUTH_AUTH_FAILURE') {
        setGoogleLoading(false);
        setErrorMsg(event.data.error || 'Google Authentication cancelled or failed.');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onLoginSuccess]);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const queryParams = new URLSearchParams({
        role: viewState === 'register' ? role : 'resident',
        block: viewState === 'register' ? block : 'A',
        floor: viewState === 'register' ? floor : '1',
        door_no: viewState === 'register' ? doorNo : '101',
        skill_type: viewState === 'register' ? skillType : 'Other',
        phone: viewState === 'register' ? phone : '',
        name: viewState === 'register' ? name : '',
      });

     const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://securesociety-smart-apartment-service.onrender.com";

const response = await fetch(
  `${API_URL}/api/auth/google/url?${queryParams.toString()}`
);

if (!response.ok) {
  const errorText = await response.text();
  throw new Error(
    `Google URL API Failed: ${response.status} - ${errorText}`
  );
}

      const data = await response.json();
      const width = 500;
      const height = 650;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        data.url,
        'google_oauth_popup',
        `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,status=yes`
      );

      if (!popup) {
        throw new Error('Popup blocked! Please allow popups in your browser to sign in with Google.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during Google Sign-In.');
      setGoogleLoading(false);
    }
  };

  // Handle URL detection for direct ?resetToken=xxx
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('resetToken');
    if (token) {
      setResetToken(token);
      setViewState('reset');
      setErrorMsg('');
      setSuccessMsg(`Detected Reset Token from Link. Please enter your new secure password.`);
    }
  }, []);

  // Helper validation checkers
  const getPasswordDetails = (pwd: string) => {
    return {
      length: pwd.length >= 8,
      upper: /[A-Z]/.test(pwd),
      lower: /[a-z]/.test(pwd),
      number: /[0-9]/.test(pwd),
      special: /[@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?!~`]/.test(pwd),
    };
  };

  const isPasswordStrong = (pwd: string) => {
    const details = getPasswordDetails(pwd);
    return details.length && details.upper && details.lower && details.number && details.special;
  };

  // Handle Login submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) {
      setErrorMsg('Please specify both your email and account password.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Authenication failure');
      }

      setSuccessMsg('Successfully Authorized.');
      onLoginSuccess(data.user, data.token);
    } catch (err: any) {
      setErrorMsg(err.message || 'Incorrect credentials or verification failure.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Registration submission
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !registerPassword) {
      setErrorMsg('Name, Gmail, and password are required.');
      return;
    }

    // Client-side validation checks
    const domain = email.trim().toLowerCase().split('@')[1];
    if (domain !== 'gmail.com') {
      setErrorMsg('Invalid Domain: New signups are strictly limited to gmail.com addresses.');
      return;
    }

    if (!isPasswordStrong(registerPassword)) {
      setErrorMsg('Password does not fulfill the required complexity policy.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          role,
          phone,
          block,
          floor,
          door_no: doorNo,
          skill_type: skillType,
          password: registerPassword
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to complete registration.');
      }

      setSuccessMsg(`Welcome, ${name}! Your secure profile is initialised.`);
      setTimeout(() => {
        onLoginSuccess(data.user, data.token);
      }, 700);
    } catch (err: any) {
      setErrorMsg(err.message || 'Critical Registration Failure.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Forgot Password submission
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setErrorMsg('Please specify your registered account email.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    setSimulatedInbox(null);

    try {
const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
  method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify email address.');
      }

      setSuccessMsg('Verfied! Reset instructions generated.');
      setSimulatedInbox({
        token: data.resetToken,
        link: data.resetLink,
        email: data.email
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during verification.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Password Reset Form Submission
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken.trim()) {
      setErrorMsg('Please specify your password reset token.');
      return;
    }
    if (!newPassword) {
      setErrorMsg('New password is required.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (!isPasswordStrong(newPassword)) {
      setErrorMsg('New password does not fulfill the required complexity policy.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken.trim(), password: newPassword })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to replace password securely.');
      }

      setSuccessMsg('Success! Your password is updated.');
      
      // Clear simulations
      setSimulatedInbox(null);
      setResetToken('');
      setNewPassword('');
      setConfirmPassword('');

      // Redirect back to sign in
      setTimeout(() => {
        setViewState('login');
        setSuccessMsg('Password replaced. Please sign in now.');
      }, 1500);

    } catch (err: any) {
      setErrorMsg(err.message || 'Verification token was invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  // UI state renderers
  const pwdDetails = getPasswordDetails(
    viewState === 'register' ? registerPassword : newPassword
  );

  return (
    <div className="max-w-md w-full mx-auto bg-white border border-slate-200 p-8 rounded-3xl shadow-xl space-y-6">
      
      {/* Platform Title */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 text-slate-900 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full text-xs font-bold font-sans">
          <KeyRound className="w-3.5 h-3.5 text-indigo-505 animate-pulse" />
          SecureSociety Authorized Access
        </div>
        <h2 className="text-2xl font-black font-sans text-slate-900 tracking-tight">Smart Apartment Services</h2>
        <p className="text-xs text-slate-500 max-w-xs mx-auto leading-normal">
          {viewState === 'login' && 'Log in or reset to manage complaints, technicians, and entry verification.'}
          {viewState === 'register' && 'Register a new apartment resident or technical worker account.'}
          {viewState === 'forgot' && 'Submit your email to receive a secure login reset validation token.'}
          {viewState === 'reset' && 'Reset your password to standard SecureSociety credentials.'}
        </p>
      </div>

      {/* Tabs list (Login or Register tab panels) */}
      {(viewState === 'login' || viewState === 'register') && (
        <div className="flex border border-slate-200 p-1.5 rounded-xl bg-slate-50">
          <button
            onClick={() => {
              setViewState('login');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`flex-1 text-center py-2.5 text-xs font-bold rounded-lg transition-transform active:scale-95 duration-100 ${
              viewState === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-450 hover:text-slate-800'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => {
              setViewState('register');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`flex-1 text-center py-2.5 text-xs font-bold rounded-lg transition-transform active:scale-95 duration-100 ${
              viewState === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-450 hover:text-slate-800'
            }`}
          >
            Resident / Worker Signup
          </button>
        </div>
      )}

      {/* Errors display */}
      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-1.5 flex-wrap animate-fadeIn">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-150 rounded-xl text-emerald-800 text-xs font-bold animate-fadeIn">
          {successMsg}
        </div>
      )}

      {/* ----------------- 1. LOGIN FORM ----------------- */}
      {viewState === 'login' && (
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] uppercase tracking-wide font-extrabold text-slate-450 mb-1">
              Registered Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                placeholder="you@gmail.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full text-sm bg-white border border-slate-200 pl-10 pr-4 py-3 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 font-medium font-sans"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-[11px] uppercase tracking-wide font-extrabold text-slate-450">
                Password
              </label>
              <button
                type="button"
                onClick={() => setViewState('forgot')}
                className="text-[11px] font-bold text-indigo-505 hover:underline text-right"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
              <input
                type={showLoginPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full text-sm bg-white border border-slate-200 pl-10 pr-10 py-3 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 font-medium font-sans"
              />
              <button
                type="button"
                onClick={() => setShowLoginPassword(!showLoginPassword)}
                className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-650 cursor-pointer"
              >
                {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-3.5 rounded-xl shadow-lg transition active:scale-95 cursor-pointer disabled:bg-slate-400"
          >
            <span>Authorized Log In</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest">
              <span className="bg-white px-3 text-slate-400">Or credentials context</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading || googleLoading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs py-3.5 rounded-xl border border-slate-250 shadow-sm transition active:scale-95 cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
          >
            {googleLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin text-slate-500" />
            ) : (
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>Continue with Google</span>
          </button>
        </form>
      )}

      {/* ----------------- 2. REGISTRATION FORM ----------------- */}
      {viewState === 'register' && (
        <form onSubmit={handleRegisterSubmit} className="space-y-4">
          {/* Role selector */}
          <div>
            <label className="block text-[11px] uppercase tracking-wide font-extrabold text-slate-450 mb-1.5">
              Registration role
            </label>
            <div className="grid grid-cols-3 gap-1.5 text-[11px] sm:text-xs font-bold font-sans">
              <button
                type="button"
                onClick={() => setRole('resident')}
                className={`py-2 px-1.5 border rounded-xl transition ${
                  role === 'resident' 
                    ? 'border-slate-900 bg-slate-50 text-slate-950 shadow-sm' 
                    : 'border-slate-150 text-slate-450 hover:bg-slate-50'
                }`}
              >
                Resident User
              </button>
              <button
                type="button"
                onClick={() => setRole('worker')}
                className={`py-2 px-1.5 border rounded-xl transition ${
                  role === 'worker' 
                    ? 'border-slate-900 bg-slate-50 text-slate-955 shadow-sm' 
                    : 'border-slate-150 text-slate-450 hover:bg-slate-50'
                }`}
              >
                Tech Worker
              </button>
              <button
                type="button"
                onClick={() => setRole('admin')}
                className={`py-2 px-1.5 border rounded-xl transition ${
                  role === 'admin' 
                    ? 'border-slate-900 bg-slate-50 text-slate-955 shadow-sm' 
                    : 'border-slate-150 text-slate-450 hover:bg-slate-50'
                }`}
              >
                Society Admin
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wide font-extrabold text-slate-450 mb-1">
              Full Name
            </label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                required
                placeholder="Jane Cooper"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-sm bg-white border border-slate-200 pl-10 pr-4 py-3 rounded-xl text-slate-800 placeholder-slate-450 focus:outline-none focus:ring-1 focus:ring-slate-900 font-medium font-sans"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wide font-extrabold text-slate-450 mb-1">
              Gmail Address (Required)
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                placeholder="username@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-sm bg-white border border-slate-200 pl-10 pr-4 py-3 rounded-xl text-slate-800 placeholder-slate-450 focus:outline-none focus:ring-1 focus:ring-slate-900 font-medium font-sans"
              />
            </div>
            {email && !email.trim().toLowerCase().endsWith('@gmail.com') && (
              <span className="text-[10px] text-rose-500 font-bold mt-1 block">
                ⚠ Only valid @gmail.com accounts are permitted.
              </span>
            )}
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wide font-extrabold text-slate-450 mb-1">
              Secure Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
              <input
                type={showRegisterPassword ? 'text' : 'password'}
                required
                placeholder="Choose strong password"
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
                className="w-full text-sm bg-white border border-slate-200 pl-10 pr-10 py-3 rounded-xl text-slate-850 placeholder-slate-450 focus:outline-none focus:ring-1 focus:ring-slate-900 font-medium font-sans"
              />
              <button
                type="button"
                onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-650 cursor-pointer"
              >
                {showRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password Validation Indicators Grid */}
            {registerPassword && (
              <div className="mt-2 text-[10px] p-2.5 bg-slate-50 border border-slate-150 rounded-xl space-y-1 block font-semibold text-slate-600 animate-fadeIn">
                <p className="font-extrabold text-[10px] uppercase text-slate-400 mb-1 tracking-wider">Password Requirements</p>
                <div className="grid grid-cols-2 gap-1 font-sans">
                  <div className="flex items-center gap-1">
                    {pwdDetails.length ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <X className="w-3.5 h-3.5 text-rose-500" />}
                    <span className={pwdDetails.length ? 'text-emerald-700' : 'text-slate-500'}>Min 8 characters</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {pwdDetails.upper ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <X className="w-3.5 h-3.5 text-rose-500" />}
                    <span className={pwdDetails.upper ? 'text-emerald-700' : 'text-slate-500'}>Uppercase (A-Z)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {pwdDetails.lower ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <X className="w-3.5 h-3.5 text-rose-500" />}
                    <span className={pwdDetails.lower ? 'text-emerald-700' : 'text-slate-500'}>Lowercase (a-z)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {pwdDetails.number ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <X className="w-3.5 h-3.5 text-rose-500" />}
                    <span className={pwdDetails.number ? 'text-emerald-700' : 'text-slate-500'}>Number (0-9)</span>
                  </div>
                  <div className="flex items-center gap-1 col-span-2">
                    {pwdDetails.special ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <X className="w-3.5 h-3.5 text-rose-500" />}
                    <span className={pwdDetails.special ? 'text-emerald-700' : 'text-slate-500'}>Special char (@, #, $, %, etc)</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wide font-extrabold text-slate-450 mb-1">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                required
                placeholder="+1 (555) 012-4411"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full text-sm bg-white border border-slate-200 pl-10 pr-4 py-3 rounded-xl text-slate-800 placeholder-slate-450 focus:outline-none focus:ring-1 focus:ring-slate-900 font-medium font-sans"
              />
            </div>
          </div>

          {/* Conditional items based on Role */}
          {role === 'resident' && (
            <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100 font-sans">
              <div>
                <label className="block text-[10px] uppercase font-black text-slate-400 mb-0.5">Block</label>
                <input
                  type="text"
                  required
                  value={block}
                  onChange={(e) => setBlock(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 px-2.5 py-2 rounded text-slate-800 font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-black text-slate-400 mb-0.5">Floor</label>
                <input
                  type="text"
                  required
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 px-2.5 py-2 rounded text-slate-800 font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-black text-slate-400 mb-0.5">Door No</label>
                <input
                  type="text"
                  required
                  value={doorNo}
                  onChange={(e) => setDoorNo(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 px-2.5 py-2 rounded text-slate-800 font-bold"
                />
              </div>
            </div>
          )}



          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-slate-850 text-white font-bold text-xs py-3 rounded-xl px-4 shadow shadow-md transition active:scale-95 gap-2 inline-flex items-center justify-center cursor-pointer disabled:bg-slate-400"
          >
            <span>Register & Initialize Profile</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest">
              <span className="bg-white px-3 text-slate-400">Or credentials context</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading || googleLoading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs py-3.5 rounded-xl border border-slate-250 shadow-sm transition active:scale-95 cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
          >
            {googleLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin text-slate-500" />
            ) : (
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>Continue with Google</span>
          </button>
        </form>
      )}

      {/* ----------------- 3. FORGOT PASSWORD SYSTEM ----------------- */}
      {viewState === 'forgot' && (
        <div className="space-y-4 animate-fadeIn">
          <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] uppercase tracking-wide font-extrabold text-slate-450 mb-1">
                Verify Registered Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="name@email.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full text-sm bg-white border border-slate-200 pl-10 pr-4 py-3 rounded-xl text-slate-800 placeholder-slate-450 focus:outline-none focus:ring-1 focus:ring-slate-900 font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-850 text-white font-bold text-xs py-3.5 rounded-xl px-4 shadow transition active:scale-95 gap-1.5 inline-flex items-center justify-center cursor-pointer disabled:bg-slate-400 uppercase tracking-wider text-[10px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Verify & Send Reset Link</span>
            </button>
          </form>

          {/* SIMULATED LIVE INBOX PANEL FOR INSTANT SANDBOX TESTING */}
          {simulatedInbox && (
            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl space-y-3 mt-4 animate-fadeIn">
              <div className="flex items-center gap-1.5 text-indigo-850 font-black uppercase text-[10px] tracking-widest border-b border-indigo-100 pb-1.5">
                <Mail className="w-4 h-4 text-indigo-600 animate-bounce" />
                Simulated Email Inbox Redirect
              </div>
              <div className="text-xs text-indigo-950 font-medium leading-relaxed font-sans mt-1">
                <p>We simulated sending the reset token to <strong className="font-mono text-indigo-700">{simulatedInbox.email}</strong>.</p>
                
                <div className="p-2.5 bg-white border border-indigo-150 rounded-xl mt-2 font-semibold">
                  <span className="block text-[9px] text-slate-400 font-black uppercase tracking-wider">Secure Token:</span>
                  <span className="text-xs text-indigo-750 font-mono select-all font-bold block mt-0.5">{simulatedInbox.token}</span>
                </div>

                <div className="mt-3.5">
                  <span className="block text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1">Click to auto-follow token reset:</span>
                  <a
                    href={simulatedInbox.link}
                    onClick={(e) => {
                      e.preventDefault();
                      setResetToken(simulatedInbox.token);
                      setViewState('reset');
                      setErrorMsg('');
                      setSuccessMsg('Token populated instantly. Set your password below!');
                    }}
                    className="w-full text-center inline-block py-2 bg-indigo-600 hover:bg-indigo-750 text-white text-[11px] font-extrabold rounded-xl shadow-sm transition active:scale-95 uppercase tracking-wide hover:no-underline"
                  >
                    Open Password Reset Form &rarr;
                  </a>
                </div>
              </div>
            </div>
          )}

          <div className="text-center pt-2">
            <button
              onClick={() => {
                setViewState('login');
                setErrorMsg('');
                setSuccessMsg('');
                setSimulatedInbox(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-bold hover:text-slate-800 hover:underline cursor-pointer"
            >
              <Undo2 className="w-4 h-4" />
              <span>Back to Sign In</span>
            </button>
          </div>
        </div>
      )}

      {/* ----------------- 4. PASSWORD RESET CORE FORM ----------------- */}
      {viewState === 'reset' && (
        <form onSubmit={handleResetPasswordSubmit} className="space-y-4 animate-fadeIn">
          <div>
            <label className="block text-[11px] uppercase tracking-wide font-extrabold text-slate-450 mb-1">
              Reset Security Token
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                required
                placeholder="Paste simulated token here"
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                className="w-full text-sm bg-white border border-slate-200 pl-10 pr-4 py-3 rounded-xl text-slate-800 placeholder-slate-450 focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wide font-extrabold text-slate-450 mb-1">
              New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
              <input
                type={showNewPassword ? 'text' : 'password'}
                required
                placeholder="Enter strong password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full text-sm bg-white border border-slate-200 pl-10 pr-10 py-3 rounded-xl text-slate-850 placeholder-slate-450 focus:outline-none focus:ring-1 focus:ring-slate-900 font-medium font-sans"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-650 cursor-pointer"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password Validation Indicators Grid */}
            {newPassword && (
              <div className="mt-2 text-[10px] p-2.5 bg-slate-50 border border-slate-150 rounded-xl space-y-1 block font-semibold text-slate-600 animate-fadeIn">
                <p className="font-extrabold text-[10px] uppercase text-slate-400 mb-1 tracking-wider">Required Password Security Rules</p>
                <div className="grid grid-cols-2 gap-1 font-sans">
                  <div className="flex items-center gap-1">
                    {pwdDetails.length ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <X className="w-3.5 h-3.5 text-rose-500" />}
                    <span className={pwdDetails.length ? 'text-emerald-700' : 'text-slate-500'}>Min 8 characters</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {pwdDetails.upper ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <X className="w-3.5 h-3.5 text-rose-500" />}
                    <span className={pwdDetails.upper ? 'text-emerald-700' : 'text-slate-500'}>Uppercase (A-Z)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {pwdDetails.lower ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <X className="w-3.5 h-3.5 text-rose-500" />}
                    <span className={pwdDetails.lower ? 'text-emerald-700' : 'text-slate-500'}>Lowercase (a-z)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {pwdDetails.number ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <X className="w-3.5 h-3.5 text-rose-500" />}
                    <span className={pwdDetails.number ? 'text-emerald-700' : 'text-slate-500'}>Number (0-9)</span>
                  </div>
                  <div className="flex items-center gap-1 col-span-2">
                    {pwdDetails.special ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <X className="w-3.5 h-3.5 text-rose-500" />}
                    <span className={pwdDetails.special ? 'text-emerald-700' : 'text-slate-500'}>Special char (@, #, $, %, etc)</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wide font-extrabold text-slate-450 mb-1">
              Confirm New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
              <input
                type="password"
                required
                placeholder="Verify password matches"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full text-sm bg-white border border-slate-200 pl-10 pr-4 py-3 rounded-xl text-slate-800 placeholder-slate-450 focus:outline-none focus:ring-1 focus:ring-slate-900 font-medium font-sans"
              />
            </div>
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <span className="text-[10px] text-rose-500 font-extrabold mt-1 block">
                ⚠ Passwords mismatched. Please match them exactly.
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !isPasswordStrong(newPassword) || newPassword !== confirmPassword}
            className="w-full bg-slate-900 hover:bg-slate-850 text-white font-bold text-xs py-3.5 rounded-xl px-4 shadow transition active:scale-95 gap-1.5 inline-flex items-center justify-center cursor-pointer disabled:bg-slate-400 uppercase tracking-wider text-[10px]"
          >
            <span>Replace Password Securely</span>
          </button>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setViewState('login');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-bold hover:text-slate-800 hover:underline cursor-pointer"
            >
              <Undo2 className="w-4 h-4" />
              <span>Back to Sign In</span>
            </button>
          </div>
        </form>
      )}

    </div>
  );
}
