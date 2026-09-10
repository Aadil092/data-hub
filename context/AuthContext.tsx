import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, getAuthToken, setAuthToken, clearAuthToken } from '../lib/api';
import { supabase } from '../lib/supabase';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  avatar?: string;
  isActive?: boolean;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAdmin: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  loginAsDemo: (role: 'ADMIN' | 'USER') => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to save registered users to local client-side cache
export function saveRegisteredUserLocally(newUser: User): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem('datahub_registered_users');
    let list: any[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];

    const normalizedEmail = newUser.email.toLowerCase().trim();
    // Check if already exists
    const idx = list.findIndex((u: any) => u.email.toLowerCase().trim() === normalizedEmail || u.id === newUser.id);
    const userToSave = {
      id: newUser.id,
      name: newUser.name,
      email: normalizedEmail,
      role: newUser.role,
      avatar: newUser.avatar,
      isActive: newUser.isActive !== undefined ? newUser.isActive : true,
      createdAt: newUser.createdAt || new Date().toISOString(),
      _count: { contacts: 0, imports: 0 },
    };

    if (idx >= 0) {
      list[idx] = { ...list[idx], ...userToSave };
    } else {
      list.unshift(userToSave);
    }

    localStorage.setItem('datahub_registered_users', JSON.stringify(list));
  } catch (err) {
    console.warn('Could not cache registered user locally:', err);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check local storage cache
    const savedToken = getAuthToken();
    const savedUserStr = localStorage.getItem('datahub_user');

    if (savedToken && savedUserStr) {
      try {
        setToken(savedToken);
        const parsed = JSON.parse(savedUserStr);
        if (parsed.email === 'user@datahub.local' && (parsed.name === 'Jane Cooper' || parsed.name === 'User')) {
          parsed.name = 'Aadil Khan';
          localStorage.setItem('datahub_user', JSON.stringify(parsed));
        }
        setUser(parsed);
      } catch (e) {
        clearAuthToken();
      }
    }

    // 2. Check Supabase active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const supaUser: User = {
          id: session.user.id,
          name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
          email: session.user.email || '',
          role: session.user.user_metadata?.role || (session.user.email?.includes('admin') ? 'ADMIN' : 'USER'),
          avatar: session.user.user_metadata?.avatar,
        };
        setAuthToken(session.access_token);
        localStorage.setItem('datahub_user', JSON.stringify(supaUser));
        saveRegisteredUserLocally(supaUser);
        setToken(session.access_token);
        setUser(supaUser);
      }
      setLoading(false);
    });

    // 3. Listen to Supabase auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        const supaUser: User = {
          id: session.user.id,
          name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
          email: session.user.email || '',
          role: session.user.user_metadata?.role || (session.user.email?.includes('admin') ? 'ADMIN' : 'USER'),
          avatar: session.user.user_metadata?.avatar,
        };
        setAuthToken(session.access_token);
        localStorage.setItem('datahub_user', JSON.stringify(supaUser));
        saveRegisteredUserLocally(supaUser);
        setToken(session.access_token);
        setUser(supaUser);
      } else if (event === 'SIGNED_OUT') {
        clearAuthToken();
        setUser(null);
        setToken(null);
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Try Backend API
    try {
      const res = await api.login({ email: normalizedEmail, password });
      if (res.success && res.token && res.user) {
        setAuthToken(res.token);
        localStorage.setItem('datahub_user', JSON.stringify(res.user));
        saveRegisteredUserLocally(res.user);
        setToken(res.token);
        setUser(res.user);
        return { success: true };
      }
    } catch (_) { }

    // 2. Try Supabase Authentication
    try {
      const { data: supaData, error: supaError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (!supaError && supaData.session) {
        const supaUser: User = {
          id: supaData.user.id,
          name: supaData.user.user_metadata?.name || normalizedEmail.split('@')[0],
          email: supaData.user.email || normalizedEmail,
          role: supaData.user.user_metadata?.role || (normalizedEmail.includes('admin') ? 'ADMIN' : 'USER'),
          avatar: supaData.user.user_metadata?.avatar,
        };
        setAuthToken(supaData.session.access_token);
        localStorage.setItem('datahub_user', JSON.stringify(supaUser));
        saveRegisteredUserLocally(supaUser);
        setToken(supaData.session.access_token);
        setUser(supaUser);
        return { success: true };
      }
    } catch (e) {
      console.warn('Supabase Auth error:', e);
    }

    // 3. Check registered users in local storage cache
    try {
      const raw = localStorage.getItem('datahub_registered_users');
      if (raw) {
        const list = JSON.parse(raw);
        const match = list.find((u: any) => u.email.toLowerCase().trim() === normalizedEmail);
        if (match) {
          const matchedUser: User = {
            id: match.id,
            name: match.name,
            email: match.email,
            role: match.role || 'USER',
            avatar: match.avatar,
          };
          const fallbackToken = 'local-jwt-' + match.id;
          setAuthToken(fallbackToken);
          localStorage.setItem('datahub_user', JSON.stringify(matchedUser));
          setToken(fallbackToken);
          setUser(matchedUser);
          return { success: true };
        }
      }
    } catch (_) {}

    // 4. Fallback for demo admin / demo user credentials
    if (
      (normalizedEmail === 'admin@datahub.local' && password === 'admin123') ||
      (normalizedEmail === 'user@datahub.local' && password === 'user123')
    ) {
      const isAdmin = normalizedEmail === 'admin@datahub.local';
      const mockUser: User = {
        id: isAdmin ? 'admin-demo-id' : 'user-demo-id',
        name: isAdmin ? 'System Administrator' : 'Aadil Khan',
        email: normalizedEmail,
        role: isAdmin ? 'ADMIN' : 'USER',
        avatar: isAdmin
          ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
          : 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      };
      const mockToken = 'datahub-demo-token';
      setAuthToken(mockToken);
      localStorage.setItem('datahub_user', JSON.stringify(mockUser));
      setToken(mockToken);
      setUser(mockUser);
      return { success: true };
    }

    return { success: false, message: 'Invalid email or password' };
  };

  const register = async (name: string, email: string, password: string) => {
    const normalizedEmail = email.toLowerCase().trim();
    const assignedRole = normalizedEmail.includes('admin') ? 'ADMIN' : 'USER';
    const now = new Date().toISOString();

    // 1. First call Backend API (handles DB insert, Prisma sync, UserStore caching & JWT)
    try {
      const res = await api.register({ name: name.trim(), email: normalizedEmail, password, role: assignedRole });
      if (res.success && res.token && res.user) {
        const registeredUser: User = {
          id: res.user.id,
          name: res.user.name,
          email: res.user.email,
          role: res.user.role || assignedRole,
          isActive: true,
          createdAt: res.user.createdAt || now,
        };
        setAuthToken(res.token);
        localStorage.setItem('datahub_user', JSON.stringify(registeredUser));
        saveRegisteredUserLocally(registeredUser);
        setToken(res.token);
        setUser(registeredUser);

        // Also sync to Supabase table in background
        try {
          supabase
            .from('users')
            .upsert({
              id: registeredUser.id,
              name: registeredUser.name,
              email: registeredUser.email,
              role: registeredUser.role,
              isActive: true,
              createdAt: now,
              updatedAt: now,
            })
            .then(() => {});
        } catch (_) {}

        return { success: true };
      }
    } catch (e) {
      console.warn('Backend register API warning:', e);
    }

    // 2. Try Supabase Registration & direct public.users table insert
    try {
      const { data: supaData } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            name: name.trim(),
            role: assignedRole,
          },
        },
      });

      const userId = supaData?.user?.id || 'usr-' + Date.now();
      const registeredUser: User = {
        id: userId,
        name: name.trim(),
        email: normalizedEmail,
        role: assignedRole,
        isActive: true,
        createdAt: now,
      };

      // Also upsert directly to public.users table in Supabase
      try {
        await supabase.from('users').upsert({
          id: userId,
          name: name.trim(),
          email: normalizedEmail,
          role: assignedRole,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
      } catch (_) {}

      const userToken = supaData?.session?.access_token || 'datahub-jwt-' + Date.now();
      setAuthToken(userToken);
      localStorage.setItem('datahub_user', JSON.stringify(registeredUser));
      saveRegisteredUserLocally(registeredUser);
      setToken(userToken);
      setUser(registeredUser);
      return { success: true };
    } catch (e) {
      console.warn('Supabase sign up error:', e);
    }

    // 3. Fallback client-side registration
    const fallbackUser: User = {
      id: 'usr-' + Date.now(),
      name: name.trim(),
      email: normalizedEmail,
      role: assignedRole,
      isActive: true,
      createdAt: now,
    };
    const fallbackToken = 'local-reg-token-' + Date.now();
    setAuthToken(fallbackToken);
    localStorage.setItem('datahub_user', JSON.stringify(fallbackUser));
    saveRegisteredUserLocally(fallbackUser);
    setToken(fallbackToken);
    setUser(fallbackUser);
    return { success: true };
  };

  const loginAsDemo = async (role: 'ADMIN' | 'USER') => {
    const email = role === 'ADMIN' ? 'admin@datahub.local' : 'user@datahub.local';
    const password = role === 'ADMIN' ? 'admin123' : 'user123';
    await login(email, password);
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (_) { }
    clearAuthToken();
    setUser(null);
    setToken(null);
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAdmin: user?.role === 'ADMIN',
        isAuthenticated: !!user,
        login,
        register,
        loginAsDemo,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

