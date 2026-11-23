import express from 'express';
import { run, get, getPgPool } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

const ALL_STEPS = [
  'm1_v1', 'm1_s1', 'm1_v2', 'm1_s2', 'm1_vr',
  'm2_v1', 'm2_s1', 'm2_v2', 'm2_s2', 'm2_vr',
  'm3_v1', 'm3_s1', 'm3_v2', 'm3_s2', 'm3_vr',
  'm4_v1', 'm4_s1', 'm4_v2', 'm4_s2', 'm4_vr',
  'm5_v1', 'm5_s1', 'm5_v2', 'm5_s2', 'm5_vr'
];

// POST /api/progress/:moduleId
router.post('/:moduleId', authenticateToken, async (req, res) => {
  try {
    const { moduleId } = req.params;
    const studentId = req.user.id;
    const stepIndex = ALL_STEPS.indexOf(moduleId);
    
    // El módulo 'exam' NO puede marcarse manualmente; se registra exclusivamente en /api/submit-exam al aprobar con >= 90%
    if (stepIndex === -1) {
      return res.status(400).json({ error: 'Módulo inválido o no permitido para marcado directo.' });
    }

    // Validación de secuencia: el paso anterior debe estar completado
    if (stepIndex > 0) {
      const prevStep = ALL_STEPS[stepIndex - 1];
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
