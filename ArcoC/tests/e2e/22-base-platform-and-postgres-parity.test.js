import { test, expect } from '@playwright/test';
import { performLogin, resetStudentState } from '../helpers/loginHelper.js';
import { completeStep } from '../helpers/simulatorHelper.js';
import { EXAM_QUESTION_COUNT, EXAM_PASS_SCORE_PERCENT, MAX_EXAM_ATTEMPTS, WILDCARD_COST } from '../../server/config/examRules.js';
import { TOTAL_COURSE_STEPS } from '../../server/config/curriculum.js';

const API = 'http://localhost:5000/api';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test-admin-password';

/** El tour de bienvenida (driver.js) cubre la página: estas pruebas lo dan por visto. */
async function skipWelcomeTour(page) {
  await page.addInitScript(() => localStorage.setItem('tour_completed_arco', 'true'));
}

async function adminToken(request) {
  await request.post(`${API}/test-reset`, {
    data: { email: 'admin@admin.com', password: ADMIN_PASSWORD },
    headers: { 'x-test-secret': process.env.TEST_RESET_SECRET || 'test-reset-secret-local' },
  });
  const res = await request.post(`${API}/login`, { data: { email: 'admin@admin.com', password: ADMIN_PASSWORD } });
  expect(res.status()).toBe(200);
  return (await res.json()).token;
}

// Estas pruebas corren igual sobre SQLite y PostgreSQL (npm run test:pg): cubren los
// fallos que solo aparecían en PostgreSQL y las reglas que antes estaban fijas en el código.
test.describe('Bases de la plataforma: esquema versionado, paridad PostgreSQL y reglas del examen', () => {

  test('El healthcheck informa el motor de base de datos y la versión de esquema aplicada', async ({ request }) => {
    const res = await request.get(`${API}/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(['sqlite', 'postgresql']).toContain(body.database);
    expect(body.schemaVersion).toBeGreaterThanOrEqual(1);
  });

  test('El código impreso en el certificado es el que valida la verificación pública', async ({ page }) => {
    await resetStudentState(page.request, { email: 'student@test.com', complete_course: true, pass_exam: true, exam_score: 95 });
    await performLogin(page, 'student@test.com', 'student123', false);

    const pdf = await page.request.get(`${API}/certificate`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()['content-type']).toContain('application/pdf');
    const code = pdf.headers()['x-verification-code'];
    expect(code).toMatch(/^CARM-[0-9A-F]{12}$/);

    const verify = await page.request.get(`${API}/verify/${code}`);
    expect(verify.status()).toBe(200);
    expect(await verify.json()).toMatchObject({ valid: true, verificationCode: code, score: 95 });

    // Descargarlo otra vez imprime el mismo código
    const again = await page.request.get(`${API}/certificate`);
    expect(again.headers()['x-verification-code']).toBe(code);
  });

  test('Las estadísticas por promoción responden y sus totales son números', async ({ request }) => {
    const token = await adminToken(request);
    const res = await request.get(`${API}/admin/cohorts`, { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status()).toBe(200);
    const { cohorts } = await res.json();
    expect(cohorts.length).toBeGreaterThan(0);
    for (const cohort of cohorts) {
      expect(typeof cohort.total_students).toBe('number');
      expect(typeof cohort.certified_students).toBe('number');
      expect(typeof cohort.in_progress_students).toBe('number');
      expect(typeof cohort.total_incidents).toBe('number');
      expect(cohort.avg_score === null || typeof cohort.avg_score === 'number').toBeTruthy();
    }
  });

  test('Los textos del estándar IES y del CSV usan las reglas vigentes, no valores fijos', async ({ request }) => {
    const token = await adminToken(request);
    const headers = { Authorization: `Bearer ${token}` };

    const { studentId } = await resetStudentState(request, { email: 'student@test.com', exam_attempts: 1, exam_score: 60 });
    const compliance = await (await request.get(`${API}/admin/compliance/${studentId}`, { headers })).json();
    const byCode = Object.fromEntries(compliance.criteria.map(c => [c.code, c]));
    expect(byCode.STD_EXAM_SCORE.required).toContain(`${EXAM_PASS_SCORE_PERCENT}%`);
    expect(byCode.STD_EXAM_SCORE.required).toContain(`${EXAM_QUESTION_COUNT} preguntas`);
    expect(byCode.STD_EXAM_SCORE.required).not.toContain('45/50');
    expect(byCode.STD_MAX_ATTEMPTS.details).toBe(`1 de máximo ${MAX_EXAM_ATTEMPTS} intentos permitidos utilizados.`);

    const csv = await (await request.get(`${API}/admin/export-audit?cohort=all`, { headers })).text();
    expect(csv).toContain(`Pasos Curriculares (de ${TOTAL_COURSE_STEPS})`);
  });

  test('El perfil del estudiante trae las reglas del examen y los intentos que le quedan', async ({ page }) => {
    await resetStudentState(page.request, { email: 'student@test.com', exam_attempts: 1, exam_score: 60 });
    await performLogin(page, 'student@test.com', 'student123', false);

    const me = await (await page.request.get(`${API}/student/me`)).json();
    expect(me.exam).toEqual({
      questionCount: EXAM_QUESTION_COUNT,
      passScore: EXAM_PASS_SCORE_PERCENT,
      wildcardCost: WILDCARD_COST,
      maxAttempts: MAX_EXAM_ATTEMPTS,
      attemptsUsed: 1,
      attemptsLeft: MAX_EXAM_ATTEMPTS - 1,
      inProgress: false,
      passed: false,
    });
    expect(me).not.toHaveProperty('password');
    expect(me).not.toHaveProperty('face_descriptor');
  });

  test('Quien reprobó el examen ve su nota real y puede reintentarlo desde el curso', async ({ page }) => {
    await skipWelcomeTour(page);
    await resetStudentState(page.request, { email: 'student@test.com', complete_course: true, exam_attempts: 1, exam_score: 60 });
    await performLogin(page, 'student@test.com', 'student123', false);
    await page.goto('/course');

    // Con la malla completa, lo pendiente es el examen
    await expect(page.locator('#btn-continue-course')).toContainText('Examen Final');
    const card = page.locator('#step-exam');
    await expect(card).toContainText('❌ No aprobado (60%)');
    await expect(card).not.toContainText('✅ Aprobado');

    const retry = card.locator('a', { hasText: `Reintentar Examen (${MAX_EXAM_ATTEMPTS - 1} intentos restantes)` });
    await expect(retry).toBeVisible();
    await retry.click();
    await page.waitForURL(/\/course\/exam/);
    await expect(page.locator('#exam-attempts-status')).toContainText(`Has usado 1 de ${MAX_EXAM_ATTEMPTS} intentos`);
    await expect(page.locator('#start-exam-btn')).toBeEnabled();
  });

  test('Sin intentos restantes el curso lo indica en lugar de ofrecer el examen', async ({ page }) => {
    await skipWelcomeTour(page);
    await resetStudentState(page.request, { email: 'student@test.com', complete_course: true, exam_attempts: MAX_EXAM_ATTEMPTS, exam_score: 40 });
    await performLogin(page, 'student@test.com', 'student123', false);
    await page.goto('/course');

    const card = page.locator('#step-exam');
    await expect(card).toContainText('❌ No aprobado (40%)');
    await expect(card.locator('button', { hasText: 'Sin intentos disponibles' })).toBeDisabled();
    await expect(card.locator('a', { hasText: 'Examen' })).toHaveCount(0);
    await expect(page.locator('#btn-continue-course')).toBeDisabled();
  });

  test('Quien aprobó ve "Aprobado" con su nota y no se le ofrece repetir', async ({ page }) => {
    await skipWelcomeTour(page);
    await resetStudentState(page.request, { email: 'student@test.com', complete_course: true, pass_exam: true, exam_score: 95 });
    await performLogin(page, 'student@test.com', 'student123', false);
    await page.goto('/course');

    await expect(page.locator('#btn-continue-course')).toHaveCount(0);
    await page.click('.sidebar-nav-exam');
    const card = page.locator('#step-exam');
    await expect(card).toContainText('✅ Aprobado (95%)');
    await expect(card.locator('button', { hasText: 'Examen Aprobado' })).toBeDisabled();
  });

  test('"Continuar donde quedé" abre el módulo y el paso que le toca al estudiante', async ({ page }) => {
    await skipWelcomeTour(page);
    await performLogin(page, 'student@test.com', 'student123', true);
    for (const step of ['m1_v1', 'm1_s1', 'm1_v2', 'm1_s2', 'm1_v3', 'm1_s3']) {
      await completeStep(page.request, step);
    }

    // Al entrar se abre el módulo del paso pendiente (módulo 2), no el módulo 1
    await page.goto('/course');
    await expect(page.locator('#btn-continue-course')).toContainText('Continuar donde quedé');
    const current = page.locator('#step-m2_v1');
    await expect(current).toBeVisible();
    await expect(current).toHaveClass(/card-current/);
    await expect(page.locator('#step-m1_v1')).toHaveCount(0);

    // Tras explorar otro módulo, el botón vuelve al paso pendiente
    await page.click('.sidebar-nav-btn:has-text("Módulo 1")');
    await expect(page.locator('#step-m1_v1')).toBeVisible();
    await page.click('#btn-continue-course');
    await expect(current).toBeVisible();
    await expect(current).toBeInViewport();
  });
});
