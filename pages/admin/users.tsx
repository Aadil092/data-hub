import React, { useEffect, useState, useMemo } from 'react';
import Head from 'next/head';
import {
  User as UserIcon,
  UserPlus,
  Users,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Edit2,
  Trash2,
  Key,
  Eye,
  EyeOff,
  Check,
  X,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Mail,
  MoreVertical,
  Activity,
} from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  isActive: boolean;
  createdAt: string;
  _count?: {
    contacts?: number;
    imports?: number;
  };
}

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ADMIN' | 'USER'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');

  // Create User Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'USER' as 'USER' | 'ADMIN',
    isActive: true,
  });
  const [createShowPassword, setCreateShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit User Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'USER' as 'USER' | 'ADMIN',
    isActive: true,
  });
  const [editShowPassword, setEditShowPassword] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete User Confirmation State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserData | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadUsers = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await api.getAdminUsers();
      if (res.success && res.users) {
        setUsers(res.users);
      } else {
        // Fallback demo users if backend mock
        setUsers([
          {
            id: 'admin-1',
            name: 'System Administrator',
            email: 'admin@datahub.local',
            role: 'ADMIN',
            isActive: true,
            createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
            _count: { contacts: 412, imports: 8 },
          },
          {
            id: 'user-1',
            name: 'Aadil Khan',
            email: 'user@datahub.local',
            role: 'USER',
            isActive: true,
            createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
            _count: { contacts: 872, imports: 12 },
          },
          {
            id: 'user-2',
            name: 'David Miller',
            email: 'dmiller@enterprise.com',
            role: 'USER',
            isActive: false,
            createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
            _count: { contacts: 0, imports: 0 },
          },
        ]);
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Could not refresh user list.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Quick Password Generator
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let pwd = '';
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pwd;
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setCreateForm({
      name: '',
      email: '',
      password: generateRandomPassword(),
      role: 'USER',
      isActive: true,
    });
    setCreateShowPassword(true);
    setCreateError(null);
    setCreateModalOpen(true);
  };

  // Submit Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.password.trim()) {
      setCreateError('Please fill in all required fields.');
      return;
    }
    if (createForm.password.length < 6) {
      setCreateError('Password must be at least 6 characters.');
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const res = await api.createAdminUser(createForm);
      if (res.success && res.user) {
        setUsers([res.user, ...users]);
        setCreateModalOpen(false);
        showToast('success', `User "${res.user.name}" created successfully.`);
      } else {
        setCreateError(res.message || 'Failed to create user. Check email uniqueness.');
      }
    } catch (err: any) {
      setCreateError(err.message || 'Error occurred while creating user.');
    } finally {
      setCreating(false);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (user: UserData) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      isActive: user.isActive,
    });
    setEditShowPassword(false);
    setEditError(null);
    setEditModalOpen(true);
  };

  // Submit Edit User
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editForm.name.trim() || !editForm.email.trim()) {
      setEditError('Name and email cannot be empty.');
      return;
    }
    if (editForm.password && editForm.password.trim().length > 0 && editForm.password.trim().length < 6) {
      setEditError('New password must be at least 6 characters.');
      return;
    }

    setUpdating(true);
    setEditError(null);

    try {
      const payload: any = {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        role: editForm.role,
        isActive: editForm.isActive,
      };
      if (editForm.password && editForm.password.trim().length >= 6) {
        payload.password = editForm.password.trim();
      }

      const res = await api.updateAdminUser(editingUser.id, payload);
      if (res.success && res.user) {
        setUsers(users.map((u) => (u.id === editingUser.id ? { ...u, ...res.user } : u)));
        setEditModalOpen(false);
        showToast('success', `User "${res.user.name}" updated successfully.`);
      } else {
        setEditError(res.message || 'Failed to update user.');
      }
    } catch (err: any) {
      setEditError(err.message || 'Error occurred while updating user.');
    } finally {
      setUpdating(false);
    }
  };

  // Open Delete Modal
  const handleOpenDeleteModal = (user: UserData) => {
    if (currentUser && user.id === currentUser.id) {
      showToast('error', 'You cannot delete your own administrator account.');
      return;
    }
    setDeletingUser(user);
    setDeleteError(null);
    setDeleteModalOpen(true);
  };

  // Submit Delete User
  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setDeleting(true);
    setDeleteError(null);

    try {
      const res = await api.deleteAdminUser(deletingUser.id);
      if (res.success) {
        setUsers(users.filter((u) => u.id !== deletingUser.id));
        setDeleteModalOpen(false);
        showToast('success', `User "${deletingUser.name}" has been permanently deleted.`);
      } else {
        setDeleteError(res.message || 'Failed to delete user.');
      }
    } catch (err: any) {
      setDeleteError(err.message || 'Error occurred while deleting user.');
    } finally {
      setDeleting(false);
    }
  };

  // Quick Role Toggle in table
  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const res = await api.updateUserRole(userId, newRole);
      if (res.success) {
        setUsers(users.map((u) => (u.id === userId ? { ...u, role: newRole as any } : u)));
        showToast('success', 'User role updated.');
      } else {
        showToast('error', res.message || 'Failed to change role.');
      }
    } catch (err) {
      showToast('error', 'Could not update user role.');
    }
  };

  // Quick Status Toggle in table
  const handleStatusToggle = async (userId: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    try {
      const res = await api.updateUserStatus(userId, nextStatus);
      if (res.success) {
        setUsers(users.map((u) => (u.id === userId ? { ...u, isActive: nextStatus } : u)));
        showToast('success', nextStatus ? 'User account activated.' : 'User account suspended.');
      } else {
        showToast('error', res.message || 'Failed to update status.');
      }
    } catch (err) {
      showToast('error', 'Could not update user status.');
    }
  };

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        !searchQuery.trim() ||
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRole =
        roleFilter === 'ALL' ||
        (roleFilter === 'ADMIN' && u.role === 'ADMIN') ||
        (roleFilter === 'USER' && u.role === 'USER');

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && u.isActive) ||
        (statusFilter === 'SUSPENDED' && !u.isActive);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  // Statistics calculation
  const totalUsersCount = users.length;
  const adminCount = users.filter((u) => u.role === 'ADMIN').length;
  const standardCount = users.filter((u) => u.role === 'USER').length;
  const activeCount = users.filter((u) => u.isActive).length;

  if (currentUser && currentUser.role !== 'ADMIN') {
    return (
      <AppLayout title="Access Restricted" subtitle="Administrator privileges required">
        <div className="glass-card p-10 rounded-2xl border border-red-500/30 text-center max-w-md mx-auto my-12 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-white">Administrator Access Required</h2>
          <p className="text-xs text-slate-400">
            This module is reserved for platform administrators. Your account has customer permissions.
          </p>
          <a
            href="/"
            className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl"
          >
            Return to Dashboard
          </a>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Admin: User Management"
      subtitle="Provision new users, modify access credentials, control administrator roles, and manage account statuses"
    >
      <Head>
        <title>User Management | DATAHUB Admin</title>
      </Head>

      <div className="space-y-6 pb-12">
        {/* Toast Notification */}
        {toastMessage && (
          <div
            className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl border shadow-2xl flex items-center gap-2.5 text-xs font-semibold transition-all animate-bounce ${toastMessage.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300 shadow-emerald-950/50'
              : 'bg-rose-950/90 border-rose-500 text-rose-300 shadow-rose-950/50'
              }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        )}

        {/* Top KPI Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="glass-card p-4 rounded-2xl border border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Users</span>
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <span className="text-2xl font-bold text-white mt-1 block font-mono">{totalUsersCount}</span>
            <span className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              Registered Accounts
            </span>
          </div>

          <div className="glass-card p-4 rounded-2xl border border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Administrators</span>
              <Shield className="w-4 h-4 text-purple-400" />
            </div>
            <span className="text-2xl font-bold text-purple-400 mt-1 block font-mono">{adminCount}</span>
            <span className="text-[11px] text-purple-300/80 mt-1 flex items-center gap-1">
              Full Console Access
            </span>
          </div>

          <div className="glass-card p-4 rounded-2xl border border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Standard Users</span>
              <UserIcon className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-2xl font-bold text-emerald-400 mt-1 block font-mono">{standardCount}</span>
            <span className="text-[11px] text-emerald-300/80 mt-1 flex items-center gap-1">
              Standard Privileges
            </span>
          </div>

          <div className="glass-card p-4 rounded-2xl border border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Active Status</span>
              <Activity className="w-4 h-4 text-teal-400" />
            </div>
            <span className="text-2xl font-bold text-teal-300 mt-1 block font-mono">
              {activeCount} / {totalUsersCount}
            </span>
            <span className="text-[11px] text-teal-400 mt-1 flex items-center gap-1">
              {totalUsersCount > 0 ? `${Math.round((activeCount / totalUsersCount) * 100)}% active` : '100%'}
            </span>
          </div>
        </div>

        {/* Action Header: Search, Filters, and "Create New User" Button */}
        <div className="p-4 rounded-2xl glass-card border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users by name or email..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-200 text-xs focus:outline-none focus:border-blue-500 transition-all shadow-inner"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Role Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 font-medium">Role:</span>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="ALL">All Roles</option>
                <option value="ADMIN">ADMIN</option>
                <option value="USER">USER</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 font-medium">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              onClick={() => loadUsers(true)}
              disabled={refreshing}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition-all cursor-pointer"
              title="Refresh users list"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-400' : ''}`} />
            </button>

            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-blue-500/25 transition-all cursor-pointer shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              <span>Create New User</span>
            </button>
          </div>
        </div>

        {/* User Management Table */}
        <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 border-collapse">
              <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">User Details</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4">Contacts Owned</th>
                  <th className="py-3 px-4">Import Batches</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((u) => {
                    const isSelf = currentUser?.id === u.id;

                    return (
                      <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                        {/* User Column */}
                        <td className="py-3 px-4 font-semibold text-white">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 flex items-center justify-center font-bold text-slate-200 shadow-inner">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-white">{u.name}</span>
                                {isSelf && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-300 font-mono border border-blue-500/30">
                                    YOU
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 font-normal">{u.email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Role Column */}
                        <td className="py-3 px-4">
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            disabled={isSelf}
                            className={`text-[11px] font-semibold rounded-lg px-2.5 py-1 border outline-none cursor-pointer transition-all disabled:opacity-60 disabled:cursor-not-allowed ${u.role === 'ADMIN'
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                              : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                              }`}
                          >
                            <option value="USER" className="bg-slate-900 text-white">
                              USER
                            </option>
                            <option value="ADMIN" className="bg-slate-900 text-white">
                              ADMIN
                            </option>
                          </select>
                        </td>

                        {/* Status Column */}
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${u.isActive
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                              }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                            {u.isActive ? 'ACTIVE' : 'SUSPENDED'}
                          </span>
                        </td>

                        {/* Contacts Count */}
                        <td className="py-3 px-4 font-mono font-bold text-slate-200">
                          {u._count?.contacts ?? 0}
                        </td>

                        {/* Imports Count */}
                        <td className="py-3 px-4 font-mono font-bold text-slate-200">
                          {u._count?.imports ?? 0}
                        </td>

                        {/* Joined Date */}
                        <td className="py-3 px-4 text-slate-400 text-[11px] font-mono">
                          {new Date(u.createdAt).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>

                        {/* Actions Column: Edit, Suspend/Activate, Delete */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Edit Button */}
                            <button
                              onClick={() => handleOpenEditModal(u)}
                              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 transition-all cursor-pointer"
                              title="Edit User Details"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Suspend / Activate Toggle */}
                            <button
                              onClick={() => handleStatusToggle(u.id, u.isActive)}
                              disabled={isSelf}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${u.isActive
                                ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30'
                                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                }`}
                              title={isSelf ? 'Cannot suspend your own account' : u.isActive ? 'Suspend User' : 'Activate User'}
                            >
                              {u.isActive ? 'Suspend' : 'Activate'}
                            </button>

                            {/* Delete Button */}
                            <button
                              onClick={() => handleOpenDeleteModal(u)}
                              disabled={isSelf}
                              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${isSelf
                                ? 'opacity-30 bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                                : 'bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 border-rose-500/30'
                                }`}
                              title={isSelf ? 'Cannot delete your own account' : 'Delete User Permanently'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500">
                      {loading ? (
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                          <span>Loading users from database...</span>
                        </div>
                      ) : (
                        'No matching users found for the current search filter.'
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* CREATE USER MODAL */}
        {/* ==================================================================== */}
        {createModalOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setCreateModalOpen(false)}
          >
            <div
              className="bg-[#0a111e] border border-blue-500/30 rounded-3xl p-6 max-w-md w-full relative shadow-2xl shadow-blue-500/20 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-blue-400" />
                  <h4 className="text-base font-bold text-white">Create New User</h4>
                </div>
                <button
                  onClick={() => setCreateModalOpen(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {createError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
                {/* Full Name */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    placeholder="sarah@company.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Password Field + Generator */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-semibold">Initial Password *</label>
                    <button
                      type="button"
                      onClick={() => setCreateForm({ ...createForm, password: generateRandomPassword() })}
                      className="text-[11px] text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <Key className="w-3 h-3" />
                      <span>Generate Secure Password</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={createShowPassword ? 'text' : 'password'}
                      required
                      value={createForm.password}
                      onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                      placeholder="Minimum 6 characters"
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder:text-slate-500 font-mono focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setCreateShowPassword(!createShowPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-white cursor-pointer"
                    >
                      {createShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Role and Account Status */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Role</label>
                    <select
                      value={createForm.role}
                      onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as any })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="USER">USER (Standard)</option>
                      <option value="ADMIN">ADMIN (Full Control)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Initial Status</label>
                    <select
                      value={createForm.isActive ? 'ACTIVE' : 'SUSPENDED'}
                      onChange={(e) => setCreateForm({ ...createForm, isActive: e.target.value === 'ACTIVE' })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="SUSPENDED">SUSPENDED</option>
                    </select>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold flex items-center gap-2 shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {creating ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Creating...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Create Account</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* EDIT USER MODAL */}
        {/* ==================================================================== */}
        {editModalOpen && editingUser && (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setEditModalOpen(false)}
          >
            <div
              className="bg-[#0a111e] border border-blue-500/30 rounded-3xl p-6 max-w-md w-full relative shadow-2xl shadow-blue-500/20 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Edit2 className="w-5 h-5 text-blue-400" />
                  <h4 className="text-base font-bold text-white">Edit User: {editingUser.name}</h4>
                </div>
                <button
                  onClick={() => setEditModalOpen(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {editError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <form onSubmit={handleUpdateUser} className="space-y-4 text-xs">
                {/* Full Name */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Reset Password (Optional) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-semibold">Reset Password (Optional)</label>
                    <span className="text-[10px] text-slate-500">Leave blank to keep unchanged</span>
                  </div>
                  <div className="relative">
                    <input
                      type={editShowPassword ? 'text' : 'password'}
                      value={editForm.password}
                      onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                      placeholder="Enter new password (min 6 chars)..."
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder:text-slate-500 font-mono focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setEditShowPassword(!editShowPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-white cursor-pointer"
                    >
                      {editShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Role and Account Status */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Role</label>
                    <select
                      value={editForm.role}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value as any })}
                      disabled={currentUser?.id === editingUser.id}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500 disabled:opacity-50 cursor-pointer"
                    >
                      <option value="USER">USER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Account Status</label>
                    <select
                      value={editForm.isActive ? 'ACTIVE' : 'SUSPENDED'}
                      onChange={(e) => setEditForm({ ...editForm, isActive: e.target.value === 'ACTIVE' })}
                      disabled={currentUser?.id === editingUser.id}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500 disabled:opacity-50 cursor-pointer"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="SUSPENDED">SUSPENDED</option>
                    </select>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updating}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold flex items-center gap-2 shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {updating ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* DELETE USER CONFIRMATION DIALOG */}
        {/* ==================================================================== */}
        {deleteModalOpen && deletingUser && (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setDeleteModalOpen(false)}
          >
            <div
              className="bg-[#0a111e] border border-rose-500/40 rounded-3xl p-6 max-w-md w-full relative shadow-2xl shadow-rose-500/20 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5 text-rose-400">
                  <AlertTriangle className="w-5 h-5" />
                  <h4 className="text-base font-bold text-white">Delete User Account</h4>
                </div>
                <button
                  onClick={() => setDeleteModalOpen(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {deleteError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}

              <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                <p>
                  Are you sure you want to permanently delete the account for{' '}
                  <strong className="text-white">{deletingUser.name}</strong> (
                  <code className="text-rose-400">{deletingUser.email}</code>)?
                </p>

                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 space-y-1.5 text-rose-200 text-[11px]">
                  <p className="font-semibold flex items-center gap-1.5 text-rose-300">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    Cascade Deletion Warning:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-rose-300/90 pl-1">
                    <li>{deletingUser._count?.contacts ?? 0} owned CRM contacts will be permanently removed.</li>
                    <li>{deletingUser._count?.imports ?? 0} import batch records will be deleted.</li>
                    <li>This action is irreversible and recorded in the audit trail.</li>
                  </ul>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteUser}
                  disabled={deleting}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold flex items-center gap-2 shadow-lg shadow-rose-600/30 transition-all disabled:opacity-50 cursor-pointer text-xs"
                >
                  {deleting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete User Permanently</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
