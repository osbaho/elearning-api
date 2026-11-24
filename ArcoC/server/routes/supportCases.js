import express from 'express';
import { all, get, run } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { MAX_OPEN_CASES_PER_STUDENT, caseDto, validateNewCase } from '../services/supportCases.js';

/**
 * «Reportar un problema» del estudiante (Fase 4).
 *   POST /api/support-cases        { category, stepId?, description, context? }
 *   GET  /api/support-cases/mine   sus casos y la respuesta del admin
 * No exige la promoción abierta: también se reporta, por ejemplo, un problema con el certificado.
 */
const router = express.Router();

router.post('/support-cases', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      return res.status(403).json({ error: 'Los casos los reportan los estudiantes. Para probarlo, usa un estudiante de prueba.' });
    }
    const parsed = validateNewCase(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const open = await get(`SELECT COUNT(*) AS n FROM support_cases WHERE student_id = ? AND status = 'open'`, [req.user.id]);
    if (Number(open?.n || 0) >= MAX_OPEN_CASES_PER_STUDENT) {
      return res.status(429).json({
        error: `Tienes ${MAX_OPEN_CASES_PER_STUDENT} reportes abiertos. Espera la respuesta del administrador antes de abrir otro.`,
      });
    }

    const { category, stepId, description, context } = parsed.data;
    const nowIso = new Date().toISOString();
    await run(
      `INSERT INTO support_cases (student_id, step_id, category, description, context, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'open', ?)`,
      [req.user.id, stepId, category, description, context, nowIso]
    );
    const created = await get(
      'SELECT * FROM support_cases WHERE student_id = ? AND created_at = ? ORDER BY id DESC LIMIT 1',
      [req.user.id, nowIso]
    );
    res.status(201).json({
      success: true,
      case: caseDto(created),
      message: 'Recibimos tu reporte. El administrador lo revisará y te responderá por correo.',
    });
  } catch (err) {
    console.error('Error creating support case:', err);
    res.status(500).json({ error: 'Error del servidor al registrar el reporte.' });
  }
});

router.get('/support-cases/mine', authenticateToken, async (req, res) => {
  try {
    const rows = await all('SELECT * FROM support_cases WHERE student_id = ? ORDER BY id DESC LIMIT 50', [req.user.id]);
    res.json({ success: true, cases: rows.map((row) => caseDto(row)) });
  } catch (err) {
    console.error('Error listing support cases:', err);
    res.status(500).json({ error: 'Error del servidor al consultar tus reportes.' });
  }
});

export default router;
