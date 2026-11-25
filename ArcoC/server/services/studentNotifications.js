import { all, get, run } from '../config/db.js';
import { isPracticeStep } from '../config/curriculum.js';
import { stepDescription } from './stepLabels.js';

/**
 * Avisos del estudiante dentro de la plataforma (Fase 6). Acompañan al correo cuando el admin
 * responde un reporte, reabre un paso, concede un intento del examen o envía un refuerzo, para que
 * el estudiante los vea al entrar aunque no haya leído el correo. Se ven en la campana del curso.
 */
export const NOTIFICATION_LIMITS = Object.freeze({ TITLE_MAX: 140, BODY_MAX: 600, LIST_MAX: 30 });

const clip = (text, max) => {
  const value = String(text ?? '').trim();
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
};

/** Dónde lleva el aviso de un paso: la práctica del minijuego, el examen o el curso. */
export function stepLink(stepId) {
  if (stepId === 'exam') return '/course/exam';
  if (isPracticeStep(stepId)) return `/course/practice/${stepId}`;
  return '/course';
}

/** Texto de cada aviso (función pura). */
export function notificationFor(kind, data = {}) {
  switch (kind) {
    case 'case_answered':
      return {
        title: data.status === 'resolved' ? 'Respondieron tu reporte' : 'Revisaron tu reporte',
        body: data.resolution,
        link: '/course',
      };
    case 'step_reopened':
      return {
        title: 'Se reabrió un paso de tu curso',
        body: `Puedes hacer de nuevo ${stepDescription(data.stepId)}. Motivo: ${data.reason}`,
        link: stepLink(data.stepId),
      };
    case 'exam_attempt_granted':
      return { title: 'Tienes un intento adicional del examen', body: `Motivo: ${data.reason}`, link: '/course/exam' };
    case 'reinforcement':
      return { title: `Mensaje de tu coordinador: ${data.subject}`, body: data.text, link: '/course' };
    default:
      throw new Error(`Tipo de aviso desconocido: ${kind}`);
  }
}

/** Crea el aviso `kind` para el estudiante (dentro de `db`, p. ej. una transacción). */
export async function notifyStudent(studentId, kind, data = {}, db = { run }) {
  const { title, body, link } = notificationFor(kind, data);
  await db.run(
    'INSERT INTO student_notifications (student_id, kind, title, body, link, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [
      studentId,
      kind,
      clip(title, NOTIFICATION_LIMITS.TITLE_MAX),
      body ? clip(body, NOTIFICATION_LIMITS.BODY_MAX) : null,
      link || null,
      new Date().toISOString(),
    ]
  );
}

/** Los avisos más recientes del estudiante y cuántos no ha leído. */
export async function listNotifications(studentId, { limit = NOTIFICATION_LIMITS.LIST_MAX } = {}) {
  const rows = await all(
    `SELECT id, kind, title, body, link, created_at, read_at FROM student_notifications
      WHERE student_id = ? ORDER BY id DESC LIMIT ?`,
    [studentId, limit]
  );
  const unread = await get('SELECT COUNT(*) AS n FROM student_notifications WHERE student_id = ? AND read_at IS NULL', [studentId]);
  return {
    unread: Number(unread?.n) || 0,
    items: rows.map((r) => ({
      id: Number(r.id),
      kind: r.kind,
      title: r.title,
      body: r.body || null,
      link: r.link || null,
      createdAt: r.created_at,
      read: Boolean(r.read_at),
    })),
  };
}

/** Marca como leídos los avisos `ids` del estudiante (todos si no se indican). Devuelve los no leídos. */
export async function markNotificationsRead(studentId, ids = null) {
  const nowIso = new Date().toISOString();
  if (Array.isArray(ids) && ids.length > 0) {
    await run(
      `UPDATE student_notifications SET read_at = ?
        WHERE student_id = ? AND read_at IS NULL AND id IN (${ids.map(() => '?').join(', ')})`,
      [nowIso, studentId, ...ids]
    );
  } else {
    await run('UPDATE student_notifications SET read_at = ? WHERE student_id = ? AND read_at IS NULL', [nowIso, studentId]);
  }
  const unread = await get('SELECT COUNT(*) AS n FROM student_notifications WHERE student_id = ? AND read_at IS NULL', [studentId]);
  return Number(unread?.n) || 0;
}
