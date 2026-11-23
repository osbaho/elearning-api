import { test, expect } from '@playwright/test';
import { performLogin } from '../helpers/loginHelper.js';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test-admin-password';

test.describe('Admin Quality of Life (QoL) & Institutional Audit Tools', () => {

  test('Admin downloads official Cohort Acta PDF (Grade Book) with institutional validation', async ({ page, request }) => {
    // 1. Obtener token de administrador
    const loginRes = await request.post('http://localhost:5000/api/login', {
      data: { email: 'admin@admin.com', password: ADMIN_PASSWORD }
    });
    const { token: adminToken } = await loginRes.json();

    // 2. Descargar Acta Colectiva de Promoción 1
    const actaRes = await request.get('http://localhost:5000/api/admin/cohort-acta/Promoción 1', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    expect(actaRes.status()).toBe(200);
    expect(actaRes.headers()['content-type']).toContain('application/pdf');
    expect(actaRes.headers()['content-disposition']).toContain('Acta_Oficial_IES');

    const pdfBuffer = await actaRes.body();
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    expect(pdfBuffer.slice(0, 5).toString('ascii')).toBe('%PDF-');
  });

  test('Admin closes and seals cohort with immutable cryptographic SHA-256 hash', async ({ request }) => {
    const loginRes = await request.post('http://localhost:5000/api/login', {
      data: { email: 'admin@admin.com', password: ADMIN_PASSWORD }
    });
    const { token: adminToken } = await loginRes.json();

    const uniqueCohort = `Promoción Sello ${Date.now()}`;

    // Registrar estudiante en esta cohorte para tener datos
    await request.post('http://localhost:5000/api/admin/students', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        name: 'Dra. Elena Navarro',
        email: `elena.navarro_${Date.now()}@hospital.org`,
        cohort: uniqueCohort,
        id_number: '12345678',
        institution: 'Hospital Militar Central'
      }
    });

    // Cerrar y sellar la cohorte
    const closeRes = await request.post(`http://localhost:5000/api/admin/cohorts/${encodeURIComponent(uniqueCohort)}/close`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    expect(closeRes.status()).toBe(200);
    const closeJson = await closeRes.json();
    expect(closeJson.success).toBe(true);
    expect(closeJson.cohortName).toBe(uniqueCohort);
    expect(closeJson.sealHash).toBeDefined();
    expect(closeJson.sealHash.length).toBe(64); // SHA-256 en hexadecimal

    // Intentar cerrar nuevamente debe responder 409 Conflict
    const secondCloseRes = await request.post(`http://localhost:5000/api/admin/cohorts/${encodeURIComponent(uniqueCohort)}/close`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(secondCloseRes.status()).toBe(409);

    // Consultar cohorts y verificar que esté marcado como cerrado
    const cohortsRes = await request.get('http://localhost:5000/api/admin/cohorts', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const cohortsJson = await cohortsRes.json();
    const closedCohortObj = cohortsJson.cohorts.find(c => c.name === uniqueCohort);
    expect(closedCohortObj).toBeDefined();
    expect(closedCohortObj.isClosed).toBe(true);
    expect(closedCohortObj.sealHash).toBe(closeJson.sealHash);
  });

  test('Admin resends induction email and guide with automatic email_logs tracking', async ({ request }) => {
    const loginRes = await request.post('http://localhost:5000/api/login', {
      data: { email: 'admin@admin.com', password: ADMIN_PASSWORD }
    });
    const { token: adminToken } = await loginRes.json();

    const studentEmail = `student.resend_${Date.now()}@ies.edu.co`;
    const createRes = await request.post('http://localhost:5000/api/admin/students', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        name: 'Dr. Fernando Castro',
        email: studentEmail,
        cohort: 'Promoción 1'
      }
    });
    const { student } = await createRes.json();

    // Reenviar correo de inducción
    const resendRes = await request.post(`http://localhost:5000/api/admin/resend-email/${student.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(resendRes.status()).toBe(200);
    const resendJson = await resendRes.json();
    expect(resendJson.success).toBe(true);

    // Verificar en email_logs que existan 2 registros (el de creación y el de reenvío)
    const logsRes = await request.get(`http://localhost:5000/api/admin/email-logs?studentId=${student.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const logsJson = await logsRes.json();
    expect(logsJson.logs.length).toBeGreaterThanOrEqual(2);
  });

  test('Admin detects student in academic lag (rezago) and dispatches reminder email', async ({ page, request }) => {
    const loginRes = await request.post('http://localhost:5000/api/login', {
      data: { email: 'admin@admin.com', password: ADMIN_PASSWORD }
    });
    const { token: adminToken } = await loginRes.json();

    const laggingEmail = `student.lagging_${Date.now()}@clinica.edu.co`;
    const createRes = await request.post('http://localhost:5000/api/admin/students', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        name: 'Dra. Mónica Delgado',
        email: laggingEmail,
        cohort: 'Promoción 1',
        start_date: '2026-09-01' // Hace más de 30 días
      }
    });
    const { student } = await createRes.json();

    // Enviar recordatorio académico anti-rezago
    const reminderRes = await request.post(`http://localhost:5000/api/admin/send-reminder/${student.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(reminderRes.status()).toBe(200);
    const reminderJson = await reminderRes.json();
    expect(reminderJson.success).toBe(true);

    // Verificar en email_logs que figure el recordatorio
    const logsRes = await request.get(`http://localhost:5000/api/admin/email-logs?studentId=${student.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const logsJson = await logsRes.json();
    const reminderLog = logsJson.logs.find(l => l.subject.includes('Recordatorio Académico'));
    expect(reminderLog).toBeDefined();

    // En la interfaz administrativa debe figurar el badge de rezago
    await performLogin(page, 'admin@admin.com', ADMIN_PASSWORD, false);
    await expect(page).toHaveURL(/\/admin/);

    const studentRow = page.locator(`tr[data-student-email="${laggingEmail}"]`);
    await expect(studentRow).toBeVisible();
    await expect(studentRow).toContainText('Rezago (+7d)');
    await expect(studentRow.locator('button:has-text("Recordatorio")')).toBeVisible();
  });

});
