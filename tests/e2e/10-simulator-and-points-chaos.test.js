import { test, expect } from '@playwright/test';
import { performLogin, resetStudentState } from '../helpers/loginHelper.js';

test.describe('Simulator & Reserve Points Chaos Testing', () => {

  test('Rejects negative, zero, excessive and non-numeric points payloads', async ({ page }) => {
    await performLogin(page, 'student@test.com', 'student123', true);

    const invalidPointsPayloads = [
      { points: -50, source: 'm1_s1' },
      { points: 0, source: 'm1_s1' },
      { points: 101, source: 'm1_s1' },
      { points: 99999, source: 'm1_s1' },
      { points: 'cien_puntos', source: 'm1_s1' },
      { points: NaN, source: 'm1_s1' },
      { points: null, source: 'm1_s1' },
      { points: {}, source: 'm1_s1' }
    ];

    for (const payload of invalidPointsPayloads) {
      const res = await page.request.post('http://localhost:5000/api/add-points', {
        data: payload
      });
      expect(res.status()).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Parámetros inválidos');
    }
  });

  test('Rejects points when source is unauthorized, malformed or path-traversal', async ({ page }) => {
    await performLogin(page, 'student@test.com', 'student123', true);

    const maliciousSources = [
      'exam',
      'm1_v1', // video no es módulo interactivo
      'm1_vr', // video recopilatorio no es interactivo
      '../../../etc/passwd',
      'DROP TABLE students',
      'm9_s1', // módulo inexistente
      'm1_s3',
      12345,
      {}
    ];

    for (const source of maliciousSources) {
      const res = await page.request.post('http://localhost:5000/api/add-points', {
        data: { points: 25, source }
      });
      expect(res.status()).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Fuente de puntos inválida');
    }
  });

  test('Prevents point farming on already completed interactive modules', async ({ page }) => {
    await performLogin(page, 'student@test.com', 'student123', true);

    // 1. Completar m1_v1 y luego m1_s1 en progreso
    await page.request.post('http://localhost:5000/api/progress/m1_v1');
    await page.request.post('http://localhost:5000/api/progress/m1_s1');

    // 2. Intentar ganar puntos reportando source: 'm1_s1'
    const res = await page.request.post('http://localhost:5000/api/add-points', {
      data: { points: 50, source: 'm1_s1' }
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('ya fue completado');
  });

  test('Enforces strict global cap of 500 Reserve Points and clamps additions', async ({ page }) => {
    // Inicializar estudiante con 480 puntos
    await resetStudentState(page.request, {
      email: 'student@test.com',
      reserve_points: 480
    });

    await performLogin(page, 'student@test.com', 'student123', false);

    // 1. Intentar sumar 50 puntos (480 + 50 = 530 > 500). Debe acotar exactamente a 500
    const clampRes = await page.request.post('http://localhost:5000/api/add-points', {
      data: { points: 50, source: 'm2_s1' }
    });
    expect(clampRes.status()).toBe(200);
    const clampJson = await clampRes.json();
    expect(clampJson.reservePoints).toBe(500);

    // 2. Intentar sumar más puntos una vez en el techo de 500
    const overRes = await page.request.post('http://localhost:5000/api/add-points', {
      data: { points: 10, source: 'm3_s1' }
    });
    expect(overRes.status()).toBe(400);
    const overJson = await overRes.json();
    expect(overJson.error).toContain('límite máximo permitido de 500');
  });

  test('SimulatorView drops postMessage events from malicious origins', async ({ page }) => {
    await performLogin(page, 'student@test.com', 'student123', true);
    await page.goto('/course/practice/m1_s1');

    const sessionPoints = page.locator('#session-points');
    await expect(sessionPoints).toHaveText('+0');

    // Simular inyección de mensaje desde origen falso
    await page.evaluate(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: { type: 'C_ARM_SIMULATOR_SCORE', points: 100 },
        origin: 'https://attacker-fake-domain.xyz'
      }));
    });

    // Los puntos de sesión NO deben haberse alterado
    await page.waitForTimeout(500);
    await expect(sessionPoints).toHaveText('+0');
  });

});
