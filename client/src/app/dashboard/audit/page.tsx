'use client';

import React, { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import API from '@/lib/api';

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [filterType, setFilterType] = useState('');
  const [actionType, setActionType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuditLogs();
  }, [filterType, actionType, startDate, endDate]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.append('entityType', filterType);
      if (actionType) params.append('action', actionType);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await API.get(`/audit?${params.toString()}`);
      setLogs(res.data.logs || []);
    } catch (err) {
      console.error('Failed to fetch audit logs', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (filterType) params.append('entityType', filterType);
      if (actionType) params.append('action', actionType);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await API.get(`/audit/export?${params.toString()}`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `unified-audit-report-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to export CSV', err);
      alert('CSV export failed.');
    }
  };

  const clearFilters = () => {
    setFilterType('');
    setActionType('');
    setStartDate('');
    setEndDate('');
    setSearchTerm('');
  };

  const toggleExpand = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  // Client-side Search Filtering
  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entityId?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const uniqueActions = new Set(logs.map((l) => l.action)).size;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12 font-sans">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Unified Audit Trail</h1>
            <p className="text-xs text-slate-500 mt-0.5">Immutable event history stream and compliance event logs.</p>
          </div>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded text-xs transition shadow-sm w-fit cursor-pointer flex items-center gap-1.5 active:scale-95"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h12a3 3 0 002-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Export CSV Report</span>
          </button>
        </div>

        {/* Overview Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 block">Total Recorded Logs</span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">{logs.length}</span>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 block">Filtered Events</span>
            <span className="text-xl font-bold text-indigo-600 mt-1 block">{filteredLogs.length}</span>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 block">Distinct Actions</span>
            <span className="text-xl font-bold text-emerald-600 mt-1 block">{uniqueActions}</span>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 block">Isolation Layer</span>
            <span className="text-[10px] font-mono font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded mt-2 inline-block">
              ACTIVE (RBAC Bounded)
            </span>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search by User, Action, Email or Entity ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 text-slate-900 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
              <svg className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Entity:</span>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="text-xs font-semibold bg-slate-50 border border-slate-300 text-slate-900 rounded px-2.5 py-1.5 focus:outline-none cursor-pointer"
              >
                <option value="">All Entities</option>
                <option value="TICKET">Tickets</option>
                <option value="PR">Pull Requests</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Action:</span>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                className="text-xs font-semibold bg-slate-50 border border-slate-300 text-slate-900 rounded px-2.5 py-1.5 focus:outline-none cursor-pointer"
              >
                <option value="">All Actions</option>
                <option value="TICKET_CREATED">TICKET_CREATED</option>
                <option value="TICKET_STATUS_UPDATED">TICKET_STATUS_UPDATED</option>
                <option value="CROSS_ORG_TICKET_SHARED">CROSS_ORG_TICKET_SHARED</option>
                <option value="PR_CREATED">PR_CREATED</option>
                <option value="PR_SHARED">PR_SHARED</option>
                <option value="PR_REVIEW_APPROVED">PR_REVIEW_APPROVED</option>
                <option value="PR_NEW_VERSION_CREATED">PR_NEW_VERSION_CREATED</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-500">Date Range:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-50 border border-slate-300 text-slate-900 rounded px-2 py-1 focus:outline-none text-xs"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-50 border border-slate-300 text-slate-900 rounded px-2 py-1 focus:outline-none text-xs"
              />
            </div>

            {(searchTerm || filterType || actionType || startDate || endDate) && (
              <button
                onClick={clearFilters}
                className="font-medium text-slate-500 hover:text-slate-800 transition cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
            <h2 className="font-semibold text-xs text-slate-800 uppercase tracking-wider">
              Event Log Stream ({filteredLogs.length})
            </h2>
            <span className="text-[11px] text-slate-400 font-mono">Click row to inspect payload metadata</span>
          </div>

          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-10 bg-slate-100 rounded animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase font-semibold tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5 font-mono">Timestamp</th>
                    <th className="px-4 py-2.5">Actor</th>
                    <th className="px-4 py-2.5">Action Code</th>
                    <th className="px-4 py-2.5">Entity Type</th>
                    <th className="px-4 py-2.5">Entity ID</th>
                    <th className="px-4 py-2.5 text-right font-sans">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-400 text-xs">
                        No audit logs found matching active query criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => {
                      const isExpanded = expandedLogId === log.id;

                      return (
                        <React.Fragment key={log.id}>
                          <tr
                            onClick={() => toggleExpand(log.id)}
                            className="hover:bg-slate-50/80 transition cursor-pointer select-none"
                          >
                            <td className="px-4 py-3 font-mono text-[11px] text-slate-700 font-medium">
                              {new Date(log.createdAt).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-900">
                              {log.user?.fullName || 'System User'}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`font-mono text-[10px] font-semibold px-2 py-0.5 rounded border ${
                                  log.action?.includes('SHARE')
                                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                                    : log.action?.includes('UPDATE')
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                }`}
                              >
                                {log.action}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-700">
                              {log.entityType}
                            </td>
                            <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                              {log.entityId?.slice(0, 8)}...
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 transition">
                                {isExpanded ? 'Hide Payload' : 'View Payload'}
                              </span>
                            </td>
                          </tr>

                          {/* JSON Payload Inspector Drawer */}
                          {isExpanded && (
                            <tr className="bg-slate-50 border-y border-slate-200">
                              <td colSpan={6} className="px-5 py-3.5 font-mono text-xs">
                                <div className="space-y-1.5">
                                  <div className="text-slate-500 font-sans text-[10px] font-semibold uppercase tracking-wider">
                                    Audit Event Metadata
                                  </div>
                                  <pre className="p-3 bg-slate-900 text-emerald-400 rounded border border-slate-800 overflow-x-auto text-[11px] leading-relaxed">
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