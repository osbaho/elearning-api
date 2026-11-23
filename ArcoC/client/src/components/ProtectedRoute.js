'use client';

import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ProtectedRoute({ children, requireAdmin = false, allowPreOnboarding = false }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    } else if (!loading && requireAdmin && user.role !== 'admin') {
      router.push('/course');
    } else if (!loading && !requireAdmin && user.role === 'admin') {
      router.push('/admin');
    } else if (!loading && !requireAdmin && !allowPreOnboarding && !user?.isOnboarded) {
      router.push('/onboarding');
    }
  }, [user, loading, router, requireAdmin, allowPreOnboarding]);

  if (loading) {
    return <div className="flex-center-vh">Cargando...</div>;
  }

  if (
    !user || 
    (requireAdmin && user.role !== 'admin') || 
    (!requireAdmin && user.role === 'admin') || 
    (!requireAdmin && !allowPreOnboarding && !user.isOnboarded)
  ) {
    return null; // Will redirect in useEffect
  }

  return children;
}
