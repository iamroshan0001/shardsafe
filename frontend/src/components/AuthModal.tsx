import React, { useState } from 'react';
import { Shield, Lock, Mail, AlertCircle, X, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, authModalMode, login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(authModalMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Sync mode if context opened with specific mode
  React.useEffect(() => {
    setMode(authModalMode);
    setError('');
  }, [authModalMode, isAuthModalOpen]);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-ink-900 border border-ink-700/80 rounded-2xl shadow-2xl p-6 sm:p-8">
        <div className="flex items-center justify-between pb-4 border-b border-ink-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-mono">
                {mode === 'login' ? 'Access ShardSafe Vault' : 'Create Vault Account'}
              </h2>
              <p className="text-[11px] text-ink-400">Zero-Knowledge Cloud File Storage</p>
            </div>
          </div>
          <button
            onClick={closeAuthModal}
            className="p-1.5 rounded-lg text-ink-400 hover:text-white hover:bg-ink-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-ink-300 mb-1.5">Email Address</label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@college.edu"
                className="w-full px-3.5 py-2.5 rounded-xl bg-ink-950 border border-ink-700 focus:border-cyan-500 focus:outline-none text-white text-xs placeholder:text-ink-600 pl-9 font-mono"
              />
              <Mail className="w-4 h-4 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-300 mb-1.5">Account Password</label>
            <div className="relative">
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-ink-950 border border-ink-700 focus:border-cyan-500 focus:outline-none text-white text-xs placeholder:text-ink-600 pl-9 font-mono"
              />
              <Lock className="w-4 h-4 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
            <p className="text-[10px] text-ink-500 mt-1">
              Hashed with bcrypt (10 rounds) in PostgreSQL RDS.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 transition shadow-lg shadow-cyan-950 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : mode === 'login' ? (
              <span>Sign In to Vault</span>
            ) : (
              <span>Create Account</span>
            )}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-ink-800 text-center">
          {mode === 'login' ? (
            <p className="text-xs text-ink-400">
              Don't have a vault account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
                className="text-cyan-400 hover:underline font-semibold"
              >
                Register now
              </button>
            </p>
          ) : (
            <p className="text-xs text-ink-400">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className="text-cyan-400 hover:underline font-semibold"
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
