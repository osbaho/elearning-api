import { test, expect } from '@playwright/test';
import { performLogin, resetStudentState } from '../helpers/loginHelper.js';

test.describe('Frontend Resilience, Anti-Scrubbing & Session Recovery', () => {

  test('VideoPlayer blocks forward-seeking (anti-scrubbing) and displays warning', async ({ page }) => {
    await performLogin(page, 'student@test.com', 'student123', true);
    await page.goto('/course');

    // Localizar el primer video del curso m1_v1
    const videoLocator = page.locator('video.video-el').first();
    await expect(videoLocator).toBeVisible({ timeout: 10000 });

    // Intentar adelantar el video de forma forzada a través de JavaScript en la consola
    await videoLocator.evaluate((video) => {
      video.currentTime = 120; // Intento de salto a los 2 minutos
      video.dispatchEvent(new Event('seeking'));
      video.dispatchEvent(new Event('timeupdate'));
    });

    // El reproductor debe mostrar la alerta de adelanto bloqueado
    const warningNotice = page.locator('.video-seek-warning');
    await expect(warningNotice).toBeVisible({ timeout: 5000 });
    await expect(warningNotice).toContainText('No está permitido adelantar el video');

    // El tiempo del video debe haber retornado a 0
    const currentTime = await videoLocator.evaluate((video) => video.currentTime);
    expect(currentTime).toBeLessThanOrEqual(2);
  });

  test('Exam session recovers answers and state after accidental page reload', async ({ page }) => {
    await performLogin(page, 'student@test.com', 'student123', true);
    await page.goto('/course/exam?skipCamera=true');

    const startBtn = page.locator('#start-exam-btn');
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await startBtn.click();

    await expect(page.locator('#exam-main-screen')).toBeVisible({ timeout: 5000 });

    // Responder la primera pregunta seleccionando la opción 'b'
    const firstQuestionCard = page.locator('.question-card').first();
    const secondOption = firstQuestionCard.locator('.option-btn').nth(1);
    await secondOption.click();

    // Guardar el estado en sessionStorage se ejecuta reactivamente
    await page.waitForTimeout(300);

    // Simular recarga accidental de la página (F5)
    await page.reload();

    // Comprobar que en sessionStorage sigue guardada la respuesta
    const savedAnswers = await page.evaluate(() => sessionStorage.getItem('exam_answers'));
    expect(savedAnswers).not.toBeNull();
    const parsed = JSON.parse(savedAnswers);
    expect(Object.keys(parsed).length).toBeGreaterThan(0);
  });

  test('Unauthenticated user is immediately redirected to /login from any protected page', async ({ browser }) => {
    // Crear un contexto completamente limpio sin cookies ni sesión
    const cleanContext = await browser.newContext();
    const cleanPage = await cleanContext.newPage();

    const protectedUrls = [
      '/course',
      '/course/exam',
      '/course/practice/m1_s1',
      '/admin',
      '/onboarding'
    ];

    for (const url of protectedUrls) {
      await cleanPage.goto(url);
      await cleanPage.waitForURL(/\/login/);
      await expect(cleanPage).toHaveURL(/.*login/);
    }

    await cleanContext.close();
  });

});
