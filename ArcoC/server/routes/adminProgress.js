import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { PRACTICE_STEPS } from '../config/curriculum.js';
import { getSimulatorEntry } from '../config/simulatorCatalog.js';
import { listAdminActions } from '../services/adminActions.js';
import { loadProgressRows, summarizeRows, loadStudentDetail } from '../services/progressTracking.js';

/**
 * Seguimiento del avance (Fase 2):
 *   GET /api/admin/progress               tabla por promoción, calculada en el servidor
 *   GET /api/admin/students/:id/detail    ficha completa de un estudiante
 */
const router = express.Router();
router.use(authenticateToken, requireAdmin);

const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);

// Columnas de minijuegos de la tabla: los 15 de la malla, con su módulo, fase y si ya están publicados
const MINIGAME_COLUMNS = PRACTICE_STEPS.map((stepId) => {
  const entry = getSimulatorEntry(stepId);
  return {
    stepId,
    module: Number(stepId.match(/^m(\d+)_/)[1]),
    phase: entry?.phase ?? null,
    title: entry?.title ?? stepId,
    ready: entry?.ready === true,
  };
});

// GET /api/admin/progress?cohort=&search=&status=&alerts=1&page=&limit=
router.get('/progress', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const rows = await loadProgressRows({
      cohort: text(req.query.cohort),
      search: text(req.query.search),
      status: text(req.query.status),
    });
    // El resumen es de todo el filtro; "solo con alertas" acota la lista, no los totales
    const listed = req.query.alerts === '1' ? rows.filter((r) => r.alerts.length > 0) : rows;
    res.json({
      success: true,
      page,
      limit,
      total: listed.length,
      summary: summarizeRows(rows),
      minigames: MINIGAME_COLUMNS,
      students: listed.slice((page - 1) * limit, page * limit),
    });
  } catch (err) {
    console.error('Error building progress tracking:', err);
    res.status(500).json({ error: 'Error al calcular el seguimiento del avance.' });
  }
});

// GET /api/admin/students/:id/detail
router.get('/students/:id/detail', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Identificador de estudiante inválido.' });
    }
    const adminActions = await listAdminActions({ targetType: 'student', targetId: id, limit: 200 });
    const detail = await loadStudentDetail(id, { adminActions });
    if (!detail) return res.status(404).json({ error: 'Estudiante no encontrado.' });
    res.json({ success: true, minigames: MINIGAME_COLUMNS, ...detail });
  } catch (err) {
    console.error('Error loading student detail:', err);
    res.status(500).json({ error: 'Error al consultar la ficha del estudiante.' });
  }
});

export default router;
