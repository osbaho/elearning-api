import { test, expect } from '@playwright/test';
import { SMTPServer } from 'smtp-server';
import { simpleParser } from 'mailparser';
import { createSmtpTransport, smtpOptions, mailFrom, mailTransportMode } from '../../server/services/mailer.js';
import { buildInductionEmail, buildPasswordResetEmail } from '../../server/services/emailService.js';

/**
 * Entrega real por SMTP (sin depender de un proveedor): un servidor SMTP local recibe lo que
 * envía el transporte que usa la API, con la configuración tomada de las variables SMTP_*.
 * Comprueba autenticación, destinatario, asunto y que el enlace llegue completo en HTML y texto.
 */
async function startSmtpServer() {
  const received = [];
  const server = new SMTPServer({
    authOptional: false,
    allowInsecureAuth: true,      // prueba local sin TLS
    disabledCommands: ['STARTTLS'],
    logger: false,
    onAuth(auth, session, callback) {
      if (auth.username === 'carm' && auth.password === 'secreto-smtp') return callback(null, { user: auth.username });
      return callback(new Error('Credenciales SMTP inválidas'));
    },
    onData(stream, session, callback) {
      simpleParser(stream)
        .then((mail) => { received.push({ mail, envelope: session.envelope, user: session.user }); callback(); })
        .catch(callback);
    },
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, received, port: server.server.address().port };
}

test.describe('Entrega de correo por SMTP', () => {
  test('El modo de transporte se elige por configuración', () => {
    expect(mailTransportMode({})).toBe('log');
    expect(mailTransportMode({ SMTP_HOST: 'smtp.proveedor.com' })).toBe('smtp');
    expect(mailTransportMode({ SMTP_HOST: 'smtp.proveedor.com', MAIL_TRANSPORT: 'log' })).toBe('log');
    expect(smtpOptions({ SMTP_HOST: 'h', SMTP_PORT: '465' }).secure).toBe(true);
    expect(smtpOptions({ SMTP_HOST: 'h', SMTP_PORT: '587' }).secure).toBe(false);
    expect(smtpOptions({ SMTP_HOST: 'h' }).auth).toBeUndefined();
  });

  test('El correo de activación llega por SMTP con el enlace intacto y sin contraseñas', async () => {
    const { server, received, port } = await startSmtpServer();
    try {
      const env = {
        SMTP_HOST: '127.0.0.1', SMTP_PORT: String(port), SMTP_SECURE: 'false',
        SMTP_USER: 'carm', SMTP_PASS: 'secreto-smtp', MAIL_FROM: 'C-Arm Master <no-reply@carm.test>',
      };
      const transport = createSmtpTransport(env);
      const activationUrl = 'https://cursos.carm.test/activar?token=Abc_123-xyzTokenDePrueba';
      const message = buildInductionEmail({
        name: 'Dra. Ana Correo', email: 'ana@hospital.org', cohort: 'Promoción 1', startDate: '2026-12-01', activationUrl,
      });
      await transport.sendMail({ from: mailFrom(env), to: 'ana@hospital.org', ...message });

      expect(received).toHaveLength(1);
      const { mail, envelope, user } = received[0];
      expect(user).toBe('carm');
      expect(envelope.mailFrom.address).toBe('no-reply@carm.test');
      expect(envelope.rcptTo.map((r) => r.address)).toEqual(['ana@hospital.org']);
      expect(mail.subject).toContain('Confirmación de Matrícula - Promoción 1');
      expect(mail.html).toContain(`href="${activationUrl}"`);
      expect(mail.text).toContain(activationUrl);
      expect(mail.text).toContain('01/12/2026');
      expect(`${mail.html}${mail.text}`).not.toMatch(/contraseña asignada/i);
    } finally {
      server.close();
    }
  });

  test('Credenciales SMTP incorrectas hacen fallar el envío (la cola lo reintenta)', async () => {
    const { server, received, port } = await startSmtpServer();
    try {
      const transport = createSmtpTransport({ SMTP_HOST: '127.0.0.1', SMTP_PORT: String(port), SMTP_USER: 'carm', SMTP_PASS: 'incorrecta' });
      const message = buildPasswordResetEmail({ name: 'Dr. X', resetUrl: 'https://cursos.carm.test/restablecer?token=t' });
      await expect(transport.sendMail({ from: 'a@carm.test', to: 'x@hospital.org', ...message })).rejects.toThrow();
      expect(received).toHaveLength(0);
    } finally {
      server.close();
    }
  });
});
