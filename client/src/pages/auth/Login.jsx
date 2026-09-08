import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api/axios';
import toast from 'react-hot-toast';

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
    <div className="min-h-screen bg-paper flex">
      {/* Left — Institutional identity panel */}
      <div className="hidden lg:flex flex-col justify-between w-2/5 bg-navy px-12 py-16">
        <div>
          {/* College emblem placeholder */}
          <div className="w-20 h-20 rounded-full border-2 border-white border-opacity-30 flex items-center justify-center mb-8">
            <svg viewBox="0 0 60 60" className="w-12 h-12" fill="none">
              <circle cx="30" cy="22" r="10" stroke="white" strokeWidth="1.5" />
              <path d="M8 42 C8 30 52 30 52 42" stroke="white" strokeWidth="1.5" fill="none"/>
              <path d="M20 42 L20 55 M30 42 L30 55 M40 42 L40 55" stroke="white" strokeWidth="1.5"/>
              <path d="M15 55 L45 55" stroke="white" strokeWidth="1.5"/>
            </svg>
          </div>
          <h1 className="font-serif text-white text-3xl font-bold leading-snug mb-3">
            MES Wadia COE
          </h1>
          <p className="text-blue-200 text-sm font-light leading-relaxed">
            Department of Computer Engineering
          </p>
          <div className="mt-6 pt-6 border-t border-white border-opacity-15">
            <p className="text-blue-200 text-xs">
              Autonomous Institution · Affiliated to MSBTE
            </p>
            <p className="text-blue-200 text-xs mt-1">
              Academic Year 2024–25
            </p>
          </div>
        </div>

        {/* Bottom decorative rule */}
        <div>
          <div className="h-px w-16 bg-white bg-opacity-20 mb-4" />
          <p className="text-blue-200 text-xs leading-relaxed">
            Result Declaration &amp; Academic Records System
          </p>
        </div>
      </div>

      {/* Right — Login form */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 lg:px-20 py-12">
        <div className="max-w-sm w-full mx-auto">
          {/* Mobile college name */}
          <div className="lg:hidden mb-8">
            <h2 className="font-serif text-2xl font-bold text-navy">MES Wadia COE</h2>
            <p className="text-sm text-draft mt-1">Department of Computer Engineering</p>
          </div>

          {!showForgot ? (
            <>
              <div className="mb-8">
                <h2 className="font-serif text-2xl font-bold text-ink">Sign in</h2>
                <p className="text-sm text-draft mt-1">
                  Use your email address, roll number, or employee ID
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
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
                  <label htmlFor="password" className="input-label">Password</label>
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
                  className="btn-primary w-full justify-center"
                  disabled={loading}
                >
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>

              <button
                type="button"
                onClick={() => setShowForgot(true)}
                className="mt-5 text-sm text-maroon underline underline-offset-2 hover:text-maroon-dark transition-colors"
              >
                Forgot password?
              </button>

              {/* Dev credentials hint */}
              <div className="mt-8 p-4 bg-white border border-rule rounded-sm">
                <p className="text-xs font-semibold text-draft uppercase tracking-wide mb-2.5">
                  Demo credentials (click to quick sign-in)
                </p>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => handleQuickDemo('student')}
                    className="w-full text-left p-2 rounded border border-rule hover:border-navy hover:bg-blue-50 transition-colors flex items-center justify-between group"
                  >
                    <span className="text-xs font-medium text-ink">
                      Student: <span className="font-mono text-draft group-hover:text-navy">ce6a001@meswadiacoe.edu</span>
                    </span>
                    <span className="text-[10px] text-navy font-semibold uppercase">Sign in →</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDemo('faculty')}
                    className="w-full text-left p-2 rounded border border-rule hover:border-navy hover:bg-blue-50 transition-colors flex items-center justify-between group"
                  >
                    <span className="text-xs font-medium text-ink">
                      Faculty: <span className="font-mono text-draft group-hover:text-navy">rajan@meswadiacoe.edu</span>
                    </span>
                    <span className="text-[10px] text-navy font-semibold uppercase">Sign in →</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDemo('hod')}
                    className="w-full text-left p-2 rounded border border-rule hover:border-navy hover:bg-blue-50 transition-colors flex items-center justify-between group"
                  >
                    <span className="text-xs font-medium text-ink">
                      HOD: <span className="font-mono text-draft group-hover:text-navy">hod@meswadiacoe.edu</span>
                    </span>
                    <span className="text-[10px] text-navy font-semibold uppercase">Sign in →</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Forgot password panel */
            <>
              <div className="mb-8">
                <button
                  onClick={() => { setShowForgot(false); setForgotSent(false); }}
                  className="text-sm text-maroon mb-4 flex items-center gap-1"
                >
                  ← Back to sign in
                </button>
                <h2 className="font-serif text-2xl font-bold text-ink">Reset password</h2>
                <p className="text-sm text-draft mt-1">
                  Enter the email address registered to your account.
                </p>
              </div>

              {forgotSent ? (
                <div className="notification-strip border-pass bg-green-50">
                  <svg className="w-4 h-4 text-pass flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                  </svg>
                  <span>
                    If that email exists in our system, a reset link has been sent.
                    Check your inbox (and spam folder).
                  </span>
                </div>
              ) : (
                <form onSubmit={handleForgot} className="space-y-5">
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
                  <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
                    {loading ? 'Sending…' : 'Send reset link'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-xs text-gray-400 text-center mt-auto pt-8">
          For technical issues, contact the exam cell: examcell@meswadiacoe.edu
        </p>
      </div>
    </div>
  );
}
