import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { get, all, run } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimiter.js';
import { encryptText, decryptText } from '../utils/crypto.js';
import {
  EXAM_QUESTION_COUNT, EXAM_PASS_SCORE_PERCENT, MAX_EXAM_ATTEMPTS, WILDCARD_COST
} from '../config/examRules.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// Columnas que necesita buildStudentDto (sin contraseña ni descriptor facial)
const STUDENT_DTO_COLUMNS =
  'id, name, email, role, reserve_points, exam_score, exam_attempts, exam_in_progress, is_onboarded, face_descriptor';

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
      maxAttempts: MAX_EXAM_ATTEMPTS,
      attemptsUsed,
      attemptsLeft: Math.max(0, MAX_EXAM_ATTEMPTS - attemptsUsed),
      inProgress: !!Number(student.exam_in_progress),
      // 'exam' solo se registra en course_progress al aprobar
      passed: completedModules.includes('exam'),
    },
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
      `SELECT ${STUDENT_DTO_COLUMNS}, password FROM students WHERE LOWER(email) = ?`,
      [normalizedEmail]
    );

    if (!student) {
      console.log('Login failed: Student not found for email:', normalizedEmail);
      await bcrypt.compare(password, '$2b$10$invalidhashtopreventtiming......');
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    const isValid = await bcrypt.compare(password, student.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign({ id: student.id, email: normalizedEmail, role: student.role }, JWT_SECRET, { expiresIn: '12h' });

    // Incluye el progreso completo para que el frontend tenga todo el estado al iniciar sesión
    const studentDto = await buildStudentDto({ ...student, email: normalizedEmail });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 12 * 60 * 60 * 1000 // 12 hours
    });

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

export default router;
