import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../../services/auth.service';
import { AlertCircle, Loader2, LogIn, UserPlus, CheckCircle, BookOpen, Brain, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

type AuthTab = 'login' | 'register';

export function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialTab: AuthTab = location.pathname === '/register' ? 'register' : 'login';
  const [activeTab, setActiveTab] = useState<AuthTab>(initialTab);

  // Shared form state (email + password carry over between tabs)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTabSwitch = (tab: AuthTab) => {
    setActiveTab(tab);
    setError('');
    setConfirmPassword('');
    window.history.replaceState(null, '', tab === 'login' ? '/login' : '/register');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authService.login({ email, password });
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await authService.register({ email, password });
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const passwordRequirements = [
    { met: password.length >= 6, text: 'At least 6 characters' },
    { met: password === confirmPassword && password.length > 0, text: 'Passwords match' },
  ];

  const inputClasses = cn(
    'w-full px-4 py-2.5 rounded-[var(--radius-md)]',
    'bg-[var(--color-surface)]',
    'border border-[var(--color-border)]',
    'text-[var(--color-text-primary)]',
    'placeholder:text-[var(--color-text-muted)]',
    'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-[var(--color-primary-400)]',
    'transition-colors duration-[var(--duration-fast)]',
    'disabled:opacity-50 disabled:cursor-not-allowed'
  );

  const submitButtonClasses = cn(
    'w-full py-3 px-4 rounded-[var(--radius-md)]',
    'bg-[var(--color-primary)] text-[var(--color-text-on-primary)]',
    'font-semibold text-sm',
    'hover:opacity-90',
    'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:ring-offset-2',
    'transition-all duration-[var(--duration-fast)]',
    'disabled:opacity-50 disabled:cursor-not-allowed'
  );

  return (
    <div className="min-h-screen flex bg-[var(--color-surface)]">
      {/* LEFT: Branding Panel -- hidden below lg */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden">
        {/* 1. Indigo base gradient */}
        <div className="absolute inset-0 auth-gradient-bg" aria-hidden="true" />

        {/* 2. Glowing orbs — vivid, on-brand */}
        <div aria-hidden="true">
          {/* Bright blue orb — top-right */}
          <div
            className="absolute w-[420px] h-[420px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(96,136,247,0.55) 0%, rgba(59,108,242,0.2) 50%, transparent 70%)',
              top: '-8%',
              right: '-12%',
              filter: 'blur(40px)',
              animation: 'auth-orb-drift-1 8s ease-in-out infinite',
            }}
          />
          {/* Cyan orb — center-left */}
          <div
            className="absolute w-[350px] h-[350px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(34,211,238,0.45) 0%, rgba(6,182,212,0.15) 50%, transparent 70%)',
              top: '30%',
              left: '-8%',
              filter: 'blur(40px)',
              animation: 'auth-orb-drift-2 10s ease-in-out infinite',
            }}
          />
          {/* Violet orb — bottom-right */}
          <div
            className="absolute w-[380px] h-[380px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(139,92,246,0.5) 0%, rgba(168,85,247,0.15) 50%, transparent 70%)',
              bottom: '-12%',
              right: '5%',
              filter: 'blur(40px)',
              animation: 'auth-orb-drift-3 9s ease-in-out infinite',
            }}
          />
        </div>

        {/* 3. Dot grid texture */}
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
          aria-hidden="true"
        />

        {/* 4. Branding content — logo top, copy centered, attribution bottom */}
        <div className="relative z-10 flex flex-col justify-between p-10 h-full w-full">
          {/* Top: Logo + Name */}
          <div className="flex items-center gap-3">
            <img src="/icon.svg" alt="" className="w-10 h-10 rounded-xl" />
            <span className="text-white/90 font-semibold text-lg tracking-tight">MedCompanion</span>
          </div>

          {/* Center: Headline + Subtitle + Feature callouts */}
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-white text-3xl font-bold leading-tight">
                AI agents research<br />while you rest.
              </h2>
              <p className="text-white/60 text-base">
                Smart digests delivered on your schedule.
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-white/70 text-sm">
                <BookOpen className="w-4 h-4 text-white/50 shrink-0" />
                <span>PubMed, trials & FDA scanned daily</span>
              </div>
              <div className="flex items-center gap-3 text-white/70 text-sm">
                <Brain className="w-4 h-4 text-white/50 shrink-0" />
                <span>Smart digests with explained mode</span>
              </div>
              <div className="flex items-center gap-3 text-white/70 text-sm">
                <MessageSquare className="w-4 h-4 text-white/50 shrink-0" />
                <span>Chat companion with cited answers</span>
              </div>
            </div>
          </div>

          {/* Bottom: Attribution */}
          <p className="text-white/30 text-xs">Medical Research Companion</p>
        </div>
      </div>

      {/* RIGHT: Form Panel -- full width on mobile, 55% on lg+ */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 sm:px-8">
        <div className="w-full max-w-md">
          {/* Mobile header (lg:hidden) */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <img src="/icon.svg" alt="" className="w-12 h-12 rounded-2xl mb-3" />
            <h1 className="text-xl font-bold text-[var(--color-text-primary)]">MedCompanion</h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-1 text-center">
              Autonomous medical research for caregivers
            </p>
          </div>

          {/* Pill toggle (Segmented Control) */}
          <div className="relative flex bg-[var(--color-surface-sunken)] rounded-full p-1 mb-6">
            {/* Sliding background indicator */}
            <div
              className={cn(
                'absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full transition-transform duration-300 ease-out',
                'bg-[var(--color-surface)] shadow-sm',
                activeTab === 'register' && 'translate-x-[calc(100%+4px)]'
              )}
              aria-hidden="true"
            />
            <button
              type="button"
              onClick={() => handleTabSwitch('login')}
              className={cn(
                'relative z-10 flex-1 py-2 text-sm font-medium rounded-full transition-colors duration-200',
                activeTab === 'login'
                  ? 'text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
              )}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleTabSwitch('register')}
              className={cn(
                'relative z-10 flex-1 py-2 text-sm font-medium rounded-full transition-colors duration-200',
                activeTab === 'register'
                  ? 'text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
              )}
            >
              Create Account
            </button>
          </div>

          {/* Error display */}
          {error && (
            <div className="mb-4 p-3 rounded-[var(--radius-md)] bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-[var(--color-error)] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[var(--color-error)]">{error}</p>
            </div>
          )}

          {/* Login form */}
          {activeTab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5 animate-fadeIn" key="login">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Email Address
                </label>
                <input
                  id="email" type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required className={inputClasses}
                  placeholder="you@example.com" disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Password
                </label>
                <input
                  id="password" type="password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required className={inputClasses}
                  placeholder="--------" disabled={loading}
                />
              </div>
              <button type="submit" disabled={loading} className={submitButtonClasses}>
                {loading ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <LogIn className="w-5 h-5 mr-2" />
                    Sign In
                  </span>
                )}
              </button>
            </form>
          )}

          {/* Register form */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-5 animate-fadeIn" key="register">
              <div>
                <label htmlFor="reg-email" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Email Address
                </label>
                <input
                  id="reg-email" type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required className={inputClasses}
                  placeholder="you@example.com" disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="reg-password" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Password
                </label>
                <input
                  id="reg-password" type="password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required className={inputClasses}
                  placeholder="--------" disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword" type="password" value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required className={inputClasses}
                  placeholder="--------" disabled={loading}
                />
              </div>
              {/* Password requirements */}
              {password.length > 0 && (
                <div className="space-y-1.5">
                  {passwordRequirements.map((req, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <CheckCircle
                        className={cn(
                          'w-4 h-4 transition-colors',
                          req.met ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'
                        )}
                      />
                      <span
                        className={cn(
                          'text-sm',
                          req.met ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'
                        )}
                      >
                        {req.text}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="submit"
                disabled={loading || !passwordRequirements.every(req => req.met)}
                className={submitButtonClasses}
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Creating account...
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <UserPlus className="w-5 h-5 mr-2" />
                    Create Account
                  </span>
                )}
              </button>
            </form>
          )}

          {/* Privacy notice */}
          <div className="mt-8 text-center">
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
              Your data is encrypted and stored securely.<br />
              We never share your health information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
