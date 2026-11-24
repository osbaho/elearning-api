import { test, expect } from '@playwright/test';
import { performLogin } from '../helpers/loginHelper.js';
import { playSimulatorPhase } from '../helpers/simulatorHelper.js';

test.describe('Security & Business Logic Hardening', () => {

  test('Public verification endpoint /api/verify/:code validates certificates accurately', async ({ request }) => {
    // Código que no existe
    const invalidRes = await request.get('http://localhost:5000/api/verify/CARM-INVALID123');
    expect(invalidRes.status()).toBe(404);
    const invalidJson = await invalidRes.json();
    expect(invalidJson.valid).toBe(false);

    // Formato inválido sin prefijo
    const badFormatRes = await request.get('http://localhost:5000/api/verify/XYZ-999');
    expect(badFormatRes.status()).toBe(404);
  });

  test('Wildcard endpoint hardcodes cost in server and prevents client manipulation', async ({ page }) => {
    await performLogin(page, 'student@test.com', 'student123', true);

    // El comodín solo vale dentro de un intento de examen abierto
    const startRes = await page.request.post('http://localhost:5000/api/start-exam');
    expect(startRes.status()).toBe(200);
    const qRes = await page.request.get('http://localhost:5000/api/questions');
    const questions = await qRes.json();
    const targetQuestionId = questions[0].id;

    // Intentar invocar use-wildcard enviando cost: 1 con puntos suficientes
    // Se debe debitar WILDCARD_COST (100 pts) fijo, no 1 pt
    const res = await page.request.post('http://localhost:5000/api/use-wildcard', {
      data: {
        question_id: targetQuestionId,
        cost: 1 // intento malicioso de pagar solo 1 punto
      }
    });

    // Como el estudiante tiene 150 puntos en test-reset y cuesta 100, debe quedar en 50
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.reservePoints).toBe(50); // 150 - 100 = 50 (ignora el cost: 1)
  });

  test('Course progress requires strict sequential completion', async ({ page }) => {
    await performLogin(page, 'student@test.com', 'student123', true);

    // Intentar saltar directamente a m5_v3 sin haber completado los pasos previos
    const skipRes = await page.request.post('http://localhost:5000/api/progress/m5_v3');
    expect(skipRes.status()).toBe(403);
    const skipJson = await skipRes.json();
    expect(skipJson.error).toContain('Secuencia requerida');

    // El primer paso m1_v1 sí debe permitirse
    const firstStepRes = await page.request.post('http://localhost:5000/api/progress/m1_v1');
    expect(firstStepRes.status()).toBe(200);

    // m1_s1 (segundo paso) es un minijuego del simulador: sin una partida terminada se rechaza
    const unplayedRes = await page.request.post('http://localhost:5000/api/progress/m1_s1');
    expect(unplayedRes.status()).toBe(403);
    expect((await unplayedRes.json()).error).toContain('al menos una partida');

    // Tras jugar una partida, el segundo paso sí debe permitirse
    await playSimulatorPhase(page.request, 'm1_s1');
    const secondStepRes = await page.request.post('http://localhost:5000/api/progress/m1_s1');
    expect(secondStepRes.status()).toBe(200);
  });

});
