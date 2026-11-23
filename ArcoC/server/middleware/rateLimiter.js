import rateLimit from 'express-rate-limit';

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 200 : 5000,
  skip: (req) => process.env.NODE_ENV !== 'production' && req.headers['x-test-secret'] === (process.env.TEST_RESET_SECRET || 'test-reset-secret-local'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, por favor intenta nuevamente más tarde.' },
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
