const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('datahub_token');
}

export function setAuthToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('datahub_token', token);
  }
}

export function clearAuthToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('datahub_token');
    localStorage.removeItem('datahub_user');
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; message?: string; [key: string]: any }> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Only set Content-Type if body is not FormData
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    // Check if unauthorized
    if (res.status === 401 && typeof window !== 'undefined' && !endpoint.includes('/auth/')) {
      clearAuthToken();
      window.location.href = '/login?expired=1';
    }

    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const json = await res.json();
      if (typeof json === 'object' && json !== null && !('success' in json)) {
        json.success = res.ok;
      }
      return json;
    }

    if (!res.ok) {
      if (res.status === 404) {
        return {
          success: false,
          message: `Endpoint ${endpoint} returned 404 Not Found. Make sure the DATAHUB backend server (data-hub/server) is running on port 5000.`,
        };
      }
      return { success: false, message: `Server error: ${res.statusText} (${res.status})` };
    }

    return { success: true, data: (await res.text()) as any };
  } catch (error: any) {
    console.warn(`API Request to ${endpoint} failed:`, error?.message || error);
    return {
      success: false,
      message: error?.message || 'Cannot reach DATAHUB backend server. Make sure the backend is running on port 5000.',
    };
  }
}

export const api = {
  // Auth
  login: (credentials: any) =>
    apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  register: (payload: any) =>
    apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  me: () => apiRequest('/auth/me'),

  // Contacts
  getContacts: (params: Record<string, any> = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/contacts${query ? `?${query}` : ''}`);
  },
  getContactStats: () => apiRequest('/contacts/stats'),
  getContactTags: () => apiRequest('/contacts/tags'),
  createContact: (data: any) =>
    apiRequest('/contacts', { method: 'POST', body: JSON.stringify(data) }),
  getContact: (id: string) => apiRequest(`/contacts/${id}`),
  updateContact: (id: string, data: any) =>
    apiRequest(`/contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteContact: (id: string) => apiRequest(`/contacts/${id}`, { method: 'DELETE' }),
  bulkDeleteContacts: (ids: string[]) =>
    apiRequest('/contacts/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) }),

  // Import Pipeline
  uploadFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiRequest('/import/upload', { method: 'POST', body: formData });
  },
  validateImport: (rows: any[], mapping: Record<string, string>) =>
    apiRequest('/import/validate', {
      method: 'POST',
      body: JSON.stringify({ rows, mapping }),
    }),
  commitImport: (payload: {
    fileName: string;
    fileType: string;
    rows: any[];
    duplicateStrategy: string;
  }) => apiRequest('/import/commit', { method: 'POST', body: JSON.stringify(payload) }),

  // Export
  exportCsvUrl: (query: Record<string, any> = {}) => {
    const token = getAuthToken();
    const q = new URLSearchParams({ ...query, token: token || '' }).toString();
    return `${API_BASE_URL}/export/csv?${q}`;
  },
  exportExcelUrl: (query: Record<string, any> = {}) => {
    const token = getAuthToken();
    const q = new URLSearchParams({ ...query, token: token || '' }).toString();
    return `${API_BASE_URL}/export/excel?${q}`;
  },

  // Import History
  getHistory: () => apiRequest('/history'),
  getHistoryBatch: (id: string) => apiRequest(`/history/${id}`),

  // Google Sync
  getGoogleSyncConfig: () => apiRequest('/google-sync/config'),
  saveGoogleSyncConfig: (config: any) =>
    apiRequest('/google-sync/config', { method: 'POST', body: JSON.stringify(config) }),
  triggerGoogleSync: () => apiRequest('/google-sync/sync-now', { method: 'POST' }),

  // Email Verification & Bulk Campaign Dispatcher
  verifyEmailsBatch: (emails: string[]) =>
    apiRequest('/email/verify-batch', {
      method: 'POST',
      body: JSON.stringify({ emails }),
    }),
  sendEmailCampaign: (formData: FormData) =>
    apiRequest('/email/send-campaign', {
      method: 'POST',
      body: formData,
    }),

  // Admin
  getAdminUsers: () => apiRequest('/admin/users'),
  createAdminUser: (userData: { name: string; email: string; password: string; role?: string; isActive?: boolean }) =>
    apiRequest('/admin/users', { method: 'POST', body: JSON.stringify(userData) }),
  updateAdminUser: (id: string, userData: { name?: string; email?: string; password?: string; role?: string; isActive?: boolean }) =>
    apiRequest(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(userData) }),
  deleteAdminUser: (id: string) =>
    apiRequest(`/admin/users/${id}`, { method: 'DELETE' }),
  updateUserRole: (id: string, role: string) =>
    apiRequest(`/admin/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
  updateUserStatus: (id: string, isActive: boolean) =>
    apiRequest(`/admin/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ isActive }) }),
  getAdminAuditLogs: (params: Record<string, any> = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/admin/audit-logs${query ? `?${query}` : ''}`);
  },
  getAdminStats: () => apiRequest('/admin/stats'),
};

const PYTHON_API_BASE_URL = process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:8000';

export interface PythonRequestOptions extends RequestInit {
  silent?: boolean;
}

export async function pythonRequest<T = any>(
  endpoint: string,
  options: PythonRequestOptions = {}
): Promise<{ success: boolean; data?: T; message?: string; [key: string]: any }> {
  const { silent, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (!(fetchOptions.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const res = await fetch(`${PYTHON_API_BASE_URL}${endpoint}`, {
      ...fetchOptions,
      headers,
    });

    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const json = await res.json();
      if (typeof json === 'object' && json !== null && !('success' in json)) {
        json.success = res.ok;
      }
      return json;
    }

    if (!res.ok) {
      const errorText = await res.text();
      return { success: false, message: errorText || `Python service error: ${res.statusText}` };
    }

    return { success: true, data: (await res.blob()) as any };
  } catch (error: any) {
    if (!silent && endpoint !== '/health') {
      console.warn(`Python API Request to ${endpoint} failed:`, error?.message || error);
    }
    return {
      success: false,
      message: error?.message || 'Cannot reach Python FastAPI backend. Ensure it is running on port 8000.',
    };
  }
}

export const pythonApi = {
  health: () => pythonRequest('/health', { silent: true }),
  scrapeUrl: (url: string) =>
    pythonRequest('/api/scrape', { method: 'POST', body: JSON.stringify({ url }) }),
  scrapeUniversalUrl: (url: string) =>
    pythonRequest('/api/scrape/universal', { method: 'POST', body: JSON.stringify({ url }) }),
  sendAgentMessage: (payload: {
    prompt: string;
    chat_history?: Array<{ role: string; content: string }>;
    table_records?: any[];
    table_profile?: any;
    page_content?: any;
    api_key?: string;
    provider?: string;
    model?: string;
  }) => pythonRequest('/api/agent/chat', { method: 'POST', body: JSON.stringify(payload) }),
  previewTable: (payload: { url?: string; table_index?: number; records?: any[] }) =>
    pythonRequest('/api/table/preview', { method: 'POST', body: JSON.stringify(payload) }),
  generateChart: (payload: {
    records: any[];
    chart_type: string;
    x_col?: string;
    y_col?: string;
    top_n?: number;
  }) => pythonRequest('/api/table/chart', { method: 'POST', body: JSON.stringify(payload) }),
  exportTable: async (records: any[], format: 'csv' | 'xlsx' = 'csv', filename: string = 'data_hub_export') => {
    const res = await fetch(`${PYTHON_API_BASE_URL}/api/table/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records, format, filename }),
    });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = format === 'xlsx' ? `${filename}.xlsx` : `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    a.remove();
  },
};

