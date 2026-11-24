import express from 'express';
import { get, withTransaction } from '../config/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { logAdminAction } from '../services/adminActions.js';
import { copyStudentState, isJumpTarget, jumpToStep, resetProgress } from '../services/testStudents.js';

/**
 * Herramientas para estudiantes de prueba (Fase 3). Solo se aplican a cuentas con is_test = 1
 * (409 para un estudiante real) y cada uso queda en la bitácora del admin.
 *
 *   POST /api/admin/students/:id/test-tools/reset       { reason? }
 *   POST /api/admin/students/:id/test-tools/jump        { stepId }  (paso de la malla o 'exam')
 *   POST /api/admin/students/:id/test-tools/copy-from   { sourceStudentId | sourceEmail }
 */
const router = express.Router();
router.use(authenticateToken, requireAdmin);

const text = (value, max = 500) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

async function testStudentOr4xx(req, res) {
  const id = parseInt(req.params.id, 10);
  const student = Number.isInteger(id) && id > 0
    ? await get('SELECT id, name, email, role, is_test FROM students WHERE id = ?', [id])
    : null;
  if (!student || student.role !== 'student') {
    res.status(404).json({ error: 'Estudiante no encontrado.' });
    return null;
  }
  if (!Number(student.is_test)) {
    res.status(409).json({ error: 'Estas herramientas solo se aplican a estudiantes de prueba.', code: 'NOT_A_TEST_STUDENT' });
    return null;
  }
  return student;
}

router.post('/students/:id/test-tools/reset', async (req, res) => {
  try {
    const student = await testStudentOr4xx(req, res);
    if (!student) return;
    await withTransaction(async (tx) => {
      await resetProgress(tx, student.id);
      await logAdminAction({
        adminId: req.user.id, action: 'test.reset', targetType: 'student', targetId: student.id,
        reason: text(req.body?.reason) || null,
      }, tx);
    });
    res.json({ success: true, message: `${student.name} quedó como recién matriculado.` });
  } catch (err) {
    console.error('Error resetting test student:', err);
    res.status(500).json({ error: 'Error del servidor al reiniciar el estudiante de prueba.' });
  }
});

router.post('/students/:id/test-tools/jump', async (req, res) => {
  try {
    const student = await testStudentOr4xx(req, res);
    if (!student) return;
    const stepId = req.body?.stepId;
    if (!isJumpTarget(stepId)) {
      return res.status(400).json({ error: 'Indica un paso de la malla (p. ej. m2_v1) o "exam".' });
    }
    const completedSteps = await withTransaction(async (tx) => {
      const count = await jumpToStep(tx, student.id, stepId);
      await logAdminAction({
        adminId: req.user.id, action: 'test.jump', targetType: 'student', targetId: student.id,
        reason: text(req.body?.reason) || null,
        details: { stepId, completedSteps: count },
      }, tx);
      return count;
    });
    res.json({
      success: true,
      completedSteps,
      message: stepId === 'exam'
        ? `${student.name} tiene la malla completa y puede presentar el examen.`
        : `${student.name} quedó en el paso ${stepId} (${completedSteps} pasos completados).`,
    });
  } catch (err) {
    console.error('Error moving test student:', err);
    res.status(500).json({ error: 'Error del servidor al mover el estudiante de prueba.' });
  }
});

router.post('/students/:id/test-tools/copy-from', async (req, res) => {
  try {
    const student = await testStudentOr4xx(req, res);
    if (!student) return;
    const sourceId = parseInt(req.body?.sourceStudentId, 10);
    const sourceEmail = text(req.body?.sourceEmail, 254).toLowerCase();
    const source = Number.isInteger(sourceId) && sourceId > 0
      ? await get('SELECT id, name, email, role FROM students WHERE id = ?', [sourceId])
      : sourceEmail
        ? await get('SELECT id, name, email, role FROM students WHERE LOWER(email) = ?', [sourceEmail])
        : null;
    if (!source || source.role !== 'student') {
      return res.status(404).json({ error: 'No se encontró el estudiante de origen.' });
    }
    if (source.id === student.id) {
      return res.status(400).json({ error: 'El estudiante de origen debe ser otro.' });
    }
    const copied = await withTransaction(async (tx) => {
      const counts = await copyStudentState(tx, source.id, student.id);
      await logAdminAction({
        adminId: req.user.id, action: 'test.copy_from', targetType: 'student', targetId: student.id,
        reason: text(req.body?.reason) || null,
        details: { sourceId: source.id, sourceEmail: source.email, ...counts },
      }, tx);
      return counts;
    });
    res.json({
      success: true,
      copied,
      message: `${student.name} tiene ahora el estado de ${source.name}: ${copied.steps} pasos, ` +
        `${copied.attempts} partidas y ${copied.examAttempts} intentos de examen.`,
    });
  } catch (err) {
    console.error('Error copying state to test student:', err);
    res.status(500).json({ error: 'Error del servidor al copiar el estado.' });
  }
});

export default router;
