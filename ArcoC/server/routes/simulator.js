import express from 'express';
import crypto from 'crypto';
import { get, run, withTransaction, getPgPool } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireOpenAccess } from '../services/access.js';
import { isPracticeStep, previousStepOf } from '../config/curriculum.js';
import { getSimulatorEntry, attemptBlockReason } from '../config/simulatorCatalog.js';
import { isPreviewUser } from '../services/preview.js';
import {
  classifyPhaseResult, clampToReserveCap, clampToStepCap, POINTS_BY_TIER, MAX_POINTS_PER_PRACTICE_STEP,
} from '../config/reservePoints.js';

/**
 * Integración con el simulador Unity WebGL (intentos y resultados por fase).
 *
 *   GET  /api/simulator/steps/:stepId              estado del paso para el estudiante
 *   POST /api/simulator/attempts                   { stepId } → { attemptId, scene, phase }
 *   POST /api/simulator/attempts/:attemptId/result resultado de la fase → puntos
 *
 * Unity nunca llama a la API: reporta a la página contenedora vía postMessage y
 * es la página (con la sesión del estudiante) la que envía el resultado aquí.
 * La API decide los puntos; el cliente solo informa hechos (puntaje, errores…).
 */
const router = express.Router();

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Margen para la verificación de tiempo: el tiempo de juego que reporta Unity no
// puede superar el tiempo real transcurrido desde que la API creó el intento.
const TIME_TOLERANCE_SECONDS = 5;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function isStepCompleted(studentId, stepId, db = { get }) {
  const row = await db.get(
    `SELECT id FROM course_progress WHERE student_id = ? AND module_id = ? AND status = 'completed'`,
    [studentId, stepId]
  );
  return Boolean(row);
}

function parseResultBody(body) {
  const b = body || {};
  const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
  const isNum = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

  if (!isInt(b.phase, 1, 99)) return { error: 'phase debe ser un entero entre 1 y 99.' };
  if (!isInt(b.maxScore, 1, 100000)) return { error: 'maxScore debe ser un entero positivo.' };
  if (!isInt(b.score, 0, b.maxScore)) return { error: 'score debe ser un entero entre 0 y maxScore.' };
  if (typeof b.passed !== 'boolean') return { error: 'passed debe ser booleano.' };
  if (!isInt(b.errorCount, 0, 100000)) return { error: 'errorCount debe ser un entero mayor o igual a 0.' };
  if (!isNum(b.timeSeconds, 0, 86400)) return { error: 'timeSeconds debe ser un número entre 0 y 86400.' };
  const doseMsv = b.doseMsv === undefined || b.doseMsv === null ? null : b.doseMsv;
  if (doseMsv !== null && !isNum(doseMsv, 0, 1e6)) return { error: 'doseMsv debe ser un número mayor o igual a 0.' };

  return {
    value: {
      phase: b.phase,
      score: b.score,
      maxScore: b.maxScore,
      passed: b.passed,
      errorCount: b.errorCount,
      timeSeconds: b.timeSeconds,
      doseMsv,
    },
  };
}

