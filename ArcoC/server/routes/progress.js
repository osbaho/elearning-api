import express from 'express';
import { run, get, getPgPool } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { isCourseStep, previousStepOf } from '../config/curriculum.js';
import { getSimulatorEntry } from '../config/simulatorCatalog.js';

const router = express.Router();

// POST /api/progress/:moduleId
router.post('/:moduleId', authenticateToken, async (req, res) => {
  try {
    const { moduleId } = req.params;
    const studentId = req.user.id;

    // El módulo 'exam' NO puede marcarse manualmente; se registra exclusivamente en /api/submit-exam al aprobar con >= 90%
    if (!isCourseStep(moduleId)) {
      return res.status(400).json({ error: 'Módulo inválido o no permitido para marcado directo.' });
    }

    // Validación de secuencia: el paso anterior debe estar completado
    const prevStep = previousStepOf(moduleId);
    if (prevStep) {
      const prevDone = await get(
        'SELECT id FROM course_progress WHERE student_id = ? AND module_id = ? AND status = ?',
        [studentId, prevStep, 'completed']
      );
      if (!prevDone) {
        return res.status(403).json({
          error: `Secuencia requerida: Debes completar el paso previo (${prevStep}) antes de avanzar a ${moduleId}.`
        });
      }
    }

    // Los minijuegos con contenido en el simulador exigen al menos una partida terminada
    if (getSimulatorEntry(moduleId)) {
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

    const pgPool = getPgPool();

    if (pgPool) {
      await run(`
        INSERT INTO course_progress (student_id, module_id, status) 
        VALUES (?, ?, 'completed') 
        ON CONFLICT (student_id, module_id) 
        DO NOTHING
      `, [studentId, moduleId]);
    } else {
      await run(`
        INSERT OR IGNORE INTO course_progress (student_id, module_id, status)
        VALUES (?, ?, 'completed')
      `, [studentId, moduleId]);
    }

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
