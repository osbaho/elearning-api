import { test, expect } from '@playwright/test';
import { performLogin } from '../helpers/loginHelper.js';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test-admin-password';

test.describe('Admin Cohorts Management, Automated Induction Email & IES Compliance Standard', () => {

  test('Admin registers students in distinct Promociones (Cohorts) with auto email dispatch', async ({ page, request }) => {
    // 1. Iniciar sesión como Administrador
    await performLogin(page, 'admin@admin.com', ADMIN_PASSWORD, false);
    await expect(page).toHaveURL(/\/admin/);

    // Las promociones son entidades: «Promoción 2» debe existir para elegirla en el formulario
    // (en una base nueva no existe; si ya existe, la API responde 409 y no pasa nada)
    const ensureCohort = await page.request.post('http://localhost:5000/api/admin/cohorts', { data: { name: 'Promoción 2' } });
    expect([201, 409]).toContain(ensureCohort.status());
    await page.reload();

    // 2. Abrir modal de registro de nuevo estudiante
    const registerBtn = page.locator('#btn-register-student-modal');
    await expect(registerBtn).toBeVisible();
    await registerBtn.click();

    // 3. Completar formulario para Estudiante 1 en Promoción 1
    const uniqueEmail1 = `estudiante.p1_${Date.now()}@hospital.org`;
    await page.fill('#reg-input-name', 'Dra. Valentina Gómez');
    await page.fill('#reg-input-email', uniqueEmail1);
    await page.selectOption('#reg-select-cohort', 'Promoción 1');
    await page.fill('#reg-input-start-date', '2026-10-15');
    await page.fill('#reg-input-id-number', '1098765432');
    await page.fill('#reg-input-institution', 'Hospital Universitario San Rafael');
    // Sin contraseña: el estudiante la crea con su enlace de activación

    // Enviar registro
    await page.click('#btn-submit-registration');

    // Toast de confirmación debe aparecer
    await expect(page.locator('.toast').first()).toContainText('matriculado en "Promoción 1"');

    // 4. Registrar Estudiante 2 en Promoción 2
    await registerBtn.click();
    const uniqueEmail2 = `estudiante.p2_${Date.now()}@clinica.edu.co`;
    await page.fill('#reg-input-name', 'Dr. Mateo Restrepo');
    await page.fill('#reg-input-email', uniqueEmail2);
    await page.selectOption('#reg-select-cohort', 'Promoción 2');
    await page.fill('#reg-input-start-date', '2026-11-01');
    await page.fill('#reg-input-id-number', '1054321987');
    await page.fill('#reg-input-institution', 'Clínica Cardioquirúrgica');
    await page.click('#btn-submit-registration');

    await expect(page.locator('.toast').last()).toContainText('matriculado en "Promoción 2"');

    // 5. Verificar filtrado dinámico por pestañas de Promoción
    const pillCohort2 = page.locator('#pill-cohort-promoción-2');
    await expect(pillCohort2).toBeVisible();
    await pillCohort2.click();

    // En Promoción 2 solo debe mostrarse el Dr. Mateo Restrepo
    await expect(page.locator(`tr[data-student-email="${uniqueEmail2}"]`)).toBeVisible();
    await expect(page.locator(`tr[data-student-email="${uniqueEmail1}"]`)).not.toBeVisible();

    // Cambiar a Promoción 1
    const pillCohort1 = page.locator('#pill-cohort-promoción-1');
    await pillCohort1.click();
    await expect(page.locator(`tr[data-student-email="${uniqueEmail1}"]`)).toBeVisible();
    await expect(page.locator(`tr[data-student-email="${uniqueEmail2}"]`)).not.toBeVisible();

    // 6. Verificar auditoría de correos automáticos despachados en email_logs
    const emailLogsRes = await request.get('http://localhost:5000/api/admin/email-logs', {
      headers: {
        Cookie: (await page.context().cookies()).map(c => `${c.name}=${c.value}`).join('; ')
      }
    });
    expect(emailLogsRes.status()).toBe(200);
    const emailLogsData = await emailLogsRes.json();
    expect(emailLogsData.success).toBe(true);
    
    const emailEntry1 = emailLogsData.logs.find(l => l.recipient_email === uniqueEmail1.toLowerCase());
    expect(emailEntry1).toBeDefined();
    expect(emailEntry1.subject).toContain('Confirmación de Matrícula - Promoción 1');
    // 'sent' con SMTP configurado; 'simulated' sin SMTP (desarrollo y pruebas)
    expect(['sent', 'simulated']).toContain(emailEntry1.status);
    expect(emailEntry1.template).toBe('induction_activation');

    // El enlace de activación de la última matrícula queda a mano para el admin
    await expect(page.locator('#enrollment-banner')).toContainText(uniqueEmail2);
    await expect(page.locator('#enrollment-activation-url')).toHaveValue(/\/activar\?token=/);

    const emailEntry2 = emailLogsData.logs.find(l => l.recipient_email === uniqueEmail2.toLowerCase());
    expect(emailEntry2).toBeDefined();
    expect(emailEntry2.subject).toContain('Confirmación de Matrícula - Promoción 2');
  });

  test('IES Compliance Standard Modal clearly verifies unmet criteria for in-progress student', async ({ page }) => {
    // 1. Iniciar sesión como Admin
    await performLogin(page, 'admin@admin.com', ADMIN_PASSWORD, false);
    await expect(page).toHaveURL(/\/admin/);

    // 2. Registrar estudiante nuevo sin avances
    const registerBtn = page.locator('#btn-register-student-modal');
    await registerBtn.click();
    const inProgressEmail = `audit.inprogress_${Date.now()}@ies.edu.co`;
    await page.fill('#reg-input-name', 'Dra. Claudia Benítez');
    await page.fill('#reg-input-email', inProgressEmail);
    await page.selectOption('#reg-select-cohort', 'Promoción 1');
    await page.click('#btn-submit-registration');
    await expect(page.locator('.toast').last()).toBeVisible();

    // 3. Localizar la fila del estudiante y abrir modal de Estándar IES
    const studentRow = page.locator(`tr[data-student-email="${inProgressEmail}"]`);
    await expect(studentRow).toBeVisible();
    const evalBtn = studentRow.locator('button:has-text("Ver Estándar IES")');
    await evalBtn.click();

    // 4. Modal de verificación de conformidad institucional debe abrirse
    const modal = page.locator('.modal-dialog-large');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Auditoría de Conformidad del Estándar Institucional IES');

    // 5. El veredicto debe ser claramente NO CUMPLE EL ESTÁNDAR
    const verdict = modal.locator('#compliance-verdict-title');
    await expect(verdict).toBeVisible();
    await expect(verdict).toContainText('NO CUMPLE EL ESTÁNDAR');

    // 6. Verificar el desglose de los 6 criterios
    // Criterio 2: Culminación Curricular (debe estar en proceso 0/25)
    const critCurriculum = modal.locator('#compliance-criteria-2');
    await expect(critCurriculum).toContainText('Completitud de Módulos Curriculares');
    await expect(critCurriculum).toContainText('EN PROCESO');

    // Criterio 3: Examen (debe estar pendiente)
    const critExam = modal.locator('#compliance-criteria-3');
    await expect(critExam).toContainText('Aprobación de Evaluación Oficial');
    await expect(critExam).toContainText('PENDIENTE');

    // Criterio 6: Certificado QR Criptográfico (debe estar pendiente)
    const critCert = modal.locator('#compliance-criteria-6');
    await expect(critCert).toContainText('PENDIENTE');

    // Botón de descargar certificado no debe estar presente en el footer del estándar
    await expect(modal.locator('button:has-text("Descargar Certificado IES")')).not.toBeVisible();

    // Cerrar modal
    await modal.locator('button:has-text("Cerrar Auditoría")').click();
    await expect(modal).not.toBeVisible();
  });

  test('IES Compliance Standard Modal awards official endorsement when student fulfills all criteria', async ({ page, request }) => {
    // 1. Preparar un estudiante de prueba que cumpla con el 100% de los requisitos:
    // Biometría completa, 25 módulos completados y examen >= 90%
    const certifiedEmail = `certified.student_${Date.now()}@ies.edu.co`;

    // Registrar estudiante vía API admin
    const loginAdminRes = await request.post('http://localhost:5000/api/login', {
      data: { email: 'admin@admin.com', password: ADMIN_PASSWORD }
    });
    const { token: adminToken } = await loginAdminRes.json();

    await request.post('http://localhost:5000/api/admin/students', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        name: 'Dra. Andrea Morales',
        email: certifiedEmail,
        cohort: 'Promoción 1',
        id_number: '52987123',
        id_type: 'CC',
        institution: 'Hospital Central Militar'
      }
    });

    // Completar biometría (onboarding), 25 módulos curriculares y examen aprobado al 96%
    await page.request.post('http://localhost:5000/api/test-reset', {
      headers: {
        'x-test-secret': process.env.TEST_RESET_SECRET || 'test-reset-secret-local'
      },
      data: {
        email: certifiedEmail,
        is_onboarded: 1,
        id_number: '52987123',
        institution: 'Hospital Central Militar',
        cohort: 'Promoción 1',
        complete_course: true,
        pass_exam: true,
        exam_score: 96
      }
    });

    // 2. Iniciar sesión como Admin y consultar
    await performLogin(page, 'admin@admin.com', ADMIN_PASSWORD, false);
    await expect(page).toHaveURL(/\/admin/);

    const studentRow = page.locator(`tr[data-student-email="${certifiedEmail}"]`);
    await expect(studentRow).toBeVisible();

    // Debe mostrar badge de Aval Listo
    await expect(studentRow).toContainText('Aval Listo');

    // 3. Abrir modal de Estándar IES
    const evalBtn = studentRow.locator('button:has-text("Ver Estándar IES")');
    await evalBtn.click();

    const modal = page.locator('.modal-dialog-large');
    await expect(modal).toBeVisible();

    // 4. El veredicto debe ser CUMPLE EL ESTÁNDAR
    const verdict = modal.locator('#compliance-verdict-title');
    await expect(verdict).toContainText('CUMPLE EL ESTÁNDAR');

    // 5. Todos los 6 criterios deben estar aprobados / cumplidos
    const passBadges = modal.locator('.compliance-badge-pass');
    await expect(passBadges).toHaveCount(6);

    // Verificar presencia del código de verificación HMAC-SHA256
    await expect(modal.locator('#compliance-criteria-6')).toContainText('Código HMAC-SHA256:');

    // Botón para descargar certificado debe estar visible y habilitado
    const downloadCertBtn = modal.locator('button:has-text("Descargar Certificado IES")');
    await expect(downloadCertBtn).toBeVisible();
    await expect(downloadCertBtn).toBeEnabled();
  });

  test('Audit CSV Export contains complete cohort, curriculum, score, proctoring and certification fields', async ({ request }) => {
    // 1. Obtener token de admin
    const loginAdminRes = await request.post('http://localhost:5000/api/login', {
      data: { email: 'admin@admin.com', password: ADMIN_PASSWORD }
    });
    const { token: adminToken } = await loginAdminRes.json();

    // 2. Descargar CSV de auditoría
    const csvRes = await request.get('http://localhost:5000/api/admin/export-audit?cohort=all', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    expect(csvRes.status()).toBe(200);
    expect(csvRes.headers()['content-type']).toContain('text/csv');
    expect(csvRes.headers()['content-disposition']).toContain('attachment');
    expect(csvRes.headers()['content-disposition']).toContain('auditoria_ies');

    const csvText = await csvRes.text();
    // Validar cabeceras institucionales
    expect(csvText).toContain('ID Estudiante');
    expect(csvText).toContain('Nombre Completo');
    expect(csvText).toContain('Correo Electrónico');
    expect(csvText).toContain('Institución Hospitalaria');
    expect(csvText).toContain('Promoción (Cohorte)');
    expect(csvText).toContain('Pasos Curriculares');
    expect(csvText).toContain('Nota Examen (%)');
    expect(csvText).toContain('Incidentes de Supervisión');
    expect(csvText).toContain('Cumple Estándar IES');
    expect(csvText).toContain('Código Certificado QR');
    expect(csvText).toContain('Fecha de Certificación');
  });

});
