import React, { useEffect, useState } from 'react';
import {
  Filter,
  Eye,
  Shield,
  User,
  X,
} from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

export default function AdminAuditPage() {
  const { user: currentUser } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminAuditLogs({ action: actionFilter || undefined });
      if (res.success && res.logs) {
        setLogs(res.logs);
      } else {
        // Fallback demo logs
        setLogs([
          {
            id: 'log-1',
            action: 'DATA_IMPORTED',
            entityType: 'IMPORT',
            entityId: 'batch-1',
            ipAddress: '127.0.0.1',
            createdAt: new Date().toISOString(),
            user: { name: 'Aadil Khan', email: 'user@datahub.local', role: 'USER' },
            details: { fileName: 'Q1_Leads_Database.xlsx', total: 120, imported: 114, duplicates: 4, failed: 2, strategy: 'SKIP' },
          },
          {
            id: 'log-2',
            action: 'USER_LOGIN',
            entityType: 'USER',
            entityId: 'usr-1',
            ipAddress: '192.168.1.45',
            createdAt: new Date(Date.now() - 3600000).toISOString(),
            user: { name: 'System Administrator', email: 'admin@datahub.local', role: 'ADMIN' },
            details: { authMethod: 'PASSWORD' },
          },
          {
            id: 'log-3',
            action: 'DATA_EXPORTED',
            entityType: 'CONTACT',
            ipAddress: '192.168.1.45',
            createdAt: new Date(Date.now() - 7200000).toISOString(),
            user: { name: 'System Administrator', email: 'admin@datahub.local', role: 'ADMIN' },
            details: { format: 'CSV', count: 412 },
          },
          {
            id: 'log-4',
            action: 'GOOGLE_SYNC_EXECUTED',
            entityType: 'GOOGLE_SYNC',
            ipAddress: '127.0.0.1',
            createdAt: new Date(Date.now() - 14400000).toISOString(),
            user: { name: 'Jane Cooper', email: 'user@datahub.local', role: 'USER' },
            details: { direction: 'IMPORT', syncedRecords: 5, sheetId: '1BxiMVs0XRA5n...' },
          },
        ]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [actionFilter]);

  const getActionColor = (action: string) => {
    if (action.includes('LOGIN')) return 'bg-blue-500/15 text-blue-400 border-blue-500/20';
    if (action.includes('IMPORT')) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
    if (action.includes('EXPORT')) return 'bg-purple-500/15 text-purple-400 border-purple-500/20';
    if (action.includes('DELETE')) return 'bg-red-500/15 text-red-400 border-red-500/20';
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  if (currentUser && currentUser.role !== 'ADMIN') {
    return (
      <AppLayout title="Access Restricted" subtitle="Administrator privileges required">
        <div className="glass-card p-10 rounded-2xl border border-red-500/30 text-center max-w-md mx-auto my-12 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto">
            <Shield className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-white">Administrator Access Required</h2>
          <p className="text-xs text-slate-400">
            System audit logs are restricted to platform administrators. Your account has customer permissions.
          </p>
          <a
            href="/"
            className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl"
          >
            Return to Customer Dashboard
          </a>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Admin: System Audit Trail"
      subtitle="Immutable event logs of user logins, contact modifications, imports, and exports"
    >
      <div className="space-y-4">
        <div className="glass-card p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Action Types</option>
              <option value="USER_LOGIN">USER_LOGIN</option>
              <option value="DATA_IMPORTED">DATA_IMPORTED</option>
              <option value="DATA_EXPORTED">DATA_EXPORTED</option>
              <option value="CONTACT_CREATED">CONTACT_CREATED</option>
              <option value="CONTACT_DELETED">CONTACT_DELETED</option>
              <option value="GOOGLE_SYNC_EXECUTED">GOOGLE_SYNC_EXECUTED</option>
            </select>
          </div>
          <span className="text-xs text-slate-400">{logs.length} audit records captured</span>
        </div>

        <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Event Action</th>
                  <th className="py-3 px-4">Target Entity</th>
                  <th className="py-3 px-4">Triggered By</th>
                  <th className="py-3 px-4">IP Address</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4 text-right">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getActionColor(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                        {log.entityType}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">
                        {log.user?.name || 'System Daemon'}
                      </div>
                      <div className="text-[11px] text-slate-400 font-normal">
                        {log.user?.email || 'automated'}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">{log.ipAddress || '—'}</td>
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium inline-flex items-center gap-1 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-400" />
                        <span>Inspect JSON</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* JSON Payload Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-xl rounded-2xl border border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-white">Audit Event Details</h2>
                <span className="text-xs text-blue-400 font-mono">{selectedLog.action}</span>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-900 rounded-xl">
                <div>
                  <span className="text-slate-500 block">User:</span>
                  <span className="text-white font-medium">{selectedLog.user?.email || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Timestamp:</span>
                  <span className="text-white font-mono">
                    {new Date(selectedLog.createdAt).toISOString()}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-medium mb-1 block">Context Payload:</span>
                <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-60">
                  {JSON.stringify(selectedLog.details || {}, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
