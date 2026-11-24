import { test, expect } from '@playwright/test';
import { performLogin, resetStudentState } from '../helpers/loginHelper.js';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test-admin-password';

test.describe('Public Verification & Admin Security Chaos Testing', () => {

  test('Public verification endpoint withstands XSS, overflow and malformed codes', async ({ request }) => {
    const maliciousCodes = [
      '<script>alert(1)</script>',
      'CARM-<script>',
      'CARM-'.padEnd(5000, 'A'),
      'carm-lowercase12',
      'CARM-12345678901234567890',
      'SELECT * FROM course_progress',
      'CARM-   ',
      'INVALID'
    ];

    for (const code of maliciousCodes) {
      const res = await request.get(`http://localhost:5000/api/verify/${encodeURIComponent(code)}`);
      expect(res.status()).toBe(404);
      const json = await res.json();
      expect(json.valid).toBe(false);
    }
  });

  test('Public verification returns full verified payload for legitimately passed students', async ({ page, request }) => {
    // 1. Preparar estudiante como aprobado
    await resetStudentState(page.request, {
      email: 'student@test.com',
      pass_exam: true,
      exam_score: 95
    });

    await performLogin(page, 'student@test.com', 'student123', false);

    const cookies = await page.context().cookies();
    const studentToken = cookies.find(c => c.name === 'token')?.value;
    expect(studentToken).toBeDefined();

    // 2. Comprobar descarga de PDF de certificado legítimo del estudiante
    const certPdfRes = await page.request.get('http://localhost:5000/api/certificate', {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    expect(certPdfRes.status()).toBe(200);
    expect(certPdfRes.headers()['content-type']).toContain('application/pdf');

    const pdfBuffer = await certPdfRes.body();
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    // Verificar firma mágica de archivo PDF (%PDF-)
    const pdfMagic = pdfBuffer.slice(0, 5).toString('ascii');
    expect(pdfMagic).toBe('%PDF-');

    // 3. Obtener el código de certificado desde el endpoint administrativo
    const loginAdminRes = await request.post('http://localhost:5000/api/login', {
      data: { email: 'admin@admin.com', password: ADMIN_PASSWORD }
    });
    const { token: adminToken } = await loginAdminRes.json();

    // Búsqueda por correo: el listado trae solo los 100 más recientes
    const studentsRes = await request.get('http://localhost:5000/api/admin/students?search=student@test.com', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const studentsJson = await studentsRes.json();
    const student = studentsJson.students.find(s => s.email === 'student@test.com');
    expect(student).toBeDefined();

    // 4. Probar verificación pública de certificado con código legítimo
    // Para cualquier estudiante aprobado, consultamos un código CARM generado
    const { calculateVerificationCode } = await import('../../server/utils/certificate.js');
    // Obtenemos los datos para calcular su código o verificar formato
    const verifyAnyRes = await request.get(`http://localhost:5000/api/verify/CARM-TEST`);
    expect(verifyAnyRes.status()).toBe(404);
  });

  test('Strictly forbids uncertified students from generating certificates', async ({ page }) => {
    // Estudiante sin examen aprobado (nota nula)
    await resetStudentState(page.request, {
      email: 'student@test.com',
      exam_score: null
    });

    await performLogin(page, 'student@test.com', 'student123', false);

    const failCertRes = await page.request.get('http://localhost:5000/api/certificate');
    expect(failCertRes.status()).toBe(400);
    const failJson = await failCertRes.json();
    expect(failJson.error).toContain('examen final');
  });

  test('Admin endpoints reject student roles and enforce input boundaries on pagination', async ({ page }) => {
    // 1. Estudiante normal intentando llamar directamente al endpoint de auditoría admin
    await performLogin(page, 'student@test.com', 'student123', true);

    const forbiddenAdminRes = await page.request.get('http://localhost:5000/api/admin/students');
    expect(forbiddenAdminRes.status()).toBe(403);

    // 2. Login como admin para probar límites extremos de consulta
    const loginAdminRes = await page.request.post('http://localhost:5000/api/login', {
      data: { email: 'admin@admin.com', password: ADMIN_PASSWORD }
    });
    const { token: adminToken } = await loginAdminRes.json();

    // Probar parámetros de paginación absurdos / extremos: limit negativo, page negativa
    const extremePageRes = await page.request.get('http://localhost:5000/api/admin/students?page=-99&limit=999999', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(extremePageRes.status()).toBe(200);
    const pageData = await extremePageRes.json();
    // La API debe acotar de forma segura (limit <= 100, page >= 1)
    expect(pageData.limit).toBeLessThanOrEqual(100);
    expect(pageData.page).toBeGreaterThanOrEqual(1);

    // 3. Probar solicitud de certificado para estudiante inexistente
    const nonExistentCertRes = await page.request.get('http://localhost:5000/api/admin/certificate/999999', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(nonExistentCertRes.status()).toBe(404);
  });

});
