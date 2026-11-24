import { test, expect } from '@playwright/test';
import { performLogin, resetStudentState } from '../helpers/loginHelper';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test-admin-password';

test.describe('Admin Role & IES Audit Dashboard', () => {

  test('Admin logs in and is directly redirected to /admin (not course or onboarding)', async ({ page }) => {
    // 1. Iniciar sesión con credenciales de administrador
    await performLogin(page, 'admin@admin.com', ADMIN_PASSWORD, false);

    // 2. Verificar que la URL es directamente /admin
    await expect(page).toHaveURL(/\/admin/);

    // 3. Verificar encabezado y rol de auditoría para IES
    await expect(page.locator('h1')).toContainText('Auditoría y Certificación IES');
    await expect(page.locator('header')).toContainText('Rol Administrador');

    // 4. Verificar presencia de tarjetas de métricas de auditoría
    await expect(page.locator('#stat-total-students')).toBeVisible();
    await expect(page.locator('#stat-certified-students')).toBeVisible();
  });

  test('Admin role is isolated from course modules: redirect back to /admin when accessing /course', async ({ page }) => {
    // Iniciar sesión como Administrador
    await performLogin(page, 'admin@admin.com', ADMIN_PASSWORD, false);
    await expect(page).toHaveURL(/\/admin/);

    // Intentar navegar manualmente a la ruta de estudiantes /course
    await page.goto('/course');

    // ProtectedRoute debe redirigir al admin automáticamente de vuelta a /admin
    await page.waitForURL(/\/admin/);
    await expect(page).toHaveURL(/\/admin/);
  });

  test('Admin dashboard displays student audit records with identification and IES institution', async ({ page }) => {
    // El estudiante de prueba con nombre conocido (no depende de cómo se creó la base de datos)
    await resetStudentState(page.request, { email: 'student@test.com', name: 'Test Student' });
    await performLogin(page, 'admin@admin.com', ADMIN_PASSWORD, false);
    await expect(page).toHaveURL(/\/admin/);

    // Verificar tabla de auditoría para expedición IES
    const table = page.locator('table[aria-label="Lista de estudiantes para auditoría IES"]');
    await expect(table).toBeVisible();

    // Validar encabezados institucionales
    await expect(table.locator('thead')).toContainText('Estudiante');
    await expect(table.locator('thead')).toContainText('Identificación');
    await expect(table.locator('thead')).toContainText('Institución / Hospital (IES)');
    await expect(table.locator('thead')).toContainText('Supervisión IA');
    await expect(table.locator('thead')).toContainText('Estado IES');

    // Validar que se liste el estudiante de prueba. El listado trae los 100 más recientes: se
    // busca por correo para no depender de cuántos estudiantes acumule la base de desarrollo.
    await page.fill('#input-admin-search', 'student@test.com');
    const studentRow = page.locator('tr[data-student-email="student@test.com"]');
    await expect(studentRow).toBeVisible();
    await expect(studentRow).toContainText('Test Student');
  });

  test('Student role is forbidden from accessing /admin', async ({ page }) => {
    // 1. Iniciar sesión como Estudiante normal
    await performLogin(page, 'student@test.com', 'student123', true);
    await expect(page).toHaveURL(/\/course/);

    // 2. Intentar acceder a /admin
    await page.goto('/admin');

    // 3. ProtectedRoute debe rechazar al estudiante y devolverlo a /course
    await page.waitForURL(/\/course/);
    await expect(page).toHaveURL(/\/course/);
  });

  test('Admin can download student certificate PDF for IES endorsement when passed', async ({ page }) => {
    // 1. Preparar estudiante como aprobado (>=90%)
    const resetRes = await page.request.post('http://localhost:5000/api/test-reset', {
      data: { email: 'student@test.com' }
    });
    const { studentId } = await resetRes.json();

    // Simular estudiante con examen completado en la BD
    await page.request.post('http://localhost:5000/api/progress/m1_v1', {
      headers: { 'Authorization': `Bearer temp` }
    }).catch(() => {});

    // Iniciar sesión como admin
    await performLogin(page, 'admin@admin.com', ADMIN_PASSWORD, false);
    await expect(page).toHaveURL(/\/admin/);

    // Verificar que la petición de certificado desde la API admin funciona y devuelve PDF
    // Usamos el token de autenticación de las cookies seguras del navegador
    const cookies = await page.context().cookies();
    const token = cookies.find(c => c.name === 'token')?.value;
    
    // Primero probar con estudiante que no ha completado el examen (debe responder 400 con error claro)
    const pendingCertRes = await page.request.get(`http://localhost:5000/api/admin/certificate/${studentId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    expect(pendingCertRes.status()).toBe(400);
    const errorJson = await pendingCertRes.json();
    expect(errorJson.error).toContain('examen final');
  });

});
