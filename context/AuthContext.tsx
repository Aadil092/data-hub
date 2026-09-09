import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, getAuthToken, setAuthToken, clearAuthToken } from '../lib/api';
import { supabase } from '../lib/supabase';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  avatar?: string;
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
          parsed.name = 'Aad';
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
    // 1. Try Supabase Authentication first
    try {
      const { data: supaData, error: supaError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!supaError && supaData.session) {
        const supaUser: User = {
          id: supaData.user.id,
          name: supaData.user.user_metadata?.name || email.split('@')[0],
          email: supaData.user.email || email,
          role: supaData.user.user_metadata?.role || (email.includes('admin') ? 'ADMIN' : 'USER'),
          avatar: supaData.user.user_metadata?.avatar,
        };
        setAuthToken(supaData.session.access_token);
        localStorage.setItem('datahub_user', JSON.stringify(supaUser));
        setToken(supaData.session.access_token);
        setUser(supaUser);
        return { success: true };
      }
    } catch (e) {
      console.warn('Supabase Auth error:', e);
    }

    // 2. Try Backend API
    try {
      const res = await api.login({ email, password });
      if (res.success && res.token && res.user) {
        setAuthToken(res.token);
        localStorage.setItem('datahub_user', JSON.stringify(res.user));
        setToken(res.token);
        setUser(res.user);
        return { success: true };
      }
    } catch (_) { }

    // 3. Fallback for demo admin / demo user credentials
    if (
      (email === 'admin@datahub.local' && password === 'admin123') ||
      (email === 'user@datahub.local' && password === 'user123')
    ) {
      const isAdmin = email === 'admin@datahub.local';
      const mockUser: User = {
        id: isAdmin ? 'demo-admin-id' : 'demo-user-id',
        name: isAdmin ? 'System Administrator' : 'Aad',
        email,
        role: isAdmin ? 'ADMIN' : 'USER',
        avatar: isAdmin
          ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
          : 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      };
      const mockToken = 'supabase-demo-session-token';
      setAuthToken(mockToken);
      localStorage.setItem('datahub_user', JSON.stringify(mockUser));
      setToken(mockToken);
      setUser(mockUser);
      return { success: true };
    }

    return { success: false, message: 'Invalid email or password' };
  };

  const register = async (name: string, email: string, password: string) => {
    // 1. Try Supabase Registration
    try {
      const { data: supaData, error: supaError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role: email.includes('admin') ? 'ADMIN' : 'USER',
          },
        },
      });

      if (!supaError && supaData.user) {
        const newUser: User = {
          id: supaData.user.id,
          name,
          email,
          role: email.includes('admin') ? 'ADMIN' : 'USER',
        };
        if (supaData.session) {
          setAuthToken(supaData.session.access_token);
          localStorage.setItem('datahub_user', JSON.stringify(newUser));
          setToken(supaData.session.access_token);
          setUser(newUser);
        }
        return { success: true };
      }
    } catch (e) {
      console.warn('Supabase sign up error:', e);
    }

    // 2. Try Backend API
    const res = await api.register({ name, email, password });
    if (res.success && res.token && res.user) {
      setAuthToken(res.token);
      localStorage.setItem('datahub_user', JSON.stringify(res.user));
      setToken(res.token);
      setUser(res.user);
      return { success: true };
    }

    return { success: false, message: res.message || 'Registration failed' };
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
