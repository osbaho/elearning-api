import { all, get, getPgPool, withTransaction } from '../config/db.js';
import { logAdminAction } from './adminActions.js';
import { todayIso } from './access.js';
import { loadProgressRows, toIso } from './progressTracking.js';

/**
 * Bandeja de alertas (Fase 5). Las alertas del seguimiento (computeAlerts) llegan a una bandeja
 * donde el admin decide qué hacer con cada una: nada sale solo hacia el estudiante.
 *
 *   pending    detectada, esperando una decisión
 *   postponed  el admin la pospuso hasta una fecha; ese día vuelve a pendientes
 *   sent       el admin envió un correo de refuerzo
 *   dismissed  el admin la descartó
 *   resolved   dejó de cumplirse antes de que se decidiera (p. ej. el estudiante retomó)
 *
 * La revisión (syncAlertInbox) corre cada vez que el admin abre la bandeja o el panel: calcula las
 * alertas vigentes de todos los estudiantes (sin los de prueba) y actualiza las entradas. Hay una
 * sola entrada abierta por estudiante y alerta. Tras enviar o descartar, la misma alerta no vuelve
 * a la bandeja hasta que pasa el período de espera (COOLDOWN_DAYS) si sigue cumpliéndose.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

export const INBOX_RULES = Object.freeze({
  COOLDOWN_DAYS: 7,                              // días antes de que una alerta decidida vuelva
  POSTPONE_DAYS: Object.freeze([1, 3, 7, 14, 30]), // opciones para posponer
  DEFAULT_POSTPONE_DAYS: 3,
  MAX_BATCH: 200,                                // alertas por decisión en grupo
  NOTE_MAX: 500,
});

export const OPEN_STATUSES = Object.freeze(['pending', 'postponed']);
const HISTORY_STATUSES = Object.freeze(['sent', 'dismissed', 'resolved']);

export const INBOX_VIEWS = Object.freeze({
  pending: { statuses: ['pending'], order: 'e.first_seen_at ASC, e.id ASC' },
  postponed: { statuses: ['postponed'], order: 'e.postponed_until ASC, e.id ASC' },
  history: { statuses: HISTORY_STATUSES, order: 'COALESCE(e.resolved_at, e.decided_at) DESC, e.id DESC' },
});

/** Clave de una alerta por estudiante: el código, más el paso si la alerta es de un minijuego. */
export function alertKey(alert) {
  return alert.stepId ? `${alert.code}:${alert.stepId}` : alert.code;
}

/** 'AAAA-MM-DD' + n días. */
export function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Alertas vigentes de las filas de seguimiento; los estudiantes de prueba no entran. */
export function currentAlertsOf(rows) {
  const list = [];
  for (const row of rows) {
    if (row.isTest) continue;
    for (const alert of row.alerts) {
      list.push({ studentId: row.id, code: alert.code, key: alertKey(alert), details: alert });
    }
  }
  return list;
}

/**
 * Qué cambia en la bandeja (función pura).
 *   current  alertas vigentes [{ studentId, code, key, details }]
 *   open     entradas abiertas [{ id, studentId, key, status, postponedUntil, details (JSON) }]
 *   covered  claves `${studentId}|${key}` enviadas o descartadas dentro del período de espera
 *   today    'AAAA-MM-DD'
 * Devuelve { insert, refresh, resolve }: alertas nuevas, entradas que cambian (detalle o vuelta de
 * pospuestas cuya fecha llegó) e ids de entradas cuya alerta dejó de cumplirse.
 */
