import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import jwt from 'jsonwebtoken';

/**
 * Clave del límite global: el estudiante autenticado (cookie de sesión válida) o, sin sesión, su IP.
 * Con la IP sola, todos los estudiantes detrás de un mismo NAT de hospital o de un proxy inverso
 * compartirían el cupo y la plataforma respondería 429 a todos a la vez.
 */
function studentOrIpKey(req) {
  const token = req.cookies?.token;
  if (token && process.env.JWT_SECRET) {
    try {
      const { id } = jwt.verify(token, process.env.JWT_SECRET);
      if (id) return `student:${id}`;
    } catch {
      // token inválido o vencido: se limita por IP
    }
  }
  return ipKeyGenerator(req.ip);
}

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 200 : 5000,
  keyGenerator: studentOrIpKey,
  skip: (req) => process.env.NODE_ENV !== 'production' && req.headers['x-test-secret'] === (process.env.TEST_RESET_SECRET || 'test-reset-secret-local'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, por favor intenta nuevamente más tarde.' },
});

/** Activación de cuenta y recuperación de contraseña: por IP, para frenar el envío masivo de correos y la prueba de tokens. */
export const accountRecoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 20 : 1000,
  skip: (req) => process.env.NODE_ENV !== 'production' && req.headers['x-test-secret'] === (process.env.TEST_RESET_SECRET || 'test-reset-secret-local'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes de acceso. Espera 15 minutos e inténtalo de nuevo.' },
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 500,
  skip: (req) => process.env.NODE_ENV !== 'production' && req.headers['x-test-secret'] === (process.env.TEST_RESET_SECRET || 'test-reset-secret-local'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Espera 15 minutos.' },
  skipSuccessfulRequests: true,
});
