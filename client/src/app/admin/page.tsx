'use client';

import React, { useEffect, useState } from 'react';
import API from '@/lib/api';
import Navbar from '@/components/Navbar';

export default function SuperAdminConsole() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgDomain, setNewOrgDomain] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [targetOrg, setTargetOrg] = useState('');
  const [userRole, setUserRole] = useState('ORG_ADMIN');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetchOrgs();
  }, []);

  // 1. Fetch Live DB Organizations (Filtering out internal Platform Org)
  const fetchOrgs = async () => {
    setLoading(true);
    try {
      const res = await API.get('/orgs');
      const rawList = res.data?.organizations || [];
      
      // ⚡ Filter out the internal 'Froncort Platform' org
      const clientOrgs = rawList.filter(
        (o: any) => o.domain !== 'froncort.ai' && !o.name.toLowerCase().includes('froncort platform')
      );

      setOrgs(clientOrgs);
      if (clientOrgs.length > 0) {
        setTargetOrg(clientOrgs[0].id);
      }
    } catch (err: any) {
      console.error('Error fetching orgs from DB:', err);
    } finally {
      setLoading(false);
    }
  };

  // 2. Add Organization to Database
  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;

    try {
      await API.post('/orgs', {
        name: newOrgName.trim(),
        domain: newOrgDomain.trim(),
      });

      setMsg(`✅ Organization "${newOrgName}" created in PostgreSQL DB!`);
      setNewOrgName('');
      setNewOrgDomain('');
      fetchOrgs();
    } catch (err: any) {
      setMsg(`⚠️ Error: ${err.response?.data?.error || 'Failed to create organization'}`);
    }
  };

  // 3. Provision User in DB & Assign Membership
  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmail.trim() || !targetOrg) return;

    try {
      await API.post('/orgs/memberships', {
        email: userEmail.trim(),
        orgId: targetOrg,
        role: userRole,
      });

      setMsg(`✅ Account provisioned for "${userEmail}" in DB! Password: password123`);
      setUserEmail('');
    } catch (err: any) {
      setMsg(`⚠️ Error: ${err.response?.data?.error || 'Failed to assign role'}`);
    }
  };

  // 4. Delete Organization from DB
  const handleDeleteOrg = async (orgId: string, orgName: string) => {
    if (!confirm(`Are you sure you want to delete ${orgName} from database?`)) return;

    try {
      await API.delete(`/orgs/${orgId}`);
      setMsg(`Organization "${orgName}" deleted.`);
      fetchOrgs();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete organization');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Navbar />

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        
        {/* Page Header */}
        <div className="border-b border-slate-200 pb-4">
          <h1 className="text-2xl font-bold text-slate-900">Super Admin Panel</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage platform client organizations and user memberships directly in PostgreSQL.
          </p>
        </div>

        {msg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium rounded-lg flex justify-between items-center">
            <span>{msg}</span>
            <button onClick={() => setMsg('')} className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer">✕</button>
          </div>
        )}

        {/* Forms Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Add Organization */}
          <div className="bg-white p-5 rounded-lg border border-slate-200 space-y-4 shadow-xs">
            <h2 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-2">
              Add New Organization
            </h2>

            <form onSubmit={handleCreateOrg} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="e.g. Netflix"
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Domain
                </label>
                <input
                  type="text"
                  value={newOrgDomain}
                  onChange={(e) => setNewOrgDomain(e.target.value)}
                  placeholder="e.g. netflix.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-md transition cursor-pointer"
              >
                Add Organization
              </button>
            </form>
          </div>

          {/* Provision User & Assign Membership */}
          <div className="bg-white p-5 rounded-lg border border-slate-200 space-y-4 shadow-xs">
            <h2 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-2">
              Assign User Membership & Provision
            </h2>

            <form onSubmit={handleAssignRole} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  User Email Address
                </label>
                <input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="e.g. rohan@netflix.com"
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Organization
                  </label>
                  <select
                    value={targetOrg}
                    onChange={(e) => setTargetOrg(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none bg-white cursor-pointer"
                  >
                    {orgs.length > 0 ? (
                      orgs.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))
                    ) : (
                      <option value="">No Orgs Found</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Role
                  </label>
                  <select
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none bg-white cursor-pointer"
                  >
                    <option value="ORG_ADMIN">ORG_ADMIN</option>
                    <option value="REVIEWER">REVIEWER</option>
                    <option value="SUPPORT_AGENT">SUPPORT_AGENT</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-sm rounded-md transition cursor-pointer"
              >
                Provision User & Assign Role
              </button>
            </form>
          </div>

        </div>

        {/* Dynamic DB Table */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800">
              Registered Organizations ({orgs.length})
            </h2>
            <span className="text-xs text-slate-400 font-mono">PostgreSQL Database</span>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-6 text-center text-xs text-slate-400">Loading organizations from database...</div>
            ) : orgs.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">No client organizations found in database. Add one above!</div>
            ) : (
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Organization Name</th>
                    <th className="py-3 px-4">Domain</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orgs.map((org) => (
                    <tr key={org.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-semibold text-slate-900">{org.name}</td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-xs">{org.domain || 'N/A'}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-800">
                          Active
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteOrg(org.id, org.name)}
                          className="text-rose-600 hover:underline text-xs font-semibold cursor-pointer"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}