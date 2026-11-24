import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { get, all, run, withTransaction, getPgPool } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { loginLimiter, accountRecoveryLimiter } from '../middleware/rateLimiter.js';
import { encryptText, decryptText } from '../utils/crypto.js';
import {
  EXAM_QUESTION_COUNT, EXAM_PASS_SCORE_PERCENT, WILDCARD_COST, maxAttemptsFor
} from '../config/examRules.js';
import { getStudentAccess, accessBlockedMessage } from '../services/access.js';
import {
  TOKEN_PURPOSES, TOKEN_ERROR_MESSAGES, issueToken, findToken, consumeToken
} from '../services/authTokens.js';
import { sendWelcomeInductionEmail, sendPasswordResetEmail } from '../services/emailService.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 horas

// Columnas que necesita buildStudentDto (sin contraseña ni descriptor facial)
const STUDENT_DTO_COLUMNS =
  'id, name, email, role, reserve_points, exam_score, exam_attempts, exam_bonus_attempts, exam_in_progress, is_onboarded, face_descriptor';

/** Política de contraseñas: al menos 8 caracteres, con letras y números. Devuelve el error o null. */
export function passwordPolicyError(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return 'La contraseña debe tener entre 8 y 128 caracteres.';
  }
  if (!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(password) || !/\d/.test(password)) {
    return 'La contraseña debe incluir letras y números.';
  }
  return null;
}

/** Abre la sesión: firma el JWT (con la versión de sesión de la cuenta) y fija la cookie. */
function startSession(res, student, email) {
  const token = jwt.sign(
    { id: student.id, email, role: student.role, tv: Number(student.token_version) || 0 },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_MS,
  });
  return token;
}

const HONORIFICS = /^(dr|dra|mg|msc|phd|lic|ing|sr|sra|srta|enf|tec|tecn)\.?$/i;

/** Primer nombre para saludar, sin títulos («Dra. Lucía Pérez» → «Lucía»). */
function firstNameOf(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/);
  return parts.find((p) => !HONORIFICS.test(p)) || parts[0] || '';
}

function maskEmail(email) {
  const [user, domain] = String(email).split('@');
  if (!domain) return '***';
  return `${user.slice(0, 2)}${'•'.repeat(Math.max(1, user.length - 2))}@${domain}`;
}

/**
 * Perfil que recibe el frontend al iniciar sesión y en /student/me.
 * DTO explícito: ningún campo snake_case ni dato sensible se filtra por spread (C-02/C-03).
 * `exam` lleva las reglas vigentes y los intentos, para que la interfaz no las repita a mano.
 */
async function buildStudentDto(student) {
  const progressRecords = await all(
    'SELECT module_id FROM course_progress WHERE student_id = ? AND status = ?',
    [student.id, 'completed']
  );
  const completedModules = progressRecords.map(p => p.module_id);
  const attemptsUsed = Number(student.exam_attempts) || 0;
  const maxAttempts = maxAttemptsFor(student.exam_bonus_attempts);
  const access = await getStudentAccess(student.id);
  // Historial de intentos del examen (sin las preguntas): in_progress | submitted | suspended | abandoned
  const examHistory = await all(
    `SELECT attempt_number, status, score, question_count, started_at, finished_at
       FROM exam_attempts WHERE student_id = ? ORDER BY attempt_number`,
    [student.id]
  );

  return {
    id: student.id,
    name: student.name,
    email: student.email,
    role: student.role,
    completedModules,
    reservePoints: student.reserve_points ?? 0,
    examScore: student.exam_score ?? null,
    isOnboarded: !!student.is_onboarded,
    hasFaceDescriptor: !!student.face_descriptor,
    exam: {
      questionCount: EXAM_QUESTION_COUNT,
      passScore: EXAM_PASS_SCORE_PERCENT,
      wildcardCost: WILDCARD_COST,
      maxAttempts,
      // Intentos adicionales que concedió el admin tras revisar su caso (Fase 4)
      bonusAttempts: Number(student.exam_bonus_attempts) || 0,
      attemptsUsed,
      attemptsLeft: Math.max(0, maxAttempts - attemptsUsed),
      inProgress: !!Number(student.exam_in_progress),
      // 'exam' solo se registra en course_progress al aprobar
      passed: completedModules.includes('exam'),
      history: examHistory.map((a) => ({
        number: Number(a.attempt_number),
        status: a.status,
        score: a.score === null || a.score === undefined ? null : Number(a.score),
        questionCount: Number(a.question_count),
        startedAt: a.started_at,
        finishedAt: a.finished_at ?? null,
      })),
    },
    // Ventana de acceso de su promoción: 'open' | 'closed' (modo consulta) | 'not_started'
    access: access
      ? { state: access.state, cohort: access.cohort, startsOn: access.startsOn, endsOn: access.endsOn }
      : null,
  };
}

