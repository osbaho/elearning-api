import { test, expect } from '@playwright/test';
import { API, adminSession, newApiContext, uniqueSuffix } from '../helpers/adminHelper.js';
import { performLogin } from '../helpers/loginHelper.js';
import { completeStep, playSimulatorPhase } from '../helpers/simulatorHelper.js';
import { EXAM_QUESTION_COUNT, WILDCARD_COST } from '../../server/config/examRules.js';
import { summarizePoints, wildcardCostOf } from '../../server/services/studentProgress.js';

const FAILED = { score: 40, maxScore: 100, passed: false, errorCount: 3 };
const PASSWORD = 'MiProgreso2026!';

async function studentApi(email, reset = {}) {
  const ctx = await newApiContext();
  const res = await ctx.post(`${API}/test-reset`, { data: { email, password: PASSWORD, reserve_points: 0, ...reset } });
  const { studentId } = await res.json();
  expect((await ctx.post(`${API}/login`, { data: { email, password: PASSWORD } })).ok()).toBe(true);
  return { ctx, id: studentId, progress: async () => (await ctx.get(`${API}/student/progress`)).json() };
}

/** m1_v1, una partida no aprobada y una perfecta en m1_s1 (finalizado) y m1_v2: 3/30 pasos y 10 puntos. */
async function studentWithPlays(email) {
  const s = await studentApi(email);
  await completeStep(s.ctx, 'm1_v1');
  await playSimulatorPhase(s.ctx, 'm1_s1', FAILED);
  await playSimulatorPhase(s.ctx, 'm1_s1');
  expect((await s.ctx.post(`${API}/progress/m1_s1`)).status()).toBe(200);
  await completeStep(s.ctx, 'm1_v2');
  return s;
}

