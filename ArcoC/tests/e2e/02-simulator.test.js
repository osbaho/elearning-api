import { test, expect } from '@playwright/test';
import { performLogin } from '../helpers/loginHelper.js';

test('Simulator points update correctly', async ({ page }) => {
  await performLogin(page);
  // El minijuego m1_s1 exige haber completado el video previo
  await page.request.post('http://localhost:5000/api/progress/m1_v1');

  // Aislar la prueba del build WebGL real (si existe): la vista usa el modo sin build
  await page.route('**/webgl/**', route => route.abort());
  await page.goto('/course/practice/m1_s1');

  // Check points initialization
  const sessionPointsLocator = page.locator('#session-points');
  await expect(sessionPointsLocator).toBeVisible({ timeout: 5000 });
  await expect(sessionPointsLocator).toHaveText('+0');

  // Partida perfecta simulada (mismo resultado que reportaría Unity) → la API otorga 10 pts
  const [response] = await Promise.all([
    page.waitForResponse(res => res.url().includes('/simulator/attempts/') && res.url().endsWith('/result') && res.status() === 200, { timeout: 5000 }),
    page.click('button:has-text("Simular partida perfecta")')
  ]);
  const body = await response.json();
  expect(body.tier).toBe('perfect');
  expect(body.pointsAwarded).toBe(10);

  // Check updated points
  await expect(sessionPointsLocator).toHaveText('+10');
});
