import { test, expect } from '@playwright/test';
import { performLogin, resetStudentState } from '../helpers/loginHelper.js';

test.describe('Exam Resilience & Anti-Tampering Chaos Testing', () => {

  test('Rejects malformed, empty, duplicate, and non-existent question submissions', async ({ page }) => {
    await performLogin(page, 'student@test.com', 'student123', true);

    // 1. Envío vacío o no array
    const emptyRes = await page.request.post('http://localhost:5000/api/submit-exam', {
      data: { answers: [] }
    });
    expect(emptyRes.status()).toBe(400);

    const nonArrayRes = await page.request.post('http://localhost:5000/api/submit-exam', {
      data: { answers: 'all_options_a' }
    });
    expect(nonArrayRes.status()).toBe(400);

    // 2. Preguntas con ID inexistente
    const invalidIdRes = await page.request.post('http://localhost:5000/api/submit-exam', {
      data: {
        answers: [
          { question_id: 999999, answer: 'a' },
          { question_id: 999998, answer: 'b' },
          { question_id: 999997, answer: 'c' },
          { question_id: 999996, answer: 'd' },
          { question_id: 999995, answer: 'a' }
        ]
      }
    });
    expect(invalidIdRes.status()).toBe(400);
    expect((await invalidIdRes.json()).error).toContain('no existe');

    // 3. ID no entero o negativo
    const badIntRes = await page.request.post('http://localhost:5000/api/submit-exam', {
      data: {
        answers: [
          { question_id: -5, answer: 'a' },
          { question_id: 2.5, answer: 'b' }
        ]
      }
    });
    expect(badIntRes.status()).toBe(400);
    expect((await badIntRes.json()).error).toContain('entero positivo');

    // 4. Preguntas duplicadas en el payload para intentar inflar la tasa de acierto
    const duplicateRes = await page.request.post('http://localhost:5000/api/submit-exam', {
      data: {
        answers: [
          { question_id: 1, answer: 'a' },
          { question_id: 1, answer: 'a' },
          { question_id: 2, answer: 'b' },
          { question_id: 3, answer: 'c' },
          { question_id: 4, answer: 'd' }
        ]
      }
    });
    expect(duplicateRes.status()).toBe(400);
    expect((await duplicateRes.json()).error).toContain('duplicadas');

    // 5. Menos preguntas del mínimo reglamentario (menos de 5)
    const tooFewRes = await page.request.post('http://localhost:5000/api/submit-exam', {
      data: {
        answers: [
          { question_id: 1, answer: 'a' },
          { question_id: 2, answer: 'b' }
        ]
      }
    });
    expect(tooFewRes.status()).toBe(400);
    expect((await tooFewRes.json()).error).toContain('mínimo');
  });

  test('Enforces strictly 3 exam attempts limit across repeated starts', async ({ page }) => {
    await performLogin(page, 'student@test.com', 'student123', true);

    // Intento 1
    const res1 = await page.request.post('http://localhost:5000/api/start-exam');
    expect(res1.status()).toBe(200);

    // Intento 2
    const res2 = await page.request.post('http://localhost:5000/api/start-exam');
    expect(res2.status()).toBe(200);

    // Intento 3
    const res3 = await page.request.post('http://localhost:5000/api/start-exam');
    expect(res3.status()).toBe(200);

    // Intento 4: Debe responder 403 Forbidden
    const res4 = await page.request.post('http://localhost:5000/api/start-exam');
    expect(res4.status()).toBe(403);
    const json4 = await res4.json();
    expect(json4.error).toContain('límite máximo de 3 intentos');
  });

  test('Blocks resubmission with 409 Conflict if student has already passed the exam', async ({ page }) => {
    // Inicializar estudiante con examen ya aprobado
    await resetStudentState(page.request, {
      email: 'student@test.com',
      pass_exam: true,
      exam_score: 95
    });

    await performLogin(page, 'student@test.com', 'student123', false);

    const reSubmitRes = await page.request.post('http://localhost:5000/api/submit-exam', {
      data: {
        answers: [
          { question_id: 1, answer: 'a' },
          { question_id: 2, answer: 'b' },
          { question_id: 3, answer: 'c' },
          { question_id: 4, answer: 'd' },
          { question_id: 5, answer: 'a' }
        ]
      }
    });

    expect(reSubmitRes.status()).toBe(409);
    const json = await reSubmitRes.json();
    expect(json.error).toContain('Ya has completado y aprobado el examen');
  });

  test('Wildcard rejects when points are insufficient, question is missing or invalid', async ({ page }) => {
    // Configurar estudiante con sólo 50 puntos (el comodín cuesta 100)
    await resetStudentState(page.request, {
      email: 'student@test.com',
      reserve_points: 50
    });

    await performLogin(page, 'student@test.com', 'student123', false);

    // 1. Puntos insuficientes
    const resLowPoints = await page.request.post('http://localhost:5000/api/use-wildcard', {
      data: { question_id: 1 }
    });
    expect(resLowPoints.status()).toBe(400);
    const lowJson = await resLowPoints.json();
    expect(lowJson.error).toContain('Puntos insuficientes');

    // 2. Dar 150 puntos y probar con question_id inexistente
    await resetStudentState(page.request, {
      email: 'student@test.com',
      reserve_points: 150
    });
    const resBadQ = await page.request.post('http://localhost:5000/api/use-wildcard', {
      data: { question_id: 888888 }
    });
    expect(resBadQ.status()).toBe(400);
    const badQJson = await resBadQ.json();
    expect(badQJson.error).toContain('Pregunta no encontrada');

    // 3. Probar con question_id no numérico o inválido
    const resInvalidId = await page.request.post('http://localhost:5000/api/use-wildcard', {
      data: { question_id: 'no_es_id' }
    });
    expect(resInvalidId.status()).toBe(400);
    expect((await resInvalidId.json()).error).toContain('entero positivo');
  });

});
