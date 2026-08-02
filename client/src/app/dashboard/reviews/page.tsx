'use client';

import React, { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import API from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function ReviewConsolePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [prs, setPrs] = useState<any[]>([]);
  const [sharedPRs, setSharedPRs] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [diffSummary, setDiffSummary] = useState('');
  const [requiredApprovals, setRequiredApprovals] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Versioning & Diff Viewer State
  const [versionModalPrId, setVersionModalPrId] = useState<string | null>(null);
  const [newDiffSummary, setNewDiffSummary] = useState('');
  const [selectedPrHistory, setSelectedPrHistory] = useState<any | null>(null);

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
      await API.post('/prs', { title, description: diffSummary, requiredApprovals });
      alert('Pull Request submitted successfully.');
      setTitle('');
      setDiffSummary('');
      setRequiredApprovals(1);
      setIsModalOpen(false);
      fetchPRs();
    } catch (err: any) {
      console.error('Error creating PR:', err.response?.data || err);
      alert(err.response?.data?.error || 'Failed to create PR');
    }
  };

  const handleReviewAction = async (prId: string, status: 'APPROVED' | 'CHANGES_REQUESTED' | 'MERGED') => {
    try {
      await API.post(`/prs/${prId}/review`, { 
        status, 
        comment: `${status} via console` 
      });
      alert(`PR status updated to ${status}.`);
      fetchPRs();
    } catch (err: any) {
      console.error('Error submitting review action:', err.response?.data || err);
      const serverErr = err.response?.data?.error || err.response?.data?.details || 'Failed to submit review action';
      alert(serverErr);
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
      alert('New PR Version created successfully.');
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
      alert(res.data.message || 'PR shared successfully with partner organization.');
      fetchPRs();
    } catch (err: any) {
      const serverErr = err.response?.data?.details || err.response?.data?.error || err.message;
      alert(`Failed to share PR: ${serverErr}`);
    }
  };

  const acceptedConnections = connections.filter((c) => c.status === 'ACCEPTED');

  if (isAgent) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        <Navbar />
        <main className="max-w-xl mx-auto px-4 py-24 text-center space-y-4">
          <div className="w-12 h-12 bg-slate-200 text-slate-700 rounded-lg flex items-center justify-center mx-auto">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-slate-900">Access Restricted</h1>
          <p className="text-slate-500 text-xs max-w-sm mx-auto leading-relaxed">
            Support Agents are strictly bounded to Support Hub. Code Reviews and Audit Console require Reviewer or Admin privileges.
          </p>
          <a
            href="/dashboard"
            className="inline-block px-3.5 py-1.5 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 transition"
          >
            Return to Support Hub
          </a>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12 font-sans">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Review & Audit Console</h1>
            <p className="text-xs text-slate-500 mt-0.5">Multi-approval code review workflows and version diff tracking.</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded transition cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95 w-fit"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>Submit Pull Request</span>
          </button>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 block">Total PRs</span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">{prs.length}</span>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 block">In Review</span>
            <span className="text-xl font-bold text-amber-600 mt-1 block">
              {prs.filter((p) => p.status === 'IN_REVIEW' || p.status === 'DRAFT').length}
            </span>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 block">Approved / Merged</span>
            <span className="text-xl font-bold text-emerald-600 mt-1 block">
              {prs.filter((p) => p.status === 'APPROVED' || p.status === 'MERGED').length}
            </span>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 block">Cross-Org Shared</span>
            <span className="text-xl font-bold text-indigo-600 mt-1 block">{sharedPRs.length}</span>
          </div>
        </div>

        {/* Active PR List */}
        <div className="space-y-4">
          <h2 className="font-semibold text-xs text-slate-800 uppercase tracking-wider">
            Active Pull Requests ({prs.length})
          </h2>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((n) => (
                <div key={n} className="h-28 bg-slate-200 rounded-lg animate-pulse"></div>
              ))}
            </div>
          ) : prs.length === 0 ? (
            <div className="bg-white p-8 text-center rounded-lg border border-slate-200 text-slate-500 text-xs">
              No active pull requests in this organization workspace.
            </div>
          ) : (
            prs.map((pr) => {
              const versions = pr.versions || [];
              const latestVersion = versions[0] || { versionNumber: 1, diff: pr.description || 'Initial PR creation' };
              const approvals = pr.reviews?.filter((r: any) => r.status === 'APPROVED').length || 0;
              const reqApprovals = pr.requiredApprovals || 1;

              return (
                <div key={pr.id} className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[10px] font-mono bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 rounded font-bold">
                        v{latestVersion.versionNumber} ({versions.length} rev)
                      </span>
                      <h3 className="font-semibold text-slate-900 text-sm">{pr.title}</h3>
                    </div>
                    <span
                      className={`text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded border ${
                        pr.status === 'MERGED'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : pr.status === 'APPROVED'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : pr.status === 'CHANGES_REQUESTED'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {pr.status}
                    </span>
                  </div>

                  {/* Code Diff Display Box */}
                  <div className="bg-slate-900 text-slate-100 p-3.5 rounded font-mono text-xs overflow-x-auto border border-slate-800 space-y-1.5">
                    <div className="flex justify-between items-center text-slate-400 text-[10px] uppercase font-sans">
                      <span>Code Diff (v{latestVersion.versionNumber})</span>
                      <button
                        onClick={() => setSelectedPrHistory(pr)}
                        className="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer underline"
                      >
                        Version History & Diffs
                      </button>
                    </div>
                    <pre className="whitespace-pre-wrap leading-relaxed text-slate-200">{latestVersion.diff || latestVersion.description || pr.description}</pre>
                  </div>

                  {/* Approvals & Actions Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600">
                        Approvals: <strong className="text-slate-900">{approvals} / {reqApprovals} required</strong>
                      </span>
                      {approvals >= reqApprovals && pr.status !== 'MERGED' && (
                        <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                          Threshold Met
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setVersionModalPrId(pr.id)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded border border-slate-200 transition cursor-pointer"
                      >
                        New Version
                      </button>
                      {(isAdmin || isReviewer) && (
                        <>
                          <button
                            onClick={() => handleReviewAction(pr.id, 'APPROVED')}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded transition cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReviewAction(pr.id, 'CHANGES_REQUESTED')}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded transition cursor-pointer"
                          >
                            Request Changes
                          </button>
                          {approvals >= reqApprovals && pr.status === 'APPROVED' && (
                            <button
                              onClick={() => handleReviewAction(pr.id, 'MERGED')}
                              className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded transition cursor-pointer"
                            >
                              Merge PR
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Cross-Org Share Bar */}
                  {isAdmin && acceptedConnections.length > 0 && (
                    <div className="flex items-center gap-2 pt-2.5 border-t border-slate-100">
                      <select
                        value={shareTargetOrgId[pr.id] || ''}
                        onChange={(e) => setShareTargetOrgId({ ...shareTargetOrgId, [pr.id]: e.target.value })}
                        className="text-xs bg-slate-50 border border-slate-300 text-slate-900 rounded px-2 py-1 focus:outline-none cursor-pointer"
                      >
                        <option value="">Select Partner Org...</option>
                        {acceptedConnections.map((c) => {
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
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded transition cursor-pointer"
                      >
                        Share Access
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Cross-Org Shared PRs */}
        {sharedPRs.length > 0 && (
          <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3 text-slate-900 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="font-semibold text-xs text-slate-800 uppercase tracking-wider">
                Cross-Org Shared Pull Requests
              </h3>
              <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                Partner Guest Access
              </span>
            </div>
            <div className="space-y-3">
              {sharedPRs.map((pr) => (
                <div key={pr.id} className="bg-slate-50 p-3.5 rounded border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-slate-900">{pr.title}</h4>
                      <span className="text-[10px] font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 uppercase">
                        Shared by: {pr.organization?.name || 'Partner Org'}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">v{pr.versions?.[0]?.versionNumber || 1}</span>
                  </div>
                  <div className="bg-slate-900 text-slate-200 p-2.5 rounded font-mono text-xs overflow-x-auto border border-slate-800">
                    <pre>{pr.versions?.[0]?.diff || pr.description || 'Initial Diff'}</pre>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Submit PR Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-5 shadow-xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
              <h3 className="text-sm font-bold text-slate-900">Submit Pull Request</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreatePR} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="e.g. Rate limiter middleware implementation"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-900 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Required Approvals Threshold</label>
                <select
                  value={requiredApprovals}
                  onChange={(e) => setRequiredApprovals(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-900 focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                >
                  <option value={1}>1 Approval Required</option>
                  <option value={2}>2 Approvals Required</option>
                  <option value={3}>3 Approvals Required</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Initial Diff Summary</label>
                <textarea
                  value={diffSummary}
                  onChange={(e) => setDiffSummary(e.target.value)}
                  required
                  rows={5}
                  placeholder="Describe your code changes or paste unified diff..."
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded font-mono text-xs text-slate-900 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded transition shadow-sm"
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
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-5 shadow-xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
              <h3 className="text-sm font-bold text-slate-900">Push New PR Version</h3>
              <button
                type="button"
                onClick={() => setVersionModalPrId(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateVersion} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Updated Code Diff</label>
                <textarea
                  value={newDiffSummary}
                  onChange={(e) => setNewDiffSummary(e.target.value)}
                  required
                  rows={5}
                  placeholder="Paste updated diff summary..."
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded font-mono text-xs text-slate-900 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setVersionModalPrId(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded transition shadow-sm"
                >
                  Push Version
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      {selectedPrHistory && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-lg max-w-2xl w-full p-5 shadow-2xl border border-slate-200 space-y-4 max-h-[80vh] overflow-y-auto font-sans">
            <div className="flex justify-between items-center border-b border-slate-200 pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{selectedPrHistory.title}</h3>
                <p className="text-[11px] text-slate-500">Version History & Diff Snapshots</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPrHistory(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-3">
              {(selectedPrHistory.versions || []).map((v: any) => (
                <div key={v.id || v.versionNumber} className="bg-slate-50 p-3.5 rounded border border-slate-200 space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-mono text-indigo-600 text-xs font-bold">Version v{v.versionNumber}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{new Date(v.createdAt || Date.now()).toLocaleString()}</span>
                  </div>
                  <pre className="font-mono text-xs text-slate-800 bg-slate-100 p-2.5 rounded border border-slate-200 whitespace-pre-wrap leading-relaxed">
                    {v.diff || v.description}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}