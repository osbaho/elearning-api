import { TOTAL_COURSE_STEPS, COURSE_MODULE_COUNT } from '../config/curriculum.js';
import { EXAM_QUESTION_COUNT, EXAM_PASS_SCORE_PERCENT, MAX_EXAM_ATTEMPTS } from '../config/examRules.js';
import { MAX_RESERVE_POINTS } from '../config/reservePoints.js';
import { appUrl } from '../config/appUrls.js';
import { queueEmail } from './mailer.js';
import { formatDate } from './access.js';

/**
 * Correos institucionales de C-Arm Master. Se encolan en email_logs (ver mailer.js): la
 * bitácora guarda cada envío con su estado real y sin los enlaces privados.
 *
 * Nunca se envían contraseñas: la cuenta se activa con un enlace de un solo uso.
 */

const ACTIVATION_DAYS = 7;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function layout({ title, badge, bodyHtml }) {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #050814; color: #f1f5f9; margin: 0; padding: 24px; }
    .container { max-width: 650px; margin: 0 auto; background-color: #0b1120; border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 12px; padding: 32px; }
    .header { text-align: center; border-bottom: 1px solid rgba(0, 240, 255, 0.2); padding-bottom: 24px; margin-bottom: 24px; }
    .logo { font-size: 26px; font-weight: bold; color: #00f0ff; }
    .subtitle { color: #94a3b8; font-size: 14px; margin-top: 6px; }
    .badge { display: inline-block; background: rgba(0, 240, 255, 0.15); color: #00f0ff; border: 1px solid #00f0ff; border-radius: 20px; padding: 4px 14px; font-size: 13px; font-weight: bold; margin-top: 12px; }
    .content { line-height: 1.6; font-size: 15px; color: #cbd5e1; }
    .box { background: rgba(15, 23, 42, 0.8); border: 1px dashed #38bdf8; border-radius: 8px; padding: 18px; margin: 20px 0; }
    .box strong { color: #00f0ff; }
    .step-item { margin-bottom: 14px; font-size: 14px; }
    .step-item strong { color: #f8fafc; }
    .btn { display: block; text-align: center; background: #00f0ff; color: #050814 !important; font-weight: bold; text-decoration: none; padding: 14px 28px; border-radius: 8px; margin: 28px 0; font-size: 16px; }
    .muted { font-size: 12px; color: #94a3b8; }
    .footer { text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 20px; margin-top: 28px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🏥 C-Arm Master</div>
      <div class="subtitle">Programa de Certificación en Fluoroscopía y Radioprotección Quirúrgica</div>
      ${badge ? `<div class="badge">${escapeHtml(badge)}</div>` : ''}
    </div>
    <div class="content">
      ${bodyHtml}
    </div>
    <div class="footer">
      <div>C-Arm Master — Formación en Arco en C</div>
      <div>Correo automático. Si no reconoces esta inscripción, comunícate con la administración académica.</div>
    </div>
  </div>
</body>
</html>`.trim();
}

function courseGuideHtml() {
  return `
      <h3 style="color: #00f0ff; margin: 28px 0 16px;">📘 Cómo avanzar en el curso</h3>
      <div class="step-item">1. <strong>Primer ingreso y registro biométrico:</strong> confirma tu documento e institución y registra tu rostro con la cámara; se usa para supervisar el examen.</div>
      <div class="step-item">2. <strong>Ruta secuencial:</strong> ${COURSE_MODULE_COUNT} módulos y ${TOTAL_COURSE_STEPS} pasos entre videos y minijuegos, en orden. Cada módulo tiene su lectura en PDF.</div>
      <div class="step-item">3. <strong>Minijuegos y Puntos de Reserva:</strong> cada partida en el simulador suma puntos (hasta ${MAX_RESERVE_POINTS}) que puedes usar como comodín en el examen.</div>
      <div class="step-item">4. <strong>Examen final:</strong> se habilita al completar el curso. ${EXAM_QUESTION_COUNT} preguntas por intento, nota mínima del ${EXAM_PASS_SCORE_PERCENT}% y máximo ${MAX_EXAM_ATTEMPTS} intentos.</div>
      <div class="step-item">5. <strong>Certificado:</strong> al aprobar descargas tu certificado en PDF con código QR verificable.</div>`;
}

function courseGuideText() {
  return [
    'CÓMO AVANZAR EN EL CURSO',
    '1. Primer ingreso: confirma tus datos y registra tu rostro (supervisión del examen).',
    `2. Ruta secuencial: ${COURSE_MODULE_COUNT} módulos y ${TOTAL_COURSE_STEPS} pasos en orden.`,
    `3. Minijuegos: suman Puntos de Reserva (hasta ${MAX_RESERVE_POINTS}) para usar como comodín.`,
    `4. Examen final: ${EXAM_QUESTION_COUNT} preguntas por intento, mínimo ${EXAM_PASS_SCORE_PERCENT}%, máximo ${MAX_EXAM_ATTEMPTS} intentos.`,
    '5. Certificado en PDF con código QR verificable.',
  ].join('\n');
}

/**
 * Bienvenida e inducción. Con `activationUrl` (cuenta nueva o aún sin activar) invita a crear
 * la contraseña; sin él (cuenta ya activada) recuerda cómo ingresar.
 */
export function buildInductionEmail({ name, email, cohort, startDate, activationUrl }) {
  const loginUrl = appUrl('/login');
  const forgotUrl = appUrl('/recuperar');
  const access = startDate ? `desde el ${formatDate(startDate)}` : 'desde hoy';
  const subject = `🏥 Bienvenido a C-Arm Master: Confirmación de Matrícula - ${cohort || 'Promoción 1'}`;

  const accessBox = activationUrl
    ? `
      <div class="box">
        <h4 style="margin: 0 0 10px; color: #fff;">🔑 Activa tu cuenta</h4>
        <div>• <strong>Usuario:</strong> ${escapeHtml(email)}</div>
        <div>• <strong>Acceso habilitado:</strong> ${escapeHtml(access)}</div>
        <div style="margin-top: 10px;">Crea tu contraseña con el botón de abajo. El enlace es personal, sirve una sola vez y vence en ${ACTIVATION_DAYS} días.</div>
      </div>
      <a href="${activationUrl}" class="btn">Activar mi cuenta ▶</a>
      <div class="muted">Si el botón no funciona, copia este enlace en tu navegador: ${activationUrl}</div>`
    : `
      <div class="box">
        <h4 style="margin: 0 0 10px; color: #fff;">🔑 Tu acceso</h4>
        <div>• <strong>Portal:</strong> <a href="${loginUrl}" style="color: #38bdf8;">${loginUrl}</a></div>
        <div>• <strong>Usuario:</strong> ${escapeHtml(email)} (con la contraseña que creaste)</div>
        <div>• <strong>Acceso habilitado:</strong> ${escapeHtml(access)}</div>
        <div style="margin-top: 10px;">¿No la recuerdas? Usa <a href="${forgotUrl}" style="color: #38bdf8;">«¿Olvidaste tu contraseña?»</a>.</div>
      </div>
      <a href="${loginUrl}" class="btn">Ingresar al curso ▶</a>`;

  const html = layout({
    title: 'Bienvenido a C-Arm Master',
    badge: `Promoción: ${cohort || 'Promoción 1'}`,
    bodyHtml: `
      <p>Estimado(a) <strong>${escapeHtml(name)}</strong>,</p>
      <p>Te confirmamos tu matrícula en el programa de certificación clínica con Arco en C.</p>
      ${accessBox}
      ${courseGuideHtml()}`,
  });

  const text = [
    'BIENVENIDO A C-ARM MASTER - CONFIRMACIÓN DE MATRÍCULA',
    `Promoción: ${cohort || 'Promoción 1'}`,
    '',
    `Estimado(a) ${name},`,
    'Te confirmamos tu matrícula en el programa de certificación clínica con Arco en C.',
    '',
    `Usuario: ${email}`,
    `Acceso habilitado: ${access}`,
    activationUrl
      ? `Activa tu cuenta y crea tu contraseña (enlace personal, de un solo uso, vence en ${ACTIVATION_DAYS} días):\n${activationUrl}`
      : `Ingresa en ${loginUrl} con la contraseña que creaste. ¿No la recuerdas? ${forgotUrl}`,
    '',
    courseGuideText(),
  ].join('\n');

  return { subject, html, text };
}

export async function sendWelcomeInductionEmail({ studentId, name, email, cohort, startDate, activationUrl = null, adminId = null }) {
  const message = buildInductionEmail({ name, email, cohort, startDate, activationUrl });
  return queueEmail({
    studentId, to: email, ...message,
    template: activationUrl ? 'induction_activation' : 'induction',
    secrets: [activationUrl], adminId,
  });
}

export function buildPasswordResetEmail({ name, resetUrl }) {
  const subject = '🔑 C-Arm Master: Restablece tu contraseña';
  const html = layout({
    title: 'Restablece tu contraseña',
    bodyHtml: `
      <p>Hola <strong>${escapeHtml(name)}</strong>,</p>
      <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta. Crea una nueva con el botón de abajo. El enlace sirve una sola vez y vence en 1 hora.</p>
      <a href="${resetUrl}" class="btn">Crear nueva contraseña ▶</a>
      <div class="muted">Si el botón no funciona, copia este enlace en tu navegador: ${resetUrl}</div>
      <p class="muted">Si no lo solicitaste, ignora este correo: tu contraseña actual sigue funcionando.</p>`,
  });
  const text = [
    `Hola ${name},`,
    'Recibimos una solicitud para restablecer la contraseña de tu cuenta de C-Arm Master.',
    `Crea una nueva aquí (enlace de un solo uso, vence en 1 hora): ${resetUrl}`,
    'Si no lo solicitaste, ignora este correo.',
  ].join('\n');
  return { subject, html, text };
}

export async function sendPasswordResetEmail({ studentId, name, email, resetUrl, adminId = null }) {
  return queueEmail({
    studentId, to: email, ...buildPasswordResetEmail({ name, resetUrl }),
    template: 'password_reset', secrets: [resetUrl], adminId,
  });
}

/** Recordatorio de avance (refuerzo para continuar el curso). */
export async function sendProgressReminderEmail({ studentId, name, email, cohort, completedSteps = 0, adminId = null }) {
  const loginUrl = appUrl('/login');
  const percent = Math.round((completedSteps / TOTAL_COURSE_STEPS) * 100);
  const subject = `🔔 Recordatorio Académico: Continúa tu Certificación en C-Arm Master - ${cohort || 'Promoción 1'}`;
  const html = layout({
    title: 'Recordatorio Académico - C-Arm Master',
    badge: `Promoción: ${cohort || 'Promoción 1'}`,
    bodyHtml: `
      <p>Estimado(a) <strong>${escapeHtml(name)}</strong>,</p>
      <p>Tu proceso de certificación en Arco en C y Radioprotección Quirúrgica sigue activo. Para habilitar la evaluación final necesitas completar el 100% de la ruta.</p>
      <div class="box">
        <div>📊 <strong>Tu progreso actual:</strong> ${completedSteps} de ${TOTAL_COURSE_STEPS} pasos completados (${percent}%).</div>
        <div style="margin-top: 8px; font-size: 13px;">Retoma donde quedaste: el curso te lleva directo al siguiente paso.</div>
      </div>
      <a href="${loginUrl}" class="btn">Retomar mi curso ▶</a>`,
  });
  const text = [
    `Estimado(a) ${name},`,
    `Tu progreso actual: ${completedSteps} de ${TOTAL_COURSE_STEPS} pasos (${percent}%).`,
    `Retoma tu curso en ${loginUrl}`,
  ].join('\n');
  return queueEmail({ studentId, to: email, subject, html, text, template: 'progress_reminder', adminId });
}
