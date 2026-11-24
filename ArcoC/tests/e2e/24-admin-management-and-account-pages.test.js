import { test, expect } from '@playwright/test';
import { performLogin } from '../helpers/loginHelper.js';
import {
  API, ADMIN_PASSWORD, adminSession, newApiContext, ensureCohort, enrollStudent, tokenFromUrl, uniqueSuffix, isoDay,
} from '../helpers/adminHelper.js';

// Fase 1 (interfaz): páginas públicas de activación y recuperación, y gestión de promociones,
// estudiantes e importación desde el panel del administrador.
test.describe('Páginas de acceso y gestión del administrador', () => {
  let admin;
  test.beforeAll(async () => { admin = await adminSession(); });
  test.afterAll(async () => { await admin.dispose(); });

  test('El estudiante activa su cuenta desde el enlace del correo y llega al registro biométrico', async ({ page }) => {
    const id = uniqueSuffix();
    const email = `ui.activa.${id}@hospital.org`;
    const enrolled = await enrollStudent(admin, { name: 'Dra. Lucía Enlace', email, cohort: 'Promoción 1' });

    await page.goto(`/activar?token=${encodeURIComponent(tokenFromUrl(enrolled.activationUrl))}`);
    await expect(page.locator('h1')).toContainText('Activa tu cuenta');
    await expect(page.locator('#set-password-form')).toContainText('Lucía');
    await expect(page.locator('#set-password-form')).toContainText('@hospital.org');

    // Validaciones en el formulario antes de llamar al API
    await page.fill('#new-password', 'ClaveSegura2026');
    await page.fill('#confirm-password', 'OtraCosa2026');
    await page.click('#btn-set-password');
    await expect(page.locator('#set-password-error')).toContainText('no coinciden');

    await page.fill('#confirm-password', 'ClaveSegura2026');
    await page.click('#btn-set-password');
    await page.waitForURL('**/onboarding', { timeout: 15000 });
  });

  test('Un enlace inválido o ya usado explica qué hacer', async ({ page }) => {
    await page.goto('/activar?token=este-enlace-no-existe-0123456789abcdef');
    await expect(page.locator('#token-error')).toContainText('no es válido');
    await expect(page.locator('#token-error a[href="/recuperar"]')).toBeVisible();

    await page.goto('/restablecer');
    await expect(page.locator('#token-error')).toContainText('Falta el código');
  });

  test('«¿Olvidaste tu contraseña?» y restablecer desde el enlace, de punta a punta', async ({ page }) => {
    const id = uniqueSuffix();
    const email = `ui.olvido.${id}@hospital.org`;
    const enrolled = await enrollStudent(admin, { name: 'Dr. Mario Olvido', email, cohort: 'Promoción 1' });
    const visitor = await newApiContext();
    await visitor.post(`${API}/auth/activate`, { data: { token: tokenFromUrl(enrolled.activationUrl), password: 'PrimeraClave1' } });
    await visitor.dispose();

    await page.goto('/login');
    await page.click('#link-forgot-password');
    await page.waitForURL('**/recuperar');
    await page.fill('#forgot-email', email);
    await page.click('#btn-forgot-submit');
    await expect(page.locator('#forgot-result')).toContainText('Si el correo está registrado');

    // El enlace llega por correo; aquí se toma uno equivalente generado por el admin
    const link = await (await admin.post(`/admin/students/${enrolled.student.id}/access-link`, { sendEmail: false })).json();
    await page.goto(`/restablecer?token=${encodeURIComponent(tokenFromUrl(link.url))}`);
    await expect(page.locator('h1')).toContainText('nueva contraseña');
    await page.fill('#new-password', 'NuevaClave2027');
    await page.fill('#confirm-password', 'NuevaClave2027');
    await page.click('#btn-set-password');
    await expect(page.locator('#set-password-success')).toContainText('contraseña se actualizó');

    await page.click('#set-password-success a[href="/login"]');
    await page.fill('#email', email);
    await page.fill('#password', 'NuevaClave2027');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(course|onboarding)/);
  });

  test('Una cuenta desactivada ve el motivo al intentar entrar', async ({ page }) => {
    const id = uniqueSuffix();
    const email = `ui.desactivada.${id}@hospital.org`;
    const enrolled = await enrollStudent(admin, { name: 'Dr. Sin Acceso', email, cohort: 'Promoción 1' });
    const visitor = await newApiContext();
    await visitor.post(`${API}/auth/activate`, { data: { token: tokenFromUrl(enrolled.activationUrl), password: 'ClaveSegura2026' } });
    await visitor.dispose();
    await admin.post(`/admin/students/${enrolled.student.id}/deactivate`, { reason: 'Suspensión académica' });

    await page.goto('/login');
    await page.fill('#email', email);
    await page.fill('#password', 'ClaveSegura2026');
    await page.click('button[type="submit"]');
    await expect(page.locator('#login-error')).toContainText('desactivada');
  });

  test('Con la promoción cerrada el curso queda en modo consulta y lo avisa', async ({ page }) => {
    const closed = await ensureCohort(admin, { name: `UI Cerrada ${uniqueSuffix()}`, startsOn: isoDay(-90), endsOn: isoDay(-3) });
    await admin.post('/test-reset', { email: 'student@test.com', password: 'student123', cohort: closed.name });
    await page.addInitScript(() => localStorage.setItem('tour_completed_arco', 'true'));
    await performLogin(page, 'student@test.com', 'student123', false);
    await page.goto('/course');
    await expect(page.locator('#access-closed-banner')).toContainText('Tu promoción cerró');
    await admin.post('/test-reset', { email: 'student@test.com', password: 'student123' });
  });

  test('Promociones desde el panel: crear con fechas y editar el cierre', async ({ page }) => {
    const name = `Panel ${uniqueSuffix()}`;
    await performLogin(page, 'admin@admin.com', ADMIN_PASSWORD, false);
    await page.click('#btn-open-cohorts');
    const modal = page.locator('#cohort-manager-modal');
    await expect(modal).toBeVisible();

    await page.fill('#cohort-form-name', name);
    await page.fill('#cohort-form-starts', '2026-01-10');
    await page.fill('#cohort-form-ends', '2027-03-31');
    await page.click('#btn-create-cohort');
    const row = modal.locator(`tr[data-cohort-name="${name}"]`);
    await expect(row).toContainText('10/01/2026');
    await expect(row).toContainText('31/03/2027');

    await row.locator('button', { hasText: 'Editar' }).click();
    await row.locator('input[type="date"]').nth(1).fill('2027-06-30');
    await row.locator('button', { hasText: 'Guardar' }).click();
    await expect(row).toContainText('30/06/2027');
  });

  test('Gestionar estudiante: editar datos, cambiar de promoción, desactivar y reactivar con historial', async ({ page }) => {
    const id = uniqueSuffix();
    const target = await ensureCohort(admin, { name: `Destino ${id}` });
    const email = `ui.gestion.${id}@hospital.org`;
    const enrolled = await enrollStudent(admin, { name: 'Dra. Gestión Completa', email, cohort: 'Promoción 1' });

    await performLogin(page, 'admin@admin.com', ADMIN_PASSWORD, false);
    await page.fill('#input-admin-search', email);
    const row = page.locator(`tr[data-student-email="${email}"]`);
    await expect(row).toBeVisible();
    await expect(row).toHaveAttribute('data-account-status', 'pending');
    await expect(row).toContainText('Pendiente de activación');

    await page.click(`#btn-manage-${enrolled.student.id}`);
    const modal = page.locator('#student-manage-modal');
    await expect(modal).toBeVisible();
    await page.fill('#manage-input-institution', 'Hospital de Prueba Fase 1');
    await page.selectOption('#manage-select-cohort', target.name);
    await page.fill('#manage-input-reason', 'Traslado de grupo solicitado');
    await page.click('#btn-save-student');
    await expect(modal.locator('#manage-history')).toContainText('Cambió de promoción');
    await expect(modal.locator('#manage-history')).toContainText('Traslado de grupo solicitado');

    // Enlace de acceso: la cuenta no está activada → activación
    await page.click('#btn-access-link');
    await expect(page.locator('#access-link-url')).toHaveValue(/\/activar\?token=/);

    await page.fill('#manage-deactivate-reason', 'Inasistencia prolongada');
    await page.click('#btn-deactivate-student');
    await expect(page.locator('#manage-account-status')).toHaveText('Desactivada');
    await expect(page.locator('#manage-deactivation-info')).toContainText('Inasistencia prolongada');

    await page.click('#btn-reactivate-student');
    await expect(page.locator('#manage-account-status')).toHaveText('Pendiente de activación');
    await expect(modal.locator('#manage-history')).toContainText('Desactivó la cuenta');
    await expect(modal.locator('#manage-history')).toContainText('Reactivó la cuenta');

    // La bitácora general registra las mismas acciones
    await modal.locator('.modal-footer button', { hasText: 'Cerrar' }).click();
    await page.click('#btn-open-admin-actions');
    const actions = page.locator('#admin-actions-modal');
    await expect(actions).toContainText('Inasistencia prolongada');
    await expect(actions.locator('tr[data-action="student.move_cohort"]').first()).toBeVisible();
  });

  test('Importar estudiantes desde el panel: vista previa con errores y matrícula de las filas válidas', async ({ page }) => {
    const id = uniqueSuffix();
    const cohort = await ensureCohort(admin, { name: `UI Import ${id}` });
    const csv = [
      'nombre;correo;tipo_documento;numero_documento;institucion',
      `Dra. Primera;primera.${id}@hospital.org;CC;201;Hospital A`,
      `Dr. Segundo;segundo.${id}@hospital.org;CE;E202;Hospital B`,
      'Sin Correo;;CC;203;Hospital C',
    ].join('\n');

    await performLogin(page, 'admin@admin.com', ADMIN_PASSWORD, false);
    await page.click('#btn-open-import');
    await page.selectOption('#import-select-cohort', cohort.name);
    await page.setInputFiles('#import-file', { name: 'estudiantes.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') });
    await page.click('#btn-import-validate');
    await expect(page.locator('#import-summary')).toContainText('2 válidas');
    await expect(page.locator('tr[data-import-status="error"]')).toHaveCount(1);

    await page.click('#btn-import-commit');
    await expect(page.locator('#import-result')).toContainText('2 matriculados');
    const { students } = await (await admin.get(`/admin/students?cohort=${encodeURIComponent(cohort.name)}`)).json();
    expect(students.map((s) => s.email).sort()).toEqual([`primera.${id}@hospital.org`, `segundo.${id}@hospital.org`]);
  });

  test('El filtro por estado de la cuenta muestra solo las pendientes de activación', async ({ page }) => {
    await enrollStudent(admin, { name: 'Dr. Pendiente', email: `ui.pendiente.${uniqueSuffix()}@hospital.org`, cohort: 'Promoción 1' });
    await performLogin(page, 'admin@admin.com', ADMIN_PASSWORD, false);
    await page.selectOption('#select-status-filter', 'pending');
    const rows = page.locator('tr[data-student-id]');
    await expect(rows.first()).toBeVisible();
    const statuses = await rows.evaluateAll((trs) => trs.map((tr) => tr.getAttribute('data-account-status')));
    expect(new Set(statuses)).toEqual(new Set(['pending']));
  });
});
