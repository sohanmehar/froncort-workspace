'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

export default function Navbar() {
  const { user, logout, switchOrg } = useAuth();

  if (!user) return null;

  const memberships = user.memberships || [];
  const currentOrg = memberships.find(
    (m) => m.organization?.id === user.activeOrgId
  )?.organization;

  return (
    <header className="bg-slate-900 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <span className="font-extrabold text-xl tracking-tight text-indigo-400">
            Froncort<span className="text-white">.AI</span>
          </span>

          <nav className="flex space-x-4 text-sm font-medium">
            <Link
              href="/dashboard"
              className="px-3 py-2 rounded-md hover:bg-slate-800 text-gray-200"
            >
              Support Hub
            </Link>
            <Link
              href="/dashboard/reviews"
              className="px-3 py-2 rounded-md hover:bg-slate-800 text-gray-200"
            >
              Review & Audit Console
            </Link>
            <Link
              href="/dashboard/audit"
              className="px-3 py-2 rounded-md hover:bg-slate-800 text-gray-200"
            >
              Unified Audit Trail
            </Link>
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          {/* Organization Switcher */}
          {memberships.length > 0 && (
            <div className="flex items-center space-x-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
              <span className="text-xs text-gray-400">Active Org:</span>
              <select
                value={user.activeOrgId || ''}
                onChange={(e) => switchOrg(e.target.value)}
                className="bg-transparent text-sm font-semibold text-indigo-300 focus:outline-none cursor-pointer"
              >
                {memberships.map((m) => (
                  <option
                    key={m.organization?.id}
                    value={m.organization?.id}
                    className="bg-slate-900 text-white"
                  >
                    {m.organization?.name || 'Organization'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="text-right text-xs">
            <p className="font-semibold text-gray-200">{user.fullName}</p>
            <p className="text-indigo-400 capitalize">
              {user.role ? user.role.toLowerCase() : ''}
            </p>
          </div>

          <button
            onClick={logout}
            className="px-3 py-1.5 bg-red-600/80 hover:bg-red-600 text-white text-xs font-semibold rounded-md transition cursor-pointer"
          >
            Logout Everywhere
          </button>
        </div>
      </div>
    </header>
  );
}