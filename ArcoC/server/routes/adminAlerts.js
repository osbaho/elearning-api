import express from 'express';
import { withTransaction } from '../config/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import {
  INBOX_RULES, decideEntries, inboxSummary, listInbox, parseDecision, syncAlertInbox,
} from '../services/alertInbox.js';

/**
 * Bandeja de alertas (Fase 5):
 *   GET  /api/admin/alerts?view=pending|postponed|history&cohort=&code=&search=&page=&limit=
 *   GET  /api/admin/alerts/summary          pendientes (por tipo) y pospuestas, para el panel
 *   POST /api/admin/alerts/decide           { ids, action: 'postpone' | 'dismiss', days?, note? }
 * Abrir la bandeja o el resumen revisa antes las alertas de todos los estudiantes.
 */
const router = express.Router();
router.use(authenticateToken, requireAdmin);

const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);

router.get('/alerts', async (req, res) => {
  try {
    const { rows } = await syncAlertInbox();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const result = await listInbox({
      view: req.query.view,
      cohort: text(req.query.cohort),
      code: text(req.query.code),
      search: text(req.query.search),
      page,
      limit,
    }, { rows });
    res.json({
      success: true,
      rules: { cooldownDays: INBOX_RULES.COOLDOWN_DAYS, postponeDays: INBOX_RULES.POSTPONE_DAYS },
      ...result,
      // Totales sin filtros, para el contador de la pestaña
      summary: await inboxSummary(),
    });
  } catch (err) {
    console.error('Error listing alert inbox:', err);
    res.status(500).json({ error: 'Error al consultar la bandeja de alertas.' });
  }
});

router.get('/alerts/summary', async (req, res) => {
  try {
    await syncAlertInbox();
    res.json({ success: true, ...(await inboxSummary()) });
  } catch (err) {
    console.error('Error summarizing alert inbox:', err);
    res.status(500).json({ error: 'Error al consultar la bandeja de alertas.' });
  }
});

router.post('/alerts/decide', async (req, res) => {
  try {
    const parsed = parseDecision(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const results = await withTransaction((tx) => decideEntries(tx, { ...parsed.value, adminId: req.user.id }));
    const done = results.filter((r) => r.ok).length;
    const summary = await inboxSummary();
    if (done === 0) {
      const status = results.every((r) => r.notFound) ? 404 : 409;
      return res.status(status).json({ error: results[0].error, results, done, summary });
    }
    res.json({ success: true, results, done, summary });
  } catch (err) {
    console.error('Error deciding alerts:', err);
    res.status(500).json({ error: 'Error al registrar la decisión sobre las alertas.' });
  }
});

export default router;
