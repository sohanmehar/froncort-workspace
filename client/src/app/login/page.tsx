'use client';

import React, { useState } from 'react';
import API from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await API.post('/auth/login', { email, password });
      login(res.data.token, res.data.user);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid credentials. Check email or password.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('password123');
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-12 bg-slate-50 font-sans text-slate-900">
      
      {/* Left Column: Brand & Security Features */}
      <div className="lg:col-span-6 xl:col-span-7 bg-slate-950 p-8 lg:p-16 flex flex-col justify-between text-white relative overflow-hidden">
        <div className="flex items-center gap-2.5 z-10">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-base shadow-md">
            F
          </div>
          <span className="font-bold text-xl tracking-tight">Froncort<span className="text-indigo-400">.AI</span></span>
        </div>

        <div className="my-auto py-12 space-y-6 max-w-lg z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-950/80 border border-indigo-800/60 rounded-full text-indigo-300 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
            Unified Security Workspace
          </div>
          <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
            Multi-Tenant Compliance & Audit Console
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Secure cross-organization ticket routing, pull request approvals, and real-time immutable audit trails with strict Role-Based Access Control.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800/80">
            <div>
              <div className="text-indigo-400 font-bold text-sm">Strict RBAC</div>
              <div className="text-xs text-slate-400">Isolated Organization Contexts</div>
            </div>
            <div>
              <div className="text-emerald-400 font-bold text-sm">Immutable Audits</div>
              <div className="text-xs text-slate-400">Full Cryptographic Verification</div>
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-500 z-10">
          © 2026 Froncort Inc. Enterprise Multi-Tenant Engine.
        </div>

        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-25 pointer-events-none"></div>
      </div>

      {/* Right Column: Auth Card */}
      <div className="lg:col-span-6 xl:col-span-5 p-6 lg:p-12 flex items-center justify-center">
        <div className="w-full max-w-sm space-y-6">
          
          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Sign in</h2>
            <p className="text-xs text-slate-500">Select a demo role or enter your credentials.</p>
          </div>

          {/* Quick Demo Selector */}
          <div className="bg-slate-100 p-3 rounded-xl border border-slate-200/80 space-y-2">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              ⚡ Demo Profile Auto-Fill
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fillDemo('superadmin@froncort.ai')}
                className="px-2 py-1.5 bg-purple-900 hover:bg-purple-800 text-purple-100 text-xs font-bold rounded-lg transition cursor-pointer shadow-2xs active:scale-95 text-center border border-purple-700"
              >
                ⚡ Super Admin
              </button>
              <button
                type="button"
                onClick={() => fillDemo('john@google.com')}
                className="px-2 py-1.5 bg-white border border-slate-300 hover:border-indigo-500 hover:text-indigo-600 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer shadow-2xs active:scale-95 text-center"
              >
                Org Admin
              </button>
              <button
                type="button"
                onClick={() => fillDemo('alice@google.com')}
                className="px-2 py-1.5 bg-white border border-slate-300 hover:border-indigo-500 hover:text-indigo-600 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer shadow-2xs active:scale-95 text-center"
              >
                Reviewer
              </button>
              <button
                type="button"
                onClick={() => fillDemo('agent@google.com')}
                className="px-2 py-1.5 bg-white border border-slate-300 hover:border-indigo-500 hover:text-indigo-600 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer shadow-2xs active:scale-95 text-center"
              >
                Support Agent
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 text-xs font-medium rounded-xl border border-rose-200">
              ⚠️ {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition"
                placeholder="name@company.com"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm transition shadow-sm cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign in to Console →'}
            </button>
          </form>

        </div>
      </div>

    </div>
  );
}