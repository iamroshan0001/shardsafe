import React, { useState, useEffect } from 'react';
import { Database, Activity, RefreshCw, CheckCircle2, XCircle, Clock, Shield } from 'lucide-react';
import { api, ActivityLog } from '../api/client';

export const ActivityPage: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.getActivity();
      setLogs(res.logs);
    } catch (err) {
      console.error('[Activity] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getOperationBadge = (op: string) => {
    switch (op) {
      case 'UPLOAD_COMPLETE':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'UPLOAD_INITIATE':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
      case 'DOWNLOAD_INITIATE':
      case 'DOWNLOAD_COMPLETE':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
      case 'DELETE_FILE':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'USER_REGISTER':
      case 'USER_LOGIN':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      default:
        return 'bg-ink-800 text-ink-300 border-ink-700';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-white font-mono tracking-tight">RDS Operation Audit Trail</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
              AUDIT LOGS
            </span>
          </div>
          <p className="text-xs text-ink-400">
            Immutable operation history recorded in PostgreSQL on Amazon RDS.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-ink-900 hover:bg-ink-850 border border-ink-800 text-ink-300 hover:text-white text-xs font-mono transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          <span>Refresh Audit</span>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
          <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
          <p className="text-xs font-mono text-ink-400">Querying activity_logs table from RDS...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-ink-800 rounded-2xl bg-ink-950/40">
          <Database className="w-10 h-10 text-ink-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-white font-mono mb-1">No Activity Records</h3>
          <p className="text-xs text-ink-400 max-w-sm mx-auto">
            Operations such as file uploads, key derivations, downloads, and deletions will be logged here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-800 bg-ink-900/80">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-ink-950/80 border-b border-ink-800 text-ink-400 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Timestamp (UTC)</th>
                <th className="py-3 px-4">Operation</th>
                <th className="py-3 px-4">Result</th>
                <th className="py-3 px-4">Parameters & Context</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800/80">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-ink-850/50 transition">
                  <td className="py-3.5 px-4 text-ink-400 text-[11px]">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getOperationBadge(log.operation)}`}>
                      {log.operation}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1.5">
                      {log.status === 'success' ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 text-[11px]">SUCCESS</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5 text-rose-400" />
                          <span className="text-rose-400 text-[11px]">FAILED</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-ink-300 text-[11px]">
                    <code className="bg-ink-950 px-2 py-1 rounded text-ink-300 text-[10px] border border-ink-800">
                      {typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details)}
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
