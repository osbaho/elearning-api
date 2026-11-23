import express from 'express';
import { get, run, all, getPgPool, withTransaction } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { generateCertificatePDF, verifyCertificateCode, calculateVerificationCode } from '../utils/certificate.js';

const router = express.Router();

// ─── Constantes de negocio ────────────────────────────────────────────────────
const WILDCARD_COST = 100;          // (E-4) Costo fijo en servidor — nunca del cliente
const MAX_EXAM_ATTEMPTS = 3;        // (E-3) Máximo intentos de examen
const TOTAL_COURSE_MODULES = 25;    // 5 módulos × 5 ítems cada uno

let cachedQuestions = null;
let lastCacheTime = 0;
const CACHE_TTL = 60 * 1000; // 1 minuto

// GET /api/questions
router.get('/questions', authenticateToken, async (req, res) => {
  try {
    const { id: studentId } = req.user;

    // C-3: En producción, verificar que todos los módulos del curso están completados antes de dar acceso al examen
    if (process.env.NODE_ENV === 'production') {
      const progressCount = await get(
        `SELECT COUNT(*) as c FROM course_progress WHERE student_id = ? AND status = 'completed' AND module_id != 'exam'`,
        [studentId]
      );
      const completed = parseInt(progressCount?.c || 0, 10);
      if (completed < TOTAL_COURSE_MODULES) {
        return res.status(403).json({
          error: `Debes completar todos los módulos del curso antes de acceder al examen. Completados: ${completed}/${TOTAL_COURSE_MODULES}.`
        });
      }
    }

    const now = Date.now();
    if (!cachedQuestions || now - lastCacheTime > CACHE_TTL) {
      cachedQuestions = await all(
        'SELECT id, category, text, poison_text, option_a, option_b, option_c, option_d FROM questions'
      );
      lastCacheTime = now;
    }
    
    // Copy the array to avoid mutating the cache
    const questions = [...cachedQuestions];
    
    // Shuffle in JS (Fisher-Yates)
    for (let i = questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [questions[i], questions[j]] = [questions[j], questions[i]];
    }
    res.json(questions.slice(0, 10));
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/add-points
router.post('/add-points', authenticateToken, async (req, res) => {
  try {
    const { points, source } = req.body;
    const { id: studentId } = req.user;
    const pts = parseInt(points, 10);
    if (!studentId || isNaN(pts) || pts <= 0 || pts > 100) {
      return res.status(400).json({ error: 'Parámetros inválidos (máximo 100 puntos por evento)' });
    }

    // D-2: Validar que `source` sea un módulo interactivo válido y no esté ya completado
    const validSources = /^m[1-5]_(s1|s2)$/;
    if (source && (typeof source !== 'string' || !validSources.test(source))) {
      return res.status(400).json({ error: 'Fuente de puntos inválida.' });
    }
    if (source) {
      const alreadyDone = await get(
        `SELECT id FROM course_progress WHERE student_id = ? AND module_id = ? AND status = 'completed'`,
        [studentId, source]
      );
      if (alreadyDone) {
        return res.status(400).json({ error: 'Este módulo ya fue completado. No se pueden acumular más puntos.' });
      }
    }

    const newBalance = await withTransaction(async (tx) => {
      const student = await tx.get('SELECT id, reserve_points FROM students WHERE id = ?', [studentId]);
      if (!student) {
        const err = new Error('Estudiante no encontrado');
        err.statusCode = 404;
        throw err;
      }

      const currentPoints = student.reserve_points || 0;
      if (currentPoints >= 500) {
        const err = new Error('Has alcanzado el límite máximo permitido de 500 Puntos de Reserva.');
        err.statusCode = 400;
        throw err;
      }

      const pointsToAdd = Math.min(pts, 500 - currentPoints);
      await tx.run('UPDATE students SET reserve_points = reserve_points + ? WHERE id = ?', [pointsToAdd, studentId]);
      await tx.run(
        'INSERT INTO exam_logs (student_id, event_type, detail) VALUES (?, ?, ?)',
        [studentId, 'POINTS_EARNED', `+${pointsToAdd} pts from ${source || 'simulator'}`]
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
router.post('/use-wildcard', authenticateToken, async (req, res) => {
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
    if (err.message.includes('Estudiante no encontrado') || err.message.includes('Pregunta no encontrada') || err.message.includes('Puntos insuficientes')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/submit-exam
router.post('/submit-exam', authenticateToken, async (req, res) => {
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
    const results = [];
    const questionIds = answers.map(a => a.question_id);
    const placeholders = questionIds.map(() => '?').join(',');
    const dbQuestions = await all(`SELECT id, correct_answer FROM questions WHERE id IN (${placeholders})`, questionIds);
    const questionMap = Object.fromEntries(dbQuestions.map(q => [q.id, q]));

    for (const { question_id, answer } of answers) {
      const q = questionMap[question_id];
      if (!q) {
        return res.status(400).json({ error: `La pregunta con ID ${question_id} no existe.` });
      }
      const isCorrect = q.correct_answer === answer;
      if (isCorrect) correct++;
      results.push({ question_id, correct: isCorrect });
    }

    const score = Math.round((correct / answers.length) * 10000) / 100;
    
    await withTransaction(async (tx) => {
      const student = await tx.get('SELECT exam_score FROM students WHERE id = ?', [studentId]);
      const prevScore = student && student.exam_score !== null ? student.exam_score : 0;
      const finalScore = Math.max(score, prevScore);

      await tx.run(
        'UPDATE students SET exam_score = ? WHERE id = ?',
        [finalScore, studentId]
      );

      // Registrar módulo 'exam' y certificate_code indexado ÚNICAMENTE si aprueba con >= 90%
      if (finalScore >= 90) {
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

    res.json({ success: true, score, correct, total: answers.length, results });
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
router.post('/start-exam', authenticateToken, async (req, res) => {
  try {
    const { id: studentId } = req.user;

    // E-3: Verificar límite de intentos antes de permitir un nuevo examen
    const studentData = await get('SELECT exam_attempts FROM students WHERE id = ?', [studentId]);
    if (studentData && studentData.exam_attempts >= MAX_EXAM_ATTEMPTS) {
      return res.status(403).json({
        error: `Has alcanzado el límite máximo de ${MAX_EXAM_ATTEMPTS} intentos de examen. Contacta con el administrador.`
      });
    }

    await run('UPDATE students SET exam_attempts = exam_attempts + 1 WHERE id = ?', [studentId]);
    await run(
      'INSERT INTO exam_logs (student_id, event_type, detail) VALUES (?, ?, ?)',
      [studentId, 'EXAM_STARTED', 'Started exam attempt']
    );
    res.json({ success: true });
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
