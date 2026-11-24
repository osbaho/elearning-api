import { test, expect } from '@playwright/test';
import { API, ADMIN_PASSWORD, adminSession, ensureCohort, enrollStudent, newApiContext, uniqueSuffix } from '../helpers/adminHelper.js';
import { performLogin } from '../helpers/loginHelper.js';
import { completeStep } from '../helpers/simulatorHelper.js';

/** Estudiante con sesión (creado o reiniciado por test-reset), para darle actividad real. */
async function activeStudent(email, password, reset = {}) {
  const ctx = await newApiContext();
  const res = await ctx.post(`${API}/test-reset`, { data: { email, password, reserve_points: 0, ...reset } });
  const { studentId } = await res.json();
  expect((await ctx.post(`${API}/login`, { data: { email, password } })).ok()).toBe(true);
  return { ctx, id: studentId };
}

async function progressRow(admin, email) {
  const body = await (await admin.get(`/admin/progress?search=${encodeURIComponent(email)}`)).json();
  return body.students.find((s) => s.email === email);
}

test.describe('Estudiantes de prueba', () => {
  test('No cuentan en promociones, seguimiento ni CSV, y sus certificados no se verifican', async () => {
    const id = uniqueSuffix();
    const cohort = `Pruebas E2E ${id}`;
    const realEmail = `real_${id}@test.com`;
    const testEmail = `prueba_${id}@test.com`;
    const admin = await adminSession();
    try {
      await ensureCohort(admin, { name: cohort });
      await enrollStudent(admin, { name: 'Dra. Real', email: realEmail, cohort });
      const enrolled = await enrollStudent(admin, { name: 'Dr. De Prueba', email: testEmail, cohort, isTest: true });
      expect(enrolled.student.isTest).toBe(true);

      const listing = await (await admin.get(`/admin/students?search=${encodeURIComponent(testEmail)}`)).json();
      expect(listing.students[0]).toMatchObject({ email: testEmail, isTest: true });

      // Promociones: solo cuenta al real
      const { cohorts } = await (await admin.get('/admin/cohorts')).json();
      expect(cohorts.find((c) => c.name === cohort).total_students).toBe(1);

      // Seguimiento: los dos aparecen; el resumen solo cuenta al real
      const tracking = await (await admin.get(`/admin/progress?cohort=${encodeURIComponent(cohort)}`)).json();
      expect(tracking.students.map((s) => [s.email, s.isTest]).sort()).toEqual([[realEmail, false], [testEmail, true]].sort());
      expect(tracking.summary).toMatchObject({ students: 1, testStudents: 1 });

      // CSV de auditoría sin el estudiante de prueba
      const csv = await (await admin.get(`/admin/export-audit?cohort=${encodeURIComponent(cohort)}`)).text();
      expect(csv).toContain(realEmail);
      expect(csv).not.toContain(testEmail);

      // Certificado: un estudiante real aprobado; su estado se copia a la cuenta de prueba
      const source = await activeStudent(`aprobado_${id}@test.com`, 'Aprobado2026!', { pass_exam: true, exam_score: 95 });
      await source.ctx.dispose();
      const copy = await admin.post(`/admin/students/${enrolled.student.id}/test-tools/copy-from`, { sourceStudentId: source.id });
      expect(copy.status()).toBe(200);
      expect((await copy.json()).copied.examPassed).toBe(true);

      const realCert = await admin.get(`/admin/certificate/${source.id}`);
      const realCode = realCert.headers()['x-verification-code'];
      const testCert = await admin.get(`/admin/certificate/${enrolled.student.id}`);
      expect(testCert.status()).toBe(200);
      const testCode = testCert.headers()['x-verification-code'];
      expect(testCode).toBeTruthy();
      expect(testCode).not.toBe(realCode);
      expect((await admin.get(`/verify/${realCode}`)).status()).toBe(200);
      const verifyTest = await admin.get(`/verify/${testCode}`);
      expect(verifyTest.status()).toBe(404);

      // El sello de la promoción tampoco lo cuenta
      const sealed = await admin.post(`/admin/cohorts/${encodeURIComponent(cohort)}/close`, {});
      expect(sealed.status()).toBe(200);
      expect((await sealed.json()).totalStudents).toBe(1);
    } finally {
      await admin.dispose();
    }
  });

  test('Herramientas: llevar a un paso, copiar el estado y reiniciar, solo para cuentas de prueba y con bitácora', async () => {
    const id = uniqueSuffix();
    const admin = await adminSession();
    try {
      const real = await enrollStudent(admin, { name: 'Dra. Real Herramientas', email: `real_tools_${id}@test.com` });
      const testStudent = await enrollStudent(admin, { name: 'Dr. Prueba Herramientas', email: `prueba_tools_${id}@test.com`, isTest: true });
      const testId = testStudent.student.id;
      const testEmail = testStudent.student.email;

      // Con un estudiante real no se pueden usar
      const refused = await admin.post(`/admin/students/${real.student.id}/test-tools/jump`, { stepId: 'm2_v1' });
      expect(refused.status()).toBe(409);
      expect((await refused.json()).code).toBe('NOT_A_TEST_STUDENT');
      expect((await admin.post(`/admin/students/${testId}/test-tools/jump`, { stepId: 'm9_x' })).status()).toBe(400);

      // Llevar al inicio del módulo 2
      const jump = await admin.post(`/admin/students/${testId}/test-tools/jump`, { stepId: 'm2_v1' });
      expect(jump.status()).toBe(200);
      expect((await jump.json()).completedSteps).toBe(6);
      expect(await progressRow(admin, testEmail)).toMatchObject({ completedSteps: 6, currentStep: 'm2_v1' });

      // Copiar el estado de un estudiante real con actividad (video y una partida perfecta)
      const source = await activeStudent(`origen_${id}@test.com`, 'Origen2026!');
      await completeStep(source.ctx, 'm1_v1');
      await completeStep(source.ctx, 'm1_s1');
      await source.ctx.dispose();
      const copy = await admin.post(`/admin/students/${testId}/test-tools/copy-from`, { sourceEmail: `origen_${id}@test.com` });
      expect(copy.status()).toBe(200);
      expect((await copy.json()).copied).toMatchObject({ steps: 2, attempts: 1, examPassed: false });
      const copied = await progressRow(admin, testEmail);
      expect(copied).toMatchObject({ completedSteps: 2, currentStep: 'm1_v2', reservePoints: 10 });
      expect(copied.minigames.m1_s1).toMatchObject({ attempts: 1, bestTier: 'perfect', completed: true });
      // El origen no cambia
      expect(await progressRow(admin, `origen_${id}@test.com`)).toMatchObject({ completedSteps: 2, reservePoints: 10 });

      // Reiniciar
      expect((await admin.post(`/admin/students/${testId}/test-tools/reset`, { reason: 'Caso reproducido' })).status()).toBe(200);
      expect(await progressRow(admin, testEmail)).toMatchObject({ completedSteps: 0, reservePoints: 0, currentStep: 'm1_v1' });

      // Todo queda en la bitácora
      const { actions } = await (await admin.get(`/admin/actions?targetType=student&targetId=${testId}`)).json();
      const kinds = actions.map((a) => a.action);
      expect(kinds).toEqual(expect.arrayContaining(['test.jump', 'test.copy_from', 'test.reset']));
      expect(actions.find((a) => a.action === 'test.reset').reason).toBe('Caso reproducido');

      // Se puede desmarcar y volver a marcar como prueba (queda en la bitácora)
      const unmark = await admin.patch(`/admin/students/${testId}`, { isTest: false, reason: 'Era una cuenta real' });
      expect((await unmark.json()).student.isTest).toBe(false);
      expect((await admin.post(`/admin/students/${testId}/test-tools/reset`)).status()).toBe(409);
      await admin.patch(`/admin/students/${testId}`, { isTest: true });
    } finally {
      await admin.dispose();
    }
  });

  test('En el panel: marca de prueba, indicadores sin ella y herramientas en «Gestionar»', async ({ page }) => {
    test.setTimeout(90000);
    const id = uniqueSuffix();
    const admin = await adminSession();
    const enrolled = await enrollStudent(admin, { name: 'Dra. Prueba Panel', email: `prueba_panel_${id}@test.com`, isTest: true });
    await admin.dispose();
    const testId = enrolled.student.id;

    await performLogin(page, 'admin@admin.com', ADMIN_PASSWORD, false);
    await page.goto('/admin');
    await expect(page.locator('#reg-input-is-test')).toHaveCount(0); // el formulario está cerrado
    await page.fill('#input-admin-search', `prueba_panel_${id}@test.com`);
    const row = page.locator(`tr[data-student-id="${testId}"]`);
    await expect(row).toHaveAttribute('data-test-student', 'true', { timeout: 15000 });
    await expect(row).toContainText('🧪 Prueba');
    await expect(page.locator('#stat-total-students')).toHaveText('0');
    await expect(page.locator('#stat-test-students')).toContainText('+1 de prueba');

    await page.click(`#btn-manage-${testId}`);
    await expect(page.locator('#test-tools')).toBeVisible();
    await expect(page.locator('#manage-test-badge')).toBeVisible();
    await page.selectOption('#test-jump-step', 'm1_s2');
    await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/admin/students/${testId}/test-tools/jump`) && r.status() === 200),
      page.click('#btn-test-jump'),
    ]);

    const check = await adminSession();
    const row2 = await progressRow(check, `prueba_panel_${id}@test.com`);
    await check.dispose();
    expect(row2).toMatchObject({ completedSteps: 3, currentStep: 'm1_s2', isTest: true });

    // El formulario de matrícula ofrece crear cuentas de prueba
    await page.keyboard.press('Escape');
    await page.goto('/admin');
    await page.click('#btn-register-student-modal');
    await expect(page.locator('#reg-input-is-test')).toBeVisible();
  });
});
