'use client';

import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import ProtectedRoute from '../../components/ProtectedRoute';

export default function AdminLayout({ children }) {
  const { logout } = useAuth();

  return (
    <ProtectedRoute requireAdmin={true}>
      <header className="modern-header bg-admin-header">
        <div className="header-inner">
          <Link href="/admin" className="header-logo">⚙️ Auditoría IES — C-Arm Master</Link>
          <nav className="header-nav" aria-label="Navegación principal">
            <span className="badge-admin">Rol Administrador</span>
            <button onClick={logout} className="btn-logout" aria-label="Cerrar sesión">Cerrar sesión</button>
          </nav>
        </div>
      </header>
      <main>
        {children}
      </main>
    </ProtectedRoute>
  );
}
