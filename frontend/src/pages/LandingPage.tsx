import React from 'react';
import { Shield, Lock, HardDrive, Cpu, Cloud, Server, Database, ArrowRight, CheckCircle2, Key } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { StarfallBackground } from '../components/StarfallBackground';

interface LandingPageProps {
  onEnterApp: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onEnterApp }) => {
  const { user, openAuthModal } = useAuth();

  return (
    <div className="min-h-screen bg-[#080b11] text-ink-100">
      {/* Hero Section */}
      <section className="relative pt-24 pb-20 overflow-hidden border-b border-ink-800/60">
        <StarfallBackground />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-950/20 via-transparent to-transparent pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            {/* Clean Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-800/80 text-cyan-300 text-xs font-mono mb-8 shadow-inner">
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              <span>Secure Cloud Vault • Client-Side Encryption</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6 font-mono leading-tight">
              Shard<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">Safe</span>
            </h1>

            <p className="text-base sm:text-lg text-ink-300 mb-8 leading-relaxed max-w-2xl mx-auto">
              Store your files safely in the cloud. Files are cut into smaller blocks and encrypted directly in your browser before upload.
            </p>

            <div className="flex items-center justify-center">
              <button
                onClick={() => {
                  if (user) {
                    onEnterApp();
                  } else {
                    openAuthModal('login');
                  }
                }}
                className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 transition shadow-xl shadow-cyan-950 cursor-pointer"
              >
                <span>Enter File Vault</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Simple 4-Step Process */}
          <div className="mt-16 max-w-4xl mx-auto p-6 rounded-2xl bg-ink-900/90 border border-ink-800 shadow-2xl">
            <div className="pb-4 mb-4 border-b border-ink-800 text-xs font-mono text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>HOW SHARDSAFE PROTECTS YOUR FILES</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { step: '01', title: 'Cut Into Blocks', desc: 'Files are split into small 1 MB chunks in your browser.', icon: HardDrive, color: 'text-amber-400' },
                { step: '02', title: 'Secret Passphrase', desc: 'A unique key is created from your secret passphrase.', icon: Key, color: 'text-purple-400' },
                { step: '03', title: 'Encrypt Locally', desc: 'Each block is encrypted separately before sending.', icon: Lock, color: 'text-indigo-400' },
                { step: '04', title: 'Direct Upload', desc: 'Stored safely in private Amazon S3 cloud storage.', icon: Cloud, color: 'text-cyan-400' },
              ].map((card, i) => {
                const Icon = card.icon;
                return (
                  <div key={i} className="p-4 rounded-xl bg-ink-950 border border-ink-800/80 text-left">
                    <div className="flex items-center justify-between text-xs font-mono text-ink-500 mb-2">
                      <span>STEP {card.step}</span>
                      <Icon className={`w-4 h-4 ${card.color}`} />
                    </div>
                    <div className="text-sm font-semibold text-white mb-1">{card.title}</div>
                    <div className="text-xs text-ink-400 leading-normal">{card.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 4 AWS Services Showcase */}
      <section className="py-16 border-b border-ink-800/60 bg-ink-950/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-white font-mono mb-2">
              Powered by AWS Cloud Services
            </h2>
            <p className="text-xs text-ink-400">
              Reliable, secure cloud components working together to protect and deliver your data.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                service: 'Amazon EC2',
                badge: 'API Server',
                desc: 'Runs the backend API and generates temporary, secure upload links.',
                icon: Server,
                color: 'text-amber-400',
              },
              {
                service: 'Amazon RDS',
                badge: 'Database',
                desc: 'Stores file metadata, block counts, and operation history in PostgreSQL.',
                icon: Database,
                color: 'text-indigo-400',
              },
              {
                service: 'Amazon S3',
                badge: 'Storage',
                desc: 'Holds the encrypted file blocks in a private cloud storage bucket.',
                icon: HardDrive,
                color: 'text-cyan-400',
              },
              {
                service: 'Amazon CloudFront',
                badge: 'CDN',
                desc: 'Delivers static website assets quickly over HTTPS from global edge servers.',
                icon: Cloud,
                color: 'text-emerald-400',
              },
            ].map((srv, idx) => {
              const Icon = srv.icon;
              return (
                <div key={idx} className="p-5 rounded-2xl bg-ink-900 border border-ink-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 rounded-xl bg-ink-950 border border-ink-800">
                        <Icon className={`w-4 h-4 ${srv.color}`} />
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-ink-950 border border-ink-800 text-ink-400">
                        {srv.badge}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white font-mono mb-1">{srv.service}</h3>
                    <p className="text-xs text-ink-400 leading-relaxed">{srv.desc}</p>
                  </div>
                  <div className="pt-3 mt-3 border-t border-ink-800/80 flex items-center gap-1.5 text-[11px] text-ink-500 font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Active Service</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Simple Security Highlights */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-ink-900/60 border border-ink-800">
              <div className="p-2.5 w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white font-mono mb-1.5">Private Encryption</h3>
              <p className="text-xs text-ink-400 leading-relaxed">
                Files are encrypted right inside your browser. Plaintext and passphrases never touch cloud servers.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-ink-900/60 border border-ink-800">
              <div className="p-2.5 w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white font-mono mb-1.5">Block Integrity</h3>
              <p className="text-xs text-ink-400 leading-relaxed">
                Every block has an authentication tag. If someone alters a stored block, decryption fails immediately.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-ink-900/60 border border-ink-800">
              <div className="p-2.5 w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
                <HardDrive className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white font-mono mb-1.5">Direct Cloud Transfers</h3>
              <p className="text-xs text-ink-400 leading-relaxed">
                Blocks upload directly from your browser to Amazon S3 for maximum speed and privacy.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
