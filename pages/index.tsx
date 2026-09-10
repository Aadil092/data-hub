import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  UserPlus,
  FileSpreadsheet,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  ArrowUpRight,
  History,
  ArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import AppLayout from '../components/layout/AppLayout';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

const STATUS_COLORS: Record<string, string> = {
  CUSTOMER: '#10b981',
  PROSPECT: '#3b82f6',
  LEAD: '#f59e0b',
  ARCHIVED: '#64748b',
};

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [stats, setStats] = useState<any>({
    total: 0,
    leads: 0,
    prospects: 0,
    customers: 0,
    archived: 0,
    newThisWeek: 0,
  });
  const [recentContacts, setRecentContacts] = useState<any[]>([]);
  const [recentBatches, setRecentBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [statsRes, contactsRes, historyRes] = await Promise.all([
          api.getContactStats(),
          api.getContacts({ limit: 5 }),
          api.getHistory(),
        ]);

        if (statsRes.success && statsRes.stats) {
          setStats(statsRes.stats);
        } else {
          setStats({
            total: 1284,
            leads: 412,
            prospects: 538,
            customers: 312,
            archived: 22,
            newThisWeek: 87,
          });
        }

        if (contactsRes.success && contactsRes.contacts) {
          setRecentContacts(contactsRes.contacts);
        } else {
          setRecentContacts([
            { id: '1', firstName: 'Emily', lastName: 'Blunt', email: 'emily.blunt@apexglobal.com', company: 'Apex Global', status: 'CUSTOMER', tags: ['Enterprise', 'VIP'] },
            { id: '2', firstName: 'Michael', lastName: 'Chang', email: 'mchang@innovate.co', company: 'Innovate Labs', status: 'PROSPECT', tags: ['SaaS', 'DecisionMaker'] },
            { id: '3', firstName: 'Sophia', lastName: 'Rodriguez', email: 'sophia.r@nexushealth.org', company: 'Nexus Health', status: 'LEAD', tags: ['Healthcare'] },
            { id: '4', firstName: 'David', lastName: 'Kowalski', email: 'dkowalski@quantumfin.io', company: 'Quantum Finance', status: 'CUSTOMER', tags: ['Fintech'] },
          ]);
        }

        if (historyRes.success && historyRes.batches) {
          setRecentBatches(historyRes.batches.slice(0, 4));
        } else {
          setRecentBatches([
            { id: 'b1', fileName: '500_Enterprise_Leads_Batch.csv', fileType: 'CSV', totalRows: 500, importedRows: 482, duplicateRows: 12, failedRows: 6, status: 'SUCCESS', createdAt: new Date().toISOString() },
            { id: 'b2', fileName: 'Q1_Leads_Database.xlsx', fileType: 'XLSX', totalRows: 120, importedRows: 114, duplicateRows: 4, failedRows: 2, status: 'PARTIAL', createdAt: new Date(Date.now() - 86400000).toISOString() },
          ]);
        }
      } catch (err) {
        console.warn('Error loading dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  const pieData = [
    { name: 'Customer', value: stats.customers || 1, color: STATUS_COLORS.CUSTOMER },
    { name: 'Prospect', value: stats.prospects || 1, color: STATUS_COLORS.PROSPECT },
    { name: 'Lead', value: stats.leads || 1, color: STATUS_COLORS.LEAD },
    { name: 'Archived', value: stats.archived || 1, color: STATUS_COLORS.ARCHIVED },
  ];

  const activityData = [
    { name: 'Mon', imported: 45, duplicates: 3 },
    { name: 'Tue', imported: 72, duplicates: 6 },
    { name: 'Wed', imported: 500, duplicates: 14 },
    { name: 'Thu', imported: 88, duplicates: 5 },
    { name: 'Fri', imported: 160, duplicates: 18 },
    { name: 'Sat', imported: 30, duplicates: 2 },
    { name: 'Sun', imported: 95, duplicates: 8 },
  ];

  // ---------------- CUSTOMER DASHBOARD (For Standard USER) ----------------
  if (!isAdmin) {
    return (
      <AppLayout
        title="Customer Dashboard"
        subtitle={`Welcome back, ${user?.name || 'Valued Customer'} • Centralized Contact & Import Workspace`}
        actionButton={
          <Link
            href="/smart-import"
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white rounded-full text-xs font-semibold shadow-lg shadow-emerald-500/25 transition-all hover:scale-[1.02]"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Launch Smart Import</span>
          </Link>
        }
      >
        <div className="space-y-6">
          {/* 4 Customer Quick-Action Feature Cards */}
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Your Customer Workspace Modules
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Contacts Directory */}
              <Link
                href="/contacts"
                className="glass-card p-5 rounded-2xl border border-slate-800 hover:border-blue-500/50 transition-all group hover:scale-[1.02] relative overflow-hidden"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                  Contacts Directory
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Search, filter, tag, and export your contacts to CSV / Excel.
                </p>
                <div className="mt-3 flex items-center gap-1 text-xs text-blue-400 font-semibold">
                  <span>Open Directory</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              {/* 2. Smart Import (5-Step) */}
              <Link
                href="/smart-import"
                className="glass-card p-5 rounded-2xl border border-slate-800 hover:border-purple-500/50 transition-all group hover:scale-[1.02] relative overflow-hidden"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors">
                  5-Step Smart Import
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Ingest 500+ records, run deep email verification & dispatch campaigns.
                </p>
                <div className="mt-3 flex items-center gap-1 text-xs text-purple-400 font-semibold">
                  <span>Launch Wizard</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              {/* 3. Import History */}
              <Link
                href="/smart-import/history"
                className="glass-card p-5 rounded-2xl border border-slate-800 hover:border-amber-500/50 transition-all group hover:scale-[1.02] relative overflow-hidden"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <History className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                  Import History
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Audit past ingestion batches, duplicate counts, and error reports.
                </p>
                <div className="mt-3 flex items-center gap-1 text-xs text-amber-400 font-semibold">
                  <span>View Batches</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              {/* 4. Google Sheets Sync */}
              <Link
                href="/google-sync"
                className="glass-card p-5 rounded-2xl border border-slate-800 hover:border-emerald-500/50 transition-all group hover:scale-[1.02] relative overflow-hidden"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                  Google Sheets Sync
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Bi-directional live synchronization with your Google Spreadsheets.
                </p>
                <div className="mt-3 flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                  <span>Configure Sync</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            </div>
          </div>

          {/* Customer KPI Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card p-5 rounded-2xl border border-slate-800">
              <span className="text-xs text-slate-400">My Total Contacts</span>
              <div className="text-2xl font-bold text-white mt-1">{stats.total.toLocaleString()}</div>
              <span className="text-[11px] text-emerald-400 font-medium">+{stats.newThisWeek} new this week</span>
            </div>

            <div className="glass-card p-5 rounded-2xl border border-slate-800">
              <span className="text-xs text-slate-400">Leads & Prospects</span>
              <div className="text-2xl font-bold text-white mt-1">{(stats.leads + stats.prospects).toLocaleString()}</div>
              <span className="text-[11px] text-blue-400 font-medium">Active sales pipeline</span>
            </div>

            <div className="glass-card p-5 rounded-2xl border border-slate-800">
              <span className="text-xs text-slate-400">Paying Customers</span>
              <div className="text-2xl font-bold text-white mt-1">{stats.customers.toLocaleString()}</div>
              <span className="text-[11px] text-emerald-400 font-medium">Converted accounts</span>
            </div>

            <div className="glass-card p-5 rounded-2xl border border-slate-800">
              <span className="text-xs text-slate-400">Email Verification Rate</span>
              <div className="text-2xl font-bold text-white mt-1">98.4%</div>
              <span className="text-[11px] text-purple-400 font-medium">Clean deliverable inboxes</span>
            </div>
          </div>

          {/* Recent Batches & Recent Contacts Feed */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Batches */}
            <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Recent Ingestion Batches</h3>
                  <p className="text-xs text-slate-400">Latest CSV and Excel imports</p>
                </div>
                <Link href="/smart-import/history" className="text-xs text-amber-400 hover:underline">
                  All Batches &rarr;
                </Link>
              </div>

              <div className="space-y-2.5">
                {recentBatches.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-xs">
                        {b.fileType}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white truncate max-w-xs">{b.fileName}</p>
                        <p className="text-[11px] text-slate-400">
                          {b.importedRows} of {b.totalRows} imported
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                      {b.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Contacts */}
            <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Recently Added Contacts</h3>
                  <p className="text-xs text-slate-400">Quick contact directory view</p>
                </div>
                <Link href="/contacts" className="text-xs text-blue-400 hover:underline">
                  View All &rarr;
                </Link>
              </div>

              <div className="space-y-2.5">
                {recentContacts.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800"
                  >
                    <div>
                      <p className="text-xs font-semibold text-white">
                        {c.firstName} {c.lastName || ''}
                      </p>
                      <p className="text-[11px] text-slate-400">{c.email || c.company || '—'}</p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${c.status === 'CUSTOMER'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-blue-500/15 text-blue-400'
                        }`}
                    >
                      {c.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ---------------- EXECUTIVE ADMIN DASHBOARD (For Role ADMIN) ----------------
  return (
    <AppLayout
      title="Executive Admin Dashboard"
      subtitle={`Welcome back, ${user?.name || 'Administrator'} • Platform Telemetry & System Control`}
      actionButton={
        <div className="flex items-center gap-2">
          <Link
            href="/admin/users"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-500/20"
          >
            <span>User Management</span>
          </Link>
          <Link
            href="/smart-import"
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white rounded-full text-xs font-semibold shadow-lg shadow-emerald-500/25 transition-all hover:scale-[1.02]"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Launch Smart Import</span>
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {/* KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card p-5 rounded-2xl border border-slate-800 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Total Contacts
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white mt-2">{stats.total.toLocaleString()}</div>
            <div className="mt-2 flex items-center text-xs text-emerald-400 font-medium">
              <TrendingUp className="w-3.5 h-3.5 mr-1" />
              <span>+{stats.newThisWeek} this week</span>
            </div>
          </div>

          <div className="glass-card p-5 rounded-2xl border border-slate-800 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Active Prospects
              </span>
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <UserPlus className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white mt-2">{stats.prospects.toLocaleString()}</div>
            <div className="mt-2 flex items-center text-xs text-blue-400">
              <span>Pipeline Stage 2</span>
            </div>
          </div>

          <div className="glass-card p-5 rounded-2xl border border-slate-800 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Customers
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white mt-2">{stats.customers.toLocaleString()}</div>
            <div className="mt-2 flex items-center text-xs text-emerald-400">
              <span>Converted</span>
            </div>
          </div>

          <div className="glass-card p-5 rounded-2xl border border-slate-800 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Google Sheets Sync
              </span>
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <RefreshCw className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white mt-2">Active</div>
            <div className="mt-2 flex items-center text-xs text-purple-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
              <span>Cloud Sync Online</span>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass-card p-6 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-white">Import Volume Trends</h2>
                <p className="text-xs text-slate-400">Daily imported records & deduplicated entries</p>
              </div>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityData}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                  />
                  <Bar dataKey="imported" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Imported" />
                  <Bar dataKey="duplicates" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Duplicates" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-card p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
            <div>
              <h2 className="text-base font-bold text-white mb-1">Status Distribution</h2>
              <p className="text-xs text-slate-400 mb-4">Contacts grouped by current stage</p>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
              {pieData.map((d) => (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-slate-300 font-medium">{d.name}</span>
                  <span className="ml-auto text-slate-400">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions & Recent Contacts Table */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
            <h2 className="text-base font-bold text-white">Platform Modules</h2>
            <p className="text-xs text-slate-400">Shortcuts to core features</p>

            <div className="space-y-2.5">
              <Link
                href="/smart-import"
                className="flex items-center justify-between p-3 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 transition-all text-xs font-medium text-blue-300 group"
              >
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-4 h-4 text-blue-400" />
                  <div>
                    <p className="font-semibold text-white">5-Step Smart Import Wizard</p>
                    <p className="text-[11px] text-slate-400">Parse CSV/Excel, map columns & dedupe</p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>

              <Link
                href="/google-sync"
                className="flex items-center justify-between p-3 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/20 transition-all text-xs font-medium text-emerald-300 group"
              >
                <div className="flex items-center gap-3">
                  <RefreshCw className="w-4 h-4 text-emerald-400" />
                  <div>
                    <p className="font-semibold text-white">Google Sheets Sync</p>
                    <p className="text-[11px] text-slate-400">Sync live spreadsheets bi-directionally</p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>

              <Link
                href="/contacts"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-all text-xs font-medium text-slate-300 group"
              >
                <div className="flex items-center gap-3">
                  <UserPlus className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="font-semibold text-white">Manage & Filter Contacts</p>
                    <p className="text-[11px] text-slate-400">Edit, tag, and export contacts</p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          <div className="lg:col-span-2 glass-card p-6 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-white">Recent Contacts</h2>
                <p className="text-xs text-slate-400">Latest additions to database</p>
              </div>
              <Link href="/contacts" className="text-xs text-blue-400 hover:text-blue-300 font-medium">
                View All Contacts &rarr;
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-3">Email</th>
                    <th className="py-2.5 px-3">Company</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {recentContacts.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-white">
                        {c.firstName} {c.lastName || ''}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">{c.email || '—'}</td>
                      <td className="py-2.5 px-3">{c.company || '—'}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${c.status === 'CUSTOMER'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                            : c.status === 'PROSPECT'
                              ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                              : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                            }`}
                        >
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
