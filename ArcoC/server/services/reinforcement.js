import { all, get, getPgPool, run, withTransaction } from '../config/db.js';
import { appUrl } from '../config/appUrls.js';
import { TOTAL_COURSE_STEPS } from '../config/curriculum.js';
import { getSimulatorEntry } from '../config/simulatorCatalog.js';
import {
  DEFAULT_TEMPLATES, SAMPLE_VALUES, renderTemplate, validateTemplate,
} from '../config/reinforcementTemplates.js';
import { formatDate } from './access.js';
import { logAdminAction } from './adminActions.js';
import { TOKEN_PURPOSES, issueToken } from './authTokens.js';
import { buildInductionEmail, buildReinforcementEmail } from './emailService.js';
import { queueEmail } from './mailer.js';
import { loadProgressRows, toIso } from './progressTracking.js';

/**
 * Correos de refuerzo (Fase 5). El admin los envía desde la bandeja de alertas, uno por uno o en
 * grupo, después de ver cómo queda el correo. Nada sale solo.
 *
 * Límite por estudiante: uno cada 24 horas y dos por semana, contando los refuerzos de la bandeja
 * y el «Recordatorio» de la auditoría (plantilla progress_reminder). Los correos fallidos no cuentan.
 */
export const REINFORCEMENT_RULES = Object.freeze({ MIN_HOURS_BETWEEN: 24, MAX_PER_WEEK: 2 });

const HOUR_MS = 60 * 60 * 1000;
const OPEN_STATUSES = ['pending', 'postponed'];
const COUNTED_TEMPLATES = "(template = 'progress_reminder' OR template LIKE 'reinforcement_%')";

/** Fecha en el formato de CURRENT_TIMESTAMP ('AAAA-MM-DD HH:MM:SS', UTC). */
function sqlTimestamp(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function parseJson(text) {
  if (!text) return null;
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

/** Si el estudiante puede recibir otro refuerzo ahora, y por qué no. */
export async function reinforcementAllowance(studentId, now = new Date()) {
  // sent_at mezcla 'AAAA-MM-DD HH:MM:SS' (al encolar) e ISO (al enviar): se trae con un día de
  // margen y se filtra aquí con la fecha ya interpretada.
  const rows = await all(
    `SELECT sent_at FROM email_logs
      WHERE student_id = ? AND ${COUNTED_TEMPLATES} AND status <> 'failed' AND sent_at >= ?`,
    [studentId, sqlTimestamp(new Date(now.getTime() - 8 * 24 * HOUR_MS))]
  );
  const weekAgo = now.getTime() - 7 * 24 * HOUR_MS;
  const times = rows
    .map((r) => Date.parse(toIso(r.sent_at)))
    .filter((t) => Number.isFinite(t) && t >= weekAgo)
    .sort((a, b) => b - a);
  const lastSentAt = times.length ? new Date(times[0]).toISOString() : null;
  const base = { lastSentAt, sentThisWeek: times.length };
  if (times.length >= REINFORCEMENT_RULES.MAX_PER_WEEK) {
    return {
      ...base,
      allowed: false,
      reason: `Ya recibió ${times.length} refuerzos en los últimos 7 días (máximo ${REINFORCEMENT_RULES.MAX_PER_WEEK}).`,
    };
  }
  if (times.length && now.getTime() - times[0] < REINFORCEMENT_RULES.MIN_HOURS_BETWEEN * HOUR_MS) {
    return { ...base, allowed: false, reason: `Ya recibió un refuerzo hace menos de ${REINFORCEMENT_RULES.MIN_HOURS_BETWEEN} horas.` };
  }
  return { ...base, allowed: true, reason: null };
}

/** Paso de la malla en palabras (el servidor no tiene los títulos de los videos). */
export function stepDescription(stepId) {
  if (stepId === null || stepId === undefined) return 'ninguno: ya terminaste el curso';
  if (stepId === 'exam') return 'el examen final';
  const match = /^m(\d+)_([vs])(\d+)$/.exec(stepId);
  if (!match) return stepId;
  const [, moduleNumber, kind, index] = match;
  if (kind === 'v') return `el video ${index} del módulo ${moduleNumber}`;
  const title = getSimulatorEntry(stepId)?.title;
  return `el minijuego ${index} del módulo ${moduleNumber}${title ? ` («${title}»)` : ''}`;
}

/** Valores de las variables de la plantilla para un estudiante, su fila de seguimiento y su alerta. */
export function reinforcementValues({ student, row = null, alert = null }) {
  return {
    nombre: student.name,
    promocion: student.cohort || 'Promoción 1',
    avance: row?.percent ?? null,
    pasos_completados: row?.completedSteps ?? null,
    pasos_totales: row?.totalSteps ?? TOTAL_COURSE_STEPS,
    paso_actual: row ? stepDescription(row.currentStep) : null,
    dias_sin_actividad: alert?.days ?? null,
    avance_esperado: alert?.expected ?? null,
    fecha_cierre: row?.access?.endsOn ? formatDate(row.access.endsOn) : null,
    dias_para_cierre: alert?.daysLeft ?? null,
    minijuego: alert?.stepId ? (getSimulatorEntry(alert.stepId)?.title || alert.stepId) : null,
    partidas: alert?.attempts ?? null,
    enlace_curso: appUrl('/login'),
  };
}

// ─── Plantillas ─────────────────────────────────────────────────────────────────

/** Plantillas vigentes: el texto editado por el admin o el original. */
export async function loadTemplates() {
  const rows = await all(
    `SELECT t.alert_code, t.subject, t.body, t.updated_at, t.updated_by_admin_id, a.name AS admin_name
       FROM reinforcement_templates t
       LEFT JOIN students a ON a.id = t.updated_by_admin_id`
  );
  const edited = new Map(rows.map((r) => [r.alert_code, r]));
  return Object.entries(DEFAULT_TEMPLATES).map(([code, original]) => {
    const row = edited.get(code);
    return {
      code,
      subject: row ? row.subject : original.subject,
      body: row ? row.body : original.body,
      isDefault: !row,
      updatedAt: row ? toIso(row.updated_at) : null,
      updatedBy: row?.updated_by_admin_id ? { id: Number(row.updated_by_admin_id), name: row.admin_name || null } : null,
      original: { subject: original.subject, body: original.body },
    };
  });
}

/** Guarda el texto editado de una plantilla. Devuelve { template } o { error, status }. */
export async function saveTemplate(code, input, adminId) {
  if (!DEFAULT_TEMPLATES[code]) return { status: 404, error: 'Ese tipo de alerta no tiene plantilla.' };
  const parsed = validateTemplate(input);
  if (parsed.error) return { status: 400, error: parsed.error };
  const nowIso = new Date().toISOString();
  await run(
    `INSERT INTO reinforcement_templates (alert_code, subject, body, updated_at, updated_by_admin_id)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (alert_code) DO UPDATE
        SET subject = excluded.subject, body = excluded.body,
            updated_at = excluded.updated_at, updated_by_admin_id = excluded.updated_by_admin_id`,
    [code, parsed.value.subject, parsed.value.body, nowIso, adminId]
  );
  await logAdminAction({
    adminId, action: 'template.update', targetType: 'template', targetId: code,
    details: { subject: parsed.value.subject },
  });
  return { template: (await loadTemplates()).find((t) => t.code === code) };
}

/** Vuelve al texto original de una plantilla. */
export async function restoreTemplate(code, adminId) {
  if (!DEFAULT_TEMPLATES[code]) return { status: 404, error: 'Ese tipo de alerta no tiene plantilla.' };
  await run('DELETE FROM reinforcement_templates WHERE alert_code = ?', [code]);
  await logAdminAction({ adminId, action: 'template.restore', targetType: 'template', targetId: code });
  return { template: (await loadTemplates()).find((t) => t.code === code) };
}

/** Correo de ejemplo con un texto (aún sin guardar) y valores de muestra. */
export function previewTemplateText(input) {
  const parsed = validateTemplate(input);
  if (parsed.error) return { error: parsed.error };
  return {
    email: buildReinforcementEmail({
      subject: renderTemplate(parsed.value.subject, SAMPLE_VALUES),
      body: renderTemplate(parsed.value.body, SAMPLE_VALUES),
    }),
  };
}

// ─── Correo de una alerta ───────────────────────────────────────────────────────

/**
 * El correo de refuerzo de una alerta: { subject, html, text, template, secrets, kind }.
 * «Sin activar» reenvía la invitación: en la vista previa el enlace es de muestra y al enviar se
 * emite uno nuevo (el anterior deja de servir).
 */
export async function reinforcementEmailFor({ code, alert = null, student, row = null, adminId = null, issueActivationLink = false }) {
  if (code === 'not_activated') {
    const activationUrl = issueActivationLink
      ? (await issueToken({ studentId: student.id, purpose: TOKEN_PURPOSES.ACTIVATION, adminId })).url
      : appUrl('/activar?token=enlace-nuevo-al-enviar');
    const email = buildInductionEmail({
      name: student.name,
      email: student.email,
      cohort: student.cohort || 'Promoción 1',
      startDate: student.start_date || null,
      activationUrl,
    });
    return {
      ...email,
      template: 'reinforcement_not_activated',
      secrets: issueActivationLink ? [activationUrl] : [],
      kind: 'invitation',
    };
  }
  const template = (await loadTemplates()).find((t) => t.code === code);
  if (!template) throw new Error(`No hay plantilla de refuerzo para «${code}».`);
  const values = reinforcementValues({ student, row, alert });
  const email = buildReinforcementEmail({
    subject: renderTemplate(template.subject, values),
    body: renderTemplate(template.body, values),
  });
  return { ...email, template: `reinforcement_${code}`, secrets: [], kind: 'template' };
}

const ENTRY_WITH_STUDENT = `
  SELECT e.id, e.student_id, e.alert_code, e.alert_key, e.status, e.details,
         s.name, s.email, s.cohort, s.start_date, s.is_active
    FROM alert_inbox e
    JOIN students s ON s.id = e.student_id
   WHERE e.id = ?`;

function studentOf(entry) {
  return {
    id: Number(entry.student_id),
    name: entry.name,
    email: entry.email,
    cohort: entry.cohort,
    start_date: entry.start_date,
  };
}

/** Vista previa del correo de una entrada de la bandeja, con el límite del estudiante. */
export async function previewReinforcement(entryId) {
  const entry = await get(ENTRY_WITH_STUDENT, [entryId]);
  if (!entry) return null;
  const student = studentOf(entry);
  const [row] = await loadProgressRows({ studentId: student.id });
  const email = await reinforcementEmailFor({ code: entry.alert_code, alert: parseJson(entry.details), student, row });
  return {
    entryId: Number(entry.id),
    code: entry.alert_code,
    status: entry.status,
    open: OPEN_STATUSES.includes(entry.status),
    to: student.email,
    accountActive: Boolean(Number(entry.is_active ?? 1)),
    kind: email.kind,
    subject: email.subject,
    html: email.html,
    text: email.text,
    allowance: await reinforcementAllowance(student.id),
  };
}

/**
 * Envía el correo de refuerzo de cada entrada abierta. Por entrada:
 *   1. se comprueba que la cuenta esté activa y que el estudiante no haya llegado al límite;
 *   2. se reserva en una transacción: queda «enviada» a nombre del admin, con bloqueo de fila en
 *      PostgreSQL, para que dos admins no envíen el mismo correo;
 *   3. se encola el correo y se enlaza a la entrada. Si no se pudo encolar, la entrada vuelve a
 *      como estaba.
 * Las que no se envían siguen abiertas; el resultado de cada una trae el motivo.
 */
export async function sendReinforcements({ ids, note = null, adminId, rowsById = new Map(), now = new Date() }) {
  const nowIso = now.toISOString();
  const lock = getPgPool() ? ' FOR UPDATE' : '';
  const results = [];
  for (const id of ids) {
    const entry = await get(ENTRY_WITH_STUDENT, [id]);
    if (!entry) {
      results.push({ id, ok: false, notFound: true, error: 'La alerta no existe.' });
      continue;
    }
    if (!OPEN_STATUSES.includes(entry.status)) {
      results.push({ id, ok: false, status: entry.status, error: 'La alerta ya fue decidida o se cerró sola.' });
      continue;
    }
    if (!Number(entry.is_active ?? 1)) {
      results.push({ id, ok: false, error: 'La cuenta está desactivada: no se envían refuerzos.' });
      continue;
    }
    const allowance = await reinforcementAllowance(Number(entry.student_id), now);
    if (!allowance.allowed) {
      results.push({ id, ok: false, limited: true, error: allowance.reason });
      continue;
    }

    const previous = await withTransaction(async (tx) => {
      const current = await tx.get(
        `SELECT status, postponed_until, decided_at, decided_by_admin_id, decision_note FROM alert_inbox WHERE id = ?${lock}`,
        [id]
      );
      if (!current || !OPEN_STATUSES.includes(current.status)) return null;
      await tx.run(
        `UPDATE alert_inbox SET status = 'sent', postponed_until = NULL, decided_at = ?, decided_by_admin_id = ?,
                decision_note = ?, updated_at = ?
          WHERE id = ?`,
        [nowIso, adminId, note, nowIso, id]
      );
      return current;
    });
    if (!previous) {
      results.push({ id, ok: false, error: 'La alerta ya fue decidida o se cerró sola.' });
      continue;
    }

    const student = studentOf(entry);
    try {
      const email = await reinforcementEmailFor({
        code: entry.alert_code,
        alert: parseJson(entry.details),
        student,
        row: rowsById.get(student.id) || null,
        adminId,
        issueActivationLink: true,
      });
      await queueEmail({
        studentId: student.id, to: student.email, subject: email.subject, html: email.html, text: email.text,
        template: email.template, secrets: email.secrets, adminId,
      });
      const log = await get('SELECT MAX(id) AS id FROM email_logs WHERE student_id = ? AND template = ?', [student.id, email.template]);
      const emailLogId = log?.id ? Number(log.id) : null;
      await run('UPDATE alert_inbox SET email_log_id = ? WHERE id = ?', [emailLogId, id]);
      await logAdminAction({
        adminId, action: 'alert.send', targetType: 'student', targetId: student.id, reason: note,
        details: { alertId: id, alertCode: entry.alert_code, alertKey: entry.alert_key, emailLogId, template: email.template },
      });
      results.push({ id, ok: true, status: 'sent', emailLogId });
    } catch (err) {
      console.error('Error sending reinforcement email:', err);
      await run(
        `UPDATE alert_inbox SET status = ?, postponed_until = ?, decided_at = ?, decided_by_admin_id = ?,
                decision_note = ?, updated_at = ?
          WHERE id = ? AND status = 'sent' AND email_log_id IS NULL`,
        [previous.status, previous.postponed_until, previous.decided_at, previous.decided_by_admin_id,
          previous.decision_note, nowIso, id]
      );
      results.push({ id, ok: false, error: 'No se pudo encolar el correo; la alerta sigue abierta.' });
    }
  }
  return results;
}
