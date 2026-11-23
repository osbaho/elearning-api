import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { performLogin, resetStudentState } from '../helpers/loginHelper.js';
import { playSimulatorPhase, PERFECT_RESULT } from '../helpers/simulatorHelper.js';
import { COURSE_STEPS, TOTAL_COURSE_STEPS, VIDEO_DURATION_SECONDS, isVideoStep } from '../../server/config/curriculum.js';

const API = 'http://localhost:5000/api';
const MODULE1_VIDEOS = ['M01_V01_SER.mp4', 'M01_V02_Fisica.mp4', 'M01_V03_Geometria.mp4'];

/**
 * Página que sustituye al build de Unity en /webgl/index.html: implementa el mismo
 * protocolo que la plantilla CArmEmbed + ScormBridge (ready, phase-result, phase-ack).
 */
const FAKE_UNITY_PAGE = `<!doctype html><html><body><script>
  window.__acks = [];
  var params = new URLSearchParams(location.search);
  window.addEventListener('message', function (e) {
    if (e.source !== window.parent || e.origin !== location.origin) return;
    if (e.data && e.data.source === 'carm-host') window.__acks.push(e.data);
  });
  window.sendPhaseResult = function (overrides) {
    var msg = Object.assign({
      source: 'carm-sim', v: 1, type: 'phase-result',
      attemptId: params.get('attempt'), stepId: params.get('step'), phase: Number(params.get('phase')),
      score: 100, maxScore: 100, passed: true, errorCount: 0, doseMsv: 0.12, timeSeconds: 1
    }, overrides || {});
    window.parent.postMessage(msg, location.origin);
  };
  window.parent.postMessage({ source: 'carm-sim', v: 1, type: 'ready' }, location.origin);
</script></body></html>`;

