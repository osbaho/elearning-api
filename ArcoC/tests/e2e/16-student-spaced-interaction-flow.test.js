import { test, expect } from '@playwright/test';
import { resetStudentState } from '../helpers/loginHelper.js';
import { initDb, all, run } from '../../server/config/db.js';
import fs from 'fs';
import path from 'path';

test.describe('Student Multi-Session Spaced Learning Journey (3-day intervals, ~10% per session)', () => {
  test.use({ permissions: ['camera'] });

  const STUDENT_EMAIL = 'dr_alejandro_rojas@quirurgico.med.co';
  const STUDENT_PASS = 'Spaced2026!';
  const STUDENT_NAME = 'Dr. Alejandro Rojas';
  const SCREENSHOT_DIR = path.resolve('tests/screenshots/student-journey');
  const PUBLIC_SCREENSHOT_DIR = path.resolve('public/screenshots/student-journey');

  test.beforeAll(async () => {
    await initDb();
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    fs.mkdirSync(PUBLIC_SCREENSHOT_DIR, { recursive: true });
  });

  const saveScreenshot = async (page, filename) => {
    const targetPath = path.join(SCREENSHOT_DIR, filename);
    const publicPath = path.join(PUBLIC_SCREENSHOT_DIR, filename);
    await page.screenshot({ path: targetPath, fullPage: true });
    fs.copyFileSync(targetPath, publicPath);
  };

  const loginUser = async (page) => {
    await page.goto('/login');
    await page.waitForSelector('.login-card');
    await page.fill('#email', STUDENT_EMAIL);
    await page.fill('#password', STUDENT_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/course', { timeout: 15000 });
  };

  const logoutUser = async (page) => {
    await page.evaluate(async () => {
      await fetch('http://localhost:5000/api/logout', { method: 'POST', credentials: 'include' });
      localStorage.removeItem('token');
    });
    await page.goto('/login');
    await page.waitForSelector('.login-card');
  };

  test('Simulates a 27-day spaced learning path advancing ~10% every 3 days until certification', async ({ page, request }) => {
    test.setTimeout(120000);

    // ── Día 0: Registro de Nuevo Estudiante y Onboarding Inicial ───────────────
    await resetStudentState(request, {
      email: STUDENT_EMAIL,
      password: STUDENT_PASS,
      name: STUDENT_NAME,
      is_onboarded: 0,
      reserve_points: 0,
      exam_attempts: 0,
      exam_score: null
    });

    // Login inicial
    await page.goto('/login');
    await page.fill('#email', STUDENT_EMAIL);
    await page.fill('#password', STUDENT_PASS);
    await page.click('button[type="submit"]');

    // Onboarding automático
    await page.waitForURL('**/onboarding', { timeout: 15000 });
    await page.selectOption('select[name="id_type"]', 'CC');
    await page.fill('input[name="id_number"]', '79841235');
    await page.fill('input[name="institution"]', 'Clínica Quirúrgica Santa Fe');
    await page.check('input[type="checkbox"]');
    await page.click('button[type="submit"]');

    // Registro biométrico facial
    await expect(page.locator('h1')).toContainText('Proctoring Biométrico');
    await page.evaluate(async () => {
      const dummyDescriptor = Array(128).fill(0.05);
      const res = await fetch('http://localhost:5000/api/student/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id_type: 'CC',
          id_number: '79841235',
          institution: 'Clínica Quirúrgica Santa Fe',
          face_descriptor: dummyDescriptor
        })
      });
      if (!res.ok) throw new Error('Onboarding failed');
    });

    await page.goto('/course');
    await page.waitForSelector('.course-layout-container');

    // ── Sesión 1 (Día 0 - Avance ~8%): Pasos 1 y 2 ───────────────────────────
    await page.request.post('http://localhost:5000/api/progress/m1_v1');
    await page.request.post('http://localhost:5000/api/add-points', { data: { points: 50, source: 'm1_s1' } });
    await page.request.post('http://localhost:5000/api/progress/m1_s1');
    
    await page.reload();
    await page.waitForSelector('.course-layout-container');
    await expect(page.locator('.course-progress-container')).toContainText('2 / 25 pasos');
    await saveScreenshot(page, 'spaced-01-day0-session1-8percent.png');
    await logoutUser(page);

    // ── Sesión 2 (Día 3 - Avance a 20%): Pasos 3, 4 y 5 (Cierre Módulo 1) ────
    await loginUser(page);
    // Verificar persistencia de sesión previa
    await expect(page.locator('.course-progress-container')).toContainText('2 / 25 pasos');

    await page.request.post('http://localhost:5000/api/progress/m1_v2');
    await page.request.post('http://localhost:5000/api/add-points', { data: { points: 50, source: 'm1_s2' } });
    await page.request.post('http://localhost:5000/api/progress/m1_s2');
    await page.request.post('http://localhost:5000/api/progress/m1_vr');

    await page.reload();
    await page.waitForSelector('.course-layout-container');
    await expect(page.locator('.course-progress-container')).toContainText('5 / 25 pasos');
    await expect(page.locator('.course-progress-container')).toContainText('20% completado');
    await saveScreenshot(page, 'spaced-02-day3-session2-20percent.png');
    await logoutUser(page);

    // ── Sesión 3 (Día 6 - Avance a 28%): Pasos 6 y 7 ─────────────────────────
    await loginUser(page);
    await expect(page.locator('.course-progress-container')).toContainText('5 / 25 pasos');

    await page.request.post('http://localhost:5000/api/progress/m2_v1');
    await page.request.post('http://localhost:5000/api/add-points', { data: { points: 50, source: 'm2_s1' } });
    await page.request.post('http://localhost:5000/api/progress/m2_s1');

    await page.reload();
    await page.waitForSelector('.course-layout-container');
    await expect(page.locator('.course-progress-container')).toContainText('7 / 25 pasos');
    await logoutUser(page);

    // ── Sesión 4 (Día 9 - Avance a 40%): Pasos 8, 9 y 10 (Cierre Módulo 2) ───
    await loginUser(page);
    await expect(page.locator('.course-progress-container')).toContainText('7 / 25 pasos');

    await page.request.post('http://localhost:5000/api/progress/m2_v2');
    await page.request.post('http://localhost:5000/api/add-points', { data: { points: 50, source: 'm2_s2' } });
    await page.request.post('http://localhost:5000/api/progress/m2_s2');
    await page.request.post('http://localhost:5000/api/progress/m2_vr');

    await page.reload();
    await page.waitForSelector('.course-layout-container');
    await expect(page.locator('.course-progress-container')).toContainText('10 / 25 pasos');
    await expect(page.locator('.course-progress-container')).toContainText('40% completado');
    await saveScreenshot(page, 'spaced-03-day9-session4-40percent.png');
    await logoutUser(page);

    // ── Sesión 5 (Día 12 - Avance a 48%): Pasos 11 y 12 ──────────────────────
    await loginUser(page);
    await expect(page.locator('.course-progress-container')).toContainText('10 / 25 pasos');

    await page.request.post('http://localhost:5000/api/progress/m3_v1');
    await page.request.post('http://localhost:5000/api/add-points', { data: { points: 50, source: 'm3_s1' } });
    await page.request.post('http://localhost:5000/api/progress/m3_s1');

    await page.reload();
    await page.waitForSelector('.course-layout-container');
    await expect(page.locator('.course-progress-container')).toContainText('12 / 25 pasos');
    await logoutUser(page);

    // ── Sesión 6 (Día 15 - Avance a 60%): Pasos 13, 14 y 15 (Cierre Módulo 3) 
    await loginUser(page);
    await expect(page.locator('.course-progress-container')).toContainText('12 / 25 pasos');

    await page.request.post('http://localhost:5000/api/progress/m3_v2');
    await page.request.post('http://localhost:5000/api/add-points', { data: { points: 50, source: 'm3_s2' } });
    await page.request.post('http://localhost:5000/api/progress/m3_s2');
    await page.request.post('http://localhost:5000/api/progress/m3_vr');

    await page.reload();
    await page.waitForSelector('.course-layout-container');
    await expect(page.locator('.course-progress-container')).toContainText('15 / 25 pasos');
    await expect(page.locator('.course-progress-container')).toContainText('60% completado');
    await saveScreenshot(page, 'spaced-04-day15-session6-60percent.png');
    await logoutUser(page);

    // ── Sesión 7 (Día 18 - Avance a 68%): Pasos 16 y 17 ──────────────────────
    await loginUser(page);
    await expect(page.locator('.course-progress-container')).toContainText('15 / 25 pasos');

    await page.request.post('http://localhost:5000/api/progress/m4_v1');
    await page.request.post('http://localhost:5000/api/add-points', { data: { points: 50, source: 'm4_s1' } });
    await page.request.post('http://localhost:5000/api/progress/m4_s1');

    await page.reload();
    await page.waitForSelector('.course-layout-container');
    await expect(page.locator('.course-progress-container')).toContainText('17 / 25 pasos');
    await logoutUser(page);

    // ── Sesión 8 (Día 21 - Avance a 80%): Pasos 18, 19 y 20 (Cierre Módulo 4) 
    await loginUser(page);
    await expect(page.locator('.course-progress-container')).toContainText('17 / 25 pasos');

    await page.request.post('http://localhost:5000/api/progress/m4_v2');
    await page.request.post('http://localhost:5000/api/add-points', { data: { points: 50, source: 'm4_s2' } });
    await page.request.post('http://localhost:5000/api/progress/m4_s2');
    await page.request.post('http://localhost:5000/api/progress/m4_vr');

    await page.reload();
    await page.waitForSelector('.course-layout-container');
    await expect(page.locator('.course-progress-container')).toContainText('20 / 25 pasos');
    await expect(page.locator('.course-progress-container')).toContainText('80% completado');
    await saveScreenshot(page, 'spaced-05-day21-session8-80percent.png');
    await logoutUser(page);

    // ── Sesión 9 (Día 24 - Avance a 88%): Pasos 21 y 22 ──────────────────────
    await loginUser(page);
    await expect(page.locator('.course-progress-container')).toContainText('20 / 25 pasos');

    await page.request.post('http://localhost:5000/api/progress/m5_v1');
    await page.request.post('http://localhost:5000/api/add-points', { data: { points: 50, source: 'm5_s1' } });
    await page.request.post('http://localhost:5000/api/progress/m5_s1');

    await page.reload();
    await page.waitForSelector('.course-layout-container');
    await expect(page.locator('.course-progress-container')).toContainText('22 / 25 pasos');
    await logoutUser(page);

    // ── Sesión 10 (Día 27 - 100% y Graduación Oficial): Pasos 23, 24 y 25 ────
    await loginUser(page);
    await expect(page.locator('.course-progress-container')).toContainText('22 / 25 pasos');

    await page.request.post('http://localhost:5000/api/progress/m5_v2');
    await page.request.post('http://localhost:5000/api/add-points', { data: { points: 50, source: 'm5_s2' } });
    await page.request.post('http://localhost:5000/api/progress/m5_s2');
    await page.request.post('http://localhost:5000/api/progress/m5_vr');

    await page.reload();
    await page.waitForSelector('.course-layout-container');
    await expect(page.locator('.course-progress-container')).toContainText('25 / 25 pasos');
    await expect(page.locator('.course-progress-container')).toContainText('100% completado');
    
    // Verificar que el Examen Final está habilitado
    const examNavBtn = page.locator('.sidebar-nav-exam');
    await expect(examNavBtn).toBeEnabled();
    await saveScreenshot(page, 'spaced-06-day27-session10-100percent.png');

    // ── Presentar y Aprobar Examen Final ────────────────────────────────────
    await page.goto('/course/exam?skipCamera=true');
    await page.waitForSelector('#start-exam-btn', { timeout: 15000 });
    await page.click('#start-exam-btn');

    await page.waitForSelector('#exam-main-screen', { timeout: 10000 });
    await page.waitForSelector('.question-card', { timeout: 10000 });

    // Responder todas las preguntas de forma correcta
    const dbQuestions = await all('SELECT text, correct_answer FROM questions');
    const answerByText = new Map(dbQuestions.map(q => [q.text.trim(), q.correct_answer.toLowerCase()]));
    const letterIdx = { a: 0, b: 1, c: 2, d: 3 };

    const questionCards = await page.locator('.question-card').all();
    for (const card of questionCards) {
      const cardFullText = await card.locator('.question-text').textContent();
      let matchedAns = null;
      for (const [qText, ans] of answerByText.entries()) {
        if (cardFullText.includes(qText.slice(0, 25))) {
          matchedAns = ans;
          break;
        }
      }

      if (matchedAns && letterIdx[matchedAns] !== undefined) {
        const targetOption = card.locator('.option-btn').nth(letterIdx[matchedAns]);
        await targetOption.click();
      } else {
        await card.locator('.option-btn:not(.eliminated)').first().click();
      }
    }

    // Enviar Examen
    await page.click('#btn-submit');
    await page.waitForSelector('#result-screen', { timeout: 10000 });
    const scoreText = await page.locator('#result-score-display').textContent();
    expect(scoreText).toContain('%');

    // Volver al curso y verificar banner de certificado emitido
    await page.goto('/course');
    await page.waitForSelector('.card-course-passed', { timeout: 10000 });
    await expect(page.locator('.title-passed')).toContainText('¡Felicitaciones!');
    await saveScreenshot(page, 'spaced-07-day27-graduated.png');

    // Descargar y validar Certificado Oficial (PDF)
    const certResponse = await page.request.get('http://localhost:5000/api/certificate');
    expect(certResponse.status()).toBe(200);
    expect(certResponse.headers()['content-type']).toBe('application/pdf');
    const pdfBuffer = await certResponse.body();
    expect(pdfBuffer.toString('utf8', 0, 4)).toBe('%PDF');
  });
});
