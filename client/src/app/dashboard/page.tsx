'use client';

import React, { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import API from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function SupportHubPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [sharedTickets, setSharedTickets] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Partner Connections State
  const [connections, setConnections] = useState<any[]>([]);
  const [targetOrgId, setTargetOrgId] = useState('');
  const [shareTargetOrgId, setShareTargetOrgId] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchTickets();
    fetchNotifications();
    fetchConnections();
  }, []);

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
      const res = await API.get('/org/notifications');
      setNotifications(res.data.notifications || []);
    } catch (err) {
      console.error('Error fetching notifications', err);
    }
  };

  const fetchConnections = async () => {
    try {
      const res = await API.get('/org/connections');
      setConnections(res.data.connections || []);
    } catch (err) {
      console.error('Error fetching connections', err);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await API.post('/tickets', { title, description });
      setTitle('');
      setDescription('');
      fetchTickets();
    } catch (err) {
      alert('Failed to create ticket');
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await API.patch(`/tickets/${id}/status`, { status });
      fetchTickets();
    } catch (err) {
      alert('Failed to update status');
    }
  };

  const handleSendConnectionRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await API.post('/org/connections/request', { targetOrgId });
      setTargetOrgId('');
      alert('Connection request sent successfully!');
      fetchConnections();
    } catch (err) {
      alert('Failed to send connection request');
    }
  };

  const handleRespondConnection = async (id: string, status: string) => {
    try {
      await API.patch(`/org/connections/${id}`, { status });
      fetchConnections();
    } catch (err) {
      alert('Failed to update connection status');
    }
  };

  const handleShareTicket = async (ticketId: string) => {
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* AI Progress Tracker Digest Notification */}
        {notifications.length > 0 && (
          <div className="bg-indigo-900 text-white p-4 rounded-xl shadow-md border border-indigo-700 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold tracking-wider uppercase text-indigo-300 block mb-1">
                {notifications[0].title}
              </span>
              <p className="text-sm font-medium">{notifications[0].message}</p>
            </div>
            <span className="text-xs text-indigo-300 bg-indigo-800/60 px-3 py-1 rounded-full">
              Automated Scheduled Digest
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel: Create Ticket & Partner Connections */}
          <div className="space-y-6">
            {/* Create Ticket */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-bold text-slate-800 mb-4">Create Support Ticket</h2>
              <form onSubmit={handleCreateTicket} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="e.g. Issue with auth session sync"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    rows={4}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="Provide detailed information..."
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition cursor-pointer"
                >
                  Submit Ticket
                </button>
              </form>
            </div>

            {/* Cross-Org Partner Connections */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <h2 className="text-lg font-bold text-slate-800">🤝 Partner Connections</h2>

              <form onSubmit={handleSendConnectionRequest} className="flex gap-2">
                <input
                  type="text"
                  value={targetOrgId}
                  onChange={(e) => setTargetOrgId(e.target.value)}
                  placeholder="Target Org ID"
                  required
                  className="flex-1 px-3 py-1.5 border rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
                >
                  Connect
                </button>
              </form>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                {connections.length === 0 ? (
                  <p className="text-xs text-slate-400">No partner connections requested yet.</p>
                ) : (
                  connections.map((c, idx) => {
                    const partnerOrg = c.initiatorOrgId === user?.activeOrgId ? c.receiverOrg : c.initiatorOrg;
                    return (
                      <div key={`${c.id}-${idx}`} className="flex items-center justify-between text-xs p-2 bg-slate-50 rounded border border-slate-200">
                        <div>
                          <span className="font-bold text-slate-800">{partnerOrg?.name || 'Partner Org'}</span>
                          <span className={`block text-[10px] font-semibold ${c.status === 'ACCEPTED' ? 'text-emerald-600' : 'text-amber-600'}`}>
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

          {/* Ticket List */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-bold text-slate-800">Organization Support Tickets</h2>

            {loading ? (
              <div className="space-y-4">
                {[1, 2].map((n) => (
                  <div key={n} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm animate-pulse space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="h-5 bg-slate-200 rounded w-1/3"></div>
                      <div className="h-6 bg-slate-200 rounded-full w-16"></div>
                    </div>
                    <div className="h-4 bg-slate-100 rounded w-1/4"></div>
                    <div className="h-12 bg-slate-100 rounded w-full"></div>
                  </div>
                ))}
              </div>
            ) : tickets.length === 0 ? (
              <p className="text-sm text-slate-500 bg-white p-6 rounded-xl border border-slate-200">
                No tickets found for your organization.
              </p>
            ) : (
              tickets.map((ticket, index) => (
                <div key={`${ticket.id}-${index}`} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-slate-900">{ticket.title}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">ID: {ticket.id}</p>
                    </div>
                    <select
                      value={ticket.status}
                      onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                      className="text-xs font-semibold bg-slate-100 border border-slate-300 rounded px-2 py-1"
                    >
                      <option value="OPEN">OPEN</option>
                      <option value="IN_PROGRESS">IN_PROGRESS</option>
                      <option value="RESOLVED">RESOLVED</option>
                      <option value="CLOSED">CLOSED</option>
                    </select>
                  </div>

                  <p className="text-sm text-slate-600">{ticket.description}</p>

                  {/* Share Ticket Control */}
                  {acceptedConnections.length > 0 && (
                    <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                      <select
                        value={shareTargetOrgId[ticket.id] || ''}
                        onChange={(e) => setShareTargetOrgId({ ...shareTargetOrgId, [ticket.id]: e.target.value })}
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
                        onClick={() => handleShareTicket(ticket.id)}
                        className="px-3 py-1 bg-indigo-600 text-white text-xs font-semibold rounded hover:bg-indigo-700 transition cursor-pointer"
                      >
                        🔗 Share Access
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Cross-Org Shared Tickets */}
            {sharedTickets.length > 0 && (
              <div className="pt-6 space-y-4">
                <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
                  <span>🤝 Cross-Org Shared Tickets</span>
                </h3>
                <div className="space-y-4">
                  {sharedTickets.map((ticket, index) => (
                    <div key={`${ticket.id}-${index}`} className="bg-indigo-50/50 p-5 rounded-xl border border-indigo-200 space-y-2">
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-indigo-950">{ticket.title}</h4>
                        <span className="text-xs bg-indigo-200 text-indigo-800 px-2.5 py-0.5 rounded-full font-semibold">
                          Read-Only Guest Access
                        </span>
                      </div>
                      <p className="text-sm text-indigo-900">{ticket.description}</p>
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