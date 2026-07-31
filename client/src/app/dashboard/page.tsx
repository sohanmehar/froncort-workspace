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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Partner Connections State & All Available Orgs Dropdown
  const [connections, setConnections] = useState<any[]>([]);
  const [availableOrgs, setAvailableOrgs] = useState<any[]>([]);
  const [targetOrgId, setTargetOrgId] = useState('');
  const [shareTargetOrgId, setShareTargetOrgId] = useState<Record<string, string>>({});

  // RBAC Helpers & Super Admin Shield
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

  // ⚡ Filtered out current org AND any 'Froncort' org from partner dropdown options
  const fetchAllOrgs = async () => {
    try {
      const res = await API.get('/orgs');
      const orgsList = res.data.organizations || res.data || [];
      const otherOrgs = orgsList.filter((o: any) => 
        o.id !== user?.activeOrgId && 
        !o.name.toLowerCase().includes('froncort')
      );
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
      alert('✅ Connection request sent successfully!');
      fetchConnections();
    } catch (err: any) {
      try {
        await API.post('/org/connections/request', { targetOrgId });
        setTargetOrgId('');
        alert('✅ Connection request sent successfully!');
        fetchConnections();
      } catch (innerErr: any) {
        const backendMessage =
          innerErr?.response?.data?.error ||
          innerErr?.response?.data?.message ||
          err?.response?.data?.error ||
          'Backend endpoint rejected request';
        alert(`⚠️ Failed to connect: ${backendMessage}`);
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
      alert('Ticket shared successfully with partner organization!');
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

  if (isSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {notifications.length > 0 && (
          <div className="bg-indigo-900 text-white p-4 rounded-2xl shadow-lg border border-indigo-700 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold tracking-wider uppercase text-indigo-300 block mb-1">
                {notifications[0].title}
              </span>
              <p className="text-sm font-medium">
                {isAgent ? (
                  `Personalized Digest: You have ${tickets.filter(t => t.status === 'OPEN').length} open assigned ticket(s) in your workspace.`
                ) : (
                  notifications[0].message
                )}
              </p>
            </div>
            <span className="text-xs text-indigo-200 bg-indigo-800/80 px-3 py-1 rounded-full border border-indigo-600 font-semibold">
              Automated Scheduled Digest
            </span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Support Hub</h1>
            <p className="text-sm text-slate-500">View and manage all support tickets for your organization.</p>
          </div>
          {canManageTickets && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer w-fit"
            >
              <span>+</span> New Ticket
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Tickets</span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">{tickets.length}</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Open Items</span>
            <span className="text-2xl font-bold text-amber-600 mt-1 block">
              {tickets.filter((t) => t.status === 'OPEN').length}
            </span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Resolved</span>
            <span className="text-2xl font-bold text-emerald-600 mt-1 block">
              {tickets.filter((t) => t.status === 'RESOLVED').length}
            </span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Cross-Org Shared</span>
            <span className="text-2xl font-bold text-indigo-600 mt-1 block">{sharedTickets.length}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative min-w-[240px] flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search tickets by ID or Title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <span className="absolute left-3 top-2.5 text-slate-400 text-sm">🔍</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 focus:outline-none"
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
              className="text-xs font-semibold text-rose-600 hover:text-rose-800 transition cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className={isAdmin ? "lg:col-span-2 space-y-6" : "lg:col-span-3 space-y-6"}>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h2 className="font-bold text-slate-800">Support Tickets ({filteredTickets.length})</h2>
                <span className="text-xs text-slate-400">Showing 1 to {filteredTickets.length} of {tickets.length}</span>
              </div>

              {loading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="h-12 bg-slate-100 rounded-lg animate-pulse"></div>
                  ))}
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <p className="text-slate-500 font-medium text-sm">No tickets match your filters.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Ticket ID</th>
                        <th className="py-3 px-4">Subject & Description</th>
                        <th className="py-3 px-4">Status</th>
                        {isAdmin && <th className="py-3 px-4 text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredTickets.map((ticket) => (
                        <tr key={ticket.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3.5 px-4 font-mono text-xs text-indigo-600 font-bold">
                            {ticket.id.slice(0, 8)}...
                          </td>
                          <td className="py-3.5 px-4 max-w-xs">
                            <div className="font-bold text-slate-900">{ticket.title}</div>
                            <div className="text-xs text-slate-500 truncate mt-0.5">{ticket.description}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            {canManageTickets ? (
                              <select
                                value={ticket.status}
                                onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                                className={`text-xs font-bold px-2 py-1 rounded-full border border-transparent focus:outline-none cursor-pointer ${
                                  ticket.status === 'RESOLVED'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : ticket.status === 'OPEN'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-indigo-100 text-indigo-800'
                                }`}
                              >
                                <option value="OPEN">OPEN</option>
                                <option value="IN_PROGRESS">IN_PROGRESS</option>
                                <option value="RESOLVED">RESOLVED</option>
                                <option value="CLOSED">CLOSED</option>
                              </select>
                            ) : (
                              <span
                                className={`text-xs font-bold px-2.5 py-1 rounded-full border border-transparent inline-block ${
                                  ticket.status === 'RESOLVED'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : ticket.status === 'OPEN'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-indigo-100 text-indigo-800'
                                }`}
                              >
                                {ticket.status}
                              </span>
                            )}
                          </td>
                          {isAdmin && (
                            <td className="py-3.5 px-4 text-right">
                              {acceptedConnections.length > 0 && (
                                <div className="flex items-center justify-end gap-1.5">
                                  <select
                                    value={shareTargetOrgId[ticket.id] || ''}
                                    onChange={(e) => setShareTargetOrgId({ ...shareTargetOrgId, [ticket.id]: e.target.value })}
                                    className="text-[11px] bg-slate-50 border border-slate-300 rounded px-1.5 py-1"
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
                                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold rounded transition cursor-pointer"
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

            {/* Cross-Org Shared Tickets Section */}
            {sharedTickets.length > 0 && (
              <div className="bg-indigo-50/60 rounded-xl border border-indigo-200 p-5 space-y-4">
                <h3 className="font-bold text-indigo-950 flex items-center justify-between">
                  <span>🤝 Cross-Org Shared Tickets (Guest Access)</span>
                  <span className="text-xs bg-indigo-200 text-indigo-800 px-2.5 py-0.5 rounded-full font-bold">
                    Read-Only
                  </span>
                </h3>
                <div className="space-y-3">
                  {sharedTickets.map((ticket) => (
                    <div key={ticket.id} className="bg-white p-4 rounded-lg border border-indigo-100 shadow-sm space-y-1">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 text-sm">{ticket.title}</h4>
                          <span className="text-[10px] font-extrabold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200 uppercase">
                            Shared by: {ticket.organization?.name || 'Partner Org'}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">ID: {ticket.id.slice(0, 8)}...</span>
                      </div>
                      <p className="text-xs text-slate-600">{ticket.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {isAdmin && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <span>🤝 Partner Connections</span>
                </h2>

                <form onSubmit={handleSendConnectionRequest} className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-600 uppercase">
                    Connect Partner Workspace
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={targetOrgId}
                      onChange={(e) => setTargetOrgId(e.target.value)}
                      required
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                    >
                      <option value="">Select Partner Org...</option>
                      {availableOrgs
                        .filter((org) => !org.name.toLowerCase().includes('froncort'))
                        .map((org) => (
                          <option key={org.id} value={org.id}>
                            {org.name}
                          </option>
                        ))}
                    </select>

                    <button
                      type="submit"
                      className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition cursor-pointer shrink-0"
                    >
                      Connect
                    </button>
                  </div>
                </form>

                <div className="space-y-2 pt-3 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Active Connections
                  </span>
                  {connections.length === 0 ? (
                    <p className="text-xs text-slate-400">No partner connections established.</p>
                  ) : (
                    connections.map((c) => {
                      const partnerOrg = c.initiatorOrgId === user?.activeOrgId ? c.receiverOrg : c.initiatorOrg;
                      return (
                        <div key={c.id} className="flex items-center justify-between text-xs p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                          <div>
                            <span className="font-bold text-slate-800 block">{partnerOrg?.name || 'Partner Org'}</span>
                            <span className={`text-[10px] font-bold ${c.status === 'ACCEPTED' ? 'text-emerald-600' : 'text-amber-600'}`}>
                              {c.status}
                            </span>
                          </div>
                          {c.status === 'PENDING' && c.receiverOrgId === user?.activeOrgId && (
                            <button
                              onClick={() => handleRespondConnection(c.id, 'ACCEPTED')}
                              className="px-2 py-1 bg-emerald-600 text-white rounded font-semibold text-[10px]"
                            >
                              Accept
                            </button>
                          )}
                          {c.status === 'ACCEPTED' && (
                            <button
                              onClick={() => handleRespondConnection(c.id, 'REVOKED')}
                              className="px-2 py-1 bg-rose-600 text-white rounded font-semibold text-[10px]"
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

      {isModalOpen && canManageTickets && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Create New Support Ticket</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Ticket Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="e.g. Session token eviction bug"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={4}
                  placeholder="Provide details about the issue..."
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition shadow-sm"
                >
                  Create Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}