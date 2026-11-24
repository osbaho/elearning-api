import express from 'express';
import { get, run, all, getPgPool, withTransaction } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireOpenAccess } from '../services/access.js';
import { generateCertificatePDF, verifyCertificateCode, calculateVerificationCode } from '../utils/certificate.js';
import { TOTAL_COURSE_STEPS, countCompletedCourseSteps, isPracticeStep } from '../config/curriculum.js';
import { MAX_RESERVE_POINTS, clampToReserveCap } from '../config/reservePoints.js';
// (E-3) intentos, (E-4) costo del comodín fijado en el servidor — nunca del cliente
import { WILDCARD_COST, MAX_EXAM_ATTEMPTS, EXAM_QUESTION_COUNT, isExamPassingScore } from '../config/examRules.js';

const router = express.Router();

// ─── Constantes de negocio ────────────────────────────────────────────────────
const VALID_ANSWERS = ['a', 'b', 'c', 'd'];
const NO_OPEN_ATTEMPT = 'No tienes un intento de examen en curso. Inicia el examen desde la plataforma.';

let cachedQuestions = null;
let lastCacheTime = 0;
const CACHE_TTL = 60 * 1000; // 1 minuto

async function getQuestionBank() {
  const now = Date.now();
  if (!cachedQuestions || now - lastCacheTime > CACHE_TTL) {
    cachedQuestions = await all(
      'SELECT id, category, text, poison_text, option_a, option_b, option_c, option_d FROM questions'
    );
    lastCacheTime = now;
  }
  return cachedQuestions;
}

function pickRandomQuestionIds(bank, count) {
  const ids = bank.map(q => q.id);
  // Fisher-Yates
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, count);
}

function parseQuestionIds(value) {
  try {
    const ids = JSON.parse(value);
    return Array.isArray(ids) && ids.length > 0 && ids.every(Number.isInteger) ? ids : null;
  } catch {
    return null;
  }
}

/** C-3: en producción el examen exige la malla completa. Devuelve el mensaje de bloqueo o null. */
async function courseIncompleteMessage(studentId) {
  if (process.env.NODE_ENV !== 'production') return null;
  const rows = await all(
    `SELECT module_id FROM course_progress WHERE student_id = ? AND status = 'completed'`,
    [studentId]
  );
  const completed = countCompletedCourseSteps(rows.map(r => r.module_id));
  return completed < TOTAL_COURSE_STEPS
    ? `Debes completar todos los módulos del curso antes de acceder al examen. Completados: ${completed}/${TOTAL_COURSE_STEPS}.`
    : null;
}

/** Intento abierto del estudiante (set de preguntas fijado por /start-exam), o null. */
async function getOpenAttempt(studentId, db = { get }) {
  const row = await db.get('SELECT exam_in_progress, exam_question_ids FROM students WHERE id = ?', [studentId]);
  if (!row || !Number(row.exam_in_progress)) return null;
  const questionIds = parseQuestionIds(row.exam_question_ids);
  return questionIds ? { questionIds } : null;
}

// GET /api/questions — preguntas del intento en curso. El set lo fija /start-exam, así que
// no se pueden ver preguntas sin consumir un intento y recargar la página no las cambia.
router.get('/questions', authenticateToken, async (req, res) => {
  try {
    const { id: studentId } = req.user;

    const blocked = await courseIncompleteMessage(studentId);
    if (blocked) return res.status(403).json({ error: blocked });

    const attempt = await getOpenAttempt(studentId);
    if (!attempt) return res.status(409).json({ error: NO_OPEN_ATTEMPT });

    const byId = new Map((await getQuestionBank()).map(q => [q.id, q]));
    res.json(attempt.questionIds.map(id => byId.get(id)).filter(Boolean));
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/add-points — SOLO desarrollo y tests.
// Los puntos reales los decide el servidor en /api/simulator/attempts/:id/result a
// partir del resultado de cada fase; aquí el cliente declara los puntos, así que en
// producción el endpoint no existe.
router.post('/add-points', authenticateToken, async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  try {
    const { points, source } = req.body;
    const { id: studentId } = req.user;
    const pts = parseInt(points, 10);
    if (!studentId || isNaN(pts) || pts <= 0 || pts > 100) {
      return res.status(400).json({ error: 'Parámetros inválidos (máximo 100 puntos por evento)' });
    }

    // D-2: `source` es obligatorio, debe ser un minijuego de la malla y no estar completado
    if (!isPracticeStep(source)) {
      return res.status(400).json({ error: 'Fuente de puntos inválida.' });
    }
    const alreadyDone = await get(
      `SELECT id FROM course_progress WHERE student_id = ? AND module_id = ? AND status = 'completed'`,
      [studentId, source]
    );
    if (alreadyDone) {
      return res.status(400).json({ error: 'Este módulo ya fue completado. No se pueden acumular más puntos.' });
    }

    const newBalance = await withTransaction(async (tx) => {
      const student = await tx.get('SELECT id, reserve_points FROM students WHERE id = ?', [studentId]);
      if (!student) {
        const err = new Error('Estudiante no encontrado');
        err.statusCode = 404;
        throw err;
      }

      const currentPoints = student.reserve_points || 0;
      if (currentPoints >= MAX_RESERVE_POINTS) {
        const err = new Error(`Has alcanzado el límite máximo permitido de ${MAX_RESERVE_POINTS} Puntos de Reserva.`);
        err.statusCode = 400;
        throw err;
      }

      const pointsToAdd = clampToReserveCap(pts, currentPoints);
      await tx.run('UPDATE students SET reserve_points = reserve_points + ? WHERE id = ?', [pointsToAdd, studentId]);
      await tx.run(
        'INSERT INTO exam_logs (student_id, event_type, detail) VALUES (?, ?, ?)',
        [studentId, 'POINTS_EARNED', `+${pointsToAdd} pts from ${source}`]
      );

      const updated = await tx.get('SELECT reserve_points FROM students WHERE id = ?', [studentId]);
      return updated.reserve_points;
    });

    res.json({ success: true, newBalance, reservePoints: newBalance });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/use-wildcard
router.post('/use-wildcard', authenticateToken, requireOpenAccess, async (req, res) => {
  try {
    const { question_id } = req.body; // E-4: `cost` ignorado — siempre se usa WILDCARD_COST
    const { id: studentId } = req.user;
    const qId = parseInt(question_id, 10);
    if (!Number.isInteger(qId) || qId <= 0) {
      return res.status(400).json({ error: 'question_id debe ser un entero positivo.' });
    }

    const result = await withTransaction(async (tx) => {
      const student = await tx.get('SELECT id, reserve_points FROM students WHERE id = ?', [studentId]);
      if (!student) throw new Error('Estudiante no encontrado');

      if (student.reserve_points < WILDCARD_COST) {
        throw new Error(`Puntos insuficientes. Actual: ${student.reserve_points}, Requerido: ${WILDCARD_COST}`);
      }

      const question = await tx.get('SELECT wildcard_eliminates FROM questions WHERE id = ?', [qId]);
      if (!question) throw new Error('Pregunta no encontrada');

      // El comodín solo se usa dentro de un intento y sobre una de sus preguntas: fuera del examen
      // serviría para descubrir opciones incorrectas de cualquier pregunta del banco.
      const attempt = await getOpenAttempt(studentId, tx);
      if (!attempt) {
        const err = new Error(NO_OPEN_ATTEMPT);
        err.statusCode = 409;
        throw err;
      }
      if (!attempt.questionIds.includes(qId)) {
        const err = new Error('La pregunta no pertenece a tu intento de examen.');
        err.statusCode = 400;
        throw err;
      }

      await tx.run('UPDATE students SET reserve_points = reserve_points - ? WHERE id = ?', [WILDCARD_COST, studentId]);
      await tx.run(
        'INSERT INTO exam_logs (student_id, event_type, detail) VALUES (?, ?, ?)',
        [studentId, 'WILDCARD_USED', `50/50 on question ${qId}, -${WILDCARD_COST} pts`]
      );

      const updated = await tx.get('SELECT reserve_points FROM students WHERE id = ?', [studentId]);
      
      let eliminateOptions = [];
      if (question.wildcard_eliminates) {
        if (typeof question.wildcard_eliminates === 'string' && question.wildcard_eliminates.startsWith('[')) {
          try { eliminateOptions = JSON.parse(question.wildcard_eliminates); } catch (e) {}
        } else if (typeof question.wildcard_eliminates === 'string' && question.wildcard_eliminates.includes(',')) {
          eliminateOptions = question.wildcard_eliminates.split(',').map(s => s.trim().toLowerCase());
        } else if (typeof question.wildcard_eliminates === 'string') {
          eliminateOptions = question.wildcard_eliminates.toLowerCase().replace(/[^a-d]/g, '').split('');
        }
        eliminateOptions = [...new Set(eliminateOptions.filter(opt => ['a', 'b', 'c', 'd'].includes(opt)))];
      }
      
      return { eliminate_options: eliminateOptions, reservePoints: updated.reserve_points };
    });

    res.json({ success: true, eliminate_options: result.eliminate_options, newBalance: result.reservePoints, reservePoints: result.reservePoints });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    if (err.message.includes('Estudiante no encontrado') || err.message.includes('Pregunta no encontrada') || err.message.includes('Puntos insuficientes')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/submit-exam
router.post('/submit-exam', authenticateToken, requireOpenAccess, async (req, res) => {
  try {
    const { answers } = req.body;
    const { id: studentId } = req.user;

    // E-5: Bloquear si el estudiante ya aprobó el examen
    const examRecord = await get(
      `SELECT id FROM course_progress WHERE student_id = ? AND module_id = 'exam' AND status = 'completed'`,
      [studentId]
    );
    if (examRecord) {
      return res.status(409).json({ error: 'Ya has completado y aprobado el examen. No es posible volver a enviarlo.' });
    }
    if (!studentId || !Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ error: 'El cuerpo de la solicitud debe contener un array válido de respuestas.' });
    }

    // Validación contra fraude: no permitir preguntas duplicadas
    const seenQuestionIds = new Set();
    for (const item of answers) {
      if (!Number.isInteger(item.question_id) || item.question_id <= 0) {
        return res.status(400).json({ error: 'question_id debe ser un entero positivo.' });
      }
      if (!item.answer || typeof item.answer !== 'string') {
        return res.status(400).json({ error: 'Cada respuesta debe contener question_id (entero) y answer (string).' });
      }
      if (!VALID_ANSWERS.includes(item.answer)) {
        return res.status(400).json({ error: 'Cada respuesta debe ser una de las opciones a, b, c o d.' });
      }
      if (seenQuestionIds.has(item.question_id)) {
        return res.status(400).json({ error: 'Se detectaron preguntas duplicadas en el envío del examen.' });
      }
      seenQuestionIds.add(item.question_id);
    }

    // Validación de cantidad mínima de preguntas
    const qCountRow = await get('SELECT COUNT(*) as c FROM questions');
    const totalInDb = parseInt(qCountRow?.c || 0, 10);
    const expectedMinimum = Math.min(5, totalInDb); // Mínimo reglamentario

    if (answers.length < expectedMinimum) {
      return res.status(400).json({ 
        error: `Debes responder la totalidad del examen (mínimo ${expectedMinimum} preguntas). Recibidas: ${answers.length}` 
      });
    }

    let correct = 0;
    const questionIds = answers.map(a => a.question_id);
    const placeholders = questionIds.map(() => '?').join(',');
    const dbQuestions = await all(`SELECT id, correct_answer FROM questions WHERE id IN (${placeholders})`, questionIds);
    const questionMap = Object.fromEntries(dbQuestions.map(q => [q.id, q]));

    for (const { question_id } of answers) {
      if (!questionMap[question_id]) {
        return res.status(400).json({ error: `La pregunta con ID ${question_id} no existe.` });
      }
    }

    // C-3: en producción, la malla completa también se exige al enviar (no solo al ver preguntas)
    const blocked = await courseIncompleteMessage(studentId);
    if (blocked) return res.status(403).json({ error: blocked });

    // Solo se califica un intento abierto con /start-exam y exactamente sus preguntas:
    // así rige el límite de 3 intentos y no se puede elegir qué preguntas responder.
    const attempt = await getOpenAttempt(studentId);
    if (!attempt) return res.status(409).json({ error: NO_OPEN_ATTEMPT });
    const bankIds = new Set((await getQuestionBank()).map(q => q.id));
    const expectedIds = attempt.questionIds.filter(id => bankIds.has(id));
    const submittedIds = new Set(questionIds);
    if (expectedIds.length !== submittedIds.size || !expectedIds.every(id => submittedIds.has(id))) {
      return res.status(400).json({
        error: 'Las respuestas no corresponden a las preguntas de tu intento. Recarga el examen e inténtalo de nuevo.'
      });
    }

    for (const { question_id, answer } of answers) {
      if (questionMap[question_id].correct_answer === answer) correct++;
    }

    const score = Math.round((correct / answers.length) * 10000) / 100;

    await withTransaction(async (tx) => {
      const student = await tx.get('SELECT exam_score FROM students WHERE id = ?', [studentId]);
      const prevScore = student && student.exam_score !== null ? student.exam_score : 0;
      const finalScore = Math.max(score, prevScore);

      // Califica y cierra el intento (el siguiente /start-exam asigna un set nuevo)
      await tx.run(
        'UPDATE students SET exam_score = ?, exam_in_progress = 0, exam_question_ids = NULL WHERE id = ?',
        [finalScore, studentId]
      );

      // Registrar módulo 'exam' y certificate_code indexado ÚNICAMENTE si aprueba
      if (isExamPassingScore(finalScore)) {
        const studentRow = await tx.get('SELECT email FROM students WHERE id = ?', [studentId]);
        const email = studentRow?.email || '';
        const nowIso = new Date().toISOString();
        const certCode = calculateVerificationCode(studentId, email, finalScore, nowIso);

        await tx.run(`
          INSERT INTO course_progress (student_id, module_id, status, completed_at, certificate_code)
          VALUES (?, 'exam', 'completed', ?, ?)
          ON CONFLICT (student_id, module_id)
          DO UPDATE SET status = 'completed', completed_at = ?, certificate_code = ?
        `, [studentId, nowIso, certCode, nowIso, certCode]);
      }

      await tx.run(
        'INSERT INTO exam_logs (student_id, event_type, detail) VALUES (?, ?, ?)',
        [studentId, 'EXAM_SUBMITTED', `Score: ${score}% (${correct}/${answers.length})`]
      );
    });

    // Sin detalle por pregunta: revelaría qué respuestas son correctas
    res.json({ success: true, score, correct, total: answers.length });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/certificate (Student download)
router.get('/certificate', authenticateToken, async (req, res) => {
  try {
    await generateCertificatePDF(req.user.id, res);
  } catch (err) {
    console.error('Certificate route error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Error del servidor al generar certificado.' });
  }
});

// POST /api/start-exam
router.post('/start-exam', authenticateToken, requireOpenAccess, async (req, res) => {
  try {
    const { id: studentId } = req.user;

    const passed = await get(
      `SELECT id FROM course_progress WHERE student_id = ? AND module_id = 'exam' AND status = 'completed'`,
      [studentId]
    );
    if (passed) {
      return res.status(409).json({ error: 'Ya aprobaste el examen. No es posible presentarlo de nuevo.' });
    }

    const blocked = await courseIncompleteMessage(studentId);
    if (blocked) return res.status(403).json({ error: blocked });

    // E-3: Verificar límite de intentos antes de permitir un nuevo examen
    const studentData = await get('SELECT exam_attempts FROM students WHERE id = ?', [studentId]);
    if (studentData && studentData.exam_attempts >= MAX_EXAM_ATTEMPTS) {
      return res.status(403).json({
        error: `Has alcanzado el límite máximo de ${MAX_EXAM_ATTEMPTS} intentos de examen. Contacta con el administrador.`
      });
    }

    // Cada inicio consume un intento. Si ya había uno abierto (p. ej. recargó la página),
    // conserva sus preguntas para no regalar un set nuevo.
    const open = await getOpenAttempt(studentId);
    const questionIds = open ? open.questionIds : pickRandomQuestionIds(await getQuestionBank(), EXAM_QUESTION_COUNT);
    if (questionIds.length === 0) {
      return res.status(503).json({ error: 'El banco de preguntas está vacío. Contacta con el administrador.' });
    }

    await run(
      'UPDATE students SET exam_attempts = exam_attempts + 1, exam_in_progress = 1, exam_question_ids = ? WHERE id = ?',
      [JSON.stringify(questionIds), studentId]
    );
    await run(
      'INSERT INTO exam_logs (student_id, event_type, detail) VALUES (?, ?, ?)',
      [studentId, 'EXAM_STARTED', `Started exam attempt (${questionIds.length} preguntas)`]
    );
    const attemptsUsed = (studentData?.exam_attempts || 0) + 1;
    res.json({ success: true, questionCount: questionIds.length, attemptsUsed, maxAttempts: MAX_EXAM_ATTEMPTS });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});


// POST /api/log-incident
router.post('/log-incident', authenticateToken, async (req, res) => {
  try {
    const { type, detail } = req.body;
    const { id: studentId } = req.user;
    const validTypes = ['FOCUS_LOSS', 'PROCTORING_GRACE', 'PROCTORING_EXPIRED', 'AI_TRAP'];
    if (!validTypes.includes(type)) return res.status(400).json({ error: 'Tipo inválido' });

    if (type === 'FOCUS_LOSS') {
      await run('UPDATE students SET focus_violations = focus_violations + 1 WHERE id = ?', [studentId]);
    }
    if (type === 'PROCTORING_EXPIRED') {
      await run('UPDATE students SET proctoring_incidents = proctoring_incidents + 1 WHERE id = ?', [studentId]);
    }
    await run(
      'INSERT INTO exam_logs (student_id, event_type, detail) VALUES (?, ?, ?)',
      [studentId, type, detail || '']
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/verify/:code — Verificación pública de certificado digital (I-2)
router.get('/verify/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const certInfo = await verifyCertificateCode(code);
    if (!certInfo) {
      return res.status(404).json({
        valid: false,
        error: 'El código proporcionado no corresponde a ningún certificado válido o emitido en la plataforma.'
      });
    }
    res.json(certInfo);
  } catch (err) {
    console.error('Error al verificar certificado:', err);
    res.status(500).json({ error: 'Error al consultar la validez del certificado.' });
  }
});

export default router;
