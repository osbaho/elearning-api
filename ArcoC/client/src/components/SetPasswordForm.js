'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';

const COPY = {
  activation: {
    title: 'Activa tu cuenta',
    intro: (name) => `Hola${name ? ` ${name}` : ''}, crea la contraseña con la que ingresarás al curso.`,
    endpoint: '/auth/activate',
    submit: 'Crear contraseña y entrar',
  },
  password_reset: {
    title: 'Crea una nueva contraseña',
    intro: (name) => `Hola${name ? ` ${name}` : ''}, escribe tu nueva contraseña.`,
    endpoint: '/auth/reset-password',
    submit: 'Guardar nueva contraseña',
  },
};

/** Misma política que el servidor: 8+ caracteres, con letras y números. */
function passwordProblem(password, confirm) {
  if (password.length < 8) return 'Usa al menos 8 caracteres.';
  if (!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(password) || !/\d/.test(password)) return 'Incluye letras y números.';
  if (password !== confirm) return 'Las contraseñas no coinciden.';
  return null;
}

/**
 * Define la contraseña con un enlace de un solo uso: activación de una cuenta creada por el
 * administrador o restablecimiento. Primero comprueba el enlace para dar un error claro si
 * venció o ya se usó.
 */
export default function SetPasswordForm({ token, purpose }) {
  const copy = COPY[purpose];
  const router = useRouter();
  const { login } = useAuth();
  const [tokenState, setTokenState] = useState(token ? { status: 'checking' } : {
    status: 'invalid', error: 'Falta el código del enlace. Ábrelo directamente desde tu correo.',
  });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    apiRequest(`/auth/token-info?purpose=${purpose}&token=${encodeURIComponent(token)}`).then((res) => {
      if (cancelled) return;
      setTokenState(res.ok ? { status: 'valid', info: res.data } : { status: 'invalid', error: res.error });
    });
    return () => { cancelled = true; };
  }, [token, purpose]);

  const onSubmit = async (e) => {
    e.preventDefault();
    const problem = passwordProblem(password, confirm);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSaving(true);
    const res = await apiRequest(copy.endpoint, { method: 'POST', body: { token, password } });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (res.data.loggedIn && res.data.student) {
      login(res.data.student);
      router.replace(res.data.student.isOnboarded ? '/course' : '/onboarding');
      return;
    }
    setDone(res.data.message || 'Listo. Ya puedes iniciar sesión.');
  };

  return (
    <>
      <h1 className="login-title">{copy.title}</h1>

      {tokenState.status === 'checking' && <p className="text-secondary text-center">Comprobando el enlace...</p>}

      {tokenState.status === 'invalid' && (
        <div id="token-error" className="alert-error mb-16" role="alert">
          {tokenState.error}
          <div className="auth-help-links">
            <Link href="/recuperar">Pedir un enlace nuevo</Link>
            <Link href="/login">Iniciar sesión</Link>
          </div>
        </div>
      )}

      {done && (
        <div id="set-password-success" className="text-center" role="status">
          <p className="text-secondary mb-16">✅ {done}</p>
          <Link href="/login" className="btn btn-primary w-full">Ir a iniciar sesión</Link>
        </div>
      )}

      {tokenState.status === 'valid' && !done && (
        <form id="set-password-form" method="post" onSubmit={onSubmit} noValidate>
          <p className="text-secondary mb-16 text-sm">
            {copy.intro(tokenState.info.firstName)} Cuenta: <strong>{tokenState.info.email}</strong>
          </p>
          {error && <div id="set-password-error" className="alert-error mb-16" role="alert">{error}</div>}
          <div className="form-group">
            <label className="form-label" htmlFor="new-password">Nueva contraseña</label>
            <input className="form-input" type="password" id="new-password" autoComplete="new-password" required
              value={password} onChange={(e) => setPassword(e.target.value)} />
            <div className="text-xs text-muted mt-4">Mínimo 8 caracteres, con letras y números.</div>
          </div>
          <div className="form-group mb-24">
            <label className="form-label" htmlFor="confirm-password">Repite la contraseña</label>
            <input className="form-input" type="password" id="confirm-password" autoComplete="new-password" required
              value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <button type="submit" id="btn-set-password" className="btn btn-primary w-full" disabled={saving}>
            {saving ? 'Guardando...' : copy.submit}
          </button>
        </form>
      )}
    </>
  );
}
