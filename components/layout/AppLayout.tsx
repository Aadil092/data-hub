import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  LayoutDashboard,
  Users,
  FileSpreadsheet,
  History,
  RefreshCw,
  ShieldAlert,
  FileText,
  Activity,
  LogOut,
  ChevronRight,
  Menu,
  X,
  Database,
  BarChart3,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from '../ui/ThemeToggle';

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actionButton?: React.ReactNode;
}

export default function AppLayout({ children, title, subtitle, actionButton }: AppLayoutProps) {
  const { user, isAdmin, logout } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = [
    { name: isAdmin ? 'Executive Dashboard' : 'Customer Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Contacts', href: '/contacts', icon: Users },
    { name: 'Smart Import', href: '/import', icon: FileSpreadsheet, badge: '5-Step' },
    { name: 'Import History', href: '/import/history', icon: History },
    { name: 'Google Sheets Sync', href: '/google-sync', icon: RefreshCw },
    { name: 'Web Data Analyzer', href: '/analyzer', icon: BarChart3 },
  ];

  const adminNavigation = [
    { name: 'User Management', href: '/admin/users', icon: ShieldAlert },
    { name: 'Audit Logs', href: '/admin/audit', icon: FileText },
    { name: 'System Statistics', href: '/admin/stats', icon: Activity },
  ];

  const isActive = (path: string) => {
    if (path === '/' && router.pathname === '/') return true;
    if (path !== '/' && router.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <div className="flex h-screen bg-[#050b14] text-slate-100 antialiased overflow-hidden">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-[#0a111e] border-r border-emerald-500/20 p-4 justify-between">
        <div className="space-y-6">
          {/* Brand Logo */}
          <div className="flex items-center justify-between px-2 pt-2">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/25 group-hover:scale-105 transition-transform">
                <Database className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-xl font-bold tracking-tight text-white">
                  DATA<span className="text-emerald-400">HUB</span>
                </span>
                <span className="block text-[10px] tracking-wider text-emerald-400/90 font-mono font-semibold uppercase">
                  {isAdmin ? 'Admin Console' : 'Customer Portal'}
                </span>
              </div>
            </Link>
          </div>

          {/* Main Navigation */}
          <div className="space-y-1">
            <div className="px-3 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              {isAdmin ? 'Workspace' : 'Customer Workspace'}
            </div>
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${active
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm shadow-emerald-500/10'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${active ? 'text-emerald-400' : 'text-slate-400'}`} />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Admin Navigation (ONLY VISIBLE WHEN USER IS ADMIN) */}
          {isAdmin && (
            <div className="space-y-1 pt-2 border-t border-slate-800/60">
              <div className="flex items-center justify-between px-3 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <span>Admin Console</span>
                <span className="px-1.5 py-0.2 text-[9px] bg-purple-500/20 text-purple-300 rounded font-mono">
                  ACTIVE
                </span>
              </div>
              {adminNavigation.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${active
                      ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${active ? 'text-purple-400' : 'text-slate-400'}`} />
                      <span>{item.name}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Appearance & User Card & Logout */}
        <div className="pt-4 border-t border-slate-800/80 space-y-3">


          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-red-600 to-red-600  font-bold text-xs flex items-center justify-center shrink-0 shadow-sm shadow-red-500/20">
                {user?.name
                  ? user.name
                    .split(' ')
                    .map((n: string) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()
                  : 'AK'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate">{user?.name || 'Customer'}</p>
                <span
                  className={`inline-block text-[10px] px-1.5 py-0.2 rounded font-semibold ${isAdmin
                    ? 'bg-red-500/20 text-red-300'
                    : 'bg-emerald-500/20 text-emerald-300'
                    }`}
                >
                  {isAdmin ? 'ADMINISTRATOR' : 'CUSTOMER'}
                </span>
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 border-b border-emerald-500/20 bg-[#0a111e]/80 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">{title || 'DATAHUB'}</h1>
              {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {actionButton}
            <ThemeToggle />
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-medium shadow-sm shadow-emerald-500/10">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>NODE ONLINE</span>
            </div>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0a111e] border-b border-emerald-500/20 p-4 space-y-3">
            <div className="flex items-center justify-between px-2 pb-2 border-b border-emerald-500/20">
              <span className="text-xs font-semibold text-slate-400">Appearance</span>
              <ThemeToggle showLabel />
            </div>
            {(isAdmin ? navigation.concat(adminNavigation) : navigation).map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800"
                >
                  <Icon className="w-4 h-4 text-emerald-400" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        )}

        {/* Page Body Viewport with Cyber Grid Background */}
        <main className="flex-1 overflow-y-auto p-6 bg-[#050b14] relative">
          <div
            className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(to right, #10b981 1px, transparent 1px),
                linear-gradient(to bottom, #10b981 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px',
            }}
          />
          <div className="relative z-10 max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
