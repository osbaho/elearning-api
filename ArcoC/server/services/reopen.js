import { getPgPool } from '../config/db.js';
import { isPracticeStep, isVideoStep } from '../config/curriculum.js';

/**
 * Reintentos auditados (Fase 4): el admin reabre un paso de un estudiante tras revisar su caso.
 *   video     se borra el registro de visto y el inicio de reproducción: debe volver a verlo
 *   minijuego sus partidas se ANULAN (voided_at, no se borran), se descuentan los puntos que
 *             dieron y el paso deja de estar finalizado: debe jugar y finalizar de nuevo
 *   examen    se le concede un intento adicional (students.exam_bonus_attempts); el historial
 *             de intentos se conserva
 * Los pasos posteriores que ya había completado siguen completados.
 */
export class ReopenError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** 'video' | 'minigame' | 'exam' | null según el paso. */
export function reopenKind(stepId) {
  if (stepId === 'exam') return 'exam';
  if (isVideoStep(stepId)) return 'video';
  if (isPracticeStep(stepId)) return 'minigame';
  return null;
}

async function isCompleted(tx, studentId, stepId) {
  const row = await tx.get(
    `SELECT id FROM course_progress WHERE student_id = ? AND module_id = ? AND status = 'completed'`,
    [studentId, stepId]
  );
  return Boolean(row);
}

/**
 * Reabre `stepId` para el estudiante dentro de la transacción `tx`. Devuelve qué cambió.
 * Lanza ReopenError (400/409) si no hay nada que reabrir.
 */
export async function reopenStep(tx, { studentId, stepId, adminId, reason }) {
  const kind = reopenKind(stepId);
  if (!kind) throw new ReopenError(400, 'Indica un paso de la malla (p. ej. m1_s2) o "exam".');
  const nowIso = new Date().toISOString();

  if (kind === 'exam') {
    if (await isCompleted(tx, studentId, 'exam')) {
      throw new ReopenError(409, 'El estudiante ya aprobó el examen: no necesita otro intento.');
    }
    await tx.run(
      'UPDATE students SET exam_bonus_attempts = COALESCE(exam_bonus_attempts, 0) + 1 WHERE id = ?',
      [studentId]
    );
    const row = await tx.get('SELECT exam_bonus_attempts FROM students WHERE id = ?', [studentId]);
    return { kind, bonusAttempts: Number(row?.exam_bonus_attempts || 0) };
  }

  if (kind === 'video') {
    const completed = await isCompleted(tx, studentId, stepId);
    const started = await tx.get('SELECT id FROM video_views WHERE student_id = ? AND step_id = ?', [studentId, stepId]);
    if (!completed && !started) {
      throw new ReopenError(409, 'El estudiante no ha empezado este video: no hay nada que reabrir.');
    }
    await tx.run('DELETE FROM course_progress WHERE student_id = ? AND module_id = ?', [studentId, stepId]);
    await tx.run('DELETE FROM video_views WHERE student_id = ? AND step_id = ?', [studentId, stepId]);
    return { kind, wasCompleted: completed };
  }

  // Minijuego: anula sus partidas vigentes y descuenta los puntos que aportaron
  const completed = await isCompleted(tx, studentId, stepId);
  const attempts = await tx.all(
    'SELECT id, status, points_awarded FROM simulator_attempts WHERE student_id = ? AND step_id = ? AND voided_at IS NULL',
    [studentId, stepId]
  );
  if (!completed && attempts.length === 0) {
    throw new ReopenError(409, 'El estudiante no tiene partidas en este minijuego: no hay nada que reabrir.');
  }
  const pointsRemoved = attempts
    .filter((a) => a.status === 'completed')
    .reduce((sum, a) => sum + (Number(a.points_awarded) || 0), 0);

  await tx.run(
    `UPDATE simulator_attempts SET voided_at = ?, voided_by_admin_id = ?, void_reason = ?
      WHERE student_id = ? AND step_id = ? AND voided_at IS NULL`,
    [nowIso, adminId, reason, studentId, stepId]
  );
  // El saldo no baja de 0 (pudo gastar puntos en comodines). Fila bloqueada en PostgreSQL.
  const lock = getPgPool() ? ' FOR UPDATE' : '';
  const student = await tx.get(`SELECT reserve_points FROM students WHERE id = ?${lock}`, [studentId]);
  const before = Number(student?.reserve_points) || 0;
  const after = Math.max(0, before - pointsRemoved);
  await tx.run('UPDATE students SET reserve_points = ? WHERE id = ?', [after, studentId]);
  await tx.run('DELETE FROM course_progress WHERE student_id = ? AND module_id = ?', [studentId, stepId]);

  return {
    kind,
    wasCompleted: completed,
    voidedAttempts: attempts.length,
    pointsRemoved: before - after,
    reservePoints: after,
  };
}
