import Link from 'next/link';

/** Marco de las páginas públicas de acceso (activar cuenta, recuperar contraseña). */
export default function PublicShell({ children }) {
  return (
    <>
      <header className="modern-header">
        <div className="header-inner">
          <Link href="/" className="header-logo">🏥 C-Arm Master</Link>
          <nav className="header-nav" aria-label="Navegación principal">
            <Link href="/">Inicio</Link>
            <Link href="/login">Iniciar sesión</Link>
          </nav>
        </div>
      </header>

      <main className="login-main">
        <div className="login-card">{children}</div>
      </main>

      <footer className="modern-footer">
        <div className="footer-inner">
          <p>&copy; 2026 C-Arm Master Training Platform. Para uso educativo únicamente.</p>
        </div>
      </footer>
    </>
  );
}
