'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import API from '@/lib/api';

export default function Navbar() {
  const { user, logout, switchOrg } = useAuth();
  const pathname = usePathname();
  const [isSwitching, setIsSwitching] = useState(false);

  // Notification Bell State
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [notifTab, setNotifTab] = useState<'ALL' | 'UNREAD' | 'TICKETS' | 'PRS' | 'DIGEST'>('ALL');

  const memberships = user?.memberships || [];
  const activeMembership = memberships.find(
    (m: any) => m.orgId === user?.activeOrgId || m.organizationId === user?.activeOrgId
  );

  const roleDisplay = user?.role || activeMembership?.role || 'SUPPORT_AGENT';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'PLATFORM_SUPER_ADMIN';

  const activeOrgName =
    (activeMembership as any)?.organization?.name ||
    (activeMembership as any)?.orgName ||
    (user as any)?.activeOrgName ||
    'Organization';

  useEffect(() => {
    if (user && !isSuperAdmin) {
      fetchNotifications();
    }
  }, [user]);

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

  const navLinks = isSuperAdmin
    ? [
        { name: 'Platform Console', href: '/admin' },
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

  const filteredNotifications = notifications.filter((n) => {
    const title = (n.title || '').toLowerCase();
    const message = (n.message || '').toLowerCase();

    const isDigest = title.includes('digest') || title.includes('ai progress') || message.includes('personalized digest');
    const isPR = title.includes('pull request') || title.includes('pr') || message.includes('pull request') || message.includes('review');
    const isTicket = title.includes('ticket') || message.includes('ticket');

    if (notifTab === 'UNREAD') return !n.isRead;
    if (notifTab === 'TICKETS') return isTicket && !isDigest;
    if (notifTab === 'PRS') return isPR && !isDigest;
    if (notifTab === 'DIGEST') return isDigest;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <nav className="bg-white text-slate-900 px-6 py-2.5 flex items-center justify-between border-b border-slate-200 shadow-xs sticky top-0 z-50 font-sans">
      <div className="flex items-center gap-8">
        <Link href={isSuperAdmin ? "/admin" : "/dashboard"} className="text-base font-semibold tracking-tight hover:opacity-90 transition cursor-pointer flex items-center gap-2">
          <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center font-bold text-white text-xs shadow-xs">
            F
          </div>
          <span className="text-slate-900 font-bold">
            Froncort<span className="text-indigo-600">.AI</span>
          </span>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-1 text-xs font-medium">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded transition cursor-pointer ${
                  isActive
                    ? 'bg-slate-100 text-indigo-600 font-semibold border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {link.name}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs">
        
        {/* Organization Switcher */}
        {!isSuperAdmin && (
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded px-2.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span className="text-slate-500 text-[11px] font-medium hidden md:inline">Org:</span>
            
            {memberships.length > 1 ? (
              <select
                value={user?.activeOrgId || ''}
                onChange={handleOrgChange}
                disabled={isSwitching}
                className="bg-transparent text-slate-800 font-semibold text-xs focus:outline-none cursor-pointer"
              >
                {memberships.map((m: any) => (
                  <option key={m.orgId || m.organizationId} value={m.orgId || m.organizationId} className="bg-white text-slate-900">
                    {m.orgName || m.organization?.name || 'Organization'} ({m.role})
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-slate-800 font-semibold text-xs">
                {activeOrgName}
              </div>
            )}
          </div>
        )}

        {/* Notification Bell */}
        {!isSuperAdmin && (
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifMenu(!showNotifMenu);
                fetchNotifications();
              }}
              className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-slate-600 relative transition cursor-pointer flex items-center justify-center"
              title="Notifications"
            >
              <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-indigo-600 rounded-full"></span>
              )}
            </button>

            {showNotifMenu && (
              <div className="absolute right-0 mt-2 w-96 bg-white text-slate-900 border border-slate-200 rounded-lg shadow-xl z-50 font-sans overflow-hidden">
                <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900">
                      Notifications
                    </span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded font-mono font-bold">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <button 
                    onClick={() => setShowNotifMenu(false)}
                    className="text-slate-400 hover:text-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    Close
                  </button>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1 p-2 bg-slate-50/80 border-b border-slate-100 text-[11px]">
                  {(['ALL', 'UNREAD', 'TICKETS', 'PRS', 'DIGEST'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setNotifTab(tab)}
                      className={`px-2 py-1 rounded transition cursor-pointer font-medium ${
                        notifTab === tab
                          ? 'bg-indigo-600 text-white font-semibold'
                          : 'text-slate-600 hover:bg-slate-200/60'
                      }`}
                    >
                      {tab === 'ALL' ? 'All' : tab === 'UNREAD' ? 'Unread' : tab === 'TICKETS' ? 'Tickets' : tab === 'PRS' ? 'PRs' : 'AI Digest'}
                    </button>
                  ))}
                </div>

                {/* Items List */}
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 p-1 bg-white">
                  {filteredNotifications.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-xs text-slate-400">No notifications in this tab.</p>
                    </div>
                  ) : (
                    filteredNotifications.map((n) => {
                      const cleanTitle = (n.title || '').replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
                      
                      return (
                        <div key={n.id} className="p-3 bg-slate-50/60 hover:bg-slate-100/80 transition rounded my-1 border border-slate-100 space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-900 text-xs">
                              {cleanTitle}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                            </span>
                          </div>
                          <p className="text-slate-600 text-[11px] leading-relaxed">
                            {n.message}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* User Identity */}
        <div className="flex items-center gap-2 text-slate-700 text-xs font-medium bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200">
          <span className="font-semibold text-slate-800">{user?.fullName || 'User'}</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold uppercase ${
              isSuperAdmin
                ? 'bg-purple-100 text-purple-700 border border-purple-200'
                : 'bg-slate-200 text-slate-700 border border-slate-300'
            }`}
          >
            {isSuperAdmin ? 'SUPER_ADMIN' : roleDisplay}
          </span>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-3 py-1.5 rounded text-xs font-medium transition cursor-pointer active:scale-95"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}