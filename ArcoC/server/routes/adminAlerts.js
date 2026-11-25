import express from 'express';
import { withTransaction } from '../config/db.js';
import { DEFAULT_TEMPLATES, TEMPLATE_LIMITS, TEMPLATE_VARIABLES } from '../config/reinforcementTemplates.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import {
  INBOX_RULES, decideEntries, inboxSummary, listInbox, parseDecision, syncAlertInbox,
} from '../services/alertInbox.js';
import { loadProgressRows } from '../services/progressTracking.js';
import {
  REINFORCEMENT_RULES, loadTemplates, previewReinforcement, previewTemplateText, restoreTemplate, saveTemplate,
  sendReinforcements,
} from '../services/reinforcement.js';

/**
 * Bandeja de alertas y correos de refuerzo (Fase 5):
 *   GET    /api/admin/alerts?view=pending|postponed|history&cohort=&code=&search=&page=&limit=
 *   GET    /api/admin/alerts/summary            pendientes (por tipo) y pospuestas, para el panel
 *   GET    /api/admin/alerts/:id/preview        el correo de refuerzo de esa alerta y el límite del estudiante
 *   POST   /api/admin/alerts/decide             { ids, action: 'send' | 'postpone' | 'dismiss', days?, note? }
 *   GET    /api/admin/reinforcement-templates   textos de los correos de refuerzo y sus variables
 *   PUT    /api/admin/reinforcement-templates/:code           { subject, body }
 *   DELETE /api/admin/reinforcement-templates/:code           vuelve al texto original
 *   POST   /api/admin/reinforcement-templates/:code/preview   { subject, body } con valores de muestra
 * Abrir la bandeja o el resumen revisa antes las alertas de todos los estudiantes.
 */
const router = express.Router();
router.use(authenticateToken, requireAdmin);

const DECISION_ACTIONS = ['send', 'postpone', 'dismiss'];
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
      rules: {
        cooldownDays: INBOX_RULES.COOLDOWN_DAYS,
        postponeDays: INBOX_RULES.POSTPONE_DAYS,
        minHoursBetween: REINFORCEMENT_RULES.MIN_HOURS_BETWEEN,
        maxPerWeek: REINFORCEMENT_RULES.MAX_PER_WEEK,
      },
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

router.get('/alerts/:id/preview', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Identificador de alerta inválido.' });
    const preview = await previewReinforcement(id);
    if (!preview) return res.status(404).json({ error: 'La alerta no existe.' });
    res.json({ success: true, ...preview });
  } catch (err) {
    console.error('Error previewing reinforcement email:', err);
    res.status(500).json({ error: 'Error al preparar la vista previa del correo.' });
  }
});

router.post('/alerts/decide', async (req, res) => {
  try {
    const parsed = parseDecision(req.body, { actions: DECISION_ACTIONS });
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const { action, ids, note } = parsed.value;
    let results;
    if (action === 'send') {
      const rows = await loadProgressRows({});
      results = await sendReinforcements({ ids, note, adminId: req.user.id, rowsById: new Map(rows.map((r) => [r.id, r])) });
    } else {
      results = await withTransaction((tx) => decideEntries(tx, { ...parsed.value, adminId: req.user.id }));
    }
    const done = results.filter((r) => r.ok).length;
    const summary = await inboxSummary();
    if (done === 0) {
      const status = results.every((r) => r.notFound) ? 404 : results.every((r) => r.limited) ? 429 : 409;
      return res.status(status).json({ error: results[0].error, results, done, summary });
    }
    res.json({ success: true, results, done, summary });
  } catch (err) {
    console.error('Error deciding alerts:', err);
    res.status(500).json({ error: 'Error al registrar la decisión sobre las alertas.' });
  }
});

router.get('/reinforcement-templates', async (req, res) => {
  try {
    res.json({
      success: true,
      variables: TEMPLATE_VARIABLES,
      limits: { subjectMax: TEMPLATE_LIMITS.SUBJECT_MAX, bodyMax: TEMPLATE_LIMITS.BODY_MAX },
      rules: { minHoursBetween: REINFORCEMENT_RULES.MIN_HOURS_BETWEEN, maxPerWeek: REINFORCEMENT_RULES.MAX_PER_WEEK },
      templates: await loadTemplates(),
    });
  } catch (err) {
    console.error('Error loading reinforcement templates:', err);
    res.status(500).json({ error: 'Error al consultar las plantillas.' });
  }
});

router.put('/reinforcement-templates/:code', async (req, res) => {
  try {
    const result = await saveTemplate(req.params.code, req.body, req.user.id);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json({ success: true, template: result.template });
  } catch (err) {
    console.error('Error saving reinforcement template:', err);
    res.status(500).json({ error: 'Error al guardar la plantilla.' });
  }
});

router.delete('/reinforcement-templates/:code', async (req, res) => {
  try {
    const result = await restoreTemplate(req.params.code, req.user.id);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json({ success: true, template: result.template });
  } catch (err) {
    console.error('Error restoring reinforcement template:', err);
    res.status(500).json({ error: 'Error al restaurar la plantilla.' });
  }
});

router.post('/reinforcement-templates/:code/preview', async (req, res) => {
  if (!DEFAULT_TEMPLATES[req.params.code]) return res.status(404).json({ error: 'Ese tipo de alerta no tiene plantilla.' });
  const result = previewTemplateText(req.body);
  if (result.error) return res.status(400).json({ error: result.error });
  res.json({ success: true, ...result.email });
});

export default router;
