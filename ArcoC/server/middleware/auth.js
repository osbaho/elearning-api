import jwt from 'jsonwebtoken';
import { get } from '../config/db.js';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('❌ JWT_SECRET is missing or too short in your .env file.');
  process.exit(1);
}

/**
 * Comprueba en la base que la sesión siga vigente: la cuenta existe, está activa y la versión
 * de sesión del token coincide (desactivar la cuenta o cambiar la contraseña la incrementa y
 * cierra todas las sesiones abiertas). Devuelve { student } o { status, error, code }.
 */
export async function validateSession(payload) {
  const student = await get('SELECT id, role, is_active, token_version FROM students WHERE id = ?', [payload?.id]);
  if (!student) {
    return { status: 401, error: 'Tu sesión ya no es válida. Inicia sesión de nuevo.', code: 'SESSION_INVALID' };
  }
  if (!Number(student.is_active)) {
    return { status: 403, error: 'Tu cuenta está desactivada. Contacta al administrador del curso.', code: 'ACCOUNT_DISABLED' };
  }
  if ((Number(payload.tv) || 0) !== (Number(student.token_version) || 0)) {
    return { status: 401, error: 'Tu sesión se cerró (cambio de contraseña o de estado de la cuenta). Inicia sesión de nuevo.', code: 'SESSION_REVOKED' };
  }
  return { student };
}

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = req.cookies?.token || (authHeader && authHeader.split(' ')[1]);

  if (!token) return res.status(401).json({ error: 'No token provided' });

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  try {
    const session = await validateSession(payload);
    if (session.error) {
      return res.status(session.status).json({ error: session.error, code: session.code });
    }
    // El rol sale de la base, no del token: un cambio de rol rige de inmediato
    req.user = { ...payload, role: session.student.role };
    next();
  } catch (err) {
    console.error('Error validando la sesión:', err.message);
    res.status(500).json({ error: 'Error del servidor' });
  }
}

/** Solo administradores. Va después de authenticateToken (que lee el rol de la base). */
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden. Admin role required.' });
  }
  next();
}
