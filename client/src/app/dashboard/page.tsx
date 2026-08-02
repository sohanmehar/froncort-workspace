'use client';

import React, { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import API from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function SupportHubPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<any[]>([]);
  const [sharedTickets, setSharedTickets] = useState<any[]>([]);
  const [prs, setPrs] = useState<any[]>([]); // 🔑 PR State added
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Partner Connections State
  const [connections, setConnections] = useState<any[]>([]);
  const [availableOrgs, setAvailableOrgs] = useState<any[]>([]);
  const [targetOrgId, setTargetOrgId] = useState('');
  const [shareTargetOrgId, setShareTargetOrgId] = useState<Record<string, string>>({});

  // RBAC Helpers
  const userRole = user?.role || 'SUPPORT_AGENT';
  const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'PLATFORM_SUPER_ADMIN' || user?.email?.includes('superadmin');
  const isAdmin = userRole === 'ORG_ADMIN' && !isSuperAdmin;
  const isAgent = userRole === 'SUPPORT_AGENT';
  const canManageTickets = isAdmin || isAgent;

  useEffect(() => {
    if (isSuperAdmin) {
      router.push('/admin');
    }
  }, [user, isSuperAdmin, router]);

  useEffect(() => {
    if (!isSuperAdmin) {
      fetchTickets();
      fetchPRs(); // 🔑 Fetch PRs for accurate banner count
      fetchNotifications();
      if (isAdmin) {
        fetchConnections();
        fetchAllOrgs();
      }
    }
  }, [user, userRole, isSuperAdmin]);

  const fetchTickets = async () => {
    try {
      const res = await API.get('/tickets');
      setTickets(res.data.tickets || []);
      setSharedTickets(res.data.sharedTickets || []);
    } catch (err) {
      console.error('Error fetching tickets', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPRs = async () => {
    try {
      const res = await API.get('/prs');
      setPrs(res.data.prs || []);
    } catch (err) {
      console.error('Error fetching PRs', err);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await API.get('/orgs/notifications');
      setNotifications(res.data.notifications || []);
    } catch {
      try {
        const res = await API.get('/org/notifications');
        setNotifications(res.data.notifications || []);
      } catch (err) {
        console.error('Error fetching notifications', err);
      }
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

  const fetchAllOrgs = async () => {
    try {
      const res = await API.get('/orgs');
      const orgsList = res.data.organizations || res.data || [];
      const otherOrgs = orgsList.filter((o: any) => {
        const isCurrentOrg = o.id === user?.activeOrgId;
        const orgName = (o.name || '').toLowerCase();
        const orgDomain = (o.domain || '').toLowerCase();
        const isFroncort = orgName.includes('froncort') || orgDomain.includes('froncort');
        return !isCurrentOrg && !isFroncort;
      });
      setAvailableOrgs(otherOrgs);
    } catch (err) {
      console.error('Error fetching partner organizations', err);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageTickets) return alert('Access Restricted: Only Admins and Support Agents can create tickets.');
    try {
      await API.post('/tickets', { title, description });
      setTitle('');
      setDescription('');
      setIsModalOpen(false);
      fetchTickets();
      fetchNotifications();
    } catch (err) {
      alert('Failed to create ticket');
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    if (!canManageTickets) return alert('Access Restricted: Reviewers cannot alter ticket status.');
    try {
      await API.patch(`/tickets/${id}/status`, { status });
      fetchTickets();
    } catch (err) {
      alert('Failed to update status');
    }
  };

  const handleSendConnectionRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return alert('Access Restricted: Admin privilege required.');
    if (!targetOrgId) return alert('Please select an organization from the dropdown.');

    try {
      await API.post('/orgs/connections/request', { targetOrgId });
      setTargetOrgId('');
      alert('Connection request sent successfully.');
      fetchConnections();
    } catch (err: any) {
      try {
        await API.post('/org/connections/request', { targetOrgId });
        setTargetOrgId('');
        alert('Connection request sent successfully.');
        fetchConnections();
      } catch (innerErr: any) {
        const backendMessage =
          innerErr?.response?.data?.error ||
          innerErr?.response?.data?.message ||
          err?.response?.data?.error ||
          'Backend endpoint rejected request';
        alert(`Failed to connect: ${backendMessage}`);
      }
    }
  };

  const handleRespondConnection = async (id: string, status: string) => {
    if (!isAdmin) return alert('Access Restricted: Admin privilege required.');
    try {
      await API.patch(`/orgs/connections/${id}`, { status });
      fetchConnections();
    } catch {
      try {
        await API.patch(`/org/connections/${id}`, { status });
        fetchConnections();
      } catch (err) {
        alert('Failed to update connection status');
      }
    }
  };

  const handleShareTicket = async (ticketId: string) => {
    if (!isAdmin) return alert('Access Restricted: Only Admins can share tickets cross-org.');
    const targetOrg = shareTargetOrgId[ticketId];
    if (!targetOrg) return alert('Select a partner organization first');

    try {
      await API.post(`/tickets/${ticketId}/share`, { targetOrgId: targetOrg });
      alert('Ticket shared successfully with partner organization.');
      fetchTickets();
    } catch (err) {
      alert('Failed to share ticket');
    }
  };

  const acceptedConnections = connections.filter((c) => c.status === 'ACCEPTED');

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch =
      ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || ticket.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // 🔑 Calculated Real-time Digest Counts
  const openTicketsCount = tickets.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length;
  const activePRsCount = prs.filter((p) => p.status === 'IN_REVIEW' || p.status === 'DRAFT').length;

  if (isSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12 font-sans">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Dynamic AI Digest Banner */}
        <div className="bg-slate-900 text-slate-100 p-4 rounded-lg border border-slate-800 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[11px] font-mono tracking-wider uppercase text-slate-400 block mb-1">
              SCHEDULED AI PROGRESS DIGEST
            </span>
            <p className="text-xs font-medium text-slate-200">
              Personalized Digest: You have <strong className="text-amber-400 font-bold">{openTicketsCount}</strong> active assigned ticket(s) and <strong className="text-indigo-400 font-bold">{activePRsCount}</strong> PR(s) waiting for review in your workspace.
            </p>
          </div>
          <span className="text-[10px] font-mono text-slate-300 bg-slate-800 px-2.5 py-1 rounded border border-slate-700">
            Scheduled Digest
          </span>
        </div>

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Support Hub</h1>
            <p className="text-xs text-slate-500 mt-0.5">Manage and track organization support requests and cross-workspace items.</p>
          </div>
          {canManageTickets && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded transition shadow-sm flex items-center gap-1.5 cursor-pointer w-fit"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              <span>New Ticket</span>
            </button>
          )}
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 block">Total Tickets</span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">{tickets.length}</span>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 block">Open Items</span>
            <span className="text-xl font-bold text-amber-600 mt-1 block">
              {tickets.filter((t) => t.status === 'OPEN').length}
            </span>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 block">Resolved</span>
            <span className="text-xl font-bold text-emerald-600 mt-1 block">
              {tickets.filter((t) => t.status === 'RESOLVED').length}
            </span>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 block">Cross-Org Shared</span>
            <span className="text-xl font-bold text-indigo-600 mt-1 block">{sharedTickets.length}</span>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative min-w-[240px] flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search tickets by ID or Title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-900 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
              <svg className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs font-semibold bg-slate-50 border border-slate-300 text-slate-900 rounded px-2.5 py-1.5 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="OPEN">OPEN</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="CLOSED">CLOSED</option>
              </select>
            </div>
          </div>

          {(searchTerm || statusFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
              }}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 transition cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Main Table Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className={isAdmin ? "lg:col-span-2 space-y-6" : "lg:col-span-3 space-y-6"}>
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
                <h2 className="font-semibold text-xs text-slate-800 uppercase tracking-wider">
                  Support Tickets ({filteredTickets.length})
                </h2>
                <span className="text-[11px] text-slate-400 font-mono">
                  Showing 1 to {filteredTickets.length} of {tickets.length}
                </span>
              </div>

              {loading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="h-10 bg-slate-100 rounded animate-pulse"></div>
                  ))}
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-slate-500 font-medium text-xs">No tickets match active query filters.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-4 font-mono">Ticket ID</th>
                        <th className="py-2.5 px-4">Title & Description</th>
                        <th className="py-2.5 px-4">Status</th>
                        {isAdmin && <th className="py-2.5 px-4 text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredTickets.map((ticket) => (
                        <tr key={ticket.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-4 font-mono text-[11px] text-indigo-600 font-semibold">
                            {ticket.id.slice(0, 8)}...
                          </td>
                          <td className="py-3 px-4 max-w-xs">
                            <div className="font-semibold text-slate-900">{ticket.title}</div>
                            <div className="text-[11px] text-slate-500 truncate mt-0.5">{ticket.description}</div>
                          </td>
                          <td className="py-3 px-4">
                            {canManageTickets ? (
                              <select
                                value={ticket.status}
                                onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                                className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded border focus:outline-none cursor-pointer ${
                                  ticket.status === 'RESOLVED'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : ticket.status === 'OPEN'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                }`}
                              >
                                <option value="OPEN">OPEN</option>
                                <option value="IN_PROGRESS">IN_PROGRESS</option>
                                <option value="RESOLVED">RESOLVED</option>
                                <option value="CLOSED">CLOSED</option>
                              </select>
                            ) : (
                              <span
                                className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded border inline-block ${
                                  ticket.status === 'RESOLVED'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : ticket.status === 'OPEN'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                }`}
                              >
                                {ticket.status}
                              </span>
                            )}
                          </td>
                          {isAdmin && (
                            <td className="py-3 px-4 text-right">
                              {acceptedConnections.length > 0 && (
                                <div className="flex items-center justify-end gap-1.5">
                                  <select
                                    value={shareTargetOrgId[ticket.id] || ''}
                                    onChange={(e) => setShareTargetOrgId({ ...shareTargetOrgId, [ticket.id]: e.target.value })}
                                    className="text-[11px] bg-slate-50 border border-slate-300 text-slate-900 rounded px-2 py-1"
                                  >
                                    <option value="">Partner Org...</option>
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
                                    onClick={() => handleShareTicket(ticket.id)}
                                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-medium rounded transition cursor-pointer"
                                  >
                                    Share
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Cross-Org Shared Tickets */}
            {sharedTickets.length > 0 && (
              <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3 text-slate-900 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="font-semibold text-xs text-slate-800 uppercase tracking-wider">
                    Cross-Org Shared Tickets
                  </h3>
                  <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200">
                    Read-Only Access
                  </span>
                </div>
                <div className="space-y-2">
                  {sharedTickets.map((ticket) => (
                    <div key={ticket.id} className="bg-slate-50 p-3 rounded border border-slate-200 space-y-1">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-slate-800 text-xs">{ticket.title}</h4>
                          <span className="text-[10px] font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 uppercase">
                            Source: {ticket.organization?.name || 'Partner Org'}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">ID: {ticket.id.slice(0, 8)}...</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{ticket.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Admin Partner Connections */}
          {isAdmin && (
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 space-y-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2">
                  Partner Connections
                </h2>

                <form onSubmit={handleSendConnectionRequest} className="space-y-2">
                  <label className="block text-[11px] font-medium text-slate-500 uppercase">
                    Connect Partner Workspace
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={targetOrgId}
                      onChange={(e) => setTargetOrgId(e.target.value)}
                      required
                      className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-300 text-slate-900 rounded text-xs font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                    >
                      <option value="">Select Partner Org...</option>
                      {availableOrgs
                        .filter((org) => {
                          const name = (org.name || '').toLowerCase();
                          const domain = (org.domain || '').toLowerCase();
                          return !name.includes('froncort') && !domain.includes('froncort');
                        })
                        .map((org) => (
                          <option key={org.id} value={org.id}>
                            {org.name}
                          </option>
                        ))}
                    </select>

                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded transition cursor-pointer shrink-0"
                    >
                      Connect
                    </button>
                  </div>
                </form>

                <div className="space-y-2 pt-3 border-t border-slate-100">
                  <span className="text-[11px] font-mono uppercase text-slate-400 block">
                    Active Connections
                  </span>
                  {connections.length === 0 ? (
                    <p className="text-xs text-slate-400">No partner connections established.</p>
                  ) : (
                    connections.map((c) => {
                      const partnerOrg = c.initiatorOrgId === user?.activeOrgId ? c.receiverOrg : c.initiatorOrg;
                      return (
                        <div key={c.id} className="flex items-center justify-between text-xs p-2 bg-slate-50 rounded border border-slate-200">
                          <div>
                            <span className="font-semibold text-slate-800 block">{partnerOrg?.name || 'Partner Org'}</span>
                            <span className={`text-[10px] font-mono font-bold ${c.status === 'ACCEPTED' ? 'text-emerald-600' : 'text-amber-600'}`}>
                              {c.status}
                            </span>
                          </div>
                          {c.status === 'PENDING' && c.receiverOrgId === user?.activeOrgId && (
                            <button
                              onClick={() => handleRespondConnection(c.id, 'ACCEPTED')}
                              className="px-2 py-0.5 bg-emerald-600 text-white rounded font-medium text-[10px]"
                            >
                              Accept
                            </button>
                          )}
                          {c.status === 'ACCEPTED' && (
                            <button
                              onClick={() => handleRespondConnection(c.id, 'REVOKED')}
                              className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded font-medium text-[10px] transition"
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modal Overlay */}
      {isModalOpen && canManageTickets && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-5 shadow-xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
              <h3 className="text-sm font-bold text-slate-900">Create Support Ticket</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="e.g. Session token eviction issue"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-900 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={4}
                  placeholder="Provide technical details about the ticket..."
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-900 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
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
                  Submit Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}