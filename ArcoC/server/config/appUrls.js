/**
 * URL pública de la plataforma (el frontend), para los enlaces que salen en correos y PDF:
 * activación de cuenta, restablecimiento de contraseña e ingreso.
 *
 * APP_PUBLIC_URL (p. ej. https://cursos.midominio.com). Si no está definida se deriva de
 * CLIENT_URL (versiones anteriores la usaban con /login al final) o del primer ALLOWED_ORIGINS.
 */
export function appBaseUrl(env = process.env) {
  const raw = env.APP_PUBLIC_URL
    || (env.CLIENT_URL ? env.CLIENT_URL.replace(/\/login\/?$/, '') : null)
    || (env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',')[0].trim();
  return raw.replace(/\/+$/, '');
}

/** URL absoluta de una ruta del frontend, p. ej. appUrl('/login'). */
export function appUrl(path, env = process.env) {
  return `${appBaseUrl(env)}${path.startsWith('/') ? '' : '/'}${path}`;
}
