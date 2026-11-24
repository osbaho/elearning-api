'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '../../lib/api';

/**
 * «¿Olvidaste tu contraseña?»: la API responde lo mismo exista o no el correo. A una cuenta sin
 * activar le llega un enlace de activación; a una activada, uno para crear una contraseña nueva.
 */
export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSending(true);
    const res = await apiRequest('/auth/forgot-password', { method: 'POST', body: { email } });
    setSending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setMessage(res.data.message);
  };

  return (
    <>
      <h1 className="login-title">Recupera tu acceso</h1>
      {message ? (
        <div id="forgot-result" className="text-center" role="status">
          <p className="text-secondary mb-16">📧 {message}</p>
          <Link href="/login" className="btn btn-primary w-full">Volver a iniciar sesión</Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <p className="text-secondary text-sm mb-16">
            Escribe el correo con el que te inscribieron. Te enviaremos un enlace para crear tu contraseña
            (también sirve si nunca activaste tu cuenta).
          </p>
          {error && <div className="alert-error mb-16" role="alert">{error}</div>}
          <div className="form-group mb-24">
            <label className="form-label" htmlFor="forgot-email">Correo electrónico</label>
            <input className="form-input" type="email" id="forgot-email" autoComplete="email" required
              placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button type="submit" id="btn-forgot-submit" className="btn btn-primary w-full" disabled={sending || !email.trim()}>
            {sending ? 'Enviando...' : 'Enviarme el enlace'}
          </button>
          <div className="auth-help-links">
            <Link href="/login">Volver a iniciar sesión</Link>
          </div>
        </form>
      )}
    </>
  );
}