// POST /api/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Correo electrónico y contraseña son requeridos y deben ser cadenas de texto' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const student = await get(
      `SELECT ${STUDENT_DTO_COLUMNS}, password, is_active, password_set_at, token_version FROM students WHERE LOWER(email) = ?`,
      [normalizedEmail]
    );

    // Mismo mensaje si el correo no existe, la contraseña no coincide o la cuenta aún no se
    // activó (su contraseña es aleatoria hasta entonces): no revela qué correos están inscritos.
    const invalid = 'Credenciales inválidas. Si aún no activas tu cuenta, usa el enlace de tu correo de bienvenida o «¿Olvidaste tu contraseña?».';
    if (!student) {
      console.log('Login failed: Student not found for email:', normalizedEmail);
      await bcrypt.compare(password, '$2b$10$invalidhashtopreventtiming......');
      return res.status(401).json({ error: invalid, code: 'INVALID_CREDENTIALS' });
    }

    const isValid = await bcrypt.compare(password, student.password);
    if (!isValid) {
      return res.status(401).json({ error: invalid, code: 'INVALID_CREDENTIALS' });
    }

    // Con la contraseña correcta ya se puede explicar por qué no entra
    if (!Number(student.is_active)) {
      return res.status(403).json({ error: 'Tu cuenta está desactivada. Contacta al administrador del curso.', code: 'ACCOUNT_DISABLED' });
    }
    const access = await getStudentAccess(student.id);
    if (access?.state === 'not_started') {
      return res.status(403).json({ error: accessBlockedMessage(access), code: 'ACCESS_NOT_STARTED', startsOn: access.startsOn });
    }

    const token = startSession(res, student, normalizedEmail);
    await run('UPDATE students SET last_login_at = ? WHERE id = ?', [new Date().toISOString(), student.id]);

    // Incluye el progreso completo para que el frontend tenga todo el estado al iniciar sesión
    const studentDto = await buildStudentDto({ ...student, email: normalizedEmail });

    res.json({ success: true, student: studentDto, token });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token', { path: '/' });
  res.json({ success: true });
});

// GET /api/student/me
router.get('/student/me', authenticateToken, async (req, res) => {
  try {
    const student = await get(`SELECT ${STUDENT_DTO_COLUMNS} FROM students WHERE id = ?`, [req.user.id]);
    if (!student) return res.status(404).json({ error: 'Estudiante no encontrado' });

    res.json(await buildStudentDto(student));
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/student/descriptor — endpoint protegido para verificación biométrica (I-04)
// Devuelve el descriptor facial solo al estudiante autenticado; nunca expuesto en el perfil general.
router.get('/student/descriptor', authenticateToken, async (req, res) => {
  try {
    const student = await get('SELECT face_descriptor FROM students WHERE id = ?', [req.user.id]);
    if (!student) return res.status(404).json({ error: 'Estudiante no encontrado' });
    if (!student.face_descriptor) {
      return res.status(404).json({ error: 'Sin descriptor facial registrado. Completa el onboarding primero.' });
    }
    const decryptedJson = decryptText(student.face_descriptor);
    res.json({ descriptor: JSON.parse(decryptedJson) });
  } catch (err) {
    console.error('Descriptor fetch error:', err.message);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/student/onboarding
router.post('/student/onboarding', authenticateToken, async (req, res) => {
  try {
    const { id_number, id_type, institution, face_descriptor } = req.body;

    if (!id_number || typeof id_number !== 'string' || !id_number.trim()) {
      return res.status(400).json({ error: 'El número de identificación es requerido.' });
    }
    if (!institution || typeof institution !== 'string' || !institution.trim()) {
      return res.status(400).json({ error: 'La institución u hospital es requerido.' });
    }
    const validIdTypes = ['CC', 'CE', 'Pasaporte'];
    const chosenType = validIdTypes.includes(id_type) ? id_type : 'CC';

    if (!Array.isArray(face_descriptor) || face_descriptor.length !== 128) {
      return res.status(400).json({ error: 'El descriptor facial biométrico es inválido (debe contener 128 puntos vectoriales).' });
    }

    const isValidNumbers = face_descriptor.every(val => typeof val === 'number' && !isNaN(val));
    if (!isValidNumbers) {
      return res.status(400).json({ error: 'El vector biométrico contiene valores numéricos inválidos.' });
    }

    // B-1: Cifrado AES-256-GCM antes de persistir en base de datos
    const encryptedDescriptor = encryptText(JSON.stringify(face_descriptor));

    await run(
      'UPDATE students SET id_number = ?, id_type = ?, institution = ?, face_descriptor = ?, is_onboarded = 1 WHERE id = ?',
      [id_number.trim(), chosenType, institution.trim(), encryptedDescriptor, req.user.id]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Onboarding error:', err.message);
    res.status(500).json({ error: 'Error al procesar el onboarding' });
  }
});

// ─── Activación de cuenta y restablecimiento de contraseña ──────────────────

const PURPOSE_BY_PARAM = {
  activation: TOKEN_PURPOSES.ACTIVATION,
  password_reset: TOKEN_PURPOSES.PASSWORD_RESET,
};

function tokenErrorStatus(code) {
  return code === 'TOKEN_EXPIRED' || code === 'TOKEN_USED' ? 410 : code === 'ACCOUNT_DISABLED' ? 403 : 400;
}

// GET /api/auth/token-info?token=…&purpose=activation|password_reset — valida un enlace sin
// consumirlo, para que la página muestre a quién pertenece antes de pedir la contraseña.
router.get('/auth/token-info', accountRecoveryLimiter, async (req, res) => {
  try {
    const purpose = PURPOSE_BY_PARAM[req.query.purpose];
    if (!purpose) return res.status(400).json({ error: 'Tipo de enlace inválido.', code: 'TOKEN_INVALID' });
    const result = await findToken(req.query.token, purpose);
    if (result.code) {
      return res.status(tokenErrorStatus(result.code)).json({ error: TOKEN_ERROR_MESSAGES[result.code], code: result.code });
    }
    res.json({
      valid: true,
      purpose,
      firstName: firstNameOf(result.row.name),
      email: maskEmail(result.row.email),
      expiresAt: result.row.expires_at,
    });
  } catch (err) {
    console.error('Token info error:', err.message);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

/**
 * Consume un enlace y fija la contraseña. Activación: deja la cuenta activada y abre la sesión
 * (si su promoción ya empezó). Restablecimiento: cierra las demás sesiones abiertas.
 */
async function setPasswordWithToken(req, res, purpose) {
  const { token, password } = req.body || {};
  const policyError = passwordPolicyError(password);
  if (policyError) return res.status(400).json({ error: policyError, code: 'WEAK_PASSWORD' });

  const hash = await bcrypt.hash(password, 10);
  const outcome = await withTransaction(async (tx) => {
    const found = await findToken(token, purpose, tx, { lock: !!getPgPool() });
    if (found.code) return { code: found.code };
    const nowIso = new Date().toISOString();
    if (purpose === TOKEN_PURPOSES.ACTIVATION) {
      await tx.run(
        'UPDATE students SET password = ?, password_set_at = COALESCE(password_set_at, ?) WHERE id = ?',
        [hash, nowIso, found.row.student_id]
      );
    } else {
      await tx.run(
        'UPDATE students SET password = ?, password_set_at = COALESCE(password_set_at, ?), token_version = token_version + 1 WHERE id = ?',
        [hash, nowIso, found.row.student_id]
      );
    }
    await consumeToken(found.row.id, tx);
    // Un enlace de activación pendiente deja de servir una vez creada la contraseña (y viceversa)
    await tx.run('UPDATE auth_tokens SET used_at = ? WHERE student_id = ? AND used_at IS NULL', [nowIso, found.row.student_id]);
    return { studentId: found.row.student_id };
  });

  if (outcome.code) {
    return res.status(tokenErrorStatus(outcome.code)).json({ error: TOKEN_ERROR_MESSAGES[outcome.code], code: outcome.code });
  }

  if (purpose === TOKEN_PURPOSES.PASSWORD_RESET) {
    return res.json({ success: true, loggedIn: false, message: 'Tu contraseña se actualizó. Ya puedes iniciar sesión.' });
  }

  // Activación: abre la sesión directamente, salvo que su promoción todavía no empiece
  const student = await get(
    `SELECT ${STUDENT_DTO_COLUMNS}, token_version FROM students WHERE id = ?`,
    [outcome.studentId]
  );
  const access = await getStudentAccess(student.id);
  if (access?.state === 'not_started') {
    return res.json({ success: true, loggedIn: false, message: `Tu cuenta quedó activada. ${accessBlockedMessage(access)}` });
  }
  const sessionToken = startSession(res, student, student.email);
  await run('UPDATE students SET last_login_at = ? WHERE id = ?', [new Date().toISOString(), student.id]);
  res.json({ success: true, loggedIn: true, student: await buildStudentDto(student), token: sessionToken });
}

// POST /api/auth/activate — { token, password }
router.post('/auth/activate', accountRecoveryLimiter, async (req, res) => {
  try {
    await setPasswordWithToken(req, res, TOKEN_PURPOSES.ACTIVATION);
  } catch (err) {
    console.error('Activation error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/auth/reset-password — { token, password }
router.post('/auth/reset-password', accountRecoveryLimiter, async (req, res) => {
  try {
    await setPasswordWithToken(req, res, TOKEN_PURPOSES.PASSWORD_RESET);
  } catch (err) {
    console.error('Password reset error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/auth/forgot-password — { email }. Siempre responde lo mismo (no revela qué correos
// existen). A una cuenta sin activar le llega un enlace de activación nuevo; a una activada,
// uno de restablecimiento.
router.post('/auth/forgot-password', accountRecoveryLimiter, async (req, res) => {
  const generic = { success: true, message: 'Si el correo está registrado, te enviamos un enlace para crear tu contraseña. Revisa tu bandeja de entrada y el correo no deseado.' };
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    if (!email || email.length > 254) return res.status(400).json({ error: 'Escribe tu correo electrónico.' });

    const student = await get(
      `SELECT id, name, email, cohort, start_date, role, is_active, password_set_at FROM students WHERE LOWER(email) = ?`,
      [email]
    );
    if (!student || !Number(student.is_active)) return res.json(generic);

    if (!student.password_set_at) {
      const { url } = await issueToken({ studentId: student.id, purpose: TOKEN_PURPOSES.ACTIVATION });
      await sendWelcomeInductionEmail({
        studentId: student.id, name: student.name, email: student.email,
        cohort: student.cohort, startDate: student.start_date, activationUrl: url,
      });
    } else {
      const { url } = await issueToken({ studentId: student.id, purpose: TOKEN_PURPOSES.PASSWORD_RESET });
      await sendPasswordResetEmail({ studentId: student.id, name: student.name, email: student.email, resetUrl: url });
    }
    res.json(generic);
  } catch (err) {
    console.error('Forgot password error:', err.message);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

export default router;
