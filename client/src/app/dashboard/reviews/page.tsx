'use client';

import React, { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import API from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function ReviewConsolePage() {
  const { user } = useAuth();
  const [prs, setPrs] = useState<any[]>([]);
  const [sharedPRs, setSharedPRs] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [diffSummary, setDiffSummary] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Versioning state
  const [versionModalPrId, setVersionModalPrId] = useState<string | null>(null);
  const [newDiffSummary, setNewDiffSummary] = useState('');

  // Connections state
  const [connections, setConnections] = useState<any[]>([]);
  const [shareTargetOrgId, setShareTargetOrgId] = useState<Record<string, string>>({});

  // RBAC Helpers
  const activeMembershipRole = (user as any)?.activeMembership?.role;
  const userRole = activeMembershipRole || user?.role || 'SUPPORT_AGENT';
  const isAdmin = userRole === 'ORG_ADMIN';
  const isReviewer = userRole === 'REVIEWER';
  const isAgent = userRole === 'SUPPORT_AGENT';

  useEffect(() => {
    if (!isAgent) {
      fetchPRs();
      if (isAdmin) fetchConnections();
    } else {
      setLoading(false);
    }
  }, [user, userRole]);

  const fetchPRs = async () => {
    try {
      const res = await API.get('/prs');
      setPrs(res.data.prs || []);
      setSharedPRs(res.data.sharedPRs || []);
    } catch (err) {
      console.error('Error fetching PRs', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchConnections = async () => {
    try {
      const res = await API.get('/orgs/connections');
      setConnections(res.data.connections || []);
    } catch {
      try {
        const res = await API.get('/org/connections');
        setConnections(res.data.connections || []);
      } catch (err) {
        console.error('Error fetching connections', err);
      }
    }
  };

  const handleCreatePR = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await API.post('/prs', { title, description: diffSummary });
      alert('✅ Pull Request submitted successfully!');
      setTitle('');
      setDiffSummary('');
      setIsModalOpen(false);
      fetchPRs();
    } catch (err: any) {
      console.error('Error creating PR:', err.response?.data || err);
      alert(err.response?.data?.error || 'Failed to create PR');
    }
  };

  const handleReviewAction = async (prId: string, status: 'APPROVED' | 'CHANGES_REQUESTED') => {
    try {
      await API.post(`/prs/${prId}/review`, { 
        status, 
        comment: status === 'APPROVED' ? 'Approved via console' : 'Requested changes via console' 
      });
      alert(`✅ PR status updated to ${status}!`);
      fetchPRs();
    } catch (err: any) {
      console.error('Error submitting review action:', err.response?.data || err);
      const serverErr = err.response?.data?.error || err.response?.data?.details || 'Failed to submit review action';
      alert(`❌ ${serverErr}`);
    }
  };

  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!versionModalPrId) return;

    try {
      await API.post(`/prs/${versionModalPrId}/version`, { 
        title, 
        description: newDiffSummary, 
        diff: newDiffSummary 
      });
      alert('✅ New PR Version created successfully!');
      setVersionModalPrId(null);
      setNewDiffSummary('');
      fetchPRs();
    } catch (err: any) {
      console.error('Error creating version:', err.response?.data || err);
      alert(err.response?.data?.error || 'Failed to create new PR version');
    }
  };

  const handleSharePR = async (prId: string) => {
    const targetOrg = shareTargetOrgId[prId];
    if (!targetOrg) return alert('Please select a partner organization first');

    try {
      const res = await API.post(`/prs/${prId}/share`, { targetOrgId: targetOrg });
      alert(`✅ ${res.data.message || 'PR shared successfully with partner organization!'}`);
      fetchPRs();
    } catch (err: any) {
      const serverErr = err.response?.data?.details || err.response?.data?.error || err.message;
      alert(`⚠️ Failed to share PR: ${serverErr}`);
    }
  };

  const acceptedConnections = connections.filter((c) => c.status === 'ACCEPTED');

  if (isAgent) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
            🔒
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Access Restricted</h1>
          <p className="text-slate-500 max-w-md mx-auto text-sm">
            Support Agents are strictly bounded to Support Hub. Code Reviews and Audit Console require Reviewer or Admin privileges.
          </p>
          <a
            href="/dashboard"
            className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition cursor-pointer"
          >
            Return to Support Hub
          </a>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Review & Audit Console</h1>
            <p className="text-sm text-slate-500">Multi-Approval Workflows & Code Diff Tracking</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition cursor-pointer flex items-center gap-2 w-fit active:scale-95"
          >
            <span>+</span> Submit Pull Request
          </button>
        </div>

        {/* Stats Metric Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total PRs</span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">{prs.length}</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">In Review</span>
            <span className="text-2xl font-bold text-amber-600 mt-1 block">
              {prs.filter((p) => p.status === 'IN_REVIEW' || p.status === 'DRAFT').length}
            </span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Approved</span>
            <span className="text-2xl font-bold text-emerald-600 mt-1 block">
              {prs.filter((p) => p.status === 'APPROVED').length}
            </span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Cross-Org Shared</span>
            <span className="text-2xl font-bold text-indigo-600 mt-1 block">{sharedPRs.length}</span>
          </div>
        </div>

        {/* Active PRs List */}
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-slate-800">Pending & Approved Pull Requests ({prs.length})</h2>

          {loading ? (
            <div className="space-y-4">
              {[1, 2].map((n) => (
                <div key={n} className="h-32 bg-slate-100 rounded-xl animate-pulse"></div>
              ))}
            </div>
          ) : prs.length === 0 ? (
            <div className="bg-white p-8 text-center rounded-xl border border-slate-200 text-slate-500 text-sm">
              No active pull requests in this organization.
            </div>
          ) : (
            prs.map((pr) => {
              const latestVersion = pr.versions?.[0] || { versionNumber: 1, diff: pr.description || 'Initial PR creation' };
              const approvals = pr.reviews?.filter((r: any) => r.status === 'APPROVED').length || 0;

              return (
                <div key={pr.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full">
                        v{latestVersion.versionNumber}
                      </span>
                      <h3 className="font-bold text-slate-900 text-base">{pr.title}</h3>
                    </div>
                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full ${
                        pr.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : pr.status === 'CHANGES_REQUESTED'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {pr.status}
                    </span>
                  </div>

                  {/* Code Diff Display Window */}
                  <div className="bg-slate-950 text-slate-100 p-4 rounded-xl font-mono text-xs overflow-x-auto border border-slate-800">
                    <div className="text-slate-400 text-[10px] uppercase font-sans mb-1 font-semibold">
                      Code Diff Summary (v{latestVersion.versionNumber})
                    </div>
                    <pre className="whitespace-pre-wrap">{latestVersion.diff || latestVersion.description || pr.description}</pre>
                  </div>

                  {/* Approvals & Actions Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                    <span className="text-xs font-semibold text-slate-500">
                      Approvals: <strong className="text-slate-900">{approvals} / 1</strong>
                    </span>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setVersionModalPrId(pr.id)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer active:scale-95"
                      >
                        📝 New Version
                      </button>
                      {(isAdmin || isReviewer) && (
                        <>
                          <button
                            onClick={() => handleReviewAction(pr.id, 'APPROVED')}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition cursor-pointer active:scale-95"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReviewAction(pr.id, 'CHANGES_REQUESTED')}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition cursor-pointer active:scale-95"
                          >
                            Request Changes
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Cross-Org Sharing Selector for Admin */}
                  {isAdmin && acceptedConnections.length > 0 && (
                    <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                      <select
                        value={shareTargetOrgId[pr.id] || ''}
                        onChange={(e) => setShareTargetOrgId({ ...shareTargetOrgId, [pr.id]: e.target.value })}
                        className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
                      >
                        <option value="">Select Partner Org...</option>
                        {acceptedConnections
                          .filter((c) => {
                            const pOrg = c.initiatorOrgId === user?.activeOrgId ? c.receiverOrg : c.initiatorOrg;
                            // 🚫 'Froncort' ko dropdown options se filter out kar rahe hain
                            return pOrg?.name && !pOrg.name.toLowerCase().includes('froncort');
                          })
                          .map((c) => {
                            const pOrg = c.initiatorOrgId === user?.activeOrgId ? c.receiverOrg : c.initiatorOrg;
                            return (
                              <option key={pOrg?.id} value={pOrg?.id}>
                                {pOrg?.name}
                              </option>
                            );
                          })}
                      </select>
                      <button
                        onClick={() => handleSharePR(pr.id)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition cursor-pointer active:scale-95"
                      >
                        🔗 Share PR Access
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* 🎯 Cross-Org Shared PRs Section with Source Org Name Badge */}
        {sharedPRs.length > 0 && (
          <div className="bg-indigo-50/60 rounded-2xl border border-indigo-200 p-6 space-y-4">
            <h3 className="font-bold text-indigo-950 flex items-center justify-between">
              <span>🤝 Cross-Org Shared Pull Requests</span>
              <span className="text-xs bg-indigo-200 text-indigo-800 px-2.5 py-0.5 rounded-full font-bold">
                Guest Partner Access
              </span>
            </h3>
            <div className="space-y-4">
              {sharedPRs.map((pr) => (
                <div key={pr.id} className="bg-white p-5 rounded-xl border border-indigo-100 shadow-sm space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-sm">{pr.title}</h4>
                      <span className="text-[10px] font-extrabold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200 uppercase">
                        Shared by: {pr.organization?.name || 'Partner Org'}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">v{pr.versions?.[0]?.versionNumber || 1}</span>
                  </div>
                  <div className="bg-slate-950 text-slate-100 p-3 rounded-lg font-mono text-xs overflow-x-auto">
                    <pre>{pr.versions?.[0]?.diff || pr.description || 'Initial Diff'}</pre>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* New PR Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Submit Pull Request</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer font-bold text-base"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreatePR} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">PR Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="e.g. Add rate limiter middleware"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Diff / Summary</label>
                <textarea
                  value={diffSummary}
                  onChange={(e) => setDiffSummary(e.target.value)}
                  required
                  rows={5}
                  placeholder="Describe your code changes or diff..."
                  className="w-full px-3 py-2 border font-mono text-xs rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg transition cursor-pointer active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition cursor-pointer active:scale-95"
                >
                  Create Pull Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Version Modal */}
      {versionModalPrId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Push New PR Version</h3>
              <button
                type="button"
                onClick={() => setVersionModalPrId(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer font-bold text-base"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateVersion} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Updated Code Diff / Changes</label>
                <textarea
                  value={newDiffSummary}
                  onChange={(e) => setNewDiffSummary(e.target.value)}
                  required
                  rows={5}
                  placeholder="Paste updated diff summary..."
                  className="w-full px-3 py-2 border font-mono text-xs rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setVersionModalPrId(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg transition cursor-pointer active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition cursor-pointer active:scale-95"
                >
                  Push New Version
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}