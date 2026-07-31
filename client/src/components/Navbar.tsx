'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function Navbar() {
  const { user, logout, switchOrg } = useAuth();
  const pathname = usePathname();
  const [isSwitching, setIsSwitching] = useState(false);

  // Active membership determination
  const memberships = user?.memberships || [];
  const activeMembership = memberships.find(
    (m: any) => m.orgId === user?.activeOrgId || m.organizationId === user?.activeOrgId
  );

  const roleDisplay = user?.role || activeMembership?.role || 'SUPPORT_AGENT';
  
  // Platform Super Admin Role Check
  const isSuperAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'PLATFORM_SUPER_ADMIN';

  const activeOrgName =
    (activeMembership as any)?.organization?.name ||
    (activeMembership as any)?.orgName ||
    (user as any)?.activeOrgName ||
    'Google Org';

  // Role-Aware Navigation Links
  const navLinks = isSuperAdmin
    ? [
        { name: '⚡ Platform Console', href: '/admin' },
        { name: 'Unified Audit Trail', href: '/dashboard/audit' },
      ]
    : [
        { name: 'Support Hub', href: '/dashboard' },
        { name: 'Review & Audit Console', href: '/dashboard/reviews' },
        { name: 'Unified Audit Trail', href: '/dashboard/audit' },
      ];

  const handleOrgChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const targetOrgId = e.target.value;
    if (targetOrgId && targetOrgId !== user?.activeOrgId) {
      setIsSwitching(true);
      await switchOrg(targetOrgId);
      setIsSwitching(false);
    }
  };

  return (
    <nav className="bg-slate-950 text-white px-6 py-3.5 flex items-center justify-between border-b border-slate-800 shadow-md sticky top-0 z-40 font-sans">
      <div className="flex items-center gap-8">
        <Link href={isSuperAdmin ? "/admin" : "/dashboard"} className="text-xl font-bold tracking-tight hover:opacity-90 transition cursor-pointer flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-black text-white text-base shadow-lg shadow-indigo-500/30">
            F
          </div>
          <span>
            Froncort<span className="text-indigo-400">.AI</span>
          </span>
        </Link>

        {/* Dynamic Navigation Links */}
        <div className="flex items-center gap-1 text-sm font-medium">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                {link.name}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs">
        
        {/* 🏢 Multi-Tenant Org Switcher */}
        {!isSuperAdmin && (
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider hidden md:inline">Org:</span>
            
            {memberships.length > 1 ? (
              <select
                value={user?.activeOrgId || ''}
                onChange={handleOrgChange}
                disabled={isSwitching}
                className="bg-slate-950 text-emerald-400 font-bold text-xs rounded-lg px-2 py-1 border border-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                {memberships.map((m: any) => (
                  <option key={m.orgId || m.organizationId} value={m.orgId || m.organizationId}>
                    {m.orgName || m.organization?.name || 'Organization'} ({m.role})
                  </option>
                ))}
              </select>
            ) : (
              <div className="bg-slate-950 text-emerald-400 font-bold text-xs rounded-lg px-2 py-1 border border-slate-700">
                {activeOrgName}
              </div>
            )}
          </div>
        )}

        {/* 👤 User Identity & Role Badge */}
        <div className="flex items-center gap-2 text-slate-200 font-medium bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
          <span className="font-bold">{user?.fullName || 'User'}</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-md font-mono uppercase font-bold border ${
              isSuperAdmin
                ? 'bg-purple-950 text-purple-300 border-purple-700/80'
                : 'bg-indigo-950 text-indigo-300 border-indigo-800/60'
            }`}
          >
            {isSuperAdmin ? '⚡ PLATFORM_SUPER_ADMIN' : roleDisplay}
          </span>
        </div>

        {/* 🚪 Logout Everywhere */}
        <button
          onClick={logout}
          className="bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm active:scale-95 flex items-center gap-1.5"
        >
          Logout Everywhere
        </button>
      </div>
    </nav>
  );
}