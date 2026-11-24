import { all } from '../config/db.js';
import { COURSE_STEPS, TOTAL_COURSE_STEPS, PRACTICE_STEPS } from '../config/curriculum.js';
import { MAX_EXAM_ATTEMPTS, isExamPassingScore, maxAttemptsFor } from '../config/examRules.js';
import { accessStateFor, todayIso } from './access.js';
import { caseDto } from './supportCases.js';

/**
 * Seguimiento del avance (Fase 2): por estudiante, avance y paso actual, mejor resultado de cada
 * minijuego, puntos, última actividad y alertas. Todo se calcula en el servidor a partir de lo que
 * ya guarda la base (course_progress, simulator_attempts, video_views, exam_attempts).
 *
 * Las alertas son avisos para el admin, no correos: él decide qué hacer (Fase 5).
 */
const DAY_MS = 24 * 60 * 60 * 1000;
export const ALERT_RULES = Object.freeze({
  INACTIVE_DAYS: 7,            // sin actividad (o sin activar la cuenta) desde hace 7 días o más
  STRUGGLING_ATTEMPTS: 3,      // partidas terminadas de un minijuego sin aprobar ninguna
  BEHIND_SCHEDULE_MARGIN: 20,  // puntos porcentuales por debajo del avance esperado
  COHORT_CLOSING_DAYS: 7,      // días para el cierre de la promoción
});

const TIER_RANK = { perfect: 3, intermediate: 2, failed: 1 };

/** Fecha de cualquiera de los dos motores → ISO 8601 en UTC (o null). */
export function toIso(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  const text = String(value);
  // CURRENT_TIMESTAMP de SQLite: 'AAAA-MM-DD HH:MM:SS', en UTC
  const sqlite = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/.exec(text);
  const parsed = new Date(sqlite ? `${sqlite[1]}T${sqlite[2]}Z` : text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function latestIso(values) {
  return values.map(toIso).filter(Boolean).sort().at(-1) ?? null;
}

/** Resumen de un minijuego a partir de sus partidas terminadas. */
export function summarizeMinigame(attempts) {
  const done = attempts.filter((a) => a.status === 'completed');
  if (done.length === 0) {
    return { attempts: 0, bestTier: null, bestPercent: null, points: 0, lastPlayedAt: null };
  }
  let best = null;
  for (const a of done) {
    const percent = Number(a.max_score) > 0 ? Math.round((Number(a.score) / Number(a.max_score)) * 100) : 0;
    const rank = TIER_RANK[a.tier] || 0;
    if (!best || rank > best.rank || (rank === best.rank && percent > best.percent)) {
      best = { rank, percent, tier: a.tier };
    }
  }
  return {
    attempts: done.length,
    bestTier: best.tier,
    bestPercent: best.percent,
    points: done.reduce((sum, a) => sum + Number(a.points_awarded || 0), 0),
    lastPlayedAt: latestIso(done.map((a) => a.completed_at)),
  };
}

/** Siguiente paso pendiente; 'exam' con la malla completa; null si ya aprobó el examen. */
export function currentStepOf(completed, examPassed) {
  if (examPassed) return null;
  return COURSE_STEPS.find((step) => !completed.has(step)) ?? 'exam';
}

function daysBetween(fromIso, now) {
  return Math.floor((now.getTime() - Date.parse(fromIso)) / DAY_MS);
}

/**
 * Alertas de un estudiante. Solo para cuentas activas, no certificadas y con la promoción abierta
 * (antes del inicio o después del cierre no hay avance que esperar).
 */
export function computeAlerts(s, now = new Date()) {
  const alerts = [];
  if (s.certified || !s.isActive || s.accessState !== 'open') return alerts;

  if (!s.activated) {
    const days = s.createdAt ? daysBetween(s.createdAt, now) : 0;
    if (days >= ALERT_RULES.INACTIVE_DAYS) {
      alerts.push({ code: 'not_activated', label: `Cuenta sin activar hace ${days} días`, days });
    }
    return alerts;
  }

  const since = s.lastActivityAt || s.accessStartIso || s.activatedAt;
  if (since) {
    const days = daysBetween(since, now);
    if (days >= ALERT_RULES.INACTIVE_DAYS) {
      alerts.push({
        code: 'inactive',
        label: s.lastActivityAt ? `Sin actividad hace ${days} días` : `No ha empezado el curso (${days} días con acceso)`,
        days,
      });
    }
  }

  if (s.startsOn && s.endsOn) {
    const start = Date.parse(`${s.startsOn}T00:00:00Z`);
    const end = Date.parse(`${s.endsOn}T23:59:59Z`);
    const nowMs = now.getTime();
    if (end > start && nowMs >= start && nowMs <= end) {
      const expected = Math.round(((nowMs - start) / (end - start)) * 100);
      if (s.percent < expected - ALERT_RULES.BEHIND_SCHEDULE_MARGIN) {
        alerts.push({ code: 'behind_schedule', label: `Avance del ${s.percent}%; a esta altura se esperaba ~${expected}%`, expected });
      }
      const daysLeft = Math.floor((end - nowMs) / DAY_MS);
      if (daysLeft <= ALERT_RULES.COHORT_CLOSING_DAYS) {
        alerts.push({ code: 'cohort_closing', label: `La promoción cierra en ${daysLeft} día(s)`, daysLeft });
      }
    }
  }

  for (const [stepId, m] of Object.entries(s.minigames)) {
    if (!s.completed.has(stepId) && m.attempts >= ALERT_RULES.STRUGGLING_ATTEMPTS && m.bestTier === 'failed') {
      alerts.push({ code: 'minigame_struggling', label: `${m.attempts} partidas sin aprobar`, stepId, attempts: m.attempts });
    }
  }

  if (s.examAttemptsUsed >= (s.examMaxAttempts ?? MAX_EXAM_ATTEMPTS)) {
    alerts.push({ code: 'exam_exhausted', label: 'Agotó los intentos del examen sin aprobar' });
  }
  return alerts;
}

// ─── Carga desde la base ────────────────────────────────────────────────────────

// Mismos filtros del panel: promoción, búsqueda y estado de la cuenta
const STATUS_FILTERS = {
  active: 'COALESCE(s.is_active, 1) = 1 AND s.password_set_at IS NOT NULL',
  pending: 'COALESCE(s.is_active, 1) = 1 AND s.password_set_at IS NULL',
  inactive: 'COALESCE(s.is_active, 1) = 0',
};

function studentFilter({ cohort = null, search = null, status = null, studentId = null } = {}) {
  const where = [`s.role != 'admin'`];
  const params = [];
  if (studentId) {
    where.push('s.id = ?');
    params.push(studentId);
  }
  if (cohort && cohort !== 'all') {
    where.push(`COALESCE(s.cohort, 'Promoción 1') = ?`);
    params.push(cohort);
  }
  if (search && String(search).trim()) {
    const like = `%${String(search).toLowerCase().trim()}%`;
    where.push('(LOWER(s.name) LIKE ? OR LOWER(s.email) LIKE ? OR s.id_number LIKE ?)');
    params.push(like, like, like);
  }
  if (STATUS_FILTERS[status]) where.push(STATUS_FILTERS[status]);
  return { where: where.join(' AND '), params };
}

function groupBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const id = row[key];
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(row);
  }
  return map;
}

/**
 * Filas de seguimiento de los estudiantes que cumplen los filtros (más recientes primero).
 * Las tablas relacionadas se leen con subconsultas sobre el mismo filtro, no con listas de ids.
 */
export async function loadProgressRows(filters = {}, { db = { all }, now = new Date(), today = todayIso() } = {}) {
  const { where, params } = studentFilter(filters);
  const students = await db.all(
    `SELECT s.id, s.name, s.email, s.cohort, s.start_date, s.created_at, s.is_active, s.password_set_at,
            s.last_login_at, s.reserve_points, s.exam_score, s.exam_attempts, s.exam_bonus_attempts, s.is_test, c.starts_on, c.ends_on
       FROM students s
       LEFT JOIN cohorts c ON c.name = s.cohort
      WHERE ${where}
      ORDER BY s.id DESC`,
    params
  );
  if (students.length === 0) return [];

  const ofFiltered = `student_id IN (SELECT s.id FROM students s WHERE ${where})`;
  const progress = await db.all(
    `SELECT student_id, module_id, completed_at FROM course_progress WHERE status = 'completed' AND ${ofFiltered}`,
    params
  );
  const attempts = await db.all(
    `SELECT student_id, step_id, status, score, max_score, tier, points_awarded, completed_at
       FROM simulator_attempts WHERE status = 'completed' AND voided_at IS NULL AND ${ofFiltered}`,
    params
  );
  const views = await db.all(
    `SELECT student_id, MAX(started_at) AS last_view FROM video_views WHERE ${ofFiltered} GROUP BY student_id`,
    params
  );
  const exams = await db.all(
    `SELECT student_id, MAX(started_at) AS last_start, MAX(finished_at) AS last_finish
       FROM exam_attempts WHERE ${ofFiltered} GROUP BY student_id`,
    params
  );

  const progressBy = groupBy(progress, 'student_id');
  const attemptsBy = groupBy(attempts, 'student_id');
  const viewBy = new Map(views.map((v) => [v.student_id, v.last_view]));
  const examBy = new Map(exams.map((e) => [e.student_id, e]));

  return students.map((st) => {
    const progressRows = progressBy.get(st.id) || [];
    const attemptRows = attemptsBy.get(st.id) || [];
    const completed = new Set(progressRows.map((p) => p.module_id));
    const completedSteps = COURSE_STEPS.filter((step) => completed.has(step)).length;
    const percent = Math.round((completedSteps / TOTAL_COURSE_STEPS) * 100);
    const examPassed = completed.has('exam');
    const isActive = !!Number(st.is_active ?? 1);
    const activated = !!st.password_set_at;
    const examAttemptsUsed = Number(st.exam_attempts) || 0;
    const examMaxAttempts = maxAttemptsFor(st.exam_bonus_attempts);

    const minigames = {};
    for (const stepId of PRACTICE_STEPS) {
      minigames[stepId] = {
        ...summarizeMinigame(attemptRows.filter((a) => a.step_id === stepId)),
        completed: completed.has(stepId),
      };
    }

    const exam = examBy.get(st.id);
    const lastActivityAt = latestIso([
      ...progressRows.map((p) => p.completed_at),
      ...attemptRows.map((a) => a.completed_at),
      viewBy.get(st.id),
      exam?.last_start,
      exam?.last_finish,
      st.last_login_at,
    ]);

    const startsOn = st.start_date || st.starts_on || null;
    const endsOn = st.ends_on || null;
    const accessState = accessStateFor({ startsOn, endsOn }, today);

    const alerts = computeAlerts({
      certified: examPassed,
      isActive,
      activated,
      accessState,
      createdAt: toIso(st.created_at),
      activatedAt: toIso(st.password_set_at),
      accessStartIso: startsOn ? `${startsOn}T00:00:00.000Z` : null,
      lastActivityAt,
      startsOn,
      endsOn,
      percent,
      minigames,
      completed,
      examAttemptsUsed,
      examMaxAttempts,
    }, now);

    return {
      id: st.id,
      name: st.name,
      email: st.email,
      cohort: st.cohort || 'Promoción 1',
      // Estudiante de prueba: se lista con su marca, pero no entra en el resumen
      isTest: !!Number(st.is_test),
      account: { isActive, activated },
      access: { state: accessState, startsOn, endsOn },
      completedSteps,
      totalSteps: TOTAL_COURSE_STEPS,
      percent,
      currentStep: currentStepOf(completed, examPassed),
      minigames,
      reservePoints: Number(st.reserve_points) || 0,
      exam: {
        score: st.exam_score === null || st.exam_score === undefined ? null : Number(st.exam_score),
        attemptsUsed: examAttemptsUsed,
        maxAttempts: examMaxAttempts,
        bonusAttempts: Number(st.exam_bonus_attempts) || 0,
        passed: examPassed || isExamPassingScore(st.exam_score),
      },
      lastActivityAt,
      alerts,
    };
  });
}

/** Totales del conjunto filtrado (no solo de la página). Los estudiantes de prueba no cuentan. */
export function summarizeRows(allRows) {
  const rows = allRows.filter((r) => !r.isTest);
  const alertsByCode = {};
  for (const row of rows) {
    for (const alert of row.alerts) alertsByCode[alert.code] = (alertsByCode[alert.code] || 0) + 1;
  }
  return {
    students: rows.length,
    averagePercent: rows.length ? Math.round(rows.reduce((sum, r) => sum + r.percent, 0) / rows.length) : 0,
    certified: rows.filter((r) => r.exam.passed).length,
    withAlerts: rows.filter((r) => r.alerts.length > 0).length,
    alertsByCode,
    testStudents: allRows.length - rows.length,
  };
}

// ─── Ficha del estudiante ───────────────────────────────────────────────────────

// Eventos de exam_logs que son incidencias de supervisión
const INCIDENT_EVENTS = new Set([
  'FOCUS_LOSS', 'PROCTORING_GRACE', 'PROCTORING_WARNING', 'PROCTORING_EXPIRED', 'PROCTORING_SUSPENDED', 'AI_TRAP',
]);
const MAX_TIMELINE_EVENTS = 300;

const moduleOf = (stepId) => Number(String(stepId).match(/^m(\d+)_/)?.[1] ?? 0);
const numberOrNull = (value) => (value === null || value === undefined ? null : Number(value));

function mapAttempt(a) {
  return {
    id: a.id,
    status: a.status,
    startedAt: toIso(a.started_at),
    completedAt: toIso(a.completed_at),
    score: numberOrNull(a.score),
    maxScore: numberOrNull(a.max_score),
    passed: a.passed === null || a.passed === undefined ? null : !!Number(a.passed),
    errorCount: numberOrNull(a.error_count),
    doseMsv: numberOrNull(a.dose_msv),
    timeSeconds: numberOrNull(a.time_seconds),
    tier: a.tier || null,
    pointsAwarded: Number(a.points_awarded) || 0,
    // Anulada al reabrir el minijuego (Fase 4): se conserva, pero no cuenta
    voided: Boolean(a.voided_at),
    voidedAt: toIso(a.voided_at),
    voidReason: a.void_reason || null,
  };
}

/**
 * Todo lo que el admin necesita para auditar a un estudiante: avance por paso, cada partida,
 * videos, intentos del examen, incidencias de supervisión, correos, acciones del admin y una
 * línea de tiempo con todo junto (lo más reciente primero). El panel arma los textos.
 */
export async function loadStudentDetail(
  studentId,
  { db = { all }, now = new Date(), today = todayIso(), adminActions = [] } = {}
) {
  const [row] = await loadProgressRows({ studentId }, { db, now, today });
  if (!row) return null;

  const [student] = await db.all(
    `SELECT id_type, id_number, institution, is_onboarded, created_at, password_set_at, last_login_at,
            start_date, deactivated_at, deactivation_reason, proctoring_incidents, focus_violations
       FROM students WHERE id = ?`,
    [studentId]
  );
  const progress = await db.all(
    `SELECT module_id, completed_at, certificate_code FROM course_progress WHERE student_id = ? AND status = 'completed'`,
    [studentId]
  );
  const attempts = await db.all(
    `SELECT id, step_id, status, started_at, completed_at, score, max_score, passed, error_count, dose_msv,
            time_seconds, tier, points_awarded, voided_at, void_reason
       FROM simulator_attempts WHERE student_id = ? ORDER BY started_at`,
    [studentId]
  );
  const views = await db.all('SELECT step_id, started_at FROM video_views WHERE student_id = ?', [studentId]);
  const examAttempts = await db.all(
    `SELECT attempt_number, status, score, correct_count, question_count, started_at, finished_at
       FROM exam_attempts WHERE student_id = ? ORDER BY attempt_number`,
    [studentId]
  );
  const logs = await db.all('SELECT event_type, detail, timestamp FROM exam_logs WHERE student_id = ? ORDER BY id', [studentId]);
  const emails = await db.all(
    `SELECT id, subject, template, status, sent_at, attempts, last_error
       FROM email_logs WHERE student_id = ? ORDER BY id DESC`,
    [studentId]
  );
  const cases = (await db.all('SELECT * FROM support_cases WHERE student_id = ? ORDER BY id DESC', [studentId]))
    .map((row) => caseDto(row));

  const completedAt = new Map(progress.map((p) => [p.module_id, toIso(p.completed_at)]));
  const viewedAt = new Map(views.map((v) => [v.step_id, toIso(v.started_at)]));
  const examRow = progress.find((p) => p.module_id === 'exam');

  const steps = COURSE_STEPS.map((stepId) => {
    const isMinigame = PRACTICE_STEPS.includes(stepId);
    return {
      stepId,
      module: moduleOf(stepId),
      type: isMinigame ? 'minigame' : 'video',
      completedAt: completedAt.get(stepId) || null,
      ...(isMinigame
        ? { summary: row.minigames[stepId], attempts: attempts.filter((a) => a.step_id === stepId).map(mapAttempt) }
        : { startedAt: viewedAt.get(stepId) || null }),
    };
  });

  const examHistory = examAttempts.map((a) => ({
    number: Number(a.attempt_number),
    status: a.status,
    score: numberOrNull(a.score),
    correctCount: numberOrNull(a.correct_count),
    questionCount: Number(a.question_count),
    startedAt: toIso(a.started_at),
    finishedAt: toIso(a.finished_at),
  }));

  const incidents = logs
    .filter((l) => INCIDENT_EVENTS.has(l.event_type))
    .map((l) => ({ type: l.event_type, detail: l.detail || '', at: toIso(l.timestamp) }));

  const emailList = emails.map((e) => ({
    id: e.id,
    subject: e.subject,
    template: e.template || null,
    status: e.status,
    at: toIso(e.sent_at),
    attempts: Number(e.attempts) || 0,
    lastError: e.last_error || null,
  }));

  // Línea de tiempo: cada evento lleva su tipo y sus datos; el panel arma el texto
  const timeline = [];
  const push = (at, kind, data = {}) => {
    const iso = toIso(at);
    if (iso) timeline.push({ at: iso, kind, ...data });
  };
  push(student.created_at, 'account_created');
  push(student.password_set_at, 'account_activated');
  push(student.last_login_at, 'last_login');
  push(student.deactivated_at, 'account_deactivated', { reason: student.deactivation_reason || null });
  for (const [stepId, at] of viewedAt) push(at, 'video_started', { stepId });
  for (const [stepId, at] of completedAt) {
    if (stepId !== 'exam') push(at, 'step_completed', { stepId, type: PRACTICE_STEPS.includes(stepId) ? 'minigame' : 'video' });
  }
  for (const a of attempts) {
    if (a.status !== 'completed') continue;
    push(a.completed_at, 'minigame_played', {
      stepId: a.step_id,
      tier: a.tier,
      points: Number(a.points_awarded) || 0,
      score: numberOrNull(a.score),
      maxScore: numberOrNull(a.max_score),
      errors: numberOrNull(a.error_count),
      voided: Boolean(a.voided_at),
    });
  }
  for (const a of examHistory) {
    push(a.startedAt, 'exam_started', { number: a.number });
    if (a.finishedAt) push(a.finishedAt, `exam_${a.status}`, { number: a.number, score: a.score });
  }
  if (examRow) push(examRow.completed_at, 'certified', { certificateCode: examRow.certificate_code || null });
  for (const l of logs) {
    if (INCIDENT_EVENTS.has(l.event_type)) push(l.timestamp, 'incident', { type: l.event_type, detail: l.detail || '' });
    if (l.event_type === 'WILDCARD_USED') push(l.timestamp, 'wildcard', { detail: l.detail || '' });
  }
  for (const e of emailList) push(e.at, 'email', { subject: e.subject, status: e.status, template: e.template });
  for (const c of cases) {
    push(c.createdAt, 'case_opened', { caseId: c.id, stepId: c.stepId, category: c.category });
    if (c.resolvedAt) push(c.resolvedAt, 'case_closed', { caseId: c.id, status: c.status });
  }
  for (const a of adminActions) {
    push(a.createdAt, 'admin_action', { action: a.action, adminName: a.adminName, reason: a.reason || null });
  }
  timeline.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  return {
    student: {
      ...row,
      idType: student.id_type || null,
      idNumber: student.id_number || null,
      institution: student.institution || null,
      isOnboarded: !!Number(student.is_onboarded),
      createdAt: toIso(student.created_at),
      activatedAt: toIso(student.password_set_at),
      lastLoginAt: toIso(student.last_login_at),
      startDate: student.start_date || null,
      deactivatedAt: toIso(student.deactivated_at),
      deactivationReason: student.deactivation_reason || null,
      proctoringIncidents: Number(student.proctoring_incidents) || 0,
      focusViolations: Number(student.focus_violations) || 0,
    },
    steps,
    exam: {
      ...row.exam,
      certificateCode: examRow?.certificate_code || null,
      certifiedAt: examRow ? toIso(examRow.completed_at) : null,
      history: examHistory,
    },
    incidents,
    cases,
    emails: emailList,
    adminActions,
    timeline: timeline.slice(0, MAX_TIMELINE_EVENTS),
    timelineTruncated: timeline.length > MAX_TIMELINE_EVENTS,
  };
}