// GET /api/simulator/steps/:stepId
router.get('/steps/:stepId', authenticateToken, async (req, res) => {
  try {
    const { stepId } = req.params;
    if (!isPracticeStep(stepId)) {
      return res.status(404).json({ available: false, error: 'Paso práctico inexistente.' });
    }
    const studentId = req.user.id;
    const entry = getSimulatorEntry(stepId);
    if (!entry) {
      return res.status(404).json({ available: false, error: 'Paso práctico sin entrada en el catálogo del simulador.' });
    }
    const stats = await get(
      `SELECT COUNT(*) AS completed_attempts, COALESCE(SUM(points_awarded), 0) AS points_earned
         FROM simulator_attempts
        WHERE student_id = ? AND step_id = ? AND status = 'completed'`,
      [studentId, stepId]
    );
    res.json({
      stepId,
      // available: la escena está en el build y se juega en Unity. Un minijuego pendiente
      // (ready: false) se muestra "en desarrollo"; fuera de producción admite partidas por API
      // (canSimulate), para pruebas y para recorrer el curso en desarrollo.
      available: entry.ready,
      inDevelopment: !entry.ready,
      canSimulate: attemptBlockReason(stepId) === null,
      // Modo revisión del admin: las partidas no suman puntos ni avance
      ...(isPreviewUser(req) ? { preview: true } : {}),
      scene: entry.scene,
      phase: entry.phase,
      title: entry.title,
      completedAttempts: parseInt(stats?.completed_attempts || 0, 10),
      pointsEarned: Number(stats?.points_earned || 0),
      maxPoints: MAX_POINTS_PER_PRACTICE_STEP,
      stepCompleted: await isStepCompleted(studentId, stepId),
    });
  } catch (err) {
    console.error('Simulator step error:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/simulator/attempts
router.post('/attempts', authenticateToken, requireOpenAccess, async (req, res) => {
  try {
    const stepId = req.body?.stepId;
    const entry = getSimulatorEntry(stepId);
    const blockReason = attemptBlockReason(stepId);
    if (blockReason) {
      return res.status(entry ? 409 : 404).json({ error: blockReason });
    }
    const studentId = req.user.id;
    const preview = isPreviewUser(req);

    // Modo revisión: el admin juega cualquier minijuego sin seguir el orden
    if (!preview && await isStepCompleted(studentId, stepId)) {
      return res.status(409).json({ error: 'Este minijuego ya fue finalizado. No se pueden iniciar más partidas.' });
    }

    const previous = previousStepOf(stepId);
    if (!preview && previous && !(await isStepCompleted(studentId, previous))) {
      return res.status(403).json({
        error: `Secuencia requerida: Debes completar el paso previo (${previous}) antes de jugar ${stepId}.`,
      });
    }

    const attemptId = crypto.randomUUID();
    await run(
      `INSERT INTO simulator_attempts (id, student_id, step_id, scene, phase, status, started_at)
       VALUES (?, ?, ?, ?, ?, 'started', ?)`,
      [attemptId, studentId, stepId, entry.scene, entry.phase, new Date().toISOString()]
    );

    res.status(201).json({ attemptId, stepId, scene: entry.scene, phase: entry.phase, ...(preview ? { preview: true } : {}) });
  } catch (err) {
    console.error('Simulator attempt error:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/simulator/attempts/:attemptId/result
router.post('/attempts/:attemptId/result', authenticateToken, requireOpenAccess, async (req, res) => {
  const { attemptId } = req.params;
  if (!UUID_PATTERN.test(attemptId)) {
    return res.status(400).json({ error: 'Identificador de intento inválido.' });
  }
  const parsed = parseResultBody(req.body);
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }
  const result = parsed.value;
  const studentId = req.user.id;
  // Modo revisión: la partida del admin se registra con su nivel, pero no suma puntos ni avance
  const preview = isPreviewUser(req);
  const lockClause = getPgPool() ? ' FOR UPDATE' : '';

  try {
    const outcome = await withTransaction(async (tx) => {
      const attempt = await tx.get(
        `SELECT * FROM simulator_attempts WHERE id = ? AND student_id = ?${lockClause}`,
        [attemptId, studentId]
      );
      if (!attempt) throw new HttpError(404, 'Intento no encontrado.');

      // Idempotente: reenviar el mismo resultado no vuelve a sumar puntos.
      if (attempt.status === 'completed') {
        const student = await tx.get('SELECT reserve_points FROM students WHERE id = ?', [studentId]);
        return {
          attemptId,
          stepId: attempt.step_id,
          phase: attempt.phase,
          tier: attempt.tier,
          pointsAwarded: attempt.points_awarded,
          reservePoints: student?.reserve_points ?? 0,
          duplicate: true,
        };
      }

      if (result.phase !== Number(attempt.phase)) {
        throw new HttpError(422, 'La fase reportada no corresponde a este intento.');
      }
      if (!preview && await isStepCompleted(studentId, attempt.step_id, tx)) {
        throw new HttpError(409, 'Este minijuego ya fue finalizado. El resultado no suma puntos.');
      }
      const elapsedSeconds = (Date.now() - Date.parse(attempt.started_at)) / 1000;
      if (result.timeSeconds > elapsedSeconds + TIME_TOLERANCE_SECONDS) {
        throw new HttpError(422, 'El tiempo reportado supera el tiempo transcurrido del intento.');
      }
      // Producción: una partida real dura al menos minSeconds (carga de Unity incluida). Un resultado
      // anterior solo puede venir de un envío automatizado. En desarrollo no se aplica.
      const minSeconds = getSimulatorEntry(attempt.step_id)?.minSeconds || 0;
      if (process.env.NODE_ENV === 'production' && elapsedSeconds < minSeconds) {
        throw new HttpError(422, `Partida demasiado corta para ser válida (mínimo ${minSeconds} s).`);
      }

      const tier = classifyPhaseResult(result);
      const student = await tx.get('SELECT reserve_points FROM students WHERE id = ?', [studentId]);
      if (!student) throw new HttpError(404, 'Estudiante no encontrado');
      // Tope por minijuego (siempre) y techo global de 500
      const earned = await tx.get(
        `SELECT COALESCE(SUM(points_awarded), 0) AS earned FROM simulator_attempts
          WHERE student_id = ? AND step_id = ? AND status = 'completed'`,
        [studentId, attempt.step_id]
      );
      const earnedInStep = Number(earned?.earned || 0);
      const tierPoints = POINTS_BY_TIER[tier];
      const pointsAwarded = preview
        ? 0
        : clampToReserveCap(clampToStepCap(tierPoints, earnedInStep), student.reserve_points);
      const stepCapReached = !preview && tierPoints > 0 && earnedInStep + tierPoints > MAX_POINTS_PER_PRACTICE_STEP;

      if (pointsAwarded > 0) {
        await tx.run('UPDATE students SET reserve_points = reserve_points + ? WHERE id = ?', [pointsAwarded, studentId]);
      }
      await tx.run(
        `UPDATE simulator_attempts
            SET status = 'completed', completed_at = ?, score = ?, max_score = ?, passed = ?,
                error_count = ?, dose_msv = ?, time_seconds = ?, tier = ?, points_awarded = ?
          WHERE id = ?`,
        [
          new Date().toISOString(), result.score, result.maxScore, result.passed ? 1 : 0,
          result.errorCount, result.doseMsv, result.timeSeconds, tier, pointsAwarded, attemptId,
        ]
      );
      if (!preview) {
        await tx.run(
          'INSERT INTO exam_logs (student_id, event_type, detail) VALUES (?, ?, ?)',
          [
            studentId,
            'SIM_RESULT',
            `${attempt.step_id} fase ${attempt.phase}: ${tier} +${pointsAwarded} pts ` +
              `(score ${result.score}/${result.maxScore}, errores ${result.errorCount}, ${result.timeSeconds.toFixed(1)} s)`,
          ]
        );
      }

      const updated = await tx.get('SELECT reserve_points FROM students WHERE id = ?', [studentId]);
      return {
        attemptId,
        stepId: attempt.step_id,
        phase: Number(attempt.phase),
        tier,
        pointsAwarded,
        reservePoints: updated.reserve_points,
        stepPointsEarned: earnedInStep + pointsAwarded,
        stepPointsMax: MAX_POINTS_PER_PRACTICE_STEP,
        stepCapReached,
        duplicate: false,
        ...(preview ? { preview: true } : {}),
      };
    });

    res.json(outcome);
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Simulator result error:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

export default router;
