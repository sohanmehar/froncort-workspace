'use client';

import React, { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import API from '@/lib/api';

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [filterType, setFilterType] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuditLogs();
  }, [filterType]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const url = filterType ? `/audit?entityType=${filterType}` : '/audit';
      const res = await API.get(url);
      setLogs(res.data.logs || []);
    } catch (err) {
      console.error('Failed to fetch audit logs', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await API.get('/audit/export', {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit-report-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to export CSV', err);
      alert('CSV export failed!');
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  // Client-side Search Filtering
  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entityId?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // Unique actions count helper
  const uniqueActions = new Set(logs.map((l) => l.action)).size;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Unified Audit Trail</h1>
            <p className="text-sm text-slate-500">Immutable Event History & Multi-Tenant Compliance Stream</p>
          </div>

          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-sm transition shadow-sm w-fit cursor-pointer flex items-center gap-2 active:scale-95"
          >
            <span>📥</span> Export CSV Report
          </button>
        </div>

        {/* Quick Stats Metrics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Recorded Logs</span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">{logs.length}</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Filtered Events</span>
            <span className="text-2xl font-bold text-indigo-600 mt-1 block">{filteredLogs.length}</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Distinct Actions</span>
            <span className="text-2xl font-bold text-emerald-600 mt-1 block">{uniqueActions}</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Security Isolation</span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded mt-2 inline-block">
              ACTIVE (RBAC Bounded)
            </span>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative min-w-[240px] flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search by User, Action, or Entity ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <span className="absolute left-3 top-2.5 text-slate-400 text-sm">🔍</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Filter Entity:</span>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 focus:outline-none cursor-pointer"
              >
                <option value="">All Entities</option>
                <option value="TICKET">Tickets</option>
                <option value="PR">Pull Requests</option>
              </select>
            </div>
          </div>

          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-xs font-semibold text-rose-600 hover:text-rose-800 transition cursor-pointer"
            >
              Clear Search
            </button>
          )}
        </div>

        {/* Audit Log Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h2 className="font-bold text-slate-800">Event Logs Stream ({filteredLogs.length})</h2>
            <span className="text-xs text-slate-400">Click any row to inspect JSON Metadata</span>
          </div>

          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-10 bg-slate-100 rounded-lg animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase font-bold tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5">Timestamp</th>
                    <th className="px-6 py-3.5">Actor User</th>
                    <th className="px-6 py-3.5">Action Code</th>
                    <th className="px-6 py-3.5">Entity Type</th>
                    <th className="px-6 py-3.5">Entity ID</th>
                    <th className="px-6 py-3.5 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-slate-400 text-sm">
                        No audit logs found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => {
                      const isExpanded = expandedLogId === log.id;
                      const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;

                      return (
                        <React.Fragment key={log.id}>
                          <tr
                            onClick={() => toggleExpand(log.id)}
                            className="hover:bg-slate-50/80 transition cursor-pointer select-none"
                          >
                            <td className="px-6 py-4 text-xs font-mono text-slate-500">
                              {new Date(log.createdAt).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-900">
                              {log.user?.fullName || 'System User'}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`font-mono text-xs px-2.5 py-1 rounded-md font-bold ${
                                  log.action?.includes('SHARE')
                                    ? 'bg-purple-100 text-purple-800'
                                    : log.action?.includes('UPDATE')
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-indigo-100 text-indigo-800'
                                }`}
                              >
                                {log.action}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs font-bold text-slate-600">
                              {log.entityType}
                            </td>
                            <td className="px-6 py-4 text-xs font-mono text-slate-400">
                              {log.entityId?.slice(0, 8)}...
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                type="button"
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
                              >
                                {isExpanded ? 'Hide Payload ▲' : 'View Payload ▼'}
                              </button>
                            </td>
                          </tr>

                          {/* Expanded JSON Inspector Drawer Row */}
                          {isExpanded && (
                            <tr className="bg-slate-900/95 text-slate-100">
                              <td colSpan={6} className="px-6 py-4 font-mono text-xs">
                                <div className="space-y-2">
                                  <div className="text-indigo-300 font-sans text-[11px] font-bold uppercase tracking-wider">
                                    📜 Full Audit Event Metadata Payload
                                  </div>
                                  <pre className="p-3 bg-slate-950 rounded-lg text-emerald-400 border border-slate-800 overflow-x-auto">
                                    {JSON.stringify(
                                      {
                                        id: log.id,
                                        orgId: log.orgId,
                                        userId: log.userId,
                                        action: log.action,
                                        entityType: log.entityType,
                                        entityId: log.entityId,
                                        metadata: log.metadata || {},
                                        createdAt: log.createdAt,
                                      },
                                      null,
                                      2
                                    )}
                                  </pre>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}