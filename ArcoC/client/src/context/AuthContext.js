'use client';
import { createContext, useState, useEffect, useContext, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  // Prevents fetchUser from overwriting state set by an explicit login()
  const loginActive = useRef(false);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/student/me`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        // Don't overwrite state if an explicit login() already ran
        if (!loginActive.current) {
          setUser(data);
        }
      } else if (res.status === 401 || res.status === 403) {
        if (!loginActive.current) setUser(null);
      } else {
        console.warn('Server error checking session:', res.status);
      }
    } catch (err) {
      console.error('Auth fetch failed', err);
    } finally {
      setLoading(false);
      if (loginActive.current) {
        loginActive.current = false;
      }
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      await fetchUser();
    };
    initAuth();
  }, [fetchUser]);

  /**
   * Re-fetches the current user from the server.
   * NOTE: Resets loginActive to false — do NOT call concurrently with login().
   * Only call this after login() has fully completed (e.g., post-onboarding).
   */
  const checkSession = async () => {
    loginActive.current = false;
    await fetchUser();
  };

  const login = (userData) => {
    loginActive.current = true;
    setUser(userData);
    setLoading(false);
  };

  const logout = async () => {
    loginActive.current = false;
    setUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/logout`, { method: 'POST', credentials: 'include' });
    } catch (e) {}
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser, checkSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
