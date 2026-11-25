import { test, expect } from '@playwright/test';
import { API, adminSession, newApiContext, uniqueSuffix } from '../helpers/adminHelper.js';
import { performLogin } from '../helpers/loginHelper.js';
import { completeStep, playSimulatorPhase } from '../helpers/simulatorHelper.js';

const PASSWORD = 'PracticaLibre2026!';
const PERFECT = { score: 100, maxScore: 100, passed: true, errorCount: 0, doseMsv: 0, timeSeconds: 1 };

/** Página que sustituye al build de Unity: habla el mismo protocolo (ready / phase-result). */
const FAKE_UNITY_PAGE = `<!doctype html><html><body><script>
  var params = new URLSearchParams(location.search);
  window.sendPhaseResult = function () {
    window.parent.postMessage({
      source: 'carm-sim', v: 1, type: 'phase-result',
      attemptId: params.get('attempt'), stepId: params.get('step'), phase: Number(params.get('phase')),
      score: 100, maxScore: 100, passed: true, errorCount: 0, doseMsv: 0, timeSeconds: 1
    }, location.origin);
  };
  window.parent.postMessage({ source: 'carm-sim', v: 1, type: 'ready' }, location.origin);
</script></body></html>`;

/** m1_v1 y m1_s1 finalizado con una partida perfecta (10 puntos). */
async function studentWithFinishedMinigame(email) {
  const ctx = await newApiContext();
  const res = await ctx.post(`${API}/test-reset`, { data: { email, password: PASSWORD, reserve_points: 0 } });
  const { studentId } = await res.json();
  expect((await ctx.post(`${API}/login`, { data: { email, password: PASSWORD } })).ok()).toBe(true);
  await completeStep(ctx, 'm1_v1');
  await playSimulatorPhase(ctx, 'm1_s1');
  expect((await ctx.post(`${API}/progress/m1_s1`)).status()).toBe(200);
  return { ctx, id: studentId };
}

test.describe('Práctica libre: seguir jugando un minijuego finalizado, sin puntos', () => {
  test('El API: solo con el minijuego finalizado, no suma puntos y no cuenta en el seguimiento', async () => {
    const id = uniqueSuffix();
    const email = `practica_api_${id}@test.com`;
    const s = await studentWithFinishedMinigame(email);
    const admin = await adminSession();
    try {
      // Una partida normal ya no se puede; la práctica libre en un minijuego sin finalizar, tampoco
      const normal = await s.ctx.post(`${API}/simulator/attempts`, { data: { stepId: 'm1_s1' } });
      expect(normal.status()).toBe(409);
      expect((await normal.json()).error).toContain('práctica libre');
      await completeStep(s.ctx, 'm1_v2');
      expect((await s.ctx.post(`${API}/simulator/attempts`, { data: { stepId: 'm1_s2', practice: true } })).status()).toBe(409);

      const created = await s.ctx.post(`${API}/simulator/attempts`, { data: { stepId: 'm1_s1', practice: true } });
      expect(created.status()).toBe(201);
      const attempt = await created.json();
      expect(attempt).toMatchObject({ stepId: 'm1_s1', practice: true });
      const result = await (await s.ctx.post(`${API}/simulator/attempts/${attempt.attemptId}/result`, {
        data: { ...PERFECT, phase: attempt.phase },
      })).json();
      expect(result).toMatchObject({ practice: true, tier: 'perfect', pointsAwarded: 0, reservePoints: 10, stepCapReached: false });

      expect(await (await s.ctx.get(`${API}/simulator/steps/m1_s1`)).json())
        .toMatchObject({ completedAttempts: 1, practiceAttempts: 1, pointsEarned: 10, stepCompleted: true });

      // Seguimiento y resumen de la ficha: solo la partida normal; la ficha lista la de práctica con su marca
      const tracking = await (await admin.get(`/admin/progress?search=${encodeURIComponent(email)}`)).json();
      expect(tracking.students[0].minigames.m1_s1).toMatchObject({ attempts: 1, points: 10 });
      const detail = await (await admin.get(`/admin/students/${s.id}/detail`)).json();
      const step = detail.steps.find((x) => x.stepId === 'm1_s1');
      expect(step.summary).toMatchObject({ attempts: 1 });
      expect(step.attempts.map((a) => a.practice)).toEqual([false, true]);

      // Mi progreso: cuenta las de práctica aparte y no las pone en el historial de puntos
      const progress = await (await s.ctx.get(`${API}/student/progress`)).json();
      expect(progress.modules[0].steps.find((x) => x.stepId === 'm1_s1')).toMatchObject({ attempts: 1, practiceAttempts: 1, points: 10 });
      expect(progress.points.history.filter((e) => e.kind === 'minigame')).toHaveLength(1);
    } finally {
      await admin.dispose();
      await s.ctx.dispose();
    }
  });

  test('En la práctica: con el minijuego finalizado se ofrece practicar sin puntos', async ({ page }) => {
    test.setTimeout(60000);
    const email = `practica_ui_${uniqueSuffix()}@test.com`;
    const s = await studentWithFinishedMinigame(email);
    await s.ctx.dispose();

    await performLogin(page, email, PASSWORD, false);
    await page.route('**/webgl/index.html*', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: FAKE_UNITY_PAGE })
    );
    await page.goto('/course/practice/m1_s1');
    await expect(page.locator('#practice-completed')).toContainText('Práctica Completada', { timeout: 15000 });
    await page.click('#btn-free-practice');
    await expect(page.locator('#practice-mode-note')).toBeVisible();
    await page.click('button:has-text("Comenzar práctica libre")');
    await expect(page.locator('aside')).toContainText('Simulador listo', { timeout: 15000 });

    const frame = page.frames().find((f) => f.url().includes('/webgl/index.html'));
    expect(frame).toBeTruthy();
    const [response] = await Promise.all([
      page.waitForResponse((res) => res.url().endsWith('/result') && res.request().method() === 'POST'),
      frame.evaluate(() => window.sendPhaseResult()),
    ]);
    expect(await response.json()).toMatchObject({ practice: true, pointsAwarded: 0 });
    await expect(page.getByText('No suma Puntos de Reserva')).toBeVisible();
  });
});
