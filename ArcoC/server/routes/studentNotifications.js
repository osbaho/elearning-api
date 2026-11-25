import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { listNotifications, markNotificationsRead } from '../services/studentNotifications.js';

/**
 * Avisos del estudiante (Fase 6):
 *   GET  /api/student/notifications         los más recientes y cuántos no ha leído
 *   POST /api/student/notifications/read    { ids? } marca como leídos esos (o todos)
 */
const router = express.Router();

function studentOnly(req, res, next) {
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Los avisos son de los estudiantes.' });
  }
  next();
}

router.get('/student/notifications', authenticateToken, studentOnly, async (req, res) => {
  try {
    res.json({ success: true, ...(await listNotifications(req.user.id)) });
  } catch (err) {
    console.error('Error listing notifications:', err);
    res.status(500).json({ error: 'Error al consultar tus avisos.' });
  }
});

router.post('/student/notifications/read', authenticateToken, studentOnly, async (req, res) => {
  try {
    const ids = req.body?.ids;
    if (ids !== undefined && (!Array.isArray(ids) || ids.length > 100 || ids.some((id) => !Number.isInteger(id) || id <= 0))) {
      return res.status(400).json({ error: 'ids debe ser una lista de hasta 100 identificadores.' });
    }
    res.json({ success: true, unread: await markNotificationsRead(req.user.id, ids) });
  } catch (err) {
    console.error('Error marking notifications as read:', err);
    res.status(500).json({ error: 'Error al actualizar tus avisos.' });
  }
});

export default router;
