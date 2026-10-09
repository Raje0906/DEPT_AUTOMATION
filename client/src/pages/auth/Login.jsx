import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import crestLogo from '../../assets/images/mes-wadia-crest.jpg';
import campusPhoto from '../../assets/images/mes-wadia-campus.jpg';

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword]     = useState('');
  const [loading, setLoading]       = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent]   = useState(false);
  const { login, loginDemo } = useAuth();
  const navigate  = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    setLoading(true);
    try {
      const user = await login(identifier.trim(), password);
      const routes = {
        student: '/student',
        faculty: user?.is_seminar_coordinator ? '/faculty/seminar' : '/faculty',
        hod: '/hod'
      };
      navigate(routes[user?.role] || '/student', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed. Please check your credentials.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async (role) => {
    setLoading(true);
    try {
      const user = await loginDemo(role);
      const routes = {
        student: '/student',
        faculty: user?.is_seminar_coordinator ? '/faculty/seminar' : '/faculty',
        coordinator: '/faculty/seminar',
        hod: '/hod'
      };
      navigate(routes[role] || routes[user?.role] || '/student', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Unable to sign in as demo user');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: forgotEmail });
      setForgotSent(true);
    } catch {
      toast.error('Unable to process request. Try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col lg:flex-row">
      {/* Left — Institutional identity panel */}
      <div className="hidden lg:flex flex-col justify-between w-[42%] max-w-xl bg-navy px-12 xl:px-16 py-14 shadow-2xl relative z-10 overflow-hidden">
        {/* Campus architectural background photo with rich navy tint */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-35 pointer-events-none scale-105"
          style={{ backgroundImage: `url(${campusPhoto})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-navy/80 via-navy/85 to-navy/95 pointer-events-none" />

        <div className="relative z-10">
          {/* Official College Crest */}
          <div className="w-20 h-20 rounded-full bg-white p-2 shadow-xl border-2 border-white/40 flex items-center justify-center mb-8 overflow-hidden">
            <img
              src={crestLogo}
              alt="MES Wadia COE Emblem"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="font-serif text-white text-3xl xl:text-4xl font-bold leading-tight mb-3">
            MES Wadia COE
          </h1>
          <p className="text-blue-100 text-sm font-normal tracking-wide">
            Department of Computer Engineering
          </p>
          <div className="mt-8 pt-6 border-t border-white/15 space-y-1.5">
            <p className="text-blue-200/90 text-xs">
              Autonomous Institution · Affiliated to SPPU
            </p>
            <p className="text-blue-200/90 text-xs">
              Academic Year 2026–27
            </p>
          </div>
        </div>

        {/* Bottom decorative rule */}
        <div className="pt-8 relative z-10">
          <div className="h-px w-16 bg-white/20 mb-4" />
          <p className="text-blue-200/80 text-xs tracking-wide">
            Department Automation &amp; Academic Activity Portal
          </p>
        </div>
      </div>

      {/* Right — Login form area with full-bleed campus building background */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-10 lg:p-12 overflow-y-auto relative">
        {/* Full-bleed Campus Building Photo */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
          <img
            src={campusPhoto}
            alt="MES Wadia Campus Building"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-navy/30 backdrop-blur-[2px]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30" />
        </div>

        <div className="w-full flex-1 flex items-center justify-center relative z-10 py-6">
          <div className="w-full max-w-md bg-white/95 backdrop-blur-md p-8 sm:p-10 rounded-xl shadow-2xl border border-white/80 my-auto">
            {/* Mobile college name header */}
            <div className="lg:hidden mb-8 pb-6 border-b border-rule">
              <div className="w-14 h-14 rounded-full bg-white p-1.5 shadow-sm border border-rule flex items-center justify-center mb-3 overflow-hidden">
                <img
                  src={crestLogo}
                  alt="MES Wadia COE Emblem"
                  className="w-full h-full object-contain"
                />
              </div>
              <h2 className="font-serif text-2xl font-bold text-navy">MES Wadia COE</h2>
              <p className="text-xs text-draft mt-0.5">Department of Computer Engineering</p>
            </div>

            {!showForgot ? (
              <>
                <div className="mb-7">
                  <h2 className="font-serif text-2xl font-bold text-ink tracking-tight">Sign in</h2>
                  <p className="text-xs sm:text-sm text-draft mt-1.5">
                    Use your Email address, PRN / Enrollment No, Roll No, or Employee ID
                  </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label htmlFor="identifier" className="input-label">
                      Email / PRN / Roll No / Employee ID
                    </label>
                    <input
                      id="identifier"
                      type="text"
                      autoComplete="username"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="e.g. F23112050, 72312799K, CE6A001, or email"
                      className="input-field"
                      required
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="password" className="input-label mb-0">Password</label>
                      <button
                        type="button"
                        onClick={() => setShowForgot(true)}
                        className="text-xs text-maroon hover:underline font-medium"
                      >
                        Forgot?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="input-field pr-10"
                        required
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-700 transition-colors"
                        title={showPassword ? 'Hide password' : 'Show password'}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? (
                          // Eye slash (hide) icon
                          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                          </svg>
                        ) : (
                          // Eye (show) icon
                          <svg className="w-5 h-5 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn-primary w-full justify-center py-2.5 mt-2 shadow-sm font-semibold tracking-wide"
                    disabled={loading}
                  >
                    {loading ? 'Signing in…' : 'Sign in'}
                  </button>
                </form>

                <div className="mt-4 text-center">
                  <p className="text-xs text-draft">
                    New student or faculty?{' '}
                    <Link to="/register" className="text-navy font-semibold hover:underline">
                      Create an account →
                    </Link>
                  </p>
                </div>

                {/* Dev credentials hint */}
                <div className="mt-8 pt-6 border-t border-rule/70">
                  <p className="text-[11px] font-semibold text-draft uppercase tracking-wider mb-2.5 flex items-center justify-between">
                    <span>Quick Sign-In Credentials</span>
                    <span className="text-[10px] text-draft font-normal">Click to sign in</span>
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => handleQuickDemo('hod')}
                      className="w-full text-left px-3 py-2 rounded border border-rule hover:border-navy hover:bg-blue-50/60 transition-colors flex items-center justify-between group"
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
                          Dr. N. F. Shaikh <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.2 rounded">HOD</span>
                        </span>
                        <span className="text-[11px] font-mono text-draft group-hover:text-navy">nfs (Dr. N. F. Shaikh)</span>
                      </div>
                      <span className="text-[11px] text-navy font-semibold uppercase group-hover:translate-x-0.5 transition-transform">Sign in →</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickDemo('coordinator')}
                      className="w-full text-left px-3 py-2 rounded border border-amber-300 bg-amber-50/30 hover:border-amber-600 hover:bg-amber-50/80 transition-colors flex items-center justify-between group"
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                          Dr. S. S. Raskar <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-1.5 py-0.2 rounded">Coordinator</span>
                        </span>
                        <span className="text-[11px] font-mono text-draft group-hover:text-amber-900">ssr (Dr. S. S. Raskar)</span>
                      </div>
                      <span className="text-[11px] text-amber-800 font-semibold uppercase group-hover:translate-x-0.5 transition-transform">Sign in →</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickDemo('faculty')}
                      className="w-full text-left px-3 py-2 rounded border border-rule hover:border-navy hover:bg-blue-50/60 transition-colors flex items-center justify-between group"
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-ink">Dr. S. K. Wagh (Faculty / Guide)</span>
                        <span className="text-[11px] font-mono text-draft group-hover:text-navy">skw (Dr. S. K. Wagh)</span>
                      </div>
                      <span className="text-[11px] text-navy font-semibold uppercase group-hover:translate-x-0.5 transition-transform">Sign in →</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickDemo('student')}
                      className="w-full text-left px-3 py-2 rounded border border-rule hover:border-navy hover:bg-blue-50/60 transition-colors flex items-center justify-between group"
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-ink">Student (PRN: F23112050)</span>
                        <span className="text-[11px] font-mono text-draft group-hover:text-navy">F23112050 · pw: student@123</span>
                      </div>
                      <span className="text-[11px] text-navy font-semibold uppercase group-hover:translate-x-0.5 transition-transform">Sign in →</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* Forgot password panel */
              <>
                <div className="mb-7">
                  <button
                    onClick={() => { setShowForgot(false); setForgotSent(false); }}
                    className="text-xs text-maroon hover:underline mb-3 flex items-center gap-1 font-medium"
                  >
                    ← Back to sign in
                  </button>
                  <h2 className="font-serif text-2xl font-bold text-ink">Reset password</h2>
                  <p className="text-xs sm:text-sm text-draft mt-1.5">
                    Enter the email address registered to your account.
                  </p>
                </div>

                {forgotSent ? (
                  <div className="notification-strip border-pass bg-green-50 text-xs sm:text-sm">
                    <svg className="w-4 h-4 text-pass flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                    </svg>
                    <span>
                      If that email exists in our system, a reset link has been sent.
                      Check your inbox (and spam folder).
                    </span>
                  </div>
                ) : (
                  <form onSubmit={handleForgot} className="space-y-4">
                    <div>
                      <label htmlFor="forgot-email" className="input-label">Email address</label>
                      <input
                        id="forgot-email"
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="your@email.edu"
                        className="input-field"
                        required
                        disabled={loading}
                      />
                    </div>
                    <button type="submit" className="btn-primary w-full justify-center py-2.5 mt-2" disabled={loading}>
                      {loading ? 'Sending…' : 'Send reset link'}
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
