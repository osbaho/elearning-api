import express from 'express';
import crypto from 'crypto';
import { run, get, all } from '../config/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { generateCertificatePDF } from '../utils/certificate.js';
import { generateCohortActaPDF } from '../utils/cohortActa.js';
import { sendWelcomeInductionEmail, sendProgressReminderEmail } from '../services/emailService.js';
import { reinforcementAllowance } from '../services/reinforcement.js';
import { TOTAL_COURSE_STEPS, isCourseStep, countCompletedCourseSteps } from '../config/curriculum.js';
import { EXAM_PASS_SCORE_PERCENT, EXAM_QUESTION_COUNT, MAX_EXAM_ATTEMPTS, isExamPassingScore, maxAttemptsFor } from '../config/examRules.js';
import { issueToken, TOKEN_PURPOSES } from '../services/authTokens.js';
import { logAdminAction } from '../services/adminActions.js';

// Promociones (crear/editar/listar), matrícula, edición y estado de las cuentas viven en
// adminManagement.js; aquí quedan el listado, la auditoría IES, los PDF y los correos.
const router = express.Router();
const checkAdmin = requireAdmin;

// Filtro por estado de la cuenta en el listado (?status=)
const STATUS_FILTERS = {
  active: 'COALESCE(is_active, 1) = 1 AND password_set_at IS NOT NULL',
  pending: 'COALESCE(is_active, 1) = 1 AND password_set_at IS NULL',
  inactive: 'COALESCE(is_active, 1) = 0',
};

// GET /api/admin/students — Listado con filtrado por promoción, estado y búsqueda
router.get('/students', authenticateToken, checkAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 100));
    const offset = (page - 1) * limit;
    const cohortFilter = req.query.cohort && req.query.cohort !== 'all' ? req.query.cohort.trim() : null;
    const searchFilter = req.query.search ? `%${req.query.search.toLowerCase().trim()}%` : null;
    const statusFilter = STATUS_FILTERS[req.query.status] || null;

    let query = `
      SELECT id, name, username, email, role, id_number, id_type, institution,
             is_onboarded, exam_score, exam_attempts, exam_bonus_attempts, reserve_points,
             proctoring_incidents, focus_violations, cohort, start_date, created_at,
             is_active, deactivated_at, deactivation_reason, password_set_at, last_login_at, is_test
      FROM students
      WHERE 1=1
    `;
    const params = [];

    if (cohortFilter) {
      query += ` AND COALESCE(cohort, 'Promoción 1') = ?`;
      params.push(cohortFilter);
    }

    if (searchFilter) {
      query += ` AND (LOWER(name) LIKE ? OR LOWER(email) LIKE ? OR id_number LIKE ?)`;
      params.push(searchFilter, searchFilter, searchFilter);
    }

    if (statusFilter) {
      query += ` AND ${statusFilter}`;
    }

    query += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const students = await all(query, params);

    if (students.length === 0) {
      return res.json({ success: true, students: [], page, limit, total: 0 });
    }

    const studentIds = students.map(s => s.id);
    const placeholders = studentIds.map(() => '?').join(',');
    
    // Obtener progreso curricular y certificados emitidos
    const allProgress = await all(
      `SELECT student_id, module_id, certificate_code, completed_at 
       FROM course_progress 
       WHERE student_id IN (${placeholders}) AND status = 'completed'`,
      studentIds
    );

    const progressMap = {};
    const certMap = {};
    for (const p of allProgress) {
      if (!progressMap[p.student_id]) progressMap[p.student_id] = [];
      progressMap[p.student_id].push(p.module_id);
      if (p.module_id === 'exam' && p.certificate_code) {
        certMap[p.student_id] = { certificate_code: p.certificate_code, completed_at: p.completed_at };
      }
    }

    // Total count con los mismos filtros
    let countQuery = `SELECT COUNT(*) AS total FROM students WHERE 1=1`;
    const countParams = [];
    if (cohortFilter) {
      countQuery += ` AND COALESCE(cohort, 'Promoción 1') = ?`;
      countParams.push(cohortFilter);
    }
    if (searchFilter) {
      countQuery += ` AND (LOWER(name) LIKE ? OR LOWER(email) LIKE ? OR id_number LIKE ?)`;
      countParams.push(searchFilter, searchFilter, searchFilter);
    }
    if (statusFilter) {
      countQuery += ` AND ${statusFilter}`;
    }
    const [totalRow] = await all(countQuery, countParams);
    const total = totalRow ? parseInt(totalRow.total, 10) : 0;

    const mappedStudents = students.map(s => ({
      id: s.id,
      name: s.name,
      username: s.username,
      email: s.email,
      role: s.role,
      cohort: s.cohort || 'Promoción 1',
      startDate: s.start_date || null,
      idNumber: s.id_number || null,
      idType: s.id_type || 'CC',
      institution: s.institution || null,
      isOnboarded: !!s.is_onboarded,
      reservePoints: s.reserve_points || 0,
      examScore: s.exam_score,
      examAttempts: s.exam_attempts || 0,
      // Intentos que tiene: los del reglamento más los que concedió el admin (Fase 4)
      examMaxAttempts: maxAttemptsFor(s.exam_bonus_attempts),
      proctoringIncidents: s.proctoring_incidents || 0,
      focusViolations: s.focus_violations || 0,
      completedModules: progressMap[s.id] || [],
      certificateCode: certMap[s.id]?.certificate_code || null,
      certifiedAt: certMap[s.id]?.completed_at || null,
      createdAt: s.created_at,
      // Estado de la cuenta: activa, pendiente de activación (sin contraseña) o desactivada
      isActive: !!Number(s.is_active ?? 1),
      activated: !!s.password_set_at,
      deactivatedAt: s.deactivated_at || null,
      deactivationReason: s.deactivation_reason || null,
      lastLoginAt: s.last_login_at || null,
      // Estudiante de prueba: se lista, pero no cuenta en estadísticas, actas, CSV ni sellos
      isTest: !!Number(s.is_test)
    }));

    res.json({ success: true, students: mappedStudents, page, limit, total });
  } catch (err) {
    console.error('Error fetching admin students:', err);
    res.status(500).json({ error: 'Error del servidor al consultar estudiantes' });
  }
});

// GET /api/admin/compliance/:studentId — Verificación estricta del Estándar Institucional IES / MinEducación
router.get('/compliance/:studentId', authenticateToken, checkAdmin, async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    if (isNaN(studentId) || studentId <= 0) {
      return res.status(400).json({ error: 'studentId debe ser un entero positivo.' });
    }

    const student = await get(`
      SELECT id, name, email, role, id_number, id_type, institution, is_onboarded,
             exam_score, exam_attempts, exam_bonus_attempts, proctoring_incidents, focus_violations,
             cohort, start_date, created_at, face_descriptor
      FROM students WHERE id = ?
    `, [studentId]);

    if (!student) {
      return res.status(404).json({ error: 'Estudiante no encontrado.' });
    }

    const progressRecords = await all(`
      SELECT module_id, status, completed_at, certificate_code 
      FROM course_progress 
      WHERE student_id = ? AND status = 'completed'
    `, [studentId]);

    const completedCurricularSteps = progressRecords.filter(p => isCourseStep(p.module_id));
    const examRecord = progressRecords.find(p => p.module_id === 'exam');

    // 1. Identificación y Registro Biométrico
    const c1_met = Boolean(student.is_onboarded && student.id_number && student.face_descriptor);
    const c1 = {
      code: 'STD_BIO_ID',
      title: 'Identificación y Enrolamiento Biométrico',
      required: 'Documento legal institucional y vector facial biométrico validado con Dra. Nova (IA).',
      met: c1_met,
      status: c1_met ? 'CUMPLIDO' : 'PENDIENTE',
      details: c1_met 
        ? `${student.id_type || 'CC'} ${student.id_number} — ${student.institution || 'Institución confirmada'} (Biometría activa)`
        : 'Falta registro de documento de identidad o captura facial biométrica obligatoria.'
    };

    // 2. Culminación Curricular (todos los pasos obligatorios de la malla)
    const c2_met = completedCurricularSteps.length >= TOTAL_COURSE_STEPS;
    const c2 = {
      code: 'STD_CURRICULUM',
      title: 'Completitud de Módulos Curriculares (100%)',
      required: `${TOTAL_COURSE_STEPS} de ${TOTAL_COURSE_STEPS} pasos obligatorios completados secuencialmente sin saltos anti-adelanto.`,
      met: c2_met,
      status: c2_met ? 'CUMPLIDO' : 'EN PROCESO',
      details: `${completedCurricularSteps.length} de ${TOTAL_COURSE_STEPS} pasos completados (${Math.round((completedCurricularSteps.length / TOTAL_COURSE_STEPS) * 100)}%).`
    };

    // 3. Rendimiento Académico en Examen de Certificación
    const score = student.exam_score;
    const c3_met = isExamPassingScore(score);
    const c3 = {
      code: 'STD_EXAM_SCORE',
      title: 'Aprobación de Evaluación Oficial de Certificación',
      required: `Calificación final mínima del ${EXAM_PASS_SCORE_PERCENT}% (intentos de ${EXAM_QUESTION_COUNT} preguntas aleatorias del banco oficial).`,
      met: c3_met,
      status: c3_met ? 'APROBADO' : (score !== null ? 'REPROBADO' : 'PENDIENTE'),
      details: score !== null
        ? `Calificación obtenida: ${score}% (Umbral reglamentario: ≥${EXAM_PASS_SCORE_PERCENT}%)`
        : 'Examen de certificación no ha sido presentado aún.'
    };

    // 4. Límite Reglamentario de Intentos
    const attempts = student.exam_attempts || 0;
    // Los intentos adicionales que concede el admin tras una revisión cuentan como autorizados
    const bonusAttempts = Number(student.exam_bonus_attempts) || 0;
    const allowedAttempts = maxAttemptsFor(bonusAttempts);
    const c4_met = attempts <= allowedAttempts;
    const c4 = {
      code: 'STD_MAX_ATTEMPTS',
      title: 'Límite de Oportunidades Evaluativas',
      required: `Máximo ${MAX_EXAM_ATTEMPTS} intentos de examen permitidos según reglamento institucional IES.`,
      met: c4_met,
      status: c4_met ? 'DENTRO DEL LÍMITE' : 'EXCEDIDO',
      details: `${attempts} de máximo ${allowedAttempts} intentos permitidos utilizados${bonusAttempts > 0 ? ` (incluye ${bonusAttempts} adicional(es) autorizado(s) por el admin)` : ''}.`
    };

    // 5. Integridad Académica y Tolerancia de Supervisión (Proctoring)
    const totalIncidents = (student.proctoring_incidents || 0) + (student.focus_violations || 0);
    const c5_met = totalIncidents <= 5;
    const c5 = {
      code: 'STD_PROCTORING_INTEGRITY',
      title: 'Integridad Académica y Supervisión Continuada',
      required: 'Tolerancia máxima de 5 incidencias de proctoring o pérdida de foco durante evaluación.',
      met: c5_met,
      status: c5_met ? 'CONFORME' : 'EN OBSERVACIÓN FORENSE',
      details: `${totalIncidents} incidentes registrados (${student.proctoring_incidents || 0} anomalías de cámara/rostro, ${student.focus_violations || 0} pérdidas de foco de ventana).`
    };

    // 6. Certificación Criptográfica y Validación QR
    const hasCert = Boolean(examRecord && examRecord.certificate_code);
    const c6_met = hasCert;
    const c6 = {
      code: 'STD_CRYPTO_CERT',
      title: 'Emisión Criptográfica y Respaldo Institucional QR',
      required: 'Código de autenticación HMAC-SHA256 y acta de aprobación expedida en base de datos.',
      met: c6_met,
      status: c6_met ? 'EMITIDO' : 'PENDIENTE',
      details: hasCert 
        ? `Código HMAC-SHA256: ${examRecord.certificate_code} (Emitido: ${examRecord.completed_at || 'Registrado'})` 
        : 'Pendiente de emisión. Se genera automáticamente al cumplir los estándares 1 al 5.'
    };

    const criteria = [c1, c2, c3, c4, c5, c6];
    const allMet = criteria.every(c => c.met);
    const missingCriteria = criteria.filter(c => !c.met).map(c => c.title);

    const verdict = allMet 
      ? 'CUMPLE EL ESTÁNDAR (Aval IES / Certificación Aprobada)' 
      : 'NO CUMPLE EL ESTÁNDAR';

    res.json({
      success: true,
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        cohort: student.cohort || 'Promoción 1',
        startDate: student.start_date || 'Inmediato',
        institution: student.institution || 'Sin asignar'
      },
      allMet,
      verdict,
      missingCriteria,
      criteria
    });
  } catch (err) {
    console.error('Error verifying compliance standard:', err);
    res.status(500).json({ error: 'Error del servidor al evaluar estándar institucional.' });
  }
});

// GET /api/admin/email-logs — Bitácora forense de correos enviados para responder requerimientos IES / MinEducación
router.get('/email-logs', authenticateToken, checkAdmin, async (req, res) => {
  try {
    const studentId = req.query.studentId ? parseInt(req.query.studentId, 10) : null;
    let query = `
      SELECT el.id, el.student_id, el.recipient_email, el.subject, el.sent_at, el.status,
             el.template, el.attempts, el.last_error,
             CASE WHEN el.payload_encrypted IS NULL THEN 0 ELSE 1 END AS retryable,
             s.name as student_name, s.cohort
      FROM email_logs el
      LEFT JOIN students s ON s.id = el.student_id
    `;
    const params = [];
    if (studentId) {
      query += ` WHERE el.student_id = ?`;
      params.push(studentId);
    }
    query += ` ORDER BY el.id DESC LIMIT 100`;

    const logs = await all(query, params);
    res.json({ success: true, logs });
  } catch (err) {
    console.error('Error fetching email logs:', err);
    res.status(500).json({ error: 'Error al consultar bitácora de correos.' });
  }
});

// GET /api/admin/export-audit — Exportación formal en CSV para auditoría IES / Ministerio de Educación
router.get('/export-audit', authenticateToken, checkAdmin, async (req, res) => {
  try {
    const cohortFilter = req.query.cohort && req.query.cohort !== 'all' ? req.query.cohort.trim() : null;

    let query = `
      SELECT s.id, s.name, s.email, s.id_type, s.id_number, s.institution, s.cohort, s.start_date,
             s.is_onboarded, s.exam_score, s.exam_attempts, s.proctoring_incidents, s.focus_violations,
             cp.certificate_code, cp.completed_at as certified_at
      FROM students s
      LEFT JOIN course_progress cp ON cp.student_id = s.id AND cp.module_id = 'exam' AND cp.status = 'completed'
      WHERE s.role != 'admin' AND COALESCE(s.is_test, 0) = 0
    `;
    const params = [];
    if (cohortFilter) {
      query += ` AND COALESCE(s.cohort, 'Promoción 1') = ?`;
      params.push(cohortFilter);
    }
    query += ` ORDER BY s.id ASC`;

    const rows = await all(query, params);

    // Módulos completados por estudiante
    const studentIds = rows.map(r => r.id);
    let stepCounts = {};
    if (studentIds.length > 0) {
      const placeholders = studentIds.map(() => '?').join(',');
      const stepRows = await all(`
        SELECT student_id, module_id
        FROM course_progress
        WHERE student_id IN (${placeholders}) AND status = 'completed'
      `, studentIds);
      const modulesByStudent = {};
      for (const sr of stepRows) {
        (modulesByStudent[sr.student_id] ||= []).push(sr.module_id);
      }
      for (const [sid, moduleIds] of Object.entries(modulesByStudent)) {
        stepCounts[sid] = countCompletedCourseSteps(moduleIds);
      }
    }

    // Cabeceras oficiales de auditoría
    const csvHeaders = [
      'ID Estudiante',
      'Nombre Completo',
      'Correo Electrónico',
      'Tipo Documento',
      'Número Documento',
      'Institución Hospitalaria',
      'Promoción (Cohorte)',
      'Fecha Habilitada Acceso',
      `Pasos Curriculares (de ${TOTAL_COURSE_STEPS})`,
      'Nota Examen (%)',
      'Intentos Examen',
      'Incidentes de Supervisión',
      'Enrolamiento Biométrico',
      'Cumple Estándar IES',
      'Código Certificado QR',
      'Fecha de Certificación'
    ];

    const csvLines = [csvHeaders.join(';')];

    for (const r of rows) {
      const steps = stepCounts[r.id] || 0;
      const score = r.exam_score !== null ? r.exam_score : 'Pendiente';
      const incidents = (r.proctoring_incidents || 0) + (r.focus_violations || 0);
      const isCertified = isExamPassingScore(r.exam_score) && steps >= TOTAL_COURSE_STEPS && !!r.is_onboarded;
      const cumpleEstandar = isCertified ? 'SI (Aprobado)' : 'NO (En Proceso / No Cumple)';

      const values = [
        r.id,
        `"${(r.name || '').replace(/"/g, '""')}"`,
        `"${(r.email || '').replace(/"/g, '""')}"`,
        r.id_type || 'CC',
        `"${(r.id_number || 'Sin registrar').replace(/"/g, '""')}"`,
        `"${(r.institution || 'Sin asignar').replace(/"/g, '""')}"`,
        `"${(r.cohort || 'Promoción 1').replace(/"/g, '""')}"`,
        r.start_date || 'Inmediato',
        `${steps}/${TOTAL_COURSE_STEPS}`,
        score,
        r.exam_attempts || 0,
        incidents,
        r.is_onboarded ? 'Completado' : 'Pendiente',
        cumpleEstandar,
        r.certificate_code || 'No emitido',
        r.certified_at || 'No certificado'
      ];
      csvLines.push(values.join(';'));
    }

    const filename = `auditoria_ies_${(cohortFilter || 'todas_promociones').replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.csv`;
    
    // UTF-8 BOM (\uFEFF) para compatibilidad total con Microsoft Excel en español
    const csvContent = '\uFEFF' + csvLines.join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err) {
    console.error('Error exporting audit CSV:', err);
    res.status(500).json({ error: 'Error del servidor al exportar auditoría.' });
  }
});

// GET /api/admin/certificate/:studentId — Descarga de PDF con firma digital
router.get('/certificate/:studentId', authenticateToken, checkAdmin, async (req, res) => {
  try {
    const targetStudentId = parseInt(req.params.studentId, 10);
    if (isNaN(targetStudentId) || targetStudentId <= 0) {
      return res.status(400).json({ error: 'studentId debe ser un entero positivo.' });
    }
    await generateCertificatePDF(targetStudentId, res);
  } catch (err) {
    console.error('PDF error in admin route:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Error del servidor al generar certificado.' });
  }
});

// GET /api/admin/cohort-acta/:cohort — Descarga de Acta Colectiva y Libro de Calificaciones IES (PDF)
router.get('/cohort-acta/:cohort', authenticateToken, checkAdmin, async (req, res) => {
  try {
    const cohort = req.params.cohort;
    if (!cohort) {
      return res.status(400).json({ error: 'Nombre de la promoción requerido.' });
    }
    await generateCohortActaPDF(cohort, res);
  } catch (err) {
    console.error('Error generating cohort acta PDF:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Error al generar el acta oficial de la promoción.' });
  }
});

// POST /api/admin/cohorts/:cohort/close — Cierre formal y sellado criptográfico de la promoción
router.post('/cohorts/:cohort/close', authenticateToken, checkAdmin, async (req, res) => {
  try {
    const cohortName = req.params.cohort;
    const existing = await get('SELECT id, cohort_seal_hash, closed_at FROM cohort_closures WHERE cohort_name = ?', [cohortName]);
    if (existing) {
      return res.status(409).json({ 
        error: `La promoción "${cohortName}" ya fue cerrada y sellada previamente.`,
        closedAt: existing.closed_at,
        sealHash: existing.cohort_seal_hash
      });
    }

    const students = await all(`
      SELECT id, name, email, exam_score, is_onboarded 
      FROM students 
      WHERE COALESCE(cohort, 'Promoción 1') = ? AND role != 'admin' AND COALESCE(is_test, 0) = 0
      ORDER BY id ASC
    `, [cohortName]);

    const certifiedCount = students.filter(s => isExamPassingScore(s.exam_score) && s.is_onboarded).length;
    const sealData = students.map(s => `${s.id}:${s.name}:${s.exam_score || 'NA'}:${s.is_onboarded}`).join('||');
    const sealHash = crypto.createHash('sha256').update(sealData + `||${cohortName}||${Date.now()}`).digest('hex');
    const nowIso = new Date().toISOString();

    await run(`
      INSERT INTO cohort_closures (cohort_name, closed_at, closed_by_admin_id, cohort_seal_hash, total_students, certified_students)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [cohortName, nowIso, req.user.id, sealHash, students.length, certifiedCount]);
    await logAdminAction({
      adminId: req.user.id, action: 'cohort.close', targetType: 'cohort', targetId: cohortName,
      details: { sealHash, totalStudents: students.length, certifiedStudents: certifiedCount },
    });

    res.json({
      success: true,
      cohortName,
      closedAt: nowIso,
      sealHash,
      totalStudents: students.length,
      certifiedStudents: certifiedCount
    });
  } catch (err) {
    console.error('Error closing cohort:', err);
    res.status(500).json({ error: 'Error al cerrar y sellar la promoción.' });
  }
});

// POST /api/admin/resend-email/:studentId — Reenvío de la guía de inducción. Si la cuenta aún
// no se activó, incluye un enlace de activación nuevo (el anterior deja de servir).
router.post('/resend-email/:studentId', authenticateToken, checkAdmin, async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const student = await get(
      'SELECT id, name, email, cohort, start_date, role, is_active, password_set_at FROM students WHERE id = ?',
      [studentId]
    );
    if (!student || student.role !== 'student') return res.status(404).json({ error: 'Estudiante no encontrado.' });
    if (!Number(student.is_active ?? 1)) {
      return res.status(409).json({ error: 'La cuenta está desactivada: reactívala antes de reenviar la guía.' });
    }

    const activationUrl = student.password_set_at
      ? null
      : (await issueToken({ studentId: student.id, purpose: TOKEN_PURPOSES.ACTIVATION, adminId: req.user.id })).url;
    const email = await sendWelcomeInductionEmail({
      studentId: student.id,
      name: student.name,
      email: student.email,
      cohort: student.cohort || 'Promoción 1',
      startDate: student.start_date || null,
      activationUrl,
      adminId: req.user.id
    });
    await logAdminAction({
      adminId: req.user.id, action: 'email.resend_induction', targetType: 'student', targetId: student.id,
      details: { withActivationLink: !!activationUrl },
    });

    res.json({ success: true, emailStatus: email.status, message: `Correo de inducción reenviado a ${student.email}.` });
  } catch (err) {
    console.error('Error resending email:', err);
    res.status(500).json({ error: 'Error al reenviar correo de inducción.' });
  }
});

// POST /api/admin/send-reminder/:studentId — Envío de recordatorio académico anti-rezago
router.post('/send-reminder/:studentId', authenticateToken, checkAdmin, async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const student = await get('SELECT id, name, email, cohort, role, is_active FROM students WHERE id = ?', [studentId]);
    if (!student || student.role !== 'student') return res.status(404).json({ error: 'Estudiante no encontrado.' });
    if (!Number(student.is_active ?? 1)) {
      return res.status(409).json({ error: 'La cuenta está desactivada: no se envían recordatorios.' });
    }
    // Mismo límite que los correos de refuerzo de la bandeja: uno cada 24 horas y dos por semana
    const allowance = await reinforcementAllowance(studentId);
    if (!allowance.allowed) return res.status(429).json({ error: allowance.reason });

    const stepRows = await all(`
      SELECT module_id FROM course_progress WHERE student_id = ? AND status = 'completed'
    `, [studentId]);
    const completedSteps = countCompletedCourseSteps(stepRows.map(r => r.module_id));

    const email = await sendProgressReminderEmail({
      studentId: student.id,
      name: student.name,
      email: student.email,
      cohort: student.cohort || 'Promoción 1',
      completedSteps,
      adminId: req.user.id
    });
    await logAdminAction({
      adminId: req.user.id, action: 'email.reminder', targetType: 'student', targetId: student.id,
      details: { completedSteps, totalSteps: TOTAL_COURSE_STEPS },
    });

    res.json({ success: true, emailStatus: email.status, message: `Recordatorio académico enviado a ${student.email}.` });
  } catch (err) {
    console.error('Error sending reminder:', err);
    res.status(500).json({ error: 'Error al enviar recordatorio académico.' });
  }
});

export default router;
