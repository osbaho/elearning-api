'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { user, login, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'admin') router.replace('/admin');
      else if (!user.isOnboarded) router.replace('/onboarding');
      else router.replace('/course');
    }
  }, [user, loading, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError('Por favor llena todos los campos');
      return;
    }
    setIsLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (res.ok) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
        }
        login(data.student);
      } else {
        setError(data.error || 'Credenciales inválidas');
      }
    } catch (err) {
      console.error(err);
      setError('Error de conexión al servidor');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <header className="modern-header">
        <div className="header-inner">
          <Link href="/" className="header-logo">🏥 C-Arm Master</Link>
          <nav className="header-nav" aria-label="Navegación principal">
            <Link href="/">Inicio</Link>
          </nav>
        </div>
      </header>

      <main className="login-main">
        <div className="login-card">
          <h1 className="login-title">Iniciar Sesión</h1>

          {error && (
            <div id="login-error" className="alert-error mb-16" role="alert" aria-live="polite">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Correo Electrónico</label>
              <input
                className="form-input"
                type="email"
                id="email"
                name="email"
                required
                autoComplete="email"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-describedby={error ? 'login-error' : undefined}
              />
            </div>

            <div className="form-group mb-24">
              <label className="form-label" htmlFor="password">Contraseña</label>
              <input
                className="form-input"
                type="password"
                id="password"
                name="password"
                required
                autoComplete="current-password"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary w-full" disabled={isLoading}>
              {isLoading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="text-secondary mt-16 text-center text-sm">
            Si estás interesado en acceder, contacta con nosotros.
          </p>
        </div>
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
    </>
  );
}
