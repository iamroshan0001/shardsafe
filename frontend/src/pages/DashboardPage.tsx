import React, { useState, useEffect } from 'react';
import { HardDrive, Layers, Database, Shield, Upload, Download, ArrowUpRight, Activity, Clock, CheckCircle2, RefreshCw, Cpu, Server } from 'lucide-react';
import { api, DashboardStats, VaultFile, ActivityLog } from '../api/client';
import { formatBytes } from '../crypto/hexUtils';

interface DashboardPageProps {
  onOpenUpload: () => void;
  onNavigateFiles: () => void;
  onSelectFileForDownload: (file: VaultFile) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onOpenUpload,
  onNavigateFiles,
  onSelectFileForDownload,
}) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentFiles, setRecentFiles] = useState<VaultFile[]>([]);
  const [recentLogs, setRecentLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboardData = async () => {
    try {
      const [statsData, filesData, activityData] = await Promise.all([
        api.getStats(),
        api.listFiles(),
        api.getActivity(),
      ]);
      setStats(statsData);
      setRecentFiles(filesData.files.slice(0, 5));
      setRecentLogs(activityData.logs.slice(0, 6));
    } catch (err) {
      console.error('[Dashboard] Error loading data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
        <p className="text-xs font-mono text-ink-400">Loading live vault telemetry from RDS...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-white font-mono tracking-tight">Vault Dashboard</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              LIVE METRICS
            </span>
          </div>
          <p className="text-xs text-ink-400">
            Real-time telemetry loaded directly from PostgreSQL RDS and Amazon S3.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-ink-900 hover:bg-ink-850 border border-ink-800 text-ink-300 hover:text-white transition"
            title="Refresh metrics from database"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 transition shadow-lg shadow-cyan-950 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Upload New File</span>
          </button>
        </div>
      </div>

      {/* 4 Primary Stats Cards (Real Database Values) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-ink-900/90 border border-ink-800/80 shadow-sm">
          <div className="flex items-center justify-between text-ink-400 mb-3">
            <span className="text-xs font-mono font-medium">FILES VAULTED</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">
            {stats?.fileCount || 0}
          </div>
          <div className="text-[11px] text-ink-400 mt-2 flex items-center gap-1 font-mono">
            <span className="text-emerald-400 font-semibold">{stats?.fileCount || 0} active</span> records in RDS
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-ink-900/90 border border-ink-800/80 shadow-sm">
          <div className="flex items-center justify-between text-ink-400 mb-3">
            <span className="text-xs font-mono font-medium">ENCRYPTED BLOCKS</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">
            {stats?.segmentCount || 0}
          </div>
          <div className="text-[11px] text-ink-400 mt-2 flex items-center gap-1 font-mono">
            <span>Encrypted S3 Blocks</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-ink-900/90 border border-ink-800/80 shadow-sm">
          <div className="flex items-center justify-between text-ink-400 mb-3">
            <span className="text-xs font-mono font-medium">TOTAL SIZE</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white font-mono truncate">
            {formatBytes(stats?.totalBytes || 0)}
          </div>
          <div className="text-[11px] text-ink-400 mt-2 font-mono">
            Original file volume
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-ink-900/90 border border-ink-800/80 shadow-sm">
          <div className="flex items-center justify-between text-ink-400 mb-3">
            <span className="text-xs font-mono font-medium">STORED VOLUME</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white font-mono truncate">
            {formatBytes(stats?.totalEncryptedBytes || 0)}
          </div>
          <div className="text-[11px] text-ink-400 mt-2 font-mono">
            Encrypted cloud data
          </div>
        </div>
      </div>

      {/* 2-Column Split: Recent Files & Audit Log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Files in Vault */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-ink-900/90 border border-ink-800/80">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white font-mono">Recent Vaulted Files</h3>
            </div>
            <button
              onClick={onNavigateFiles}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono"
            >
              <span>View All ({stats?.fileCount || 0})</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentFiles.length === 0 ? (
            <div className="py-12 text-center text-ink-500 border border-dashed border-ink-800 rounded-xl">
              <p className="text-xs font-mono mb-2">No files vaulted yet</p>
              <button
                onClick={onOpenUpload}
                className="text-xs text-cyan-400 hover:underline font-semibold"
              >
                Upload your first encrypted file
              </button>
            </div>
          ) : (
            <div className="divide-y divide-ink-800/80">
              {recentFiles.map((f) => (
                <div key={f.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="truncate">
                    <div className="text-xs font-semibold text-white truncate font-mono">
                      {f.original_filename}
                    </div>
                    <div className="text-[11px] text-ink-400 font-mono mt-0.5">
                      {formatBytes(f.original_size)} • {f.segment_count} Blocks •{' '}
                      {new Date(f.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      {f.status}
                    </span>
                    <button
                      onClick={() => onSelectFileForDownload(f)}
                      className="p-1.5 rounded-lg bg-ink-950 hover:bg-cyan-500/10 border border-ink-800 hover:border-cyan-500/40 text-ink-300 hover:text-cyan-300 transition"
                      title="Decrypt and Download"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity Log from RDS */}
        <div className="p-6 rounded-2xl bg-ink-900/90 border border-ink-800/80">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white font-mono">RDS Operation Audit</h3>
            </div>
          </div>

          {recentLogs.length === 0 ? (
            <div className="py-12 text-center text-ink-500 font-mono text-xs">
              No activity recorded yet
            </div>
          ) : (
            <div className="space-y-3">
              {recentLogs.map((log) => (
                <div key={log.id} className="p-2.5 rounded-xl bg-ink-950 border border-ink-850 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-semibold text-white text-[11px]">
                      {log.operation}
                    </span>
                    <span className="text-[10px] text-ink-500 font-mono">
                      {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-[11px] text-ink-400 truncate font-mono">
                    {log.details?.filename || log.details?.email || JSON.stringify(log.details)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
