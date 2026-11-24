'use client';

import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Protege las páginas según la sesión y el rol.
 *   requireAdmin       solo administradores (el panel)
 *   allowAdminPreview  el admin también entra, en modo revisión (el curso): ve todo sin que se
 *                      registre avance; no pasa por el onboarding
 *   allowPreOnboarding estudiantes que aún no completan el onboarding
 */
export default function ProtectedRoute({ children, requireAdmin = false, allowPreOnboarding = false, allowAdminPreview = false }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  const isAdmin = user?.role === 'admin';
  const adminPreview = !requireAdmin && allowAdminPreview && isAdmin;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login');
    } else if (requireAdmin && !isAdmin) {
      router.push('/course');
    } else if (!requireAdmin && isAdmin && !adminPreview) {
      router.push('/admin');
    } else if (!requireAdmin && !adminPreview && !allowPreOnboarding && !user.isOnboarded) {
      router.push('/onboarding');
    }
  }, [user, loading, router, requireAdmin, allowPreOnboarding, isAdmin, adminPreview]);

  if (loading) {
    return <div className="flex-center-vh">Cargando...</div>;
  }

  if (
    !user ||
    (requireAdmin && !isAdmin) ||
    (!requireAdmin && isAdmin && !adminPreview) ||
    (!requireAdmin && !adminPreview && !allowPreOnboarding && !user.isOnboarded)
  ) {
    return null; // Will redirect in useEffect
  }

  return children;
}
