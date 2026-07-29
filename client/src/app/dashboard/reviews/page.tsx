'use client';

import React, { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import API from '@/lib/api';

export default function ReviewConsolePage() {
  const [prs, setPrs] = useState<any[]>([]);
  const [sharedPRs, setSharedPRs] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    fetchPRs();
  }, []);

  const fetchPRs = async () => {
    try {
      const res = await API.get('/prs');
      // Backend returns { prs: [...], sharedPRs: [...] }
      setPrs(res.data.prs || []);
      setSharedPRs(res.data.sharedPRs || []);
    } catch (err: any) {
      console.error('Failed to fetch PRs:', err.response?.data || err.message);
    }
  };

  const handleCreatePR = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await API.post('/prs', { title, description });
      setTitle('');
      setDescription('');
      fetchPRs();
    } catch (err) {
      alert('Failed to submit Pull Request');
    }
  };

  const handleReview = async (prId: string, status: string) => {
    try {
      await API.post(`/prs/${prId}/review`, { status, comment: 'Reviewed via console' });
      fetchPRs();
    } catch (err) {
      alert('Failed to submit review');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Review & Audit Console</h1>
          <p className="text-sm text-slate-500">Multi-Approval Workflows & Code Diff Tracking</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Create PR Form */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Submit Pull Request</h2>
            <form onSubmit={handleCreatePR} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase">PR Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="e.g. Add JWT revocation middleware"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase">Diff / Summary</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={4}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="Describe your code changes..."
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition"
              >
                Create Pull Request
              </button>
            </form>
          </div>

          {/* PR List */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-bold text-slate-800">Pending & Approved Pull Requests</h2>

            {prs.length === 0 ? (
              <p className="text-sm text-slate-500 bg-white p-6 rounded-xl border border-slate-200">
                No active pull requests in this organization.
              </p>
            ) : (
              prs.map((pr) => {
                const latestVersion = pr.versions?.[0]?.versionNumber || 1;
                const approvalsCount = pr.reviews?.filter((r: any) => r.status === 'APPROVED').length || 0;

                return (
                  <div key={pr.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded mr-2">
                          v{latestVersion}
                        </span>
                        <h3 className="font-bold text-slate-900 inline-block">{pr.title}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">PR ID: {pr.id.slice(0, 8)}...</p>
                      </div>
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                          pr.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : pr.status === 'REJECTED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {pr.status}
                      </span>
                    </div>

                    <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 font-mono text-xs">
                      {pr.description}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="text-xs text-slate-500 font-medium">
                        Approvals: {approvalsCount} / {pr.requiredApprovals}
                      </span>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReview(pr.id, 'APPROVED')}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded transition cursor-pointer"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReview(pr.id, 'CHANGES_REQUESTED')}
                          className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded transition cursor-pointer"
                        >
                          Request Changes
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Cross-Org Shared PRs */}
            {sharedPRs.length > 0 && (
              <div className="pt-6 space-y-4">
                <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
                  <span>🤝 Cross-Org Shared Pull Requests</span>
                </h3>
                <div className="space-y-4">
                  {sharedPRs.map((pr) => (
                    <div key={pr.id} className="bg-indigo-50/50 p-5 rounded-xl border border-indigo-200 space-y-2">
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-indigo-950">{pr.title}</h4>
                        <span className="text-xs bg-indigo-200 text-indigo-800 px-2.5 py-0.5 rounded-full font-semibold">
                          Guest Partner Access
                        </span>
                      </div>
                      <p className="text-sm text-indigo-900">{pr.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}