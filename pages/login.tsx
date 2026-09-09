import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Database,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await login(email, password);
    setLoading(false);

    if (res.success) {
      router.push('/');
    } else {
      setError(res.message || 'Invalid email or password');
    }
  };

  return (
    <div className="min-h-screen bg-[#050b14] flex items-center justify-center p-4 selection:bg-emerald-500 selection:text-white relative overflow-hidden">
      {/* ================= DATA-HUB CYBER GRID BACKGROUND ================= */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Subtle Cyber Grid Lines */}
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: `
              linear-gradient(to right, #10b981 1px, transparent 1px),
              linear-gradient(to bottom, #10b981 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Radiant Emerald & Teal Glowing Ambient Orbs */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[720px] bg-emerald-500/10 rounded-full blur-[130px]" />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-80 h-80 bg-emerald-600/10 rounded-full blur-3xl" />

        {/* Concentric Orbital Rings (Circular Radar DataHub Motif) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] h-[560px] rounded-full border border-emerald-500/10 pointer-events-none animate-pulse-ring" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[720px] rounded-full border border-dashed border-emerald-500/15 pointer-events-none animate-spin-slow" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full border border-emerald-500/5 pointer-events-none" />
      </div>

      {/* Floating System Coordinates (Top Left) */}
      <div className="absolute top-6 left-6 z-30 hidden md:flex items-center gap-2.5 text-xs text-emerald-400/70 font-mono tracking-wider">
        <Terminal className="w-4 h-4 text-emerald-400" />
        <span>DATAHUB://AUTH_NODE_01</span>
      </div>

      {/* Floating Header Gateway Badge (Top Right) */}
      <div className="absolute top-6 right-6 z-30 flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-mono shadow-sm shadow-emerald-500/10">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>GATEWAY ONLINE</span>
        </div>
      </div>

      {/* ================= PERFECT CIRCULAR DATA-HUB LOGIN CARD ================= */}
      <div className="relative z-10 w-full max-w-[420px]">
        {/* Outer Rotating Dashed Circular Ring */}
        <div className="absolute -inset-3 rounded-[3.25rem] border border-dashed border-emerald-500/30 animate-spin-slow pointer-events-none" />

        {/* Glowing Outer Emerald Halo */}
        <div className="absolute -inset-1 rounded-[3.15rem] bg-gradient-to-b from-emerald-500/40 via-teal-500/20 to-emerald-500/40 blur-lg opacity-80 pointer-events-none" />

        {/* The Card Container with Emerald Border & Balanced Circular Capsule Silhouette */}
        <div className="relative rounded-[3rem] border-2 border-emerald-400/90 bg-[#0a111e]/95 backdrop-blur-2xl shadow-[0_0_50px_-5px_rgba(16,185,129,0.4)] p-8 sm:p-9 space-y-5 transition-all hover:border-emerald-300">
          {/* Circular Core Crest with Concentric Rings */}
          <div className="flex flex-col items-center text-center space-y-2.5">
            <div className="relative group mt-1">
              {/* Outer rotating dashed ring */}
              <div className="absolute -inset-3 rounded-full border border-dashed border-emerald-400/50 animate-spin-slow pointer-events-none" />
              {/* Inner glowing pulse ring */}
              <div className="absolute -inset-1.5 rounded-full border border-emerald-400/60 animate-pulse pointer-events-none" />

              {/* Central Glowing Circular Crest */}
              <div className="relative w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/40 group-hover:scale-105 transition-transform">
                <Database className="w-7 h-7 text-white drop-shadow-md" />
              </div>
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold tracking-wider uppercase mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                DataHub Secure Gateway
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white">
                DATA<span className="text-emerald-400">HUB</span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Centralized Contact & Ingestion Platform
              </p>
            </div>
          </div>

          {/* Telemetry Status Ribbon in Circular Pill */}
          <div className="grid grid-cols-3 gap-2 py-2 px-3.5 rounded-full bg-emerald-950 border border-emerald-500 text-center font-mono text-[10px]">
            <div>
              <span className="text-slate-400">PORT:</span>{' '}
              <span className="text-emerald-400 font-bold">5000</span>
            </div>
            <div className="border-x border-emerald-500">
              <span className="text-slate-400">SSL:</span>{' '}
              <span className="text-teal-300 font-bold">256-BIT</span>
            </div>
            <div>
              <span className="text-slate-400">STATUS:</span>{' '}
              <span className="text-emerald-400 font-bold">ONLINE</span>
            </div>
          </div>

          {/* Error Alert Box */}
          {error && (
            <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Authentication Form with Circular Pill Inputs */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 ml-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-emerald-400/80 absolute left-4 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-11 pr-4 py-3 bg-slate-900/90 border border-emerald-500/30 hover:border-emerald-500/60 rounded-full text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/25 transition-all shadow-inner"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 ml-2">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-emerald-400/80 absolute left-4 top-3.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3 bg-slate-900/90 border border-emerald-500/30 hover:border-emerald-500/60 rounded-full text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/25 transition-all shadow-inner"
                />
              </div>
            </div>

            {/* Glowing Circular Pill Sign-In Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-6 rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-white font-bold text-xs tracking-wider shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>SIGN IN</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer with Security Telemetry & Registration */}
          <div className="pt-2 text-center space-y-2 border-t border-emerald-500/20">
            <p className="text-xs text-slate-400">
              New organization?{' '}
              <Link
                href="/register"
                className="text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-4"
              >
                Create an account
              </Link>
            </p>


          </div>
        </div>
      </div>
    </div>
  );
}
