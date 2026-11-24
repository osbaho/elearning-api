import express from 'express';
import { get, withTransaction } from '../config/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { logAdminAction } from '../services/adminActions.js';
import { sendStepReopenedEmail } from '../services/emailService.js';
import { ReopenError, reopenStep } from '../services/reopen.js';

/**
 * Reintentos auditados (Fase 4).
 *   POST /api/admin/students/:id/reopen   { stepId (paso de la malla o 'exam'), reason, caseId? }
 * El motivo es obligatorio: queda en la bitácora con lo que cambió (partidas anuladas, puntos
 * descontados, intentos concedidos) y se le envía al estudiante por correo.
 */
const router = express.Router();
router.use(authenticateToken, requireAdmin);

const text = (value, max = 500) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

router.post('/students/:id/reopen', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const student = Number.isInteger(id) && id > 0
      ? await get('SELECT id, name, email, role FROM students WHERE id = ?', [id])
      : null;
    if (!student || student.role !== 'student') return res.status(404).json({ error: 'Estudiante no encontrado.' });

    const reason = text(req.body?.reason);
    if (reason.length < 3) {
      return res.status(400).json({ error: 'Indica el motivo: queda en la bitácora y se le envía al estudiante.' });
    }
    const stepId = req.body?.stepId;
    const caseId = parseInt(req.body?.caseId, 10);

    const result = await withTransaction(async (tx) => {
      const changed = await reopenStep(tx, { studentId: student.id, stepId, adminId: req.user.id, reason });
      await logAdminAction({
        adminId: req.user.id,
        action: 'student.reopen',
        targetType: 'student',
        targetId: student.id,
        reason,
        details: { stepId, ...changed, ...(Number.isInteger(caseId) && caseId > 0 ? { caseId } : {}) },
      }, tx);
      return changed;
    });

    const email = await sendStepReopenedEmail({
      studentId: student.id, name: student.name, email: student.email,
      stepId, kind: result.kind, reason, adminId: req.user.id,
    });
    const message = result.kind === 'exam'
      ? `${student.name} tiene un intento adicional del examen.`
      : result.kind === 'video'
        ? `El video ${stepId} quedó pendiente para ${student.name}.`
        : `El minijuego ${stepId} quedó pendiente para ${student.name}: ${result.voidedAttempts} partida(s) anulada(s) y ${result.pointsRemoved} punto(s) descontado(s).`;
    res.json({ success: true, ...result, emailStatus: email.status, message });
  } catch (err) {
    if (err instanceof ReopenError) return res.status(err.status).json({ error: err.message });
    console.error('Error reopening step:', err);
    res.status(500).json({ error: 'Error del servidor al reabrir el paso.' });
  }
});

export default router;