export function planInboxSync({ current, open, covered = new Set(), today }) {
  const openByKey = new Map(open.map((entry) => [`${entry.studentId}|${entry.key}`, entry]));
  const seen = new Set();
  const insert = [];
  const refresh = [];
  for (const alert of current) {
    const k = `${alert.studentId}|${alert.key}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const entry = openByKey.get(k);
    if (!entry) {
      if (!covered.has(k)) insert.push(alert);
      continue;
    }
    const details = JSON.stringify(alert.details);
    const reactivate = entry.status === 'postponed' && Boolean(entry.postponedUntil) && entry.postponedUntil <= today;
    if (reactivate || details !== entry.details) refresh.push({ id: entry.id, details, reactivate });
  }
  const resolve = open.filter((entry) => !seen.has(`${entry.studentId}|${entry.key}`)).map((entry) => entry.id);
  return { insert, refresh, resolve };
}

// Inserta solo si no hay una entrada abierta ni una decidida dentro del período de espera. La
// comprobación va en la misma sentencia para que una decisión simultánea no se cuele; el índice
// único parcial evita duplicados si dos revisiones insertan a la vez. Los CAST fijan el tipo de
// los parámetros en PostgreSQL.
const INSERT_IF_NEW = `
  INSERT INTO alert_inbox (student_id, alert_code, alert_key, status, details, first_seen_at, updated_at)
  SELECT CAST(? AS INTEGER), CAST(? AS TEXT), CAST(? AS TEXT), 'pending', CAST(? AS TEXT), CAST(? AS TEXT), CAST(? AS TEXT)
   WHERE NOT EXISTS (
     SELECT 1 FROM alert_inbox
      WHERE student_id = CAST(? AS INTEGER) AND alert_key = CAST(? AS TEXT)
        AND (status IN ('pending', 'postponed') OR (status IN ('sent', 'dismissed') AND decided_at >= CAST(? AS TEXT)))
   )
  ON CONFLICT DO NOTHING`;

async function runSync({ now = new Date(), today = todayIso() } = {}) {
  const rows = await loadProgressRows({}, { now, today });
  const current = currentAlertsOf(rows);
  const nowIso = now.toISOString();
  const coolSince = new Date(now.getTime() - INBOX_RULES.COOLDOWN_DAYS * DAY_MS).toISOString();

  const open = (await all(
    `SELECT id, student_id, alert_key, status, postponed_until, details
       FROM alert_inbox WHERE status IN ('pending', 'postponed')`
  )).map((r) => ({
    id: Number(r.id),
    studentId: Number(r.student_id),
    key: r.alert_key,
    status: r.status,
    postponedUntil: r.postponed_until,
    details: r.details,
  }));
  const covered = new Set((await all(
    `SELECT DISTINCT student_id, alert_key FROM alert_inbox
      WHERE status IN ('sent', 'dismissed') AND decided_at >= ?`,
    [coolSince]
  )).map((r) => `${Number(r.student_id)}|${r.alert_key}`));

  const plan = planInboxSync({ current, open, covered, today });
  if (plan.insert.length || plan.refresh.length || plan.resolve.length) {
    await withTransaction(async (tx) => {
      for (const alert of plan.insert) {
        await tx.run(INSERT_IF_NEW, [
          alert.studentId, alert.code, alert.key, JSON.stringify(alert.details), nowIso, nowIso,
          alert.studentId, alert.key, coolSince,
        ]);
      }
      for (const change of plan.refresh) {
        if (change.reactivate) {
          await tx.run(
            `UPDATE alert_inbox SET status = 'pending', postponed_until = NULL, details = ?, updated_at = ?
              WHERE id = ? AND status = 'postponed'`,
            [change.details, nowIso, change.id]
          );
        } else {
          await tx.run(
            `UPDATE alert_inbox SET details = ?, updated_at = ? WHERE id = ? AND status IN ('pending', 'postponed')`,
            [change.details, nowIso, change.id]
          );
        }
      }
      for (const id of plan.resolve) {
        await tx.run(
          `UPDATE alert_inbox SET status = 'resolved', resolved_at = ?, updated_at = ?
            WHERE id = ? AND status IN ('pending', 'postponed')`,
          [nowIso, nowIso, id]
        );
      }
    });
  }
  return { rows, plan };
}

let inflight = null;

/**
 * Revisa las alertas y actualiza la bandeja. Si ya hay una revisión en curso, se espera esa misma
 * (el admin puede abrir el panel y la bandeja a la vez). Devuelve las filas de seguimiento.
 */
export function syncAlertInbox(options) {
  if (!inflight) {
    inflight = runSync(options).finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

function entryFilter({ statuses = null, cohort = null, code = null, search = null, studentId = null } = {}) {
  const where = [];
  const params = [];
  if (statuses) {
    where.push(`e.status IN (${statuses.map(() => '?').join(', ')})`);
    params.push(...statuses);
  }
  if (cohort && cohort !== 'all') {
    where.push(`COALESCE(s.cohort, 'Promoción 1') = ?`);
    params.push(cohort);
  }
  if (code) {
    where.push('e.alert_code = ?');
    params.push(code);
  }
  if (search && String(search).trim()) {
    const like = `%${String(search).toLowerCase().trim()}%`;
    where.push('(LOWER(s.name) LIKE ? OR LOWER(s.email) LIKE ? OR s.id_number LIKE ?)');
    params.push(like, like, like);
  }
  if (studentId) {
    where.push('e.student_id = ?');
    params.push(studentId);
  }
  return { where: where.length ? where.join(' AND ') : '1 = 1', params };
}

function parseDetails(text) {
  if (!text) return null;
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

function entryDto(e, row) {
  return {
    id: Number(e.id),
    studentId: Number(e.student_id),
    student: { name: e.student_name, email: e.student_email, cohort: e.student_cohort || 'Promoción 1' },
    code: e.alert_code,
    key: e.alert_key,
    status: e.status,
    alert: parseDetails(e.details) ?? { code: e.alert_code },
    firstSeenAt: toIso(e.first_seen_at),
    updatedAt: toIso(e.updated_at),
    postponedUntil: e.postponed_until || null,
    decidedAt: toIso(e.decided_at),
    decidedBy: e.decided_by_admin_id ? { id: Number(e.decided_by_admin_id), name: e.admin_name || null } : null,
    note: e.decision_note || null,
    emailLogId: e.email_log_id ? Number(e.email_log_id) : null,
    resolvedAt: toIso(e.resolved_at),
    progress: row
      ? {
        percent: row.percent,
        completedSteps: row.completedSteps,
        totalSteps: row.totalSteps,
        currentStep: row.currentStep,
        lastActivityAt: row.lastActivityAt,
      }
      : null,
  };
}

const ENTRY_SELECT = `
  SELECT e.*, s.name AS student_name, s.email AS student_email, s.cohort AS student_cohort, a.name AS admin_name
    FROM alert_inbox e
    JOIN students s ON s.id = e.student_id
    LEFT JOIN students a ON a.id = e.decided_by_admin_id`;

/** Cuántas entradas hay de cada estado con los filtros dados. */
export async function countEntries(filters = {}) {
  const { where, params } = entryFilter(filters);
  const counts = { pending: 0, postponed: 0, sent: 0, dismissed: 0, resolved: 0 };
  const rows = await all(
    `SELECT e.status, COUNT(*) AS n FROM alert_inbox e JOIN students s ON s.id = e.student_id WHERE ${where} GROUP BY e.status`,
    params
  );
  for (const r of rows) if (r.status in counts) counts[r.status] = Number(r.n);
  return { ...counts, history: counts.sent + counts.dismissed + counts.resolved };
}

/** Resumen para el panel: pendientes por tipo de alerta y pospuestas. */
export async function inboxSummary() {
  const counts = await countEntries();
  const byCode = {};
  for (const r of await all(`SELECT alert_code, COUNT(*) AS n FROM alert_inbox WHERE status = 'pending' GROUP BY alert_code`)) {
    byCode[r.alert_code] = Number(r.n);
  }
  return { pending: counts.pending, postponed: counts.postponed, byCode };
}

/** Una página de la bandeja (pendientes, pospuestas o historial) con el avance de cada estudiante. */
export async function listInbox({ view = 'pending', cohort = null, code = null, search = null, studentId = null, page = 1, limit = 50 } = {},
  { rows = [] } = {}) {
  const viewKey = INBOX_VIEWS[view] ? view : 'pending';
  const { statuses, order } = INBOX_VIEWS[viewKey];
  const filters = { cohort, code, search, studentId };
  const { where, params } = entryFilter({ ...filters, statuses });
  const total = await get(
    `SELECT COUNT(*) AS n FROM alert_inbox e JOIN students s ON s.id = e.student_id WHERE ${where}`,
    params
  );
  const entries = await all(
    `${ENTRY_SELECT} WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit]
  );
  const progress = new Map(rows.map((row) => [row.id, row]));
  return {
    view: viewKey,
    page,
    limit,
    total: Number(total?.n) || 0,
    counts: await countEntries(filters),
    entries: entries.map((e) => entryDto(e, progress.get(Number(e.student_id)))),
  };
}

