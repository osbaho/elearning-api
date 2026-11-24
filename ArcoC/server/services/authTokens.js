import crypto from 'crypto';
import { get, run } from '../config/db.js';
import { appUrl } from '../config/appUrls.js';

/**
 * Enlaces de un solo uso para activar la cuenta (la crea el admin, el estudiante define su
 * contraseña) y para restablecer la contraseña. En la base solo queda el hash SHA-256 del token:
 * el token en claro viaja en el correo y, a pedido, se le muestra al admin una sola vez.
 */
export const TOKEN_PURPOSES = Object.freeze({
  ACTIVATION: 'activation',
  PASSWORD_RESET: 'password_reset',
});

const TOKEN_TTL_MS = {
  [TOKEN_PURPOSES.ACTIVATION]: 7 * 24 * 60 * 60 * 1000,   // 7 días
  [TOKEN_PURPOSES.PASSWORD_RESET]: 60 * 60 * 1000,        // 1 hora
};

const TOKEN_PAGES = {
  [TOKEN_PURPOSES.ACTIVATION]: '/activar',
  [TOKEN_PURPOSES.PASSWORD_RESET]: '/restablecer',
};

export function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

/** Enlace del frontend que consume el token (lo que va en el correo). */
export function tokenUrl(purpose, token) {
  return appUrl(`${TOKEN_PAGES[purpose]}?token=${encodeURIComponent(token)}`);
}

/**
 * Emite un enlace nuevo e invalida los anteriores del mismo propósito que no se usaron.
 * Devuelve el token en claro, su URL y el vencimiento.
 */
export async function issueToken({ studentId, purpose, adminId = null }, db = { run }) {
  if (!TOKEN_TTL_MS[purpose]) throw new Error(`Propósito de enlace desconocido: ${purpose}`);
  const token = crypto.randomBytes(32).toString('base64url');
  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS[purpose]).toISOString();
  await db.run(
    'UPDATE auth_tokens SET used_at = ? WHERE student_id = ? AND purpose = ? AND used_at IS NULL',
    [nowIso, studentId, purpose]
  );
  await db.run(
    'INSERT INTO auth_tokens (student_id, purpose, token_hash, expires_at, created_by_admin_id) VALUES (?, ?, ?, ?, ?)',
    [studentId, purpose, hashToken(token), expiresAt, adminId]
  );
  return { token, url: tokenUrl(purpose, token), expiresAt };
}

/**
 * Busca un enlace sin consumirlo. Devuelve { row } si es válido o { code } con el motivo:
 * TOKEN_INVALID (no existe o no es de este propósito), TOKEN_USED, TOKEN_EXPIRED, ACCOUNT_DISABLED.
 */
export async function findToken(token, purpose, db = { get }, { lock = false } = {}) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) return { code: 'TOKEN_INVALID' };
  const row = await db.get(
    `SELECT t.id, t.student_id, t.expires_at, t.used_at,
            s.name, s.email, s.is_active, s.password_set_at, s.role
       FROM auth_tokens t
       JOIN students s ON s.id = t.student_id
      WHERE t.token_hash = ? AND t.purpose = ?${lock ? ' FOR UPDATE OF t' : ''}`,
    [hashToken(token), purpose]
  );
  if (!row) return { code: 'TOKEN_INVALID' };
  if (row.used_at) return { code: 'TOKEN_USED' };
  if (Date.parse(row.expires_at) < Date.now()) return { code: 'TOKEN_EXPIRED' };
  if (!Number(row.is_active)) return { code: 'ACCOUNT_DISABLED' };
  return { row };
}

export async function consumeToken(tokenId, db = { run }) {
  await db.run('UPDATE auth_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL', [new Date().toISOString(), tokenId]);
}

export const TOKEN_ERROR_MESSAGES = Object.freeze({
  TOKEN_INVALID: 'El enlace no es válido. Revisa que lo hayas copiado completo o pide uno nuevo.',
  TOKEN_USED: 'Este enlace ya se usó. Si necesitas otro, pídelo desde «¿Olvidaste tu contraseña?».',
  TOKEN_EXPIRED: 'El enlace venció. Pide uno nuevo desde «¿Olvidaste tu contraseña?» o al administrador del curso.',
  ACCOUNT_DISABLED: 'Tu cuenta está desactivada. Contacta al administrador del curso.',
});
