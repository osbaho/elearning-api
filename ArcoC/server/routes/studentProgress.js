import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { loadMyProgress } from '../services/studentProgress.js';

/**
 * «Mi progreso» del estudiante (Fase 6):
 *   GET /api/student/progress   avance por módulo, puntajes, historial de puntos, examen y sus datos
 * Solo lectura: también funciona con la promoción cerrada (modo consulta).
 */
const router = express.Router();

router.get('/student/progress', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Solo los estudiantes tienen progreso en el curso.' });
    }
    const progress = await loadMyProgress(req.user.id);
    if (!progress) return res.status(404).json({ error: 'Estudiante no encontrado.' });
    res.json({ success: true, ...progress });
  } catch (err) {
    console.error('Error loading student progress:', err);
    res.status(500).json({ error: 'Error al consultar tu progreso.' });
  }
});

export default router;