/**
 * Valida una decisión { ids, action, days?, note? }. `actions` son las acciones admitidas.
 * Devuelve { value } o { error }.
 */
export function parseDecision(body, { actions = ['postpone', 'dismiss'] } = {}) {
  const b = body && typeof body === 'object' ? body : {};
  if (!actions.includes(b.action)) return { error: `action debe ser ${actions.join(' o ')}.` };
  const ids = Array.isArray(b.ids) ? [...new Set(b.ids)] : [];
  if (ids.length === 0 || ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    return { error: 'Indica las alertas a decidir (ids).' };
  }
  if (ids.length > INBOX_RULES.MAX_BATCH) {
    return { error: `Se pueden decidir hasta ${INBOX_RULES.MAX_BATCH} alertas a la vez.` };
  }
  let days = null;
  if (b.action === 'postpone') {
    days = b.days === undefined || b.days === null ? INBOX_RULES.DEFAULT_POSTPONE_DAYS : b.days;
    if (!INBOX_RULES.POSTPONE_DAYS.includes(days)) {
      return { error: `days debe ser uno de: ${INBOX_RULES.POSTPONE_DAYS.join(', ')}.` };
    }
  }
  if (b.note !== undefined && b.note !== null && typeof b.note !== 'string') return { error: 'note debe ser texto.' };
  const note = typeof b.note === 'string' ? b.note.trim() : '';
  if (note.length > INBOX_RULES.NOTE_MAX) return { error: `La nota admite hasta ${INBOX_RULES.NOTE_MAX} caracteres.` };
  return { value: { action: b.action, ids, days, note: note || null } };
}

/**
 * Pospone o descarta entradas abiertas dentro de la transacción `tx`. Cada una queda con el admin,
 * la fecha y la nota, y va a la bitácora del estudiante. Devuelve el resultado por id.
 */
export async function decideEntries(tx, { ids, action, days = null, note = null, adminId, now = new Date(), today = todayIso() }) {
  const nowIso = now.toISOString();
  const until = action === 'postpone' ? addDays(today, days) : null;
  const lock = getPgPool() ? ' FOR UPDATE' : '';
  const results = [];
  for (const id of ids) {
    const entry = await tx.get(`SELECT id, student_id, alert_code, alert_key, status FROM alert_inbox WHERE id = ?${lock}`, [id]);
    if (!entry) {
      results.push({ id, ok: false, notFound: true, error: 'La alerta no existe.' });
      continue;
    }
    if (!OPEN_STATUSES.includes(entry.status)) {
      results.push({ id, ok: false, status: entry.status, error: 'La alerta ya fue decidida o se cerró sola.' });
      continue;
    }
    if (action === 'postpone') {
      await tx.run(
        `UPDATE alert_inbox SET status = 'postponed', postponed_until = ?, decided_at = ?, decided_by_admin_id = ?,
                decision_note = ?, updated_at = ?
          WHERE id = ?`,
        [until, nowIso, adminId, note, nowIso, id]
      );
    } else {
      await tx.run(
        `UPDATE alert_inbox SET status = 'dismissed', postponed_until = NULL, decided_at = ?, decided_by_admin_id = ?,
                decision_note = ?, updated_at = ?
          WHERE id = ?`,
        [nowIso, adminId, note, nowIso, id]
      );
    }
    await logAdminAction({
      adminId,
      action: `alert.${action}`,
      targetType: 'student',
      targetId: Number(entry.student_id),
      reason: note,
      details: { alertId: id, alertCode: entry.alert_code, alertKey: entry.alert_key, ...(until ? { days, until } : {}) },
    }, tx);
    results.push({
      id,
      ok: true,
      status: action === 'postpone' ? 'postponed' : 'dismissed',
      ...(until ? { postponedUntil: until } : {}),
    });
  }
  return results;
}
