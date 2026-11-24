import { test, expect } from '@playwright/test';
import { io } from 'socket.io-client';
import { performLogin, resetStudentState } from '../helpers/loginHelper.js';

const API = 'http://localhost:5000/api';

async function answerAll(questions, option = 'a') {
  return questions.map(q => ({ question_id: q.id, answer: option }));
}

test.describe('Examen final: integridad del intento, errores visibles y proctoring en servidor', () => {

  test('Un intento abierto con /start-exam es requisito para ver preguntas, enviar y usar comodines', async ({ page }) => {
    await performLogin(page, 'student@test.com', 'student123', true);
    const req = page.request;

    // Sin intento abierto no hay preguntas, envío ni comodín
    const noAttemptQuestions = await req.get(`${API}/questions`);
    expect(noAttemptQuestions.status()).toBe(409);
    expect((await noAttemptQuestions.json()).error).toContain('No tienes un intento de examen en curso');
    expect((await req.post(`${API}/use-wildcard`, { data: { question_id: 1 } })).status()).toBe(409);

    // Abrir intento: fija el set de preguntas y descuenta un intento
    const start = await req.post(`${API}/start-exam`);
    expect(start.status()).toBe(200);
    const startJson = await start.json();
    expect(startJson).toMatchObject({ success: true, attemptsUsed: 1, maxAttempts: 3 });

    const questions = await (await req.get(`${API}/questions`)).json();
    expect(questions.length).toBe(startJson.questionCount);
    // Recargar no cambia las preguntas del intento
    const again = await (await req.get(`${API}/questions`)).json();
    expect(again.map(q => q.id)).toEqual(questions.map(q => q.id));

    // Respuestas inválidas o de otras preguntas se rechazan sin consumir el intento
    expect((await req.post(`${API}/submit-exam`, { data: { answers: questions.map(q => ({ question_id: q.id, answer: 'z' })) } })).status()).toBe(400);
    const partial = await req.post(`${API}/submit-exam`, { data: { answers: await answerAll(questions.slice(1)) } });
    expect(partial.status()).toBe(400);

    // Envío correcto: califica, no revela qué respuestas fueron correctas y cierra el intento
    const submit = await req.post(`${API}/submit-exam`, { data: { answers: await answerAll(questions) } });
    expect(submit.status()).toBe(200);
    const result = await submit.json();
    expect(result).toHaveProperty('score');
    expect(result).not.toHaveProperty('results');
    const resubmit = await req.post(`${API}/submit-exam`, { data: { answers: await answerAll(questions) } });
    expect(resubmit.status()).toBe(409);
  });

  test('Quien ya aprobó no puede abrir otro intento', async ({ page }) => {
    await resetStudentState(page.request, { email: 'student@test.com', pass_exam: true, exam_score: 95 });
    await performLogin(page, 'student@test.com', 'student123', false);
    const start = await page.request.post(`${API}/start-exam`);
    expect(start.status()).toBe(409);
    expect((await start.json()).error).toContain('Ya aprobaste');
  });

  test('La página muestra el motivo real si la API rechaza las preguntas (no se cae)', async ({ page }) => {
    await performLogin(page, 'student@test.com', 'student123', true);
    const crashes = [];
    page.on('pageerror', e => crashes.push(e.message));
    await page.route('**/api/questions', route => route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Debes completar todos los módulos del curso antes de acceder al examen. Completados: 24/26.' }),
    }));

    await page.goto('/course/exam?skipCamera=true');
    await page.click('#start-exam-btn');
    const errorCard = page.locator('#exam-questions-error');
    await expect(errorCard).toContainText('Completados: 24/26');
    await expect(errorCard.locator('button:has-text("Volver al Curso")')).toBeVisible();
    await expect(page.locator('text=Ha ocurrido un imprevisto')).toHaveCount(0);
    expect(crashes).toEqual([]);
  });

  test('Con los 3 intentos agotados el examen no arranca y se explica por qué', async ({ page }) => {
    await resetStudentState(page.request, { email: 'student@test.com', exam_attempts: 3 });
    await performLogin(page, 'student@test.com', 'student123', false);

    // La página lo explica antes de intentarlo: motivo visible y botón deshabilitado
    await page.goto('/course/exam?skipCamera=true');
    await expect(page.locator('#exam-attempts-status')).toContainText('Ya usaste tus 3 intentos');
    await expect(page.locator('#start-exam-btn')).toBeDisabled();
    await expect(page.locator('#exam-main-screen')).toHaveCount(0);

    // Y la API lo rechaza igual si alguien se salta la interfaz
    const start = await page.request.post(`${API}/start-exam`);
    expect(start.status()).toBe(403);
    expect((await start.json()).error).toContain('límite máximo de 3 intentos');
  });

  test('Proctoring en servidor: suspende sin rostro, cierra el intento y no castiga al terminar', async ({ page }) => {
    test.setTimeout(120000);
    await performLogin(page, 'student@test.com', 'student123', true);
    expect((await page.request.post(`${API}/start-exam`)).status()).toBe(200);
    const questions = await (await page.request.get(`${API}/questions`)).json();

    const token = (await page.context().cookies()).find(c => c.name === 'token')?.value;
    expect(token).toBeTruthy();
    const connect = () => io('http://localhost:5000', { transports: ['websocket'], extraHeaders: { Cookie: `token=${token}` } });

    // A: supervisión activa sin rostro frente a la cámara → suspensión en ≤ 3 ciclos del monitor
    const noFace = connect();
    const suspended = new Promise(resolve => noFace.on('exam_suspended', resolve));
    await new Promise(resolve => noFace.on('connect', resolve));
    noFace.emit('start_exam');
    const badBeats = setInterval(() => noFace.emit('proctoring_heartbeat', { faceDetected: false, isMatch: null }), 3000);

    // B: identidad no evaluable (null) con rostro presente, y fin explícito de la supervisión
    const finished = connect();
    let finishedSuspended = false;
    finished.on('exam_suspended', () => { finishedSuspended = true; });
    await new Promise(resolve => finished.on('connect', resolve));
    finished.emit('start_exam');
    finished.emit('proctoring_heartbeat', { faceDetected: true, isMatch: null });
    await new Promise(r => setTimeout(r, 4000));
    finished.emit('proctoring_heartbeat', { faceDetected: true, isMatch: null });
    finished.emit('end_exam'); // sin esto, el monitor lo daría por "señal perdida" a los 30 s
    const finishedLastBeat = Date.now();

    try {
      const reason = await Promise.race([
        suspended,
        new Promise((_, reject) => setTimeout(() => reject(new Error('sin suspensión en 50 s')), 50000)),
      ]);
      expect(reason.reason).toContain('Rostro no detectado');

      // La suspensión cerró el intento en el servidor: ya no se puede enviar por la API
      const submit = await page.request.post(`${API}/submit-exam`, { data: { answers: await answerAll(questions) } });
      expect(submit.status()).toBe(409);
      // y el historial de intentos lo registra como suspendido
      const me = await (await page.request.get(`${API}/student/me`)).json();
      expect(me.exam.history.map(a => a.status)).toEqual(['suspended']);

      // B terminó su supervisión: superado el umbral de 30 s sin latidos (+ un ciclo del monitor),
      // no debe haber suspensión
      const remaining = 46000 - (Date.now() - finishedLastBeat);
      if (remaining > 0) await page.waitForTimeout(remaining);
      expect(finishedSuspended).toBe(false);
    } finally {
      clearInterval(badBeats);
      noFace.disconnect();
      finished.disconnect();
    }
  });
});
