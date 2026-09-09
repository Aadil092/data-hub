import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Plus,
  Download,
  Trash2,
  Edit2,
  Tag,
  Mail,
  Phone,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import { api } from '../../lib/api';

const STATUSES = ['ALL', 'LEAD', 'PROSPECT', 'CUSTOMER', 'ARCHIVED'];

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedTag, setSelectedTag] = useState('ALL');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal State for Add / Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    jobTitle: '',
    tags: '',
    status: 'LEAD',
    notes: '',
  });

  const loadContacts = async () => {
    setLoading(true);
    try {
      const res = await api.getContacts({
        page,
        limit,
        search,
        status: statusFilter,
        tag: selectedTag,
      });

      if (res.success && res.contacts) {
        setContacts(res.contacts);
        setTotal(res.pagination?.total || res.contacts.length);
      } else {
        // Mock contacts if backend pending
        setContacts([
          { id: '1', firstName: 'Emily', lastName: 'Blunt', email: 'emily.blunt@apexglobal.com', phone: '+1 (555) 234-5678', company: 'Apex Global', jobTitle: 'VP of Product', status: 'CUSTOMER', tags: ['Enterprise', 'VIP'], source: 'MANUAL' },
          { id: '2', firstName: 'Michael', lastName: 'Chang', email: 'mchang@innovate.co', phone: '+1 (555) 345-6789', company: 'Innovate Labs', jobTitle: 'CTO', status: 'PROSPECT', tags: ['SaaS'], source: 'CSV_IMPORT' },
          { id: '3', firstName: 'Sophia', lastName: 'Rodriguez', email: 'sophia.r@nexushealth.org', phone: '+1 (555) 456-7890', company: 'Nexus Health', jobTitle: 'Ops Lead', status: 'LEAD', tags: ['Healthcare'], source: 'EXCEL_IMPORT' },
          { id: '4', firstName: 'David', lastName: 'Kowalski', email: 'dkowalski@quantumfin.io', phone: '+1 (555) 567-8901', company: 'Quantum Fin', jobTitle: 'Security', status: 'CUSTOMER', tags: ['Fintech'], source: 'GOOGLE_SHEETS' },
          { id: '5', firstName: 'Aaliyah', lastName: 'Patel', email: 'aaliyah@stratosmedia.com', phone: '+1 (555) 678-9012', company: 'Stratos Media', jobTitle: 'Marketing VP', status: 'PROSPECT', tags: ['Media'], source: 'MANUAL' },
        ]);
        setTotal(5);
      }

      const tagsRes = await api.getContactTags();
      if (tagsRes.success && tagsRes.tags) {
        setAvailableTags(tagsRes.tags);
      } else {
        setAvailableTags(['Enterprise', 'VIP', 'SaaS', 'Healthcare', 'Fintech', 'Media']);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, [page, statusFilter, selectedTag]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadContacts();
  };

  const handleSelectAll = () => {
    if (selectedIds.length === contacts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(contacts.map((c) => c.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleDeleteSingle = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;
    await api.deleteContact(id);
    setContacts(contacts.filter((c) => c.id !== id));
    setTotal((prev) => Math.max(0, prev - 1));
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} selected contacts?`)) return;
    await api.bulkDeleteContacts(selectedIds);
    setContacts(contacts.filter((c) => !selectedIds.includes(c.id)));
    setSelectedIds([]);
    setTotal((prev) => Math.max(0, prev - selectedIds.length));
  };

  const openAddModal = () => {
    setEditingContact(null);
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      company: '',
      jobTitle: '',
      tags: '',
      status: 'LEAD',
      notes: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (contact: any) => {
    setEditingContact(contact);
    setFormData({
      firstName: contact.firstName || '',
      lastName: contact.lastName || '',
      email: contact.email || '',
      phone: contact.phone || '',
      company: contact.company || '',
      jobTitle: contact.jobTitle || '',
      tags: Array.isArray(contact.tags) ? contact.tags.join(', ') : '',
      status: contact.status || 'LEAD',
      notes: contact.notes || '',
    });
    setModalOpen(true);
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      tags: formData.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    };

    if (editingContact) {
      const res = await api.updateContact(editingContact.id, payload);
      if (res.success && res.contact) {
        setContacts(contacts.map((c) => (c.id === editingContact.id ? res.contact : c)));
      }
    } else {
      const res = await api.createContact(payload);
      if (res.success && res.contact) {
        setContacts([res.contact, ...contacts]);
        setTotal((prev) => prev + 1);
      }
    }
    setModalOpen(false);
  };

  const handleExportCsv = () => {
    const url = api.exportCsvUrl({
      search,
      status: statusFilter,
      tag: selectedTag,
      ids: selectedIds.length > 0 ? selectedIds.join(',') : undefined,
    });
    window.open(url, '_blank');
  };

  const handleExportExcel = () => {
    const url = api.exportExcelUrl({
      search,
      status: statusFilter,
      tag: selectedTag,
      ids: selectedIds.length > 0 ? selectedIds.join(',') : undefined,
    });
    window.open(url, '_blank');
  };

  return (
    <AppLayout
      title="Contact Directory"
      subtitle="Manage, search, filter, and export contacts with schema controls"
      actionButton={
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-xl text-xs font-semibold transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected ({selectedIds.length})</span>
            </button>
          )}

          <div className="flex items-center bg-slate-800/80 rounded-xl p-0.5 border border-slate-700/60">
            <button
              onClick={handleExportCsv}
              title="Export as CSV"
              className="px-2.5 py-1.5 hover:bg-slate-700/60 text-slate-300 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span>CSV</span>
            </button>
            <button
              onClick={handleExportExcel}
              title="Export as Excel .xlsx"
              className="px-2.5 py-1.5 hover:bg-slate-700/60 text-slate-300 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Excel</span>
            </button>
          </div>

          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white rounded-full text-xs font-semibold shadow-lg shadow-emerald-500/25 transition-all hover:scale-[1.02] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Contact</span>
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Controls Bar */}
        <div className="glass-card p-4 rounded-2xl border border-emerald-500/20 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-emerald-400/70 absolute left-3.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, company, phone..."
              className="w-full pl-9 pr-4 py-2 bg-slate-900/90 border border-emerald-500/30 hover:border-emerald-500/50 rounded-full text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/25 transition-all shadow-inner"
            />
          </form>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Status Pills */}
            <div className="flex items-center bg-slate-900/90 rounded-full p-1 border border-emerald-500/25">
              {STATUSES.map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    setStatusFilter(st);
                    setPage(1);
                  }}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                    statusFilter === st
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Tag Filter */}
            {availableTags.length > 0 && (
              <select
                value={selectedTag}
                onChange={(e) => {
                  setSelectedTag(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Tags</option>
                {availableTags.map((t) => (
                  <option key={t} value={t}>
                    Tag: {t}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Contacts Table */}
        <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 w-10">
                    <button onClick={handleSelectAll} className="text-slate-400 hover:text-white">
                      {selectedIds.length === contacts.length && contacts.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-blue-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Organization & Title</th>
                  <th className="py-3 px-4">Contact Info</th>
                  <th className="py-3 px-4">Tags</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {contacts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      No contacts found matching criteria.
                    </td>
                  </tr>
                ) : (
                  contacts.map((contact) => {
                    const isSelected = selectedIds.includes(contact.id);
                    return (
                      <tr
                        key={contact.id}
                        className={`hover:bg-slate-800/40 transition-colors ${
                          isSelected ? 'bg-blue-600/10' : ''
                        }`}
                      >
                        <td className="py-3 px-4">
                          <button
                            onClick={() => toggleSelectOne(contact.id)}
                            className="text-slate-400 hover:text-white"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-400" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">
                            {contact.firstName} {contact.lastName || ''}
                          </div>
                          {contact.notes && (
                            <div className="text-[11px] text-slate-500 truncate max-w-xs">
                              {contact.notes}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-200 font-medium">{contact.company || '—'}</div>
                          <div className="text-[11px] text-slate-400">{contact.jobTitle || '—'}</div>
                        </td>
                        <td className="py-3 px-4 space-y-0.5">
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <Mail className="w-3 h-3 text-slate-500" />
                            <span>{contact.email || '—'}</span>
                          </div>
                          {contact.phone && (
                            <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                              <Phone className="w-3 h-3 text-slate-500" />
                              <span>{contact.phone}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {contact.tags && contact.tags.length > 0 ? (
                              contact.tags.map((t: string) => (
                                <span
                                  key={t}
                                  className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700/60"
                                >
                                  {t}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              contact.status === 'CUSTOMER'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                : contact.status === 'PROSPECT'
                                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                                : contact.status === 'ARCHIVED'
                                ? 'bg-slate-700 text-slate-400'
                                : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {contact.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-[11px] text-slate-400 font-mono">
                            {contact.source}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1">
                          <button
                            onClick={() => openEditModal(contact)}
                            title="Edit Contact"
                            className="p-1 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSingle(contact.id)}
                            title="Delete Contact"
                            className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>
              Showing {contacts.length} of {total} contacts
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-white">Page {page}</span>
              <button
                disabled={page * limit >= total}
                onClick={() => setPage(page + 1)}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-lg rounded-2xl border border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white">
                {editingContact ? 'Edit Contact' : 'Add New Contact'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Company
                  </label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Job Title
                  </label>
                  <input
                    type="text"
                    value={formData.jobTitle}
                    onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-blue-500 outline-none"
                  >
                    <option value="LEAD">LEAD</option>
                    <option value="PROSPECT">PROSPECT</option>
                    <option value="CUSTOMER">CUSTOMER</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="VIP, SaaS, Prospect"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Key account details or meeting notes..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-blue-500 outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-500/20"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
