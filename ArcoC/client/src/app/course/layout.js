'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import ProtectedRoute from '../../components/ProtectedRoute';

export default function CourseLayout({ children }) {
  const { logout, user } = useAuth();
  const pathname = usePathname();

  // El admin entra al curso en modo revisión (ve todo, nada se registra)
  const isAdmin = user?.role === 'admin';

  return (
    <ProtectedRoute allowAdminPreview>
      <header className={`modern-header ${isAdmin ? 'bg-admin-header' : ''}`}>
        <div className="header-inner">
          <Link href="/" className="header-logo">🏥 C-Arm Master</Link>
          <nav className="header-nav" aria-label="Navegación principal">
            <Link href="/">Inicio</Link>
            <Link href="/course" className={pathname === '/course' ? 'active' : ''}>Curso</Link>
            <Link href="/course/progreso" id="nav-my-progress" className={pathname === '/course/progreso' ? 'active' : ''}>Mi progreso</Link>
            <Link href="/course/ayuda" id="nav-faq" className={pathname === '/course/ayuda' ? 'active' : ''}>Ayuda</Link>
            <button onClick={logout} className="btn-logout" aria-label="Cerrar sesión">Cerrar sesión</button>
            {isAdmin ? (
              <Link href="/admin" id="nav-back-admin" className="nav-points" aria-label="Volver al panel del administrador">
                ⚙️ Panel admin
              </Link>
            ) : (
              <Link href="/course/progreso#progress-points" id="nav-points-display" className="nav-points" aria-label="Puntos de reserva: ver el historial">
                {user?.reservePoints || 0} Pts
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main>
        {children}
      </main>

      <footer className="modern-footer">
        <div className="footer-inner">
          <p>&copy; 2026 C-Arm Master Training Platform. Para uso educativo únicamente.</p>
          <nav className="footer-links" aria-label="Pie de página">
            <a href="#">Política de Privacidad</a>
            <a href="#">Términos de Uso</a>
            <a href="#">Soporte</a>
          </nav>
        </div>
      </footer>
    </ProtectedRoute>
  );
}
