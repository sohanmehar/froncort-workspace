'use client';

import React, { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import API from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function ReviewConsolePage() {
  const { user, loading: authLoading } = useAuth();
  const [prs, setPrs] = useState<any[]>([]);
  const [sharedPRs, setSharedPRs] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [connections, setConnections] = useState<any[]>([]);
  const [shareTargetOrgId, setShareTargetOrgId] = useState<Record<string, string>>({});
  const [editingPrId, setEditingPrId] = useState<string | null>(null);
  const [newDiff, setNewDiff] = useState('');
  const [dataLoading, setDataLoading] = useState(true);

  // Active Membership resolve karo (dono schema key formats check karke)
  const activeMembership = user?.memberships?.find(
    (m: any) => m.orgId === user?.activeOrgId || m.organizationId === user?.activeOrgId
  );

  // Exact Role Resolve
  const userRole = activeMembership?.role || user?.role || 'SUPPORT_AGENT';

  // Allowed Roles Check
  const isAllowedToReview = userRole === 'ORG_ADMIN' || userRole === 'REVIEWER' || userRole === 'SUPER_ADMIN';

  useEffect(() => {
    if (!authLoading && user) {
      if (isAllowedToReview) {
        fetchPRs();
        fetchConnections();
      } else {
        setDataLoading(false);
      }
    }
  }, [user, userRole, authLoading]);

  const fetchPRs = async () => {
    try {
      const res = await API.get('/prs');
      setPrs(res.data.prs || []);
      setSharedPRs(res.data.sharedPRs || []);
    } catch (err: any) {
      console.error('Failed to fetch PRs:', err.response?.data || err.message);
    } finally {
      setDataLoading(false);
    }
  };

  const fetchConnections = async () => {
    try {
      const res = await API.get('/org/connections');
      setConnections(res.data.connections || []);
    } catch (err) {
      console.error('Failed to fetch connections', err);
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
    const comment = prompt('Enter review comment (optional):', 'Reviewed via console');
    try {
      await API.post(`/prs/${prId}/review`, { status, comment: comment || 'Reviewed via console' });
      fetchPRs();
    } catch (err) {
      alert('Failed to submit review');
    }
  };

  const handleSharePR = async (prId: string) => {
    const targetOrg = shareTargetOrgId[prId];
    if (!targetOrg) return alert('Select a partner organization first');

    try {
      await API.post(`/prs/${prId}/share`, { targetOrgId: targetOrg });
      alert('PR shared successfully with partner organization!');
      fetchPRs();
    } catch (err) {
      alert('Failed to share PR');
    }
  };

  const handleUpdatePRVersion = async (prId: string) => {
    if (!newDiff) return alert('Please enter the code diff changes!');
    try {
      await API.post(`/prs/${prId}/version`, {
        title: 'Updated Code Iteration',
        description: 'Applied requested changes',
        diff: newDiff,
      });
      alert('New PR Version created successfully!');
      setEditingPrId(null);
      setNewDiff('');
      fetchPRs();
    } catch (err) {
      alert('Failed to create new PR version');
    }
  };

  const acceptedConnections = connections.filter((c) => c.status === 'ACCEPTED');

  // Auth Context Initializing Skeleton
  if (authLoading || (dataLoading && isAllowedToReview)) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-8 space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/4 animate-pulse"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-xl border border-slate-200 h-64 animate-pulse"></div>
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white p-6 rounded-xl border border-slate-200 h-40 animate-pulse"></div>
              <div className="bg-white p-6 rounded-xl border border-slate-200 h-40 animate-pulse"></div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // RBAC Lock: Only trigger if Auth is fully resolved and user is definitely SUPPORT_AGENT
  if (!isAllowedToReview) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-16 text-center">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 shadow-sm space-y-3">
            <div className="text-4xl">🔒</div>
            <h2 className="text-2xl font-bold text-amber-900">Access Restricted</h2>
            <p className="text-sm text-amber-800 max-w-md mx-auto">
              Your role (<strong>{userRole}</strong>) is scoped strictly to Dashboard 1 (Support Hub). Access to the Review & Audit Console is locked.
            </p>
          </div>
        </main>
      </div>
    );
  }

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
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition cursor-pointer"
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
                const latestVersion = pr.versions?.[0]?.versionNumber || (pr.versions?.length ? pr.versions.length : 1);
                const approvalsCount = pr.reviews?.filter((r: any) => r.status === 'APPROVED').length || 0;
                const activeDiff = pr.versions?.[0]?.diff || pr.description;

                return (
                  <div key={pr.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-bold font-mono bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded mr-2">
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

                    {/* Diff Code View */}
                    <div className="bg-slate-900 text-slate-200 p-3 rounded-lg font-mono text-xs overflow-x-auto space-y-1">
                      <div className="text-[10px] text-slate-400 font-sans uppercase font-semibold border-b border-slate-800 pb-1 mb-1">
                        Code Diff Summary (v{latestVersion})
                      </div>
                      <pre className="whitespace-pre-wrap">{activeDiff}</pre>
                    </div>

                    {/* Review Activity Feed */}
                    {pr.reviews && pr.reviews.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-slate-100">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Reviews & Feedback</span>
                        {pr.reviews.map((rev: any) => (
                          <div key={rev.id} className="text-xs bg-slate-50 p-2 rounded border border-slate-200 flex justify-between items-center">
                            <span className="font-medium text-slate-700">{rev.user?.fullName || 'Reviewer'}: "{rev.comment}"</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${rev.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                              {rev.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* New Version Form Drawer */}
                    {editingPrId === pr.id ? (
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                        <label className="block text-xs font-bold text-slate-700 uppercase">New Version Code Diff / Changes</label>
                        <textarea
                          value={newDiff}
                          onChange={(e) => setNewDiff(e.target.value)}
                          rows={3}
                          placeholder="e.g. + added token revocation check logic"
                          className="w-full text-xs font-mono p-2 border rounded bg-white focus:outline-none"
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => setEditingPrId(null)}
                            className="px-3 py-1 bg-slate-200 text-slate-700 text-xs rounded font-semibold"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleUpdatePRVersion(pr.id)}
                            className="px-3 py-1 bg-indigo-600 text-white text-xs rounded font-semibold hover:bg-indigo-700"
                          >
                            Push New Version (v{latestVersion + 1})
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <span className="text-xs text-slate-500 font-medium">
                        Approvals: {approvalsCount} / {pr.requiredApprovals || 1}
                      </span>

                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingPrId(editingPrId === pr.id ? null : pr.id)}
                          className="px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded transition cursor-pointer"
                        >
                          📝 New Version
                        </button>
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

                    {/* Share PR Control */}
                    {acceptedConnections.length > 0 && (
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                        <select
                          value={shareTargetOrgId[pr.id] || ''}
                          onChange={(e) => setShareTargetOrgId({ ...shareTargetOrgId, [pr.id]: e.target.value })}
                          className="text-xs bg-slate-50 border border-slate-300 rounded px-2 py-1"
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
                          className="px-3 py-1 bg-indigo-600 text-white text-xs font-semibold rounded hover:bg-indigo-700 transition cursor-pointer"
                        >
                          🔗 Share PR Access
                        </button>
                      </div>
                    )}
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
                      <p className="text-sm text-indigo-900 font-mono text-xs">{pr.description}</p>
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