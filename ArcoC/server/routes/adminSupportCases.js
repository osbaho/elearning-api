import express from 'express';
import { all, get, withTransaction } from '../config/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { logAdminAction } from '../services/adminActions.js';
import { sendCaseAnsweredEmail } from '../services/emailService.js';
import { CASE_STATUSES, caseDto, validateResolution } from '../services/supportCases.js';

/**
 * Bandeja de casos reportados (Fase 4).
 *   GET  /api/admin/support-cases?status=open|resolved|rejected|all&studentId=
 *   POST /api/admin/support-cases/:id/resolve   { status: 'resolved' | 'rejected', resolution }
 * Cerrar un caso exige una respuesta: queda en la bitácora (sobre el estudiante) y se le envía
 * por correo.
 */
const router = express.Router();
router.use(authenticateToken, requireAdmin);

const CASE_SELECT = `
  SELECT c.*, s.name AS student_name, s.email AS student_email, s.is_test AS student_is_test, a.name AS admin_name
    FROM support_cases c
    JOIN students s ON s.id = c.student_id
    LEFT JOIN students a ON a.id = c.resolved_by_admin_id`;

router.get('/support-cases', async (req, res) => {
  try {
    const status = req.query.status === 'all' ? null : CASE_STATUSES.includes(req.query.status) ? req.query.status : 'open';
    const studentId = parseInt(req.query.studentId, 10);
    const where = [];
    const params = [];
    if (status) {
      where.push('c.status = ?');
      params.push(status);
    }
    if (Number.isInteger(studentId) && studentId > 0) {
      where.push('c.student_id = ?');
      params.push(studentId);
    }
    const rows = await all(
      `${CASE_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY c.id DESC LIMIT 200`,
      params
    );
    const counts = { open: 0, resolved: 0, rejected: 0 };
    for (const r of await all('SELECT status, COUNT(*) AS n FROM support_cases GROUP BY status')) {
      if (r.status in counts) counts[r.status] = Number(r.n);
    }
    res.json({ success: true, counts, cases: rows.map((row) => caseDto(row, { withStudent: true })) });
  } catch (err) {
    console.error('Error listing support cases (admin):', err);
    res.status(500).json({ error: 'Error del servidor al consultar los casos.' });
  }
});

router.post('/support-cases/:id/resolve', async (req, res) => {
  try {
    const caseId = parseInt(req.params.id, 10);
    const row = Number.isInteger(caseId) && caseId > 0 ? await get(`${CASE_SELECT} WHERE c.id = ?`, [caseId]) : null;
    if (!row) return res.status(404).json({ error: 'Caso no encontrado.' });
    if (row.status !== 'open') return res.status(409).json({ error: 'El caso ya fue cerrado.' });
    const parsed = validateResolution(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const { status, resolution } = parsed.data;

    const nowIso = new Date().toISOString();
    await withTransaction(async (tx) => {
      await tx.run(
        `UPDATE support_cases SET status = ?, resolution = ?, resolved_at = ?, resolved_by_admin_id = ? WHERE id = ?`,
        [status, resolution, nowIso, req.user.id, caseId]
      );
      await logAdminAction({
        adminId: req.user.id,
        action: status === 'resolved' ? 'case.resolve' : 'case.reject',
        targetType: 'student',
        targetId: row.student_id,
        reason: resolution,
        details: { caseId, stepId: row.step_id || null, category: row.category },
      }, tx);
    });

    const email = await sendCaseAnsweredEmail({
      studentId: row.student_id, name: row.student_name, email: row.student_email,
      status, resolution, description: row.description, createdAt: row.created_at, adminId: req.user.id,
    });
    const updated = await get(`${CASE_SELECT} WHERE c.id = ?`, [caseId]);
    res.json({ success: true, case: caseDto(updated, { withStudent: true }), emailStatus: email.status });
  } catch (err) {
    console.error('Error resolving support case:', err);
    res.status(500).json({ error: 'Error del servidor al cerrar el caso.' });
  }
});

export default router;
