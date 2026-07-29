'use client';

import React, { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import API from '@/lib/api';

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [filterType, setFilterType] = useState('');

  useEffect(() => {
    fetchAuditLogs();
  }, [filterType]);

  const fetchAuditLogs = async () => {
    try {
      const url = filterType ? `/audit?entityType=${filterType}` : '/audit';
      const res = await API.get(url);
      setLogs(res.data.logs || []);
    } catch (err) {
      console.error('Failed to fetch audit logs', err);
    }
  };

  const handleExportCSV = () => {
    const token = localStorage.getItem('token');
    window.open(`http://localhost:5000/api/audit/export?token=${token}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Unified Audit Trail</h1>
            <p className="text-sm text-slate-500">Immutable Event History & Compliance Stream</p>
          </div>

          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg text-sm transition shadow-sm w-fit cursor-pointer"
          >
            📥 Export CSV Report
          </button>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <span className="text-xs font-semibold text-slate-500 uppercase">Filter Entity:</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1.5 border rounded-lg text-sm text-slate-700 bg-slate-50 focus:outline-none"
          >
            <option value="">All Events</option>
            <option value="TICKET">Tickets</option>
            <option value="PR">Pull Requests</option>
          </select>
        </div>

        {/* Audit Log Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600 text-xs uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Timestamp</th>
                <th className="px-6 py-3">User</th>
                <th className="px-6 py-3">Action</th>
                <th className="px-6 py-3">Entity Type</th>
                <th className="px-6 py-3">Entity ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400 text-sm">
                    No audit logs recorded for this organization yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-6 py-4 text-xs font-mono text-slate-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {log.user?.fullName || 'System User'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs px-2 py-1 bg-indigo-50 text-indigo-700 rounded font-semibold">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-slate-600">
                      {log.entityType}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-400">
                      {log.entityId.slice(0, 8)}...
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}