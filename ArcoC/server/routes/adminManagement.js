import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { get, all, withTransaction } from '../config/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { EXAM_PASS_SCORE_PERCENT } from '../config/examRules.js';
import { logAdminAction, listAdminActions } from '../services/adminActions.js';
import { issueToken, TOKEN_PURPOSES } from '../services/authTokens.js';
import { sendWelcomeInductionEmail, sendPasswordResetEmail } from '../services/emailService.js';
import { retryEmail } from '../services/mailer.js';
import { accessStateFor, getStudentAccess } from '../services/access.js';
import { parseStudentsCsv, STUDENTS_CSV_TEMPLATE } from '../utils/csv.js';
import { getLaunchReadiness } from '../services/launchReadiness.js';

/**
 * Gestión del administrador: promociones, matrícula (individual y por CSV), edición, estado de
 * la cuenta y enlaces de acceso. Toda modificación queda en admin_actions.
 */
const router = express.Router();
router.use(authenticateToken, requireAdmin);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_TYPES = ['CC', 'CE', 'Pasaporte'];
const MAX_IMPORT_ROWS = 500;
const DEFAULT_COHORT = 'Promoción 1';

function cleanText(value, max = 200) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';
}

export function isValidIsoDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** '' o null → null; fecha válida → la fecha; otra cosa → undefined (inválida). */
function optionalDate(value) {
  if (value === null || value === undefined || value === '') return null;
  return isValidIsoDate(value) ? value : undefined;
}

// Las cuentas creadas por el admin no tienen contraseña hasta que el estudiante la crea con su
// enlace: se guarda el hash de un secreto aleatorio que nadie conoce (se descarta al generarlo).
let unusablePasswordHash = null;
function getUnusablePasswordHash() {
  if (!unusablePasswordHash) unusablePasswordHash = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);
  return unusablePasswordHash;
}

async function uniqueUsername(db, email) {
  const base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '') || 'estudiante';
  let candidate = base;
  for (let i = 0; i < 8; i++) {
    if (!(await db.get('SELECT id FROM students WHERE username = ?', [candidate]))) return candidate;
    candidate = `${base}_${crypto.randomInt(100, 99999)}`;
  }
  throw new Error('No se pudo generar un nombre de usuario único.');
}

async function insertStudent(db, { name, email, idType, idNumber, institution, cohort, startDate }) {
  const username = await uniqueUsername(db, email);
  await db.run(
    `INSERT INTO students (name, username, password, email, role, id_number, id_type, institution, cohort, start_date, password_set_at, is_active)
     VALUES (?, ?, ?, ?, 'student', ?, ?, ?, ?, ?, NULL, 1)`,
    [name, username, getUnusablePasswordHash(), email, idNumber || null, idType || 'CC', institution || null, cohort, startDate || null]
  );
  const created = await db.get('SELECT id FROM students WHERE LOWER(email) = ?', [email]);
  return { id: created.id, username };
}

async function getSealedCohorts() {
  return new Set((await all('SELECT cohort_name FROM cohort_closures')).map((r) => r.cohort_name));
}

function cohortDto(row, stats = {}) {
  return {
    id: row.id,
    name: row.name,
    startsOn: row.starts_on || null,
    endsOn: row.ends_on || null,
    description: row.description || null,
    accessState: accessStateFor({ startsOn: row.starts_on, endsOn: row.ends_on }),
    ...stats,
  };
}

// ─── Promociones ─────────────────────────────────────────────────────────────

// GET /api/admin/cohorts — promociones con fechas, estado de acceso, métricas y sello
router.get('/cohorts', async (req, res) => {
  try {
    // CAST(... AS NUMERIC): en PostgreSQL ROUND(x, 2) solo existe para NUMERIC. Todas las
    // columnas no agregadas van en el GROUP BY (PostgreSQL lo exige).
    const rows = await all(`
      SELECT c.id, c.name, c.starts_on, c.ends_on, c.description,
             COUNT(s.id) AS total_students,
             SUM(CASE WHEN s.exam_score >= ? THEN 1 ELSE 0 END) AS certified_students,
             SUM(CASE WHEN s.id IS NOT NULL AND (s.exam_score IS NULL OR s.exam_score < ?) THEN 1 ELSE 0 END) AS in_progress_students,
             SUM(CASE WHEN s.id IS NOT NULL AND COALESCE(s.is_active, 1) = 0 THEN 1 ELSE 0 END) AS inactive_students,
             SUM(CASE WHEN s.id IS NOT NULL AND s.password_set_at IS NULL THEN 1 ELSE 0 END) AS pending_activation,
             ROUND(CAST(AVG(s.exam_score) AS NUMERIC), 2) AS avg_score,
             COALESCE(SUM(COALESCE(s.proctoring_incidents, 0) + COALESCE(s.focus_violations, 0)), 0) AS total_incidents,
             cc.closed_at, cc.cohort_seal_hash
        FROM cohorts c
        LEFT JOIN students s ON s.cohort = c.name AND s.role != 'admin'
        LEFT JOIN cohort_closures cc ON cc.cohort_name = c.name
       GROUP BY c.id, c.name, c.starts_on, c.ends_on, c.description, cc.closed_at, cc.cohort_seal_hash
       ORDER BY c.name ASC
    `, [EXAM_PASS_SCORE_PERCENT, EXAM_PASS_SCORE_PERCENT]);

    res.json({
      success: true,
      cohorts: rows.map((r) => cohortDto(r, {
        total_students: r.total_students || 0,
        certified_students: r.certified_students || 0,
        in_progress_students: r.in_progress_students || 0,
        inactive_students: r.inactive_students || 0,
        pending_activation: r.pending_activation || 0,
        avg_score: r.avg_score ?? null,
        total_incidents: r.total_incidents || 0,
        closed_at: r.closed_at || null,
        cohort_seal_hash: r.cohort_seal_hash || null,
        isClosed: !!r.closed_at,
        sealHash: r.cohort_seal_hash || null,
        closedAt: r.closed_at || null,
      })),
    });
  } catch (err) {
    console.error('Error fetching cohorts:', err);
    res.status(500).json({ error: 'Error al consultar promociones.' });
  }
});

function validateCohortDates(startsOn, endsOn) {
  if (startsOn === undefined) return 'La fecha de inicio no es válida (AAAA-MM-DD).';
  if (endsOn === undefined) return 'La fecha de cierre no es válida (AAAA-MM-DD).';
  if (startsOn && endsOn && startsOn > endsOn) return 'La fecha de cierre debe ser igual o posterior a la de inicio.';
  return null;
}

// POST /api/admin/cohorts — { name, startsOn?, endsOn?, description? }
router.post('/cohorts', async (req, res) => {
  try {
    const name = cleanText(req.body?.name, 80);
    if (name.length < 2) return res.status(400).json({ error: 'El nombre de la promoción es requerido (mínimo 2 caracteres).' });
    const startsOn = optionalDate(req.body?.startsOn);
    const endsOn = optionalDate(req.body?.endsOn);
    const datesError = validateCohortDates(startsOn, endsOn);
    if (datesError) return res.status(400).json({ error: datesError });
    const description = cleanText(req.body?.description, 500) || null;

    if (await get('SELECT id FROM cohorts WHERE LOWER(name) = LOWER(?)', [name])) {
      return res.status(409).json({ error: `Ya existe la promoción "${name}".` });
    }

    const cohort = await withTransaction(async (tx) => {
      await tx.run(
        'INSERT INTO cohorts (name, starts_on, ends_on, description, created_by_admin_id) VALUES (?, ?, ?, ?, ?)',
        [name, startsOn, endsOn, description, req.user.id]
      );
      const row = await tx.get('SELECT * FROM cohorts WHERE name = ?', [name]);
      await logAdminAction({
        adminId: req.user.id, action: 'cohort.create', targetType: 'cohort', targetId: row.id,
        details: { name, startsOn, endsOn },
      }, tx);
      return row;
    });
    res.status(201).json({ success: true, cohort: cohortDto(cohort) });
  } catch (err) {
    console.error('Error creating cohort:', err);
    res.status(500).json({ error: 'Error al crear la promoción.' });
  }
});

// PATCH /api/admin/cohorts/:id — { name?, startsOn?, endsOn?, description? } (null borra una fecha)
router.patch('/cohorts/:id', async (req, res) => {
  try {
    const cohortId = parseInt(req.params.id, 10);
    const cohort = Number.isInteger(cohortId) ? await get('SELECT * FROM cohorts WHERE id = ?', [cohortId]) : null;
    if (!cohort) return res.status(404).json({ error: 'Promoción no encontrada.' });
    if ((await getSealedCohorts()).has(cohort.name)) {
      return res.status(409).json({ error: `La promoción "${cohort.name}" está cerrada y sellada: ya no se puede modificar.` });
    }

    const body = req.body || {};
    const next = {
      name: body.name !== undefined ? cleanText(body.name, 80) : cohort.name,
      starts_on: body.startsOn !== undefined ? optionalDate(body.startsOn) : cohort.starts_on,
      ends_on: body.endsOn !== undefined ? optionalDate(body.endsOn) : cohort.ends_on,
      description: body.description !== undefined ? (cleanText(body.description, 500) || null) : cohort.description,
    };
    if (next.name.length < 2) return res.status(400).json({ error: 'El nombre de la promoción es requerido (mínimo 2 caracteres).' });
    const datesError = validateCohortDates(next.starts_on, next.ends_on);
    if (datesError) return res.status(400).json({ error: datesError });

    const changed = Object.keys(next).filter((k) => (next[k] ?? null) !== (cohort[k] ?? null));
    if (changed.length === 0) return res.json({ success: true, cohort: cohortDto(cohort), unchanged: true });

    if (next.name !== cohort.name && await get('SELECT id FROM cohorts WHERE LOWER(name) = LOWER(?) AND id != ?', [next.name, cohortId])) {
      return res.status(409).json({ error: `Ya existe la promoción "${next.name}".` });
    }

    const updated = await withTransaction(async (tx) => {
      await tx.run(
        'UPDATE cohorts SET name = ?, starts_on = ?, ends_on = ?, description = ? WHERE id = ?',
        [next.name, next.starts_on, next.ends_on, next.description, cohortId]
      );
      // students.cohort guarda el nombre: renombrar mueve a sus estudiantes con ella
      if (next.name !== cohort.name) {
        await tx.run('UPDATE students SET cohort = ? WHERE cohort = ?', [next.name, cohort.name]);
      }
      await logAdminAction({
        adminId: req.user.id, action: 'cohort.update', targetType: 'cohort', targetId: cohortId,
        reason: cleanText(body.reason, 500) || null,
        details: {
          before: Object.fromEntries(changed.map((k) => [k, cohort[k] ?? null])),
          after: Object.fromEntries(changed.map((k) => [k, next[k] ?? null])),
        },
      }, tx);
      return tx.get('SELECT * FROM cohorts WHERE id = ?', [cohortId]);
    });
    res.json({ success: true, cohort: cohortDto(updated) });
  } catch (err) {
    console.error('Error updating cohort:', err);
    res.status(500).json({ error: 'Error al actualizar la promoción.' });
  }
});

// ─── Estudiantes ─────────────────────────────────────────────────────────────

/** Valida los datos de un estudiante nuevo. Devuelve { data } o { error }. */
function validateNewStudent(input) {
  const name = cleanText(input.name, 120);
  const email = cleanText(input.email, 254).toLowerCase();
  if (!name) return { error: 'El nombre completo del estudiante es requerido.' };
  if (!email || !EMAIL_RE.test(email)) return { error: 'Un correo electrónico válido es requerido.' };
  const idType = cleanText(input.idType, 20) || 'CC';
  if (!ID_TYPES.includes(idType)) return { error: `Tipo de documento inválido (${ID_TYPES.join(', ')}).` };
  const startDate = optionalDate(input.startDate);
  if (startDate === undefined) return { error: 'La fecha de inicio individual no es válida (AAAA-MM-DD).' };
  return {
    data: {
      name, email, idType, startDate,
      idNumber: cleanText(input.idNumber, 40) || null,
      institution: cleanText(input.institution, 160) || null,
      cohort: cleanText(input.cohort, 80) || DEFAULT_COHORT,
    },
  };
}

// POST /api/admin/students — matrícula individual. La cuenta queda pendiente de activación y
// el estudiante recibe un enlace para crear su contraseña (nunca se envían contraseñas).
// Si la promoción no existe se crea sin fechas.
router.post('/students', async (req, res) => {
  try {
    const body = req.body || {};
    const validation = validateNewStudent({
      name: body.name, email: body.email, idType: body.id_type ?? body.idType,
      idNumber: body.id_number ?? body.idNumber, institution: body.institution,
      cohort: body.cohort, startDate: body.start_date ?? body.startDate,
    });
    if (validation.error) return res.status(400).json({ error: validation.error });
    const student = validation.data;

    if (await get('SELECT id FROM students WHERE LOWER(email) = ?', [student.email])) {
      return res.status(409).json({ error: 'Ya existe un estudiante registrado con este correo electrónico.' });
    }
    if ((await getSealedCohorts()).has(student.cohort)) {
      return res.status(409).json({ error: `La promoción "${student.cohort}" está cerrada y sellada: no admite nuevas matrículas.` });
    }

    const { created, activation, cohortCreated } = await withTransaction(async (tx) => {
      let cohortCreated = false;
      if (!(await tx.get('SELECT id FROM cohorts WHERE name = ?', [student.cohort]))) {
        await tx.run('INSERT INTO cohorts (name, created_by_admin_id) VALUES (?, ?)', [student.cohort, req.user.id]);
        const cohortRow = await tx.get('SELECT id FROM cohorts WHERE name = ?', [student.cohort]);
        await logAdminAction({
          adminId: req.user.id, action: 'cohort.create', targetType: 'cohort', targetId: cohortRow.id,
          details: { name: student.cohort, createdFrom: 'student.create' },
        }, tx);
        cohortCreated = true;
      }
      const created = await insertStudent(tx, student);
      const activation = await issueToken({ studentId: created.id, purpose: TOKEN_PURPOSES.ACTIVATION, adminId: req.user.id }, tx);
      await logAdminAction({
        adminId: req.user.id, action: 'student.create', targetType: 'student', targetId: created.id,
        details: { name: student.name, email: student.email, cohort: student.cohort, startDate: student.startDate },
      }, tx);
      return { created, activation, cohortCreated };
    });

    const email = await sendWelcomeInductionEmail({
      studentId: created.id, name: student.name, email: student.email, cohort: student.cohort,
      startDate: student.startDate, activationUrl: activation.url, adminId: req.user.id,
    });

    res.status(201).json({
      success: true,
      student: {
        id: created.id, name: student.name, username: created.username, email: student.email,
        cohort: student.cohort, startDate: student.startDate, activated: false,
      },
      cohortCreated,
      // Solo para el admin, por si el correo no llega: el enlace también va en el correo
      activationUrl: activation.url,
      activationExpiresAt: activation.expiresAt,
      emailStatus: email.status,
      emailTransport: email.transport,
      emailDispatched: true,
    });
  } catch (err) {
    console.error('Error creating student in admin:', err);
    res.status(500).json({ error: 'Error del servidor al registrar estudiante.' });
  }
});

// GET /api/admin/students/import/template — plantilla CSV
router.get('/students/import/template', (req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="plantilla_estudiantes.csv"');
  res.send(STUDENTS_CSV_TEMPLATE);
});

// POST /api/admin/students/import — { csv, defaultCohort?, dryRun? }
// Con dryRun (por defecto) solo valida y devuelve la vista previa. Con dryRun: false matricula
// las filas válidas (las que tienen errores se omiten) y envía sus enlaces de activación.
router.post('/students/import', async (req, res) => {
  try {
    const { csv } = req.body || {};
    const dryRun = req.body?.dryRun !== false;
    if (typeof csv !== 'string' || !csv.trim()) return res.status(400).json({ error: 'Adjunta un archivo CSV con estudiantes.' });

    const parsed = parseStudentsCsv(csv);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    if (parsed.records.length === 0) return res.status(400).json({ error: 'El archivo no tiene filas de estudiantes.' });
    if (parsed.records.length > MAX_IMPORT_ROWS) {
      return res.status(400).json({ error: `Máximo ${MAX_IMPORT_ROWS} estudiantes por archivo (tiene ${parsed.records.length}).` });
    }

    const defaultCohort = cleanText(req.body?.defaultCohort, 80) || DEFAULT_COHORT;
    const cohorts = new Set((await all('SELECT name FROM cohorts')).map((r) => r.name));
    const sealed = await getSealedCohorts();
    const existingEmails = new Set((await all('SELECT LOWER(email) AS email FROM students')).map((r) => r.email));
    const seen = new Map();

    const rows = parsed.records.map((record) => {
      const errors = [];
      const validation = validateNewStudent({ ...record, cohort: record.cohort || defaultCohort });
      if (validation.error) errors.push(validation.error);
      const data = validation.data || { ...record, cohort: record.cohort || defaultCohort };
      if (data.email && EMAIL_RE.test(data.email)) {
        if (existingEmails.has(data.email)) errors.push('Ya existe un estudiante con este correo.');
        if (seen.has(data.email)) errors.push(`Correo repetido en el archivo (línea ${seen.get(data.email)}).`);
        else seen.set(data.email, record.line);
      }
      if (!cohorts.has(data.cohort)) errors.push(`La promoción "${data.cohort}" no existe: créala antes de importar.`);
      else if (sealed.has(data.cohort)) errors.push(`La promoción "${data.cohort}" está sellada.`);
      return { line: record.line, ...data, status: errors.length ? 'error' : 'ok', errors };
    });

    const valid = rows.filter((r) => r.status === 'ok');
    const summary = { total: rows.length, valid: valid.length, invalid: rows.length - valid.length };
    if (dryRun) return res.json({ success: true, dryRun: true, defaultCohort, summary, rows });
    if (valid.length === 0) return res.status(400).json({ error: 'No hay filas válidas para importar.', summary, rows });

    const created = await withTransaction(async (tx) => {
      const result = [];
      for (const row of valid) {
        const student = await insertStudent(tx, row);
        const activation = await issueToken({ studentId: student.id, purpose: TOKEN_PURPOSES.ACTIVATION, adminId: req.user.id }, tx);
        result.push({ ...row, id: student.id, activationUrl: activation.url });
      }
      await logAdminAction({
        adminId: req.user.id, action: 'student.import', targetType: 'cohort', targetId: defaultCohort,
        details: {
          created: result.map((r) => ({ id: r.id, email: r.email, cohort: r.cohort })),
          skipped: rows.filter((r) => r.status === 'error').map((r) => ({ line: r.line, email: r.email, errors: r.errors })),
        },
      }, tx);
      return result;
    });

    for (const student of created) {
      await sendWelcomeInductionEmail({
        studentId: student.id, name: student.name, email: student.email, cohort: student.cohort,
        startDate: student.startDate, activationUrl: student.activationUrl, adminId: req.user.id,
      });
    }

    res.status(201).json({
      success: true,
      dryRun: false,
      summary: { total: rows.length, created: created.length, skipped: rows.length - created.length },
      created: created.map(({ id, name, email, cohort }) => ({ id, name, email, cohort })),
      skipped: rows.filter((r) => r.status === 'error'),
    });
  } catch (err) {
    console.error('Error importing students:', err);
    res.status(500).json({ error: 'Error del servidor al importar estudiantes.' });
  }
});

async function getStudentOr404(req, res) {
  const studentId = parseInt(req.params.id, 10);
  const student = Number.isInteger(studentId) && studentId > 0
    ? await get(
      `SELECT id, name, username, email, role, cohort, start_date, id_type, id_number, institution,
              is_active, deactivated_at, deactivation_reason, password_set_at, last_login_at, created_at,
              reserve_points, exam_score, exam_attempts, is_onboarded
         FROM students WHERE id = ?`,
      [studentId]
    )
    : null;
  if (!student || student.role !== 'student') {
    res.status(404).json({ error: 'Estudiante no encontrado.' });
    return null;
  }
  return student;
}

function studentDto(s) {
  return {
    id: s.id,
    name: s.name,
    username: s.username,
    email: s.email,
    cohort: s.cohort,
    startDate: s.start_date || null,
    idType: s.id_type || 'CC',
    idNumber: s.id_number || null,
    institution: s.institution || null,
    isActive: !!Number(s.is_active ?? 1),
    deactivatedAt: s.deactivated_at || null,
    deactivationReason: s.deactivation_reason || null,
    activated: !!s.password_set_at,
    lastLoginAt: s.last_login_at || null,
    createdAt: s.created_at,
    isOnboarded: !!s.is_onboarded,
    reservePoints: s.reserve_points || 0,
    examScore: s.exam_score ?? null,
    examAttempts: s.exam_attempts || 0,
  };
}

// GET /api/admin/students/:id — ficha básica: datos, acceso, historial de acciones y correos
router.get('/students/:id', async (req, res) => {
  try {
    const student = await getStudentOr404(req, res);
    if (!student) return;
    const [access, actions, emails] = await Promise.all([
      getStudentAccess(student.id),
      listAdminActions({ targetType: 'student', targetId: student.id, limit: 50 }),
      all(
        `SELECT id, subject, template, status, sent_at, attempts, last_error
           FROM email_logs WHERE student_id = ? ORDER BY id DESC LIMIT 20`,
        [student.id]
      ),
    ]);
    res.json({ success: true, student: studentDto(student), access, actions, emails });
  } catch (err) {
    console.error('Error fetching student detail:', err);
    res.status(500).json({ error: 'Error del servidor.' });
  }
});

// PATCH /api/admin/students/:id — { name?, email?, idType?, idNumber?, institution?, cohort?, startDate?, reason? }
router.patch('/students/:id', async (req, res) => {
  try {
    const student = await getStudentOr404(req, res);
    if (!student) return;
    const body = req.body || {};

    const next = {
      name: body.name !== undefined ? cleanText(body.name, 120) : student.name,
      email: body.email !== undefined ? cleanText(body.email, 254).toLowerCase() : student.email,
      id_type: body.idType !== undefined ? (cleanText(body.idType, 20) || 'CC') : student.id_type,
      id_number: body.idNumber !== undefined ? (cleanText(body.idNumber, 40) || null) : student.id_number,
      institution: body.institution !== undefined ? (cleanText(body.institution, 160) || null) : student.institution,
      cohort: body.cohort !== undefined ? cleanText(body.cohort, 80) : student.cohort,
      start_date: body.startDate !== undefined ? optionalDate(body.startDate) : student.start_date,
    };
    if (!next.name) return res.status(400).json({ error: 'El nombre es requerido.' });
    if (!EMAIL_RE.test(next.email)) return res.status(400).json({ error: 'Un correo electrónico válido es requerido.' });
    if (next.id_type && !ID_TYPES.includes(next.id_type)) return res.status(400).json({ error: `Tipo de documento inválido (${ID_TYPES.join(', ')}).` });
    if (next.start_date === undefined) return res.status(400).json({ error: 'La fecha de inicio individual no es válida (AAAA-MM-DD).' });

    const changed = Object.keys(next).filter((k) => (next[k] ?? null) !== (student[k] ?? null));
    if (changed.length === 0) return res.json({ success: true, student: studentDto(student), unchanged: true });

    if (changed.includes('email') && await get('SELECT id FROM students WHERE LOWER(email) = ? AND id != ?', [next.email, student.id])) {
      return res.status(409).json({ error: 'Ya existe otro estudiante con este correo electrónico.' });
    }
    if (changed.includes('cohort')) {
      if (!(await get('SELECT id FROM cohorts WHERE name = ?', [next.cohort]))) {
        return res.status(404).json({ error: `La promoción "${next.cohort}" no existe.` });
      }
      const sealed = await getSealedCohorts();
      if (sealed.has(student.cohort) || sealed.has(next.cohort)) {
        return res.status(409).json({ error: 'No se puede mover a un estudiante desde o hacia una promoción sellada.' });
      }
    }

    const updated = await withTransaction(async (tx) => {
      await tx.run(
        `UPDATE students SET name = ?, email = ?, id_type = ?, id_number = ?, institution = ?, cohort = ?, start_date = ? WHERE id = ?`,
        [next.name, next.email, next.id_type, next.id_number, next.institution, next.cohort, next.start_date, student.id]
      );
      await logAdminAction({
        adminId: req.user.id,
        action: changed.includes('cohort') ? 'student.move_cohort' : 'student.update',
        targetType: 'student', targetId: student.id,
        reason: cleanText(body.reason, 500) || null,
        details: {
          before: Object.fromEntries(changed.map((k) => [k, student[k] ?? null])),
          after: Object.fromEntries(changed.map((k) => [k, next[k] ?? null])),
        },
      }, tx);
      return tx.get(
        `SELECT id, name, username, email, role, cohort, start_date, id_type, id_number, institution,
                is_active, deactivated_at, deactivation_reason, password_set_at, last_login_at, created_at,
                reserve_points, exam_score, exam_attempts, is_onboarded
           FROM students WHERE id = ?`,
        [student.id]
      );
    });
    res.json({ success: true, student: studentDto(updated) });
  } catch (err) {
    console.error('Error updating student:', err);
    res.status(500).json({ error: 'Error del servidor al actualizar el estudiante.' });
  }
});

// POST /api/admin/students/:id/deactivate — { reason } (obligatorio). Corta el acceso y cierra
// sus sesiones abiertas. No borra nada: su avance y su historial se conservan.
router.post('/students/:id/deactivate', async (req, res) => {
  try {
    const student = await getStudentOr404(req, res);
    if (!student) return;
    const reason = cleanText(req.body?.reason, 500);
    if (reason.length < 3) return res.status(400).json({ error: 'Indica el motivo de la desactivación.' });
    if (!Number(student.is_active ?? 1)) return res.status(409).json({ error: 'La cuenta ya está desactivada.' });

    await withTransaction(async (tx) => {
      await tx.run(
        `UPDATE students SET is_active = 0, deactivated_at = ?, deactivation_reason = ?, token_version = token_version + 1 WHERE id = ?`,
        [new Date().toISOString(), reason, student.id]
      );
      await logAdminAction({ adminId: req.user.id, action: 'student.deactivate', targetType: 'student', targetId: student.id, reason }, tx);
    });
    res.json({ success: true, message: `La cuenta de ${student.name} quedó desactivada.` });
  } catch (err) {
    console.error('Error deactivating student:', err);
    res.status(500).json({ error: 'Error del servidor al desactivar la cuenta.' });
  }
});

// POST /api/admin/students/:id/reactivate — { reason? }
router.post('/students/:id/reactivate', async (req, res) => {
  try {
    const student = await getStudentOr404(req, res);
    if (!student) return;
    if (Number(student.is_active ?? 1)) return res.status(409).json({ error: 'La cuenta ya está activa.' });

    await withTransaction(async (tx) => {
      await tx.run(
        'UPDATE students SET is_active = 1, deactivated_at = NULL, deactivation_reason = NULL WHERE id = ?',
        [student.id]
      );
      await logAdminAction({
        adminId: req.user.id, action: 'student.reactivate', targetType: 'student', targetId: student.id,
        reason: cleanText(req.body?.reason, 500) || null,
        details: { previousReason: student.deactivation_reason || null },
      }, tx);
    });
    res.json({ success: true, message: `La cuenta de ${student.name} quedó activa de nuevo.` });
  } catch (err) {
    console.error('Error reactivating student:', err);
    res.status(500).json({ error: 'Error del servidor al reactivar la cuenta.' });
  }
});

// POST /api/admin/students/:id/access-link — { sendEmail? = true }
// Cuenta sin activar → nuevo enlace de activación; activada → enlace para restablecer la
// contraseña. Invalida el enlace anterior y lo devuelve al admin (por si el correo no llega).
router.post('/students/:id/access-link', async (req, res) => {
  try {
    const student = await getStudentOr404(req, res);
    if (!student) return;
    if (!Number(student.is_active ?? 1)) {
      return res.status(409).json({ error: 'La cuenta está desactivada: reactívala antes de enviar un enlace de acceso.' });
    }
    const purpose = student.password_set_at ? TOKEN_PURPOSES.PASSWORD_RESET : TOKEN_PURPOSES.ACTIVATION;
    const sendEmail = req.body?.sendEmail !== false;

    const link = await withTransaction(async (tx) => {
      const issued = await issueToken({ studentId: student.id, purpose, adminId: req.user.id }, tx);
      await logAdminAction({
        adminId: req.user.id, action: 'student.access_link', targetType: 'student', targetId: student.id,
        details: { purpose, emailed: sendEmail },
      }, tx);
      return issued;
    });

    let emailStatus = null;
    if (sendEmail) {
      const sent = purpose === TOKEN_PURPOSES.ACTIVATION
        ? await sendWelcomeInductionEmail({
          studentId: student.id, name: student.name, email: student.email, cohort: student.cohort,
          startDate: student.start_date, activationUrl: link.url, adminId: req.user.id,
        })
        : await sendPasswordResetEmail({ studentId: student.id, name: student.name, email: student.email, resetUrl: link.url, adminId: req.user.id });
      emailStatus = sent.status;
    }
    res.json({ success: true, purpose, url: link.url, expiresAt: link.expiresAt, emailStatus });
  } catch (err) {
    console.error('Error issuing access link:', err);
    res.status(500).json({ error: 'Error del servidor al generar el enlace.' });
  }
});

// ─── Bitácora y correos ──────────────────────────────────────────────────────

// GET /api/admin/actions?targetType=student&targetId=12&limit=100
router.get('/actions', async (req, res) => {
  try {
    const actions = await listAdminActions({
      targetType: req.query.targetType ? String(req.query.targetType) : null,
      targetId: req.query.targetId ? String(req.query.targetId) : null,
      limit: req.query.limit,
    });
    res.json({ success: true, actions });
  } catch (err) {
    console.error('Error fetching admin actions:', err);
    res.status(500).json({ error: 'Error al consultar la bitácora de acciones.' });
  }
});

// GET /api/admin/launch-readiness — qué falta para el lanzamiento: videos y minijuegos sin
// publicar y tamaño del banco de preguntas (services/launchReadiness.js)
router.get('/launch-readiness', async (req, res) => {
  try {
    res.json({ success: true, ...(await getLaunchReadiness()) });
  } catch (err) {
    console.error('Error checking launch readiness:', err);
    res.status(500).json({ error: 'Error al revisar la preparación del lanzamiento.' });
  }
});

// POST /api/admin/email-logs/:id/retry — vuelve a encolar un correo fallido
router.post('/email-logs/:id/retry', async (req, res) => {
  try {
    const emailId = parseInt(req.params.id, 10);
    if (!Number.isInteger(emailId) || !(await retryEmail(emailId))) {
      return res.status(409).json({ error: 'Solo se pueden reintentar correos fallidos que conservan su contenido.' });
    }
    await logAdminAction({ adminId: req.user.id, action: 'email.retry', targetType: 'email', targetId: emailId });
    res.json({ success: true });
  } catch (err) {
    console.error('Error retrying email:', err);
    res.status(500).json({ error: 'Error al reintentar el correo.' });
  }
});

export default router;
