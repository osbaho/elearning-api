import nodemailer from 'nodemailer';
import { run, all } from '../config/db.js';
import { encryptText, decryptText } from '../utils/crypto.js';

/**
 * Envío de correo con cola persistente (tabla email_logs).
 *
 * Transporte (MAIL_TRANSPORT):
 *   smtp  envía por SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS (cualquier proveedor: SES, Brevo,
 *         Postmark, Microsoft 365, Google Workspace…). Es el modo por defecto si hay SMTP_HOST.
 *   log   no envía: registra el correo como 'simulated'. Por defecto sin SMTP_HOST (desarrollo
 *         y pruebas). En producción el arranque avisa de que los correos no saldrán.
 *
 * Estados en email_logs.status: queued → sent | simulated | failed (tras MAX_EMAIL_ATTEMPTS).
 * body_content guarda el HTML con los enlaces privados ocultos (lo ve el admin en la bitácora);
 * el contenido real viaja cifrado en payload_encrypted y se borra al enviarse.
 */

export const MAX_EMAIL_ATTEMPTS = 5;
const RETRY_DELAYS_MINUTES = [1, 5, 15, 60];
const REDACTED = '[enlace privado]';

export function mailTransportMode(env = process.env) {
  const mode = (env.MAIL_TRANSPORT || '').trim().toLowerCase();
  if (mode === 'smtp' || mode === 'log') return mode;
  return env.SMTP_HOST ? 'smtp' : 'log';
}

export function smtpOptions(env = process.env) {
  const port = Number(env.SMTP_PORT || 587);
  const secureFlag = (env.SMTP_SECURE || '').trim().toLowerCase();
  return {
    host: env.SMTP_HOST,
    port,
    // 465 = TLS directo; 587/25 = STARTTLS (nodemailer lo negocia y verifica el certificado)
    secure: secureFlag ? ['1', 'true', 'yes'].includes(secureFlag) : port === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS || '' } : undefined,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  };
}

export function mailFrom(env = process.env) {
  return env.MAIL_FROM || 'C-Arm Master <no-reply@localhost>';
}

export function createSmtpTransport(env = process.env) {
  return nodemailer.createTransport(smtpOptions(env));
}

let transport = null;
function getTransport() {
  if (!transport) transport = createSmtpTransport();
  return transport;
}

function redact(text, secrets) {
  return secrets.filter(Boolean).reduce((acc, secret) => acc.split(secret).join(REDACTED), text || '');
}

/**
 * Encola un correo. `secrets`: textos que no deben quedar legibles en la bitácora (enlaces de
 * activación o restablecimiento). Llamar fuera de transacciones: el envío arranca de inmediato.
 */
export async function queueEmail({ studentId = null, to, subject, html, text, template, secrets = [], adminId = null }) {
  const recipient = String(to).toLowerCase().trim();
  await run(
    `INSERT INTO email_logs
       (student_id, recipient_email, subject, body_content, status, template, attempts, payload_encrypted, created_by_admin_id)
     VALUES (?, ?, ?, ?, 'queued', ?, 0, ?, ?)`,
    [studentId, recipient, subject, redact(html, secrets), template, encryptText(JSON.stringify({ html, text })), adminId]
  );
  scheduleQueueRun();
  return { status: 'queued', transport: mailTransportMode() };
}

let processing = false;
let scheduled = null;
let intervalTimer = null;

/** Procesa la cola en cuanto termine el ciclo actual (sin esperar al intervalo). */
export function scheduleQueueRun() {
  if (scheduled) return;
  scheduled = setTimeout(() => {
    scheduled = null;
    processEmailQueue().catch((err) => console.error('Cola de correo:', err.message));
  }, 25);
}

/** Envía los correos pendientes cuyo turno llegó. Devuelve cuántos procesó. */
export async function processEmailQueue({ limit = 10 } = {}) {
  if (processing) return 0;
  processing = true;
  try {
    const due = await all(
      `SELECT id, recipient_email, subject, attempts, payload_encrypted FROM email_logs
        WHERE status = 'queued' AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
        ORDER BY id ASC LIMIT ?`,
      [new Date().toISOString(), limit]
    );
    for (const email of due) await deliver(email);
    return due.length;
  } finally {
    processing = false;
  }
}

async function deliver(email) {
  const attempts = (Number(email.attempts) || 0) + 1;
  try {
    let payload;
    try {
      payload = JSON.parse(decryptText(email.payload_encrypted));
    } catch {
      const err = new Error('El contenido del correo no está disponible (¿cambió la clave de cifrado?). Genera uno nuevo.');
      err.permanent = true;
      throw err;
    }

    let messageId;
    const mode = mailTransportMode();
    if (mode === 'log') {
      messageId = `simulado-${email.id}`;
      console.log(`📧 [correo simulado, sin SMTP] ${email.recipient_email} — ${email.subject}`);
    } else {
      const info = await getTransport().sendMail({
        from: mailFrom(),
        to: email.recipient_email,
        subject: email.subject,
        html: payload.html,
        text: payload.text,
      });
      messageId = info.messageId;
    }

    await run(
      `UPDATE email_logs
          SET status = ?, attempts = ?, sent_at = ?, provider_message_id = ?, last_error = NULL,
              next_attempt_at = NULL, payload_encrypted = NULL
        WHERE id = ?`,
      [mode === 'log' ? 'simulated' : 'sent', attempts, new Date().toISOString(), messageId, email.id]
    );
  } catch (err) {
    const failed = err.permanent || attempts >= MAX_EMAIL_ATTEMPTS;
    const delayMinutes = RETRY_DELAYS_MINUTES[Math.min(attempts - 1, RETRY_DELAYS_MINUTES.length - 1)];
    await run(
      'UPDATE email_logs SET status = ?, attempts = ?, last_error = ?, next_attempt_at = ? WHERE id = ?',
      [
        failed ? 'failed' : 'queued',
        attempts,
        String(err.message || err).slice(0, 500),
        failed ? null : new Date(Date.now() + delayMinutes * 60000).toISOString(),
        email.id,
      ]
    );
    console.error(`📧 Error enviando el correo ${email.id} (intento ${attempts}/${MAX_EMAIL_ATTEMPTS}): ${err.message}`);
  }
}

/** Vuelve a encolar un correo fallido. false si no existe, no falló o ya no tiene contenido. */
export async function retryEmail(id) {
  const rows = await all(
    `SELECT id FROM email_logs WHERE id = ? AND status = 'failed' AND payload_encrypted IS NOT NULL`,
    [id]
  );
  if (rows.length === 0) return false;
  await run(
    `UPDATE email_logs SET status = 'queued', attempts = 0, last_error = NULL, next_attempt_at = NULL WHERE id = ?`,
    [id]
  );
  scheduleQueueRun();
  return true;
}

export function startEmailWorker({ intervalMs = Number(process.env.MAIL_QUEUE_INTERVAL_MS) || 10000 } = {}) {
  const mode = mailTransportMode();
  if (mode === 'smtp') {
    console.log(`📧 Correo: SMTP ${process.env.SMTP_HOST}:${smtpOptions().port} (remitente: ${mailFrom()})`);
  } else if (process.env.NODE_ENV === 'production') {
    console.warn('⚠️  Correo en modo simulado: no saldrá ningún correo. Configura SMTP_HOST (y SMTP_USER/SMTP_PASS, MAIL_FROM).');
  } else {
    console.log('📧 Correo: modo simulado (sin SMTP_HOST). Los correos quedan en email_logs como "simulated".');
  }
  intervalTimer = setInterval(() => {
    processEmailQueue().catch((err) => console.error('Cola de correo:', err.message));
  }, intervalMs);
  intervalTimer.unref?.();
  scheduleQueueRun();
}

export function stopEmailWorker() {
  if (intervalTimer) clearInterval(intervalTimer);
  if (scheduled) clearTimeout(scheduled);
  intervalTimer = null;
  scheduled = null;
}
