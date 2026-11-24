import express from 'express';
import { run, get } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireOpenAccess } from '../services/access.js';
import { isPreviewUser } from '../services/preview.js';
import { isCourseStep, isPracticeStep, isVideoStep, minWatchSecondsFor, previousStepOf } from '../config/curriculum.js';

const router = express.Router();

async function isStepCompleted(studentId, stepId) {
  const row = await get(
    'SELECT id FROM course_progress WHERE student_id = ? AND module_id = ? AND status = ?',
    [studentId, stepId, 'completed']
  );
  return Boolean(row);
}

/** Mensaje de bloqueo si el paso anterior no está completado, o null. */
async function sequenceBlockMessage(studentId, stepId) {
  const prevStep = previousStepOf(stepId);
  if (prevStep && !(await isStepCompleted(studentId, prevStep))) {
    return `Secuencia requerida: Debes completar el paso previo (${prevStep}) antes de avanzar a ${stepId}.`;
  }
  return null;
}

// POST /api/progress/:moduleId/start — el estudiante empezó a reproducir un video.
// Registra solo el primer inicio: es el punto desde el que se mide el tiempo mínimo de visualización.
router.post('/:moduleId/start', authenticateToken, requireOpenAccess, async (req, res) => {
  try {
    const { moduleId } = req.params;
    const studentId = req.user.id;
    if (!isVideoStep(moduleId)) {
      return res.status(400).json({ error: 'Solo los videos del curso registran inicio de reproducción.' });
    }
    // Modo revisión: el admin recorre el curso sin registrar nada
    if (isPreviewUser(req)) return res.json({ stepId: moduleId, preview: true });
    const blocked = await sequenceBlockMessage(studentId, moduleId);
    if (blocked) return res.status(403).json({ error: blocked });

    // ON CONFLICT … DO NOTHING: sintaxis común a PostgreSQL y SQLite (≥ 3.24)
    await run(
      `INSERT INTO video_views (student_id, step_id, started_at) VALUES (?, ?, ?) ON CONFLICT (student_id, step_id) DO NOTHING`,
      [studentId, moduleId, new Date().toISOString()]
    );

    const view = await get('SELECT started_at FROM video_views WHERE student_id = ? AND step_id = ?', [studentId, moduleId]);
    res.json({ stepId: moduleId, startedAt: view?.started_at, minWatchSeconds: minWatchSecondsFor(moduleId) });
  } catch (err) {
    console.error('Video start error:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/progress/:moduleId
router.post('/:moduleId', authenticateToken, requireOpenAccess, async (req, res) => {
  try {
    const { moduleId } = req.params;
    const studentId = req.user.id;

    // El módulo 'exam' NO puede marcarse manualmente; se registra exclusivamente en /api/submit-exam al aprobar
    if (!isCourseStep(moduleId)) {
      return res.status(400).json({ error: 'Módulo inválido o no permitido para marcado directo.' });
    }

    // Modo revisión: el admin abre cualquier paso sin orden y no se registra como avance
    if (isPreviewUser(req)) return res.json({ success: true, preview: true });

    // Repetir un paso ya completado no cambia nada
    if (await isStepCompleted(studentId, moduleId)) {
      return res.json({ success: true, alreadyCompleted: true });
    }

    // Validación de secuencia: el paso anterior debe estar completado
    const blocked = await sequenceBlockMessage(studentId, moduleId);
    if (blocked) return res.status(403).json({ error: blocked });

    // Videos (solo producción): el reproductor impide adelantar, pero eso ocurre en el navegador.
    // El servidor exige además que desde el inicio de la reproducción haya pasado el tiempo mínimo.
    // En desarrollo y tests no se aplica para poder avanzar la malla sin esperar.
    if (process.env.NODE_ENV === 'production' && isVideoStep(moduleId)) {
      const minSeconds = minWatchSecondsFor(moduleId);
      if (minSeconds > 0) {
        const view = await get('SELECT started_at FROM video_views WHERE student_id = ? AND step_id = ?', [studentId, moduleId]);
        if (!view) {
          return res.status(403).json({ error: 'Reproduce el video en la plataforma para registrarlo como visto.' });
        }
        const elapsed = (Date.now() - Date.parse(view.started_at)) / 1000;
        if (elapsed < minSeconds) {
          return res.status(403).json({
            error: `Aún no has visto el video completo (faltan unos ${Math.ceil(minSeconds - elapsed)} s).`
          });
        }
      }
    }

    // Todo minijuego exige al menos una partida terminada. Uno pendiente (sin escena en el build)
    // no admite partidas en producción, así que ahí no se puede finalizar ni pasar de largo.
    if (isPracticeStep(moduleId)) {
      const played = await get(
        `SELECT id FROM simulator_attempts WHERE student_id = ? AND step_id = ? AND status = 'completed' LIMIT 1`,
        [studentId, moduleId]
      );
      if (!played) {
        return res.status(403).json({
          error: 'Debes terminar al menos una partida en el simulador antes de finalizar este minijuego.'
        });
      }
    }

    await run(`
      INSERT INTO course_progress (student_id, module_id, status)
      VALUES (?, ?, 'completed')
      ON CONFLICT (student_id, module_id) DO NOTHING
    `, [studentId, moduleId]);

    await run(
      'INSERT INTO exam_logs (student_id, event_type, detail) VALUES (?, ?, ?)',
      [studentId, 'MODULE_COMPLETED', `Module ${moduleId} completed`]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Progress error:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

export default router;