test.describe('Mi progreso y preguntas frecuentes del estudiante', () => {
  test('Reglas puras: costo del comodín y resumen del historial de puntos', () => {
    expect(wildcardCostOf('50/50 on question 7, -100 pts')).toBe(100);
    expect(wildcardCostOf('sin dato')).toBe(WILDCARD_COST);

    const summary = summarizePoints({
      balance: 65,
      plays: [
        { at: '2026-11-20T10:00:00.000Z', stepId: 'm1_s1', tier: 'perfect', points: 10, voided: true },
        { at: '2026-11-21T10:00:00.000Z', stepId: 'm1_s2', tier: 'intermediate', points: 5, voided: false },
      ],
      wildcards: [{ at: '2026-11-23T10:00:00.000Z', cost: 100 }],
      reopens: [{ at: '2026-11-22T10:00:00.000Z', stepId: 'm1_s1', points: 10, reason: 'Falla del simulador' }],
    });
    expect(summary).toMatchObject({ balance: 65, earned: 15, spent: 100, removed: 10, other: 160 });
    // De lo más reciente a lo más antiguo, con signo
    expect(summary.history.map((e) => [e.kind, e.points])).toEqual([
      ['wildcard', -100], ['reopen', -10], ['minigame', 5], ['minigame', 10],
    ]);
    // Dentro de un mismo segundo (la bitácora guarda segundos), el ajuste va después de la partida
    const sameSecond = summarizePoints({
      balance: 0,
      plays: [{ at: '2026-11-25T05:20:31.456Z', stepId: 'm1_s1', tier: 'perfect', points: 10, voided: true }],
      reopens: [{ at: '2026-11-25T05:20:31.000Z', stepId: 'm1_s1', points: 10 }],
    });
    expect(sameSecond.history.map((e) => e.kind)).toEqual(['reopen', 'minigame']);
  });

  test('GET /api/student/progress: avance, puntajes, historial de puntos (también lo descontado al reabrir) y sus datos', async () => {
    const id = uniqueSuffix();
    const s = await studentWithPlays(`progreso_a_${id}@test.com`);
    const admin = await adminSession();
    try {
      const before = await s.progress();
      expect(before.summary).toMatchObject({ percent: 10, completedSteps: 3, totalSteps: 30, currentStep: 'm1_s2', reservePoints: 10 });
      const m1 = before.modules.find((m) => m.module === 1);
      expect(m1.completedSteps).toBe(3);
      expect(m1.steps.find((st) => st.stepId === 'm1_v1')).toMatchObject({ type: 'video', completedAt: expect.any(String) });
      expect(m1.steps.find((st) => st.stepId === 'm1_s1')).toMatchObject({
        type: 'minigame', attempts: 2, bestTier: 'perfect', bestPercent: 100, points: 10, completedAt: expect.any(String), available: true,
      });
      expect(before.modules).toHaveLength(5);
      expect(before.points).toMatchObject({ balance: 10, earned: 10, spent: 0, removed: 0, other: 0 });
      expect(before.points.history.map((e) => [e.kind, e.points])).toEqual([['minigame', 10], ['minigame', 0]]);
      expect(before.exam).toMatchObject({ questionCount: EXAM_QUESTION_COUNT, wildcardCost: WILDCARD_COST, passed: false, history: [] });
      expect(before.account).toMatchObject({ email: `progreso_a_${id}@test.com`, cohort: expect.any(String) });
      // Nada de lo que es solo del admin
      for (const key of ['emails', 'adminActions', 'incidents', 'cases', 'timeline']) expect(before[key]).toBeUndefined();

      // El admin reabre el minijuego: se descuentan sus 10 puntos y queda en el historial, con el motivo
      expect((await admin.post(`/admin/students/${s.id}/reopen`, { stepId: 'm1_s1', reason: 'Falla del simulador' })).status()).toBe(200);
      const after = await s.progress();
      expect(after.points).toMatchObject({ balance: 0, earned: 10, removed: 10, other: 0 });
      expect(after.points.history[0]).toMatchObject({ kind: 'reopen', stepId: 'm1_s1', points: -10, reason: 'Falla del simulador' });
      expect(after.points.history.filter((e) => e.kind === 'minigame').every((e) => e.voided)).toBe(true);
      const reopened = after.modules[0].steps.find((st) => st.stepId === 'm1_s1');
      expect(reopened).toMatchObject({ completedAt: null, attempts: 0, points: 0 });
      expect(reopened.recent.every((r) => r.voided)).toBe(true);

      // Solo para estudiantes y con sesión
      expect((await admin.get('/student/progress')).status()).toBe(403);
      const anonymous = await newApiContext();
      expect((await anonymous.get(`${API}/student/progress`)).status()).toBe(401);
      await anonymous.dispose();
    } finally {
      await admin.dispose();
      await s.ctx.dispose();
    }
  });

  test('El comodín del examen aparece como gasto y los puntos iniciales como ajuste', async () => {
    const s = await studentApi(`progreso_w_${uniqueSuffix()}@test.com`, { complete_course: true, reserve_points: 150 });
    try {
      expect((await s.ctx.post(`${API}/start-exam`)).status()).toBe(200);
      const [question] = await (await s.ctx.get(`${API}/questions`)).json();
      expect((await s.ctx.post(`${API}/use-wildcard`, { data: { question_id: question.id } })).status()).toBe(200);

      const progress = await s.progress();
      expect(progress.points).toMatchObject({ balance: 150 - WILDCARD_COST, earned: 0, spent: WILDCARD_COST, removed: 0, other: 150 });
      expect(progress.points.history).toEqual([expect.objectContaining({ kind: 'wildcard', points: -WILDCARD_COST })]);
      expect(progress.summary).toMatchObject({ percent: 100, currentStep: 'exam' });
      expect(progress.exam.history).toEqual([expect.objectContaining({ number: 1, status: 'in_progress' })]);
    } finally {
      await s.ctx.dispose();
    }
  });

  test('En el curso: «Mi progreso» muestra el avance, los puntos y los datos, y la corrección abre un reporte de cuenta', async ({ page }) => {
    test.setTimeout(90000);
    const email = `progreso_ui_${uniqueSuffix()}@test.com`;
    const s = await studentWithPlays(email);
    await s.ctx.dispose();

    await performLogin(page, email, PASSWORD, false);
    await page.click('#sidebar-my-progress');
    await expect(page).toHaveURL(/\/course\/progreso$/);
    await expect(page.locator('#nav-my-progress')).toHaveClass(/active/);

    await expect(page.locator('#progress-summary')).toContainText('10 %');
    await expect(page.locator('#progress-balance')).toHaveText('10');
    const row = page.locator('#progress-modules tr[data-step="m1_s1"]');
    await expect(row).toContainText('Finalizado');
    await expect(row).toContainText('Perfecta');
    await expect(page.locator('#progress-points tr[data-kind="minigame"]')).toHaveCount(2);
    await expect(page.locator('#progress-exam-rules')).toContainText(`${EXAM_QUESTION_COUNT} preguntas`);
    await expect(page.locator('#progress-account')).toContainText(email);

    await page.click('#progress-account button:has-text("Solicitar una corrección")');
    await expect(page.locator('#report-category')).toHaveValue('account');
  });

  test('Preguntas frecuentes: usan las reglas vigentes del examen', async ({ page }) => {
    const email = `progreso_faq_${uniqueSuffix()}@test.com`;
    await performLogin(page, email, PASSWORD, true);
    await page.click('#nav-faq');
    await expect(page).toHaveURL(/\/course\/ayuda$/);
    await page.click('#faq-examen summary');
    await expect(page.locator('#faq-examen')).toContainText(`${EXAM_QUESTION_COUNT} preguntas`);
    await page.click('#faq-puntos summary');
    await expect(page.locator('#faq-puntos')).toContainText(`cuesta ${WILDCARD_COST}`);
  });
});
