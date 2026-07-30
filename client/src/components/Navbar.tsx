'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();

  const activeMembership = user?.memberships?.find(
    (m: any) => m.orgId === user?.activeOrgId || m.organizationId === user?.activeOrgId
  );

  const roleDisplay = user?.role || activeMembership?.role || 'SUPPORT_AGENT';

  return (
    <nav className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
      <div className="flex items-center gap-8">
        <Link href="/dashboard" className="text-xl font-bold tracking-tight">
          Froncort<span className="text-indigo-400">.AI</span>
        </Link>
        <div className="flex gap-6 text-sm font-medium">
          <Link href="/dashboard" className="hover:text-indigo-300 transition">
            Support Hub
          </Link>
          <Link href="/dashboard/reviews" className="hover:text-indigo-300 transition">
            Review & Audit Console
          </Link>
          <Link href="/dashboard/audit" className="hover:text-indigo-300 transition">
            Unified Audit Trail
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <span className="text-slate-300 font-medium">
          {user?.fullName || 'User'}{' '}
          <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded font-mono">
            ({roleDisplay})
          </span>
        </span>
        <button
          onClick={logout}
          className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
        >
          Logout Everywhere
        </button>
      </div>
    </nav>
  );
}