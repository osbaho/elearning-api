import { test, expect } from '@playwright/test';
import { API, ADMIN_PASSWORD, adminSession } from '../helpers/adminHelper.js';
import { performLogin } from '../helpers/loginHelper.js';

const PERFECT = { score: 100, maxScore: 100, passed: true, errorCount: 0, doseMsv: 0, timeSeconds: 1 };

test.describe('Modo revisión del administrador', () => {
  test('La API deja al admin recorrer el curso sin orden y sin registrar avance, puntos ni examen', async () => {
    const admin = await adminSession();
    try {
      const before = await (await admin.get('/student/me')).json();

      // Avance: cualquier paso, sin orden, sin escribir nada
      const progress = await admin.post('/progress/m3_v2');
      expect(progress.status()).toBe(200);
      expect(await progress.json()).toEqual({ success: true, preview: true });
      expect((await admin.post('/progress/m2_v1/start')).status()).toBe(200);
      expect((await admin.post('/progress/m9_x9')).status()).toBe(400);

      // Simulador: partida de un minijuego fuera de orden; registra el nivel pero no suma puntos
      const step = await (await admin.get('/simulator/steps/m1_s3')).json();
      expect(step).toMatchObject({ preview: true, available: true, stepCompleted: false });
      const start = await admin.post('/simulator/attempts', { stepId: 'm1_s3' });
      expect(start.status()).toBe(201);
      const attempt = await start.json();
      expect(attempt.preview).toBe(true);
      const result = await admin.post(`/simulator/attempts/${attempt.attemptId}/result`, { phase: attempt.phase, ...PERFECT });
      expect(result.status()).toBe(200);
      expect(await result.json()).toMatchObject({ tier: 'perfect', pointsAwarded: 0, preview: true, stepCapReached: false });

      // El examen no se presenta en modo revisión
      for (const [method, path] of [['post', '/start-exam'], ['get', '/questions'], ['post', '/submit-exam'], ['post', '/use-wildcard']]) {
        const res = await admin[method](path, method === 'post' ? {} : undefined);
        expect(res.status(), path).toBe(403);
        expect((await res.json()).code, path).toBe('PREVIEW_MODE');
      }

      const after = await (await admin.get('/student/me')).json();
      expect(after.completedModules).toEqual(before.completedModules);
      expect(after.reservePoints).toBe(before.reservePoints);
    } finally {
      await admin.dispose();
    }
  });

  test('En el navegador: el admin abre el curso desde el panel, todo está desbloqueado y nada se registra', async ({ page }) => {
    test.setTimeout(90000);
    const admin = await adminSession(); // fija la contraseña del admin para la prueba
    await admin.dispose();
    await performLogin(page, 'admin@admin.com', ADMIN_PASSWORD, false);

    await page.goto('/admin');
    await page.click('#btn-open-course-preview');
    await page.waitForURL('**/course');
    await expect(page.locator('#admin-preview-banner')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#nav-back-admin')).toBeVisible();
    // Sin el recorrido guiado ni barra de avance del estudiante
    await expect(page.locator('.course-progress-container .progress-bar-fill')).toHaveCount(0);

    // Todos los pasos abiertos: el último minijuego del módulo 1 y el examen
    const lastMinigame = page.locator('#step-m1_s3');
    await expect(lastMinigame).toContainText('Revisión');
    await expect(lastMinigame.locator('a', { hasText: 'Comenzar Minijuego' })).toBeVisible();
    await page.click('.sidebar-nav-exam');
    await expect(page.locator('#step-exam a', { hasText: 'Ver la página del examen' })).toBeVisible();

    // Práctica: una partida simulada se registra sin puntos y no hay botón de finalizar
    await page.route('**/webgl/**', (route) => route.abort());
    await page.goto('/course/practice/m1_s3');
    await expect(page.locator('#practice-preview-banner')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('button:has-text("Finalizar Práctica")')).toHaveCount(0);
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/simulator/attempts/') && r.url().endsWith('/result') && r.status() === 200),
      page.click('button:has-text("Simular partida perfecta")'),
    ]);
    await expect(page.locator('[role="status"]', { hasText: 'no suman puntos ni avance' })).toBeVisible();

    // Examen: aviso en lugar del botón para empezar
    await page.goto('/course/exam');
    await expect(page.locator('#exam-preview-notice')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#start-exam-btn')).toHaveCount(0);
  });
});
