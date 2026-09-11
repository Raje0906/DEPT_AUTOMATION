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
      const routes = { student: '/student', faculty: '/faculty', hod: '/hod' };
      navigate(routes[user?.role] || '/student', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed. Please check your credentials.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = (role) => {
    try {
      const user = loginDemo(role);
      const routes = { student: '/student', faculty: '/faculty', hod: '/hod' };
      navigate(routes[user?.role] || '/student', { replace: true });
    } catch {
      toast.error('Unable to sign in as demo user');
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
                    Use your email address, roll number, or employee ID
                  </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label htmlFor="identifier" className="input-label">
                      Email / Roll No / Employee ID
                    </label>
                    <input
                      id="identifier"
                      type="text"
                      autoComplete="username"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="e.g. CE6A001 or rajan@meswadiacoe.edu"
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
                    <input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="input-field"
                      required
                      disabled={loading}
                    />
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
                    <span>Demo credentials</span>
                    <span className="text-[10px] text-draft font-normal">Click to quick sign-in</span>
                  </p>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => handleQuickDemo('student')}
                      className="w-full text-left px-3 py-2 rounded border border-rule hover:border-navy hover:bg-blue-50/60 transition-colors flex items-center justify-between group"
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-ink">Student</span>
                        <span className="text-[11px] font-mono text-draft group-hover:text-navy">ce6a001@meswadiacoe.edu</span>
                      </div>
                      <span className="text-[11px] text-navy font-semibold uppercase group-hover:translate-x-0.5 transition-transform">Sign in →</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickDemo('faculty')}
                      className="w-full text-left px-3 py-2 rounded border border-rule hover:border-navy hover:bg-blue-50/60 transition-colors flex items-center justify-between group"
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-ink">Faculty</span>
                        <span className="text-[11px] font-mono text-draft group-hover:text-navy">rajan@meswadiacoe.edu</span>
                      </div>
                      <span className="text-[11px] text-navy font-semibold uppercase group-hover:translate-x-0.5 transition-transform">Sign in →</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickDemo('hod')}
                      className="w-full text-left px-3 py-2 rounded border border-rule hover:border-navy hover:bg-blue-50/60 transition-colors flex items-center justify-between group"
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-ink">HOD</span>
                        <span className="text-[11px] font-mono text-draft group-hover:text-navy">hod@meswadiacoe.edu</span>
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