test.describe('Módulo 1: malla, videos y simulador', () => {
  test('La malla del cliente coincide con la del servidor (26 pasos, módulo 1 = 3 videos + 3 minijuegos)', async () => {
    const configSource = fs.readFileSync(path.resolve('client/src/lib/courseConfig.js'), 'utf8');
    const clientSteps = [...configSource.matchAll(/key:\s*'(m\d+_[a-z0-9]+)'/g)].map(m => m[1]);

    expect(clientSteps).toEqual([...COURSE_STEPS]);
    expect(TOTAL_COURSE_STEPS).toBe(26);
    expect(COURSE_STEPS.slice(0, 6)).toEqual(['m1_v1', 'm1_s1', 'm1_v2', 'm1_s2', 'm1_v3', 'm1_s3']);
    expect(COURSE_STEPS).not.toContain('m1_vr');
    for (const video of MODULE1_VIDEOS) {
      expect(configSource).toContain(`/videos/modulo1/${video}`);
    }
    // Cada video de la malla tiene su duración registrada (define el tiempo mínimo de visualización)
    const videoSteps = COURSE_STEPS.filter(isVideoStep);
    expect(videoSteps.length).toBe(15);
    for (const step of videoSteps) {
      expect(VIDEO_DURATION_SECONDS[step], step).toBeGreaterThan(0);
    }
  });

  test('Los videos definitivos del módulo 1 se sirven con soporte de rangos (seek)', async ({ page }) => {
    const videosDir = path.resolve('client/public/videos/modulo1');
    test.skip(!MODULE1_VIDEOS.every(v => fs.existsSync(path.join(videosDir, v))),
      'Videos no generados: ejecuta scripts/prepare-module-videos.ps1 -Module 1');

    // El contenido del curso exige sesión
    await performLogin(page, 'student@test.com', 'student123', true);
    for (const video of MODULE1_VIDEOS) {
      const res = await page.request.get(`/videos/modulo1/${video}`, { headers: { Range: 'bytes=0-1023' } });
      expect(res.status(), video).toBe(206);
      expect(res.headers()['content-type']).toContain('video/mp4');
      // faststart: el índice (moov) va justo después de ftyp, al inicio del archivo
      expect((await res.body()).includes(Buffer.from('moov')), `${video} con faststart`).toBeTruthy();
    }
  });

  test('API del simulador: secuencia, niveles de puntos, idempotencia y finalización', async ({ page }) => {
    await performLogin(page, 'student@test.com', 'student123', true);
    await resetStudentState(page.request, { reserve_points: 0 });
    const req = page.request;

    // Práctica de la malla sin contenido Unity: estado válido (200, no disponible); paso inexistente: 404
    const noSim = await req.get(`${API}/simulator/steps/m2_s1`);
    expect(noSim.status()).toBe(200);
    expect(await noSim.json()).toMatchObject({ stepId: 'm2_s1', available: false, stepCompleted: false });
    expect((await req.get(`${API}/simulator/steps/m9_s9`)).status()).toBe(404);
    expect((await req.post(`${API}/simulator/attempts`, { data: { stepId: 'm2_s1' } })).status()).toBe(404);

    // Secuencia: el video previo debe estar completo
    const early = await req.post(`${API}/simulator/attempts`, { data: { stepId: 'm1_s1' } });
    expect(early.status()).toBe(403);
    await req.post(`${API}/progress/m1_v1`);

    // Finalizar sin haber jugado está bloqueado
    const finishTooSoon = await req.post(`${API}/progress/m1_s1`);
    expect(finishTooSoon.status()).toBe(403);
    expect((await finishTooSoon.json()).error).toContain('al menos una partida');

    // Crear intento: la API decide escena y fase
    const created = await req.post(`${API}/simulator/attempts`, { data: { stepId: 'm1_s1' } });
    expect(created.status()).toBe(201);
    const attempt = await created.json();
    expect(attempt).toMatchObject({ stepId: 'm1_s1', scene: 'Scene1', phase: 1 });

    // Validaciones del resultado
    const resultUrl = `${API}/simulator/attempts/${attempt.attemptId}/result`;
    expect((await req.post(resultUrl, { data: { ...PERFECT_RESULT, phase: 2 } })).status()).toBe(422);
    expect((await req.post(resultUrl, { data: { ...PERFECT_RESULT, phase: 1, timeSeconds: 3600 } })).status()).toBe(422);
    expect((await req.post(resultUrl, { data: { ...PERFECT_RESULT, phase: 1, score: 120 } })).status()).toBe(400);

    // Partida perfecta → 10 pts; reenviarla no suma otra vez
    const perfect = await req.post(resultUrl, { data: { ...PERFECT_RESULT, phase: 1 } });
    expect(perfect.status()).toBe(200);
    expect(await perfect.json()).toMatchObject({ tier: 'perfect', pointsAwarded: 10, reservePoints: 10, duplicate: false });
    const again = await req.post(resultUrl, { data: { ...PERFECT_RESULT, phase: 1 } });
    expect(await again.json()).toMatchObject({ tier: 'perfect', pointsAwarded: 10, reservePoints: 10, duplicate: true });

    // Aprobada con errores → 5 pts; < 70 % o no aprobada → 0 pts
    const intermediate = await playSimulatorPhase(req, 'm1_s1', { score: 85, errorCount: 2 });
    expect(intermediate.result).toMatchObject({ tier: 'intermediate', pointsAwarded: 5, reservePoints: 15 });
    const lowScore = await playSimulatorPhase(req, 'm1_s1', { score: 60, errorCount: 0 });
    expect(lowScore.result).toMatchObject({ tier: 'failed', pointsAwarded: 0, reservePoints: 15 });
    const notPassed = await playSimulatorPhase(req, 'm1_s1', { score: 90, passed: false, errorCount: 0 });
    expect(notPassed.result).toMatchObject({ tier: 'failed', pointsAwarded: 0 });

    // Estado del paso
    const info = await (await req.get(`${API}/simulator/steps/m1_s1`)).json();
    expect(info).toMatchObject({ available: true, completedAttempts: 4, pointsEarned: 15, stepCompleted: false });

    // Ya se puede finalizar; después no se admiten más partidas
    expect((await req.post(`${API}/progress/m1_s1`)).status()).toBe(200);
    expect((await req.post(`${API}/simulator/attempts`, { data: { stepId: 'm1_s1' } })).status()).toBe(409);
  });

  test('Un estudiante no puede registrar resultados en la partida de otro', async ({ page, browser }) => {
    await performLogin(page, 'student@test.com', 'student123', true);
    await page.request.post(`${API}/progress/m1_v1`);
    const attempt = await (await page.request.post(`${API}/simulator/attempts`, { data: { stepId: 'm1_s1' } })).json();

    const otherContext = await browser.newContext();
    const other = await otherContext.newPage();
    await performLogin(other, 'otro.estudiante@test.com', 'otro12345', true);
    const foreign = await other.request.post(`${API}/simulator/attempts/${attempt.attemptId}/result`, { data: { ...PERFECT_RESULT, phase: 1 } });
    expect(foreign.status()).toBe(404);
    await otherContext.close();

    // La partida sigue intacta para su dueño
    const own = await page.request.post(`${API}/simulator/attempts/${attempt.attemptId}/result`, { data: { ...PERFECT_RESULT, phase: 1 } });
    expect(own.status()).toBe(200);
  });

  test('Un minijuego aporta como máximo 50 Puntos de Reserva', async ({ page }) => {
    await performLogin(page, 'student@test.com', 'student123', true);
    await resetStudentState(page.request, { reserve_points: 0 });
    await page.request.post(`${API}/progress/m1_v1`);

    for (let i = 1; i <= 5; i++) {
      const { result } = await playSimulatorPhase(page.request, 'm1_s1');
      expect(result).toMatchObject({ pointsAwarded: 10, stepPointsEarned: 10 * i, stepPointsMax: 50, stepCapReached: false });
    }
    // La sexta partida perfecta se registra, pero ya no suma
    const { result: sixth } = await playSimulatorPhase(page.request, 'm1_s1');
    expect(sixth).toMatchObject({ tier: 'perfect', pointsAwarded: 0, reservePoints: 50, stepPointsEarned: 50, stepCapReached: true });

    const info = await (await page.request.get(`${API}/simulator/steps/m1_s1`)).json();
    expect(info).toMatchObject({ completedAttempts: 6, pointsEarned: 50, maxPoints: 50 });
  });

  test('El techo de 500 Puntos de Reserva se respeta en el simulador', async ({ page }) => {
    await performLogin(page, 'student@test.com', 'student123', true);
    await resetStudentState(page.request, { reserve_points: 495 });
    await page.request.post(`${API}/progress/m1_v1`);

    const { result } = await playSimulatorPhase(page.request, 'm1_s1');
    expect(result).toMatchObject({ tier: 'perfect', pointsAwarded: 5, reservePoints: 500 });
  });

  test('Contrato del iframe: la página lanza el simulador con el intento y registra su resultado', async ({ page }) => {
    await performLogin(page, 'student@test.com', 'student123', true);
    await page.request.post(`${API}/progress/m1_v1`);
    await page.route('**/webgl/index.html*', route =>
      route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: FAKE_UNITY_PAGE })
    );

    await page.goto('/course/practice/m1_s1');
    await page.click('button:has-text("Comenzar minijuego")');

    const iframe = page.locator('iframe[title^="Simulador C-Arm"]');
    await expect(iframe).toBeVisible();
    const src = await iframe.getAttribute('src');
    expect(src).toMatch(/^\/webgl\/index\.html\?attempt=[0-9a-f-]{36}&step=m1_s1&scene=Scene1&phase=1$/);
    await expect(page.locator('aside')).toContainText('Simulador listo');

    const frame = page.frames().find(f => f.url().includes('/webgl/index.html'));
    expect(frame).toBeTruthy();

    // Un mensaje de otro intento se ignora
    await frame.evaluate(() => window.sendPhaseResult({ attemptId: '00000000-0000-4000-8000-000000000000' }));
    await page.waitForTimeout(300);
    await expect(page.locator('#session-points')).toHaveText('+0');

    // El resultado real se registra y la plataforma devuelve el acuse al simulador
    const [response] = await Promise.all([
      page.waitForResponse(res => res.url().endsWith('/result') && res.status() === 200),
      frame.evaluate(() => window.sendPhaseResult()),
    ]);
    expect(await response.json()).toMatchObject({ tier: 'perfect', pointsAwarded: 10 });
    await expect(page.locator('#session-points')).toHaveText('+10');
    await expect.poll(() => frame.evaluate(() => window.__acks)).toEqual([
      expect.objectContaining({ source: 'carm-host', v: 1, type: 'phase-ack', tier: 'perfect', pointsAwarded: 10 })
    ]);

    // Con una partida terminada ya se puede finalizar el minijuego
    await expect(page.locator('button:has-text("Finalizar Práctica")')).toBeEnabled();
  });

  test('Build WebGL real: Unity carga en el iframe, lee el lanzamiento y recibe el acuse de la plataforma', async ({ page }) => {
    test.skip(!fs.existsSync(path.resolve('client/public/webgl/index.html')),
      'Build WebGL no generado: menú de Unity CArm → Build WebGL para ArcoC');
    test.setTimeout(240000);

    await performLogin(page, 'student@test.com', 'student123', true);
    await page.request.post(`${API}/progress/m1_v1`);
    const logs = [];
    page.on('console', msg => logs.push(msg.text()));
    const sawLog = (...parts) => logs.some(line => parts.every(p => line.includes(p)));

    await page.goto('/course/practice/m1_s1');
    await page.click('button:has-text("Comenzar minijuego")');
    const iframe = page.locator('iframe[title^="Simulador C-Arm"]');
    const attemptId = new URL(await iframe.getAttribute('src'), 'http://localhost').searchParams.get('attempt');

    // La plantilla CArmEmbed avisa "ready" cuando Unity terminó de cargar
    await expect(page.locator('aside')).toContainText('Simulador listo', { timeout: 200000 });

    // Unity leyó attempt/step/scene/phase de la URL (WebLaunchContext) y el jslib corre en el navegador
    await expect.poll(() => sawLog('[WebLaunch]', attemptId, 'step=m1_s1', 'scene=Scene1', 'phase=1'), { timeout: 15000 }).toBeTruthy();
    await expect.poll(() => sawLog('[SCORM] Sin LMS SCORM'), { timeout: 15000 }).toBeTruthy();

    // Acuse plataforma → Unity: plantilla → SendMessage → ScormBridge.OnHostMessage (C#)
    await page.evaluate((id) => {
      document.querySelector('iframe[title^="Simulador C-Arm"]').contentWindow.postMessage(
        { source: 'carm-host', v: 1, type: 'phase-ack', attemptId: id, tier: 'perfect', pointsAwarded: 10, reservePoints: 160 },
        window.location.origin
      );
    }, attemptId);
    await expect.poll(() => sawLog('[WebBridge] phase-ack', attemptId), { timeout: 15000 }).toBeTruthy();
  });
});
