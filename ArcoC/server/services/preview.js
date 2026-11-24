/**
 * Modo revisión del administrador (Fase 3).
 *
 * El admin puede recorrer el curso como lo ve un estudiante para reproducir lo que le reportan:
 * abre cualquier paso sin seguir el orden, ve los videos y juega los minijuegos. Nada de eso se
 * registra como avance ni suma Puntos de Reserva, y no presenta el examen.
 */
export const PREVIEW_EXAM_MESSAGE = 'En modo revisión el administrador no presenta el examen.';

/** true si la petición es del administrador (va después de authenticateToken). */
export function isPreviewUser(req) {
  return req.user?.role === 'admin';
}

/** Middleware para las rutas del examen: el admin no lo presenta. */
export function rejectPreviewUser(req, res, next) {
  if (isPreviewUser(req)) return res.status(403).json({ error: PREVIEW_EXAM_MESSAGE, code: 'PREVIEW_MODE' });
  next();
}
