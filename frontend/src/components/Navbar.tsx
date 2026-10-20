import React from 'react';
import { Shield, Database, Activity, Upload, HardDrive, LogOut, Home } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onTabChange }) => {
  const { user, logout, openAuthModal } = useAuth();

  const navItems = [
    { id: 'landing', label: 'Home', icon: Home },
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'upload', label: 'Upload Center', icon: Upload },
    { id: 'files', label: 'My Vault', icon: HardDrive },
    { id: 'activity', label: 'Activity Logs', icon: Database },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-ink-800/80 bg-ink-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo - clicks always forward to landing page */}
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => onTabChange('landing')}
            title="Go to ShardSafe Home"
          >
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-cyan-500/40 text-cyan-400 shadow-inner group-hover:border-cyan-400 transition">
              <Shield className="w-5 h-5 text-cyan-400" />
              <span className="absolute -bottom-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-white font-mono group-hover:text-cyan-300 transition">
                  ShardSafe
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase bg-cyan-950 text-cyan-300 border border-cyan-800/60 rounded">
                  v1.0
                </span>
              </div>
              <p className="text-[11px] text-ink-400 font-medium">Encrypted Cloud File Vault</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-ink-850 text-cyan-400 border border-ink-700/80 shadow-sm'
                      : 'text-ink-300 hover:text-white hover:bg-ink-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-ink-400'}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Right Section: User Profile */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2 pl-2">
                <div className="hidden sm:block text-right">
                  <div className="text-xs font-semibold text-white truncate max-w-[140px] font-mono">
                    {user.email.split('@')[0]}
                  </div>
                  <div className="text-[10px] text-ink-400 truncate max-w-[140px]">
                    {user.email}
                  </div>
                </div>
                <button
                  onClick={logout}
                  title="Sign out of ShardSafe"
                  className="p-2 rounded-lg bg-ink-900 hover:bg-rose-500/10 border border-ink-800 hover:border-rose-500/30 text-ink-300 hover:text-rose-400 transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openAuthModal('login')}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-ink-200 hover:text-white bg-ink-900 hover:bg-ink-850 border border-ink-800 transition"
                >
                  Sign In
                </button>
                <button
                  onClick={() => openAuthModal('register')}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 shadow-md shadow-cyan-950 transition"
                >
                  Create Vault
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
