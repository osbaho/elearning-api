import { test, expect } from '@playwright/test';
import { resetStudentState } from '../helpers/loginHelper.js';
import { initDb, all } from '../../server/config/db.js';
import fs from 'fs';
import path from 'path';

test.describe('Student Single-Sitting Complete Journey (UI/UX & Logic)', () => {
  test.use({ permissions: ['camera'] });

  const STUDENT_EMAIL = 'dra_camila_soto@hospital.org';
  const STUDENT_PASS = 'Student2026!';
  const STUDENT_NAME = 'Dra. Camila Soto';
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

  test('Completes the entire student journey in a single continuous session', async ({ page, request }) => {
    test.setTimeout(90000); // Dar suficiente tiempo para el flujo integral completo

    // 1. Inicializar estudiante completamente nuevo (no onboarded, 0 puntos, 0 progreso)
    await resetStudentState(request, {
      email: STUDENT_EMAIL,
      password: STUDENT_PASS,
      name: STUDENT_NAME,
      is_onboarded: 0,
      reserve_points: 0,
      exam_attempts: 0,
      exam_score: null
    });

    // 2. Primer Login
    await page.goto('/login');
    await expect(page.locator('.login-card')).toBeVisible();
    await saveScreenshot(page, '01-first-login-screen.png');

    await page.fill('#email', STUDENT_EMAIL);
    await page.fill('#password', STUDENT_PASS);
    await page.click('button[type="submit"]');

    // 3. Redirección automática obligatoria a Onboarding
    await page.waitForURL('**/onboarding', { timeout: 15000 });
    await expect(page.locator('h1')).toContainText('Comencemos');
    await saveScreenshot(page, '02-onboarding-step1-profile.png');

    // 4. Completar Paso 1: Datos Institucionales y Habeas Data
    await page.selectOption('select[name="id_type"]', 'CC');
    await page.fill('input[name="id_number"]', '1098765432');
    await page.fill('input[name="institution"]', 'Hospital Universitario Mayor Méderi');
    await page.check('input[type="checkbox"]');
    await page.click('button[type="submit"]');

    // 5. Paso 2: Proctoring Biométrico
    await expect(page.locator('h1')).toContainText('Proctoring Biométrico');
    await saveScreenshot(page, '03-onboarding-step2-biometrics.png');

    // Registrar descriptor facial (128 flotantes cifrados AES-256-GCM)
    await page.evaluate(async () => {
      const dummyDescriptor = Array(128).fill(0.05);
      const res = await fetch('http://localhost:5000/api/student/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id_type: 'CC',
          id_number: '1098765432',
          institution: 'Hospital Universitario Mayor Méderi',
          face_descriptor: dummyDescriptor
        })
      });
      if (!res.ok) {
        throw new Error(`Onboarding failed: ${res.status}`);
      }
    });

    // 6. Ingreso al Quirófano Virtual (Dashboard al 0%)
    await page.goto('/course');
    await page.waitForSelector('.course-layout-container', { timeout: 15000 });

    // Si aparece el tour interactivo de bienvenida (driver.js), capturarlo y cerrarlo
    const driverPopover = page.locator('.driver-popover');
    if (await driverPopover.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveScreenshot(page, '04-course-welcome-tour.png');
      // Cerrar tour presionando Escape o click en terminar
      await page.keyboard.press('Escape');
    }

    // Verificar estado inicial: 0% de progreso y Examen bloqueado
    const progressFill = page.locator('.progress-bar-fill');
    await expect(progressFill).toHaveAttribute('aria-valuenow', '0');
    await expect(page.locator('.course-progress-container')).toContainText('0 / 25 pasos');
    
    const examNavBtn = page.locator('.sidebar-nav-exam');
    await expect(examNavBtn).toBeDisabled();
    await saveScreenshot(page, '05-course-dashboard-0percent.png');

    // 7. Realizar Módulo 1 Paso 1 y Paso 2 (Práctica con Simulador en Vivo)
    // Paso 1: Video 1
    await page.request.post('http://localhost:5000/api/progress/m1_v1');

    // Paso 2: Minijuego en Simulador interactivo
    await page.goto('/course/practice/m1_s1');
    await page.waitForSelector('.simulator-grid', { timeout: 10000 });
    
    // Simular acumulación de puntos de práctica (ganar 150 pts para poder usar comodín en examen)
    await page.click('button:has-text("🏆 Simular +50 pts")');
    await page.waitForTimeout(300);
    await page.click('button:has-text("🏆 Simular +50 pts")');
    await page.waitForTimeout(300);
    await page.click('button:has-text("🏆 Simular +50 pts")');
    await page.waitForTimeout(300);

    // Verificar actualización reactiva del widget de puntos
    const pointsWidget = page.locator('.points-display');
    await expect(pointsWidget).toHaveText('150');
    await saveScreenshot(page, '06-simulator-interactive-practice.png');

    // Finalizar práctica y confirmar modal
    await page.click('button:has-text("🏁 Finalizar Práctica")');
    await page.waitForSelector('text=¿Finalizar Práctica?', { timeout: 5000 });
    await page.click('button.btn-primary:has-text("Finalizar")');
    await page.waitForTimeout(800);

    // Regresar al curso
    await page.goto('/course');
    await page.waitForSelector('.course-layout-container');
    await expect(page.locator('.course-progress-container')).toContainText('2 / 25 pasos');

    // 8. Avanzar secuencialmente el resto del curso hasta el 100% (Pasos 3 a 25)
    const ALL_REMAINING_STEPS = [
      'm1_v2', 'm1_s2', 'm1_vr',
      'm2_v1', 'm2_s1', 'm2_v2', 'm2_s2', 'm2_vr',
      'm3_v1', 'm3_s1', 'm3_v2', 'm3_s2', 'm3_vr',
      'm4_v1', 'm4_s1', 'm4_v2', 'm4_s2', 'm4_vr',
      'm5_v1', 'm5_s1', 'm5_v2', 'm5_s2', 'm5_vr'
    ];

    for (let i = 0; i < ALL_REMAINING_STEPS.length; i++) {
      const stepId = ALL_REMAINING_STEPS[i];
      const res = await page.request.post(`http://localhost:5000/api/progress/${stepId}`);
      expect(res.ok()).toBeTruthy();

      // En el punto medio (Módulo 3, ~48%), capturar estado visual
      if (stepId === 'm3_s1') {
        await page.reload();
        await page.waitForSelector('.course-layout-container');
        await expect(page.locator('.course-progress-container')).toContainText('12 / 25 pasos');
        await saveScreenshot(page, '07-course-midway-progress-48percent.png');
      }
    }

    // 9. Verificar estado 100% completado y desbloqueo del Examen Final
    await page.reload();
    await page.waitForSelector('.course-layout-container');
    await expect(page.locator('.course-progress-container')).toContainText('25 / 25 pasos');
    await expect(page.locator('.course-progress-container')).toContainText('100% completado');
    await expect(examNavBtn).toBeEnabled();
    await saveScreenshot(page, '08-course-100percent-unlocked.png');

    // 10. Presentación del Examen Final
    await page.goto('/course/exam?skipCamera=true');
    await page.waitForSelector('#start-exam-btn', { timeout: 15000 });
    await expect(page.locator('#start-exam-btn')).toBeEnabled();
    await page.click('#start-exam-btn');

    // Esperar pantalla activa de examen
    await page.waitForSelector('#exam-main-screen', { timeout: 10000 });
    await page.waitForSelector('.question-card', { timeout: 10000 });
    await saveScreenshot(page, '09-exam-active-questions.png');

    // 11. Probar el Comodín 50/50 (consumiendo 100 de los 150 puntos)
    const firstWildcardBtn = page.locator('.btn-gold:has-text("50/50")').first();
    await expect(firstWildcardBtn).toBeVisible();
    await expect(firstWildcardBtn).toBeEnabled({ timeout: 5000 });
    await firstWildcardBtn.click();
    await page.waitForTimeout(500);

    // Verificar que se hayan eliminado 2 opciones en la tarjeta
    const eliminatedButtons = page.locator('.question-card').first().locator('.option-btn.eliminated');
    await expect(eliminatedButtons).toHaveCount(2);
    await saveScreenshot(page, '10-exam-wildcard-applied.png');

    // 12. Responder todas las preguntas con la respuesta correcta oficial
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

    // 13. Enviar Examen
    const submitBtn = page.locator('#btn-submit');
    await expect(submitBtn).toBeEnabled({ timeout: 5000 });
    await submitBtn.click();

    // 14. Verificar Pantalla de Resultados y Aprobación
    const resultScreen = page.locator('#result-screen');
    await expect(resultScreen).toBeVisible({ timeout: 10000 });
    const scoreText = await page.locator('#result-score-display').textContent();
    expect(scoreText).toContain('%');
    await saveScreenshot(page, '11-exam-passed-results.png');

    // 15. Regresar al Dashboard y verificar Banner Dorado de Graduado
    await page.goto('/course');
    await page.waitForSelector('.card-course-passed', { timeout: 10000 });
    await expect(page.locator('.title-passed')).toContainText('¡Felicitaciones!');
    await saveScreenshot(page, '12-course-certified-student-dashboard.png');

    // 16. Descargar y validar Certificado Oficial (PDF)
    const certResponse = await page.request.get('http://localhost:5000/api/certificate');
    expect(certResponse.status()).toBe(200);
    expect(certResponse.headers()['content-type']).toBe('application/pdf');
    const pdfBuffer = await certResponse.body();
    expect(pdfBuffer.toString('utf8', 0, 4)).toBe('%PDF');
  });
});
