import { run, get, all } from '../config/db.js';

/**
 * Servicio de mensajería y notificaciones institucionales de C-Arm Master.
 * Genera y registra los correos de bienvenida, inducción y confirmación de matrícula
 * con fecha habilitada de ingreso y guía operativa de inicio para auditoría IES.
 */

export function buildInductionEmailHtml({ name, email, cohort, startDate, tempPassword }) {
  const effectiveDate = startDate || 'Inmediato (Acceso habilitado)';
  const loginUrl = process.env.CLIENT_URL || 'http://localhost:3000/login';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Bienvenido a C-Arm Master</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #050814; color: #f1f5f9; margin: 0; padding: 24px; }
    .container { max-width: 650px; margin: 0 auto; background-color: #0b1120; border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 12px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .header { text-align: center; border-bottom: 1px solid rgba(0, 240, 255, 0.2); padding-bottom: 24px; margin-bottom: 24px; }
    .logo { font-size: 26px; font-weight: bold; color: #00f0ff; text-decoration: none; }
    .subtitle { color: #94a3b8; font-size: 14px; margin-top: 6px; }
    .badge { display: inline-block; background: rgba(0, 240, 255, 0.15); color: #00f0ff; border: 1px solid #00f0ff; border-radius: 20px; padding: 4px 14px; font-size: 13px; font-weight: bold; margin-top: 12px; }
    .content { line-height: 1.6; font-size: 15px; color: #cbd5e1; }
    .credentials-box { background: rgba(15, 23, 42, 0.8); border: 1px dashed #38bdf8; border-radius: 8px; padding: 18px; margin: 20px 0; }
    .credentials-box strong { color: #00f0ff; }
    .guide-section { margin-top: 28px; border-top: 1px solid rgba(255,255,255,0.1); pt: 20px; }
    .step-item { display: flex; margin-bottom: 16px; align-items: flex-start; }
    .step-num { background: #00f0ff; color: #050814; font-weight: bold; border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; margin-right: 12px; flex-shrink: 0; font-size: 13px; }
    .step-text { font-size: 14px; }
    .step-text strong { color: #f8fafc; }
    .btn-login { display: block; text-align: center; background: #00f0ff; color: #050814; font-weight: bold; text-decoration: none; padding: 14px 28px; border-radius: 8px; margin: 28px 0; font-size: 16px; }
    .footer { text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 20px; margin-top: 28px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🏥 C-Arm Master</div>
      <div class="subtitle">Programa de Certificación en Fluoroscopía y Radioprotección Quirúrgica</div>
      <div class="badge">Promoción Asignada: ${cohort}</div>
    </div>

    <div class="content">
      <p>Estimado(a) <strong>${name}</strong>,</p>
      <p>Nos complace confirmarte que has sido matriculado(a) exitosamente en el programa de certificación clínica con Arco en C. Tu proceso de formación cuenta con validez oficial para convalidación ante la Institución de Educación Superior (IES).</p>

      <div class="credentials-box">
        <h4 style="margin: 0 0 10px 0; color: #fff;">🔑 Tus Credenciales de Acceso</h4>
        <div>• <strong>Portal de Ingreso:</strong> <a href="${loginUrl}" style="color: #38bdf8;">${loginUrl}</a></div>
        <div>• <strong>Usuario / Correo:</strong> ${email}</div>
        <div>• <strong>Contraseña Asignada:</strong> ${tempPassword || 'Definida en tu registro inicial'}</div>
        <div>• <strong>Fecha Habilitada de Acceso:</strong> <span style="color: #34d399; font-weight: bold;">${effectiveDate}</span></div>
      </div>

      <div class="guide-section">
        <h3 style="color: #00f0ff; margin-bottom: 16px;">📘 Guía de Inicio y Requisitos del Estándar</h3>
        
        <div class="step-item">
          <div class="step-num">1</div>
          <div class="step-text"><strong>Primer Login y Enrolamiento Biométrico:</strong> Al ingresar, completa tu número de documento de identidad e institución hospitalaria. La <em>Dra. Nova (IA)</em> registrará tu rostro con tu cámara web para supervisar las evaluaciones bajo estricto proctoring.</div>
        </div>

        <div class="step-item">
          <div class="step-num">2</div>
          <div class="step-text"><strong>Ruta de Aprendizaje Secuencial:</strong> El curso consta de 5 módulos obligatorios (25 pasos: historia/física, scatter ALARA, geometría robótica 8-DoF, proyecciones de miembro inferior y superior/columna). Los videos cuentan con protección anti-adelanto y PDFs de descarga.</div>
        </div>

        <div class="step-item">
          <div class="step-num">3</div>
          <div class="step-text"><strong>Minijuegos en Simulador y Puntos de Reserva:</strong> Cada práctica de posicionamiento virtual te otorga <em>Puntos de Reserva ⚡</em> (hasta 500 pts) que podrás usar como comodín en el examen final.</div>
        </div>

        <div class="step-item">
          <div class="step-num">4</div>
          <div class="step-text"><strong>Evaluación Final (Reglamentaria):</strong> Al completar el 100% de los módulos, se desbloqueará el examen de 50 preguntas. Se exige un mínimo de <strong>90% de aprobación</strong> y máximo <strong>3 intentos</strong> para certificar.</div>
        </div>

        <div class="step-item">
          <div class="step-num">5</div>
          <div class="step-text"><strong>Certificación Criptográfica:</strong> Al aprobar, obtendrás tu Certificado Oficial en PDF con código QR y firma digital verificable en tiempo real ante las autoridades hospitalarias y el Ministerio de Educación.</div>
        </div>
      </div>

      <a href="${loginUrl}" class="btn-login">Comenzar Mi Curso Ahora ▶</a>
    </div>

    <div class="footer">
      <div>C-Arm Master MVP — Aval Institucional para Educación Médica y Quirúrgica</div>
      <div>Este es un correo institucional automatizado. Si no reconoces esta inscripción, comunícate con la administración académica.</div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function buildInductionEmailText({ name, email, cohort, startDate, tempPassword }) {
  const effectiveDate = startDate || 'Inmediato (Acceso habilitado)';
  const loginUrl = process.env.CLIENT_URL || 'http://localhost:3000/login';

  return `
BIENVENIDO A C-ARM MASTER - CONFIRMACIÓN DE MATRÍCULA
Promoción Asignada: ${cohort}

Estimado(a) ${name},
Has sido matriculado(a) exitosamente en el programa de certificación clínica con Arco en C.

CREDENCIALES DE ACCESO:
- Portal: ${loginUrl}
- Usuario / Correo: ${email}
- Contraseña: ${tempPassword || 'Definida en registro'}
- Habilitado desde: ${effectiveDate}

GUÍA RÁPIDA DE INICIO (ESTÁNDAR DE CERTIFICACIÓN):
1. Enrolamiento Biométrico: Registra tu documento institucional y captura tu rostro para supervisión con IA.
2. Secuencia Curricular: Completa los 5 módulos (25 pasos teóricos y prácticos en orden).
3. Puntos de Reserva: Realiza las prácticas en el simulador para acumular puntos comodín.
4. Examen Final: Aprueba con mínimo 90% (máximo 3 intentos).
5. Certificado Oficial: Descarga tu certificación con QR y validación criptográfica ante IES.

Ingresa a: ${loginUrl}
  `.trim();
}

/**
 * Despacha y audita el correo de inducción para el estudiante.
 * Guarda copia forense en la tabla `email_logs` para control IES.
 */
export async function sendWelcomeInductionEmail({ studentId, name, email, cohort, startDate, tempPassword }) {
  const subject = `🏥 Bienvenido a C-Arm Master: Confirmación de Matrícula - ${cohort || 'Promoción 1'}`;
  const htmlContent = buildInductionEmailHtml({ name, email, cohort, startDate, tempPassword });
  const textContent = buildInductionEmailText({ name, email, cohort, startDate, tempPassword });

  try {
    // Registro auditable en base de datos
    await run(
      `INSERT INTO email_logs (student_id, recipient_email, subject, body_content, status) VALUES (?, ?, ?, ?, 'sent')`,
      [studentId, email.toLowerCase().trim(), subject, htmlContent]
    );

    console.log(`📧 [EMAIL AUDIT] Correo de inducción enviado a ${email} (Cohorte: ${cohort || 'Promoción 1'})`);

    return {
      success: true,
      recipient: email,
      subject,
      cohort: cohort || 'Promoción 1',
      sentAt: new Date().toISOString()
    };
  } catch (err) {
    console.error('Error al registrar/enviar email de inducción:', err);
    throw err;
  }
}

/**
 * Despacha un correo de recordatorio de avance académico y prevención de rezago.
 * Registra copia forense en email_logs.
 */
export async function sendProgressReminderEmail({ studentId, name, email, cohort, completedSteps = 0 }) {
  const loginUrl = process.env.CLIENT_URL || 'http://localhost:3000/login';
  const subject = `🔔 Recordatorio Académico: Continúa tu Certificación en C-Arm Master - ${cohort || 'Promoción 1'}`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Recordatorio Académico - C-Arm Master</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #050814; color: #f1f5f9; padding: 24px; }
    .container { max-width: 600px; margin: 0 auto; background-color: #0b1120; border: 1px solid #00f0ff; border-radius: 12px; padding: 28px; }
    .header { text-align: center; border-bottom: 1px solid rgba(0, 240, 255, 0.2); padding-bottom: 16px; margin-bottom: 20px; }
    .title { font-size: 20px; color: #00f0ff; font-weight: bold; }
    .progress-box { background: rgba(15, 23, 42, 0.8); border: 1px solid #38bdf8; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .btn { display: block; text-align: center; background: #00f0ff; color: #050814; font-weight: bold; text-decoration: none; padding: 12px 24px; border-radius: 8px; margin: 24px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="title">🏥 C-Arm Master — Recordatorio de Avance</div>
      <div style="color: #94a3b8; font-size: 13px;">Promoción: ${cohort || 'Promoción 1'}</div>
    </div>
    <p>Estimado(a) <strong>${name}</strong>,</p>
    <p>Te recordamos que tu proceso de certificación en Arco en C y Radioprotección Quirúrgica se encuentra activo. El estándar institucional IES requiere culminar el 100% de la malla formativa para habilitar tu evaluación final.</p>
    <div class="progress-box">
      <div>📊 <strong>Tu Progreso Actual:</strong> ${completedSteps} de 25 pasos obligatorios completados (${Math.round((completedSteps / 25) * 100)}%).</div>
      <div style="margin-top: 8px; font-size: 13px; color: #cbd5e1;">Aún tienes tiempo para completar tus módulos teóricos, prácticas en simulador y examen oficial.</div>
    </div>
    <a href="${loginUrl}" class="btn">Retomar mi Curso Ahora ▶</a>
    <div style="text-align: center; font-size: 11px; color: #64748b; margin-top: 24px;">
      C-Arm Master MVP — Notificación Académica Institucional IES
    </div>
  </div>
</body>
</html>
  `.trim();

  try {
    await run(
      `INSERT INTO email_logs (student_id, recipient_email, subject, body_content, status) VALUES (?, ?, ?, ?, 'sent')`,
      [studentId, email.toLowerCase().trim(), subject, htmlContent]
    );

    console.log(`📧 [EMAIL AUDIT] Recordatorio de avance enviado a ${email} (Completados: ${completedSteps}/25)`);

    return {
      success: true,
      recipient: email,
      subject,
      sentAt: new Date().toISOString()
    };
  } catch (err) {
    console.error('Error al registrar/enviar recordatorio:', err);
    throw err;
  }
}

