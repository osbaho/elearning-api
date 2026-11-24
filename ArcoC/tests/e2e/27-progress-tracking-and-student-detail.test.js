import { test, expect } from '@playwright/test';
import { API, ADMIN_PASSWORD, adminSession, ensureCohort, newApiContext } from '../helpers/adminHelper.js';
import { performLogin } from '../helpers/loginHelper.js';
import { completeStep, playSimulatorPhase } from '../helpers/simulatorHelper.js';
import {
  ALERT_RULES, computeAlerts, currentStepOf, summarizeMinigame, summarizeRows, toIso,
} from '../../server/services/progressTracking.js';
import { MAX_EXAM_ATTEMPTS } from '../../server/config/examRules.js';

const FAILED = { score: 40, maxScore: 100, passed: false, errorCount: 3 };
const INTERMEDIATE = { score: 80, maxScore: 100, passed: true, errorCount: 2 };
// Promoción propia y sin fechas: las alertas de calendario no dependen del estado de la base
const COHORT = 'Seguimiento E2E';

/** Estudiante reiniciado (sin progreso ni puntos) con sesión propia; devuelve { ctx, id }. */
async function freshStudent(email, password, reset = {}) {
  const ctx = await newApiContext();
  const res = await ctx.post(`${API}/test-reset`, {
    data: { email, password, name: reset.name || 'Dra. Seguimiento', reserve_points: 0, exam_attempts: 0, cohort: COHORT, ...reset },
  });
  const { studentId } = await res.json();
  const login = await ctx.post(`${API}/login`, { data: { email, password } });
  if (!login.ok()) throw new Error(`Login de ${email} falló: ${login.status()}`);
  return { ctx, id: studentId };
}

/**
 * Estado conocido del estudiante A: m1_v1, m1_s1 (una partida no aprobada y una perfecta, finalizado)
 * y m1_v2 completos; en m1_s2 una partida intermedia sin finalizar. Avance 3/30 = 10 %, 15 puntos.
 */
async function prepareStudentA() {
  const a = await freshStudent('seguimiento_a@test.com', 'Seguimiento2026!', { name: 'Dra. Seguimiento A' });
  await completeStep(a.ctx, 'm1_v1');
  await playSimulatorPhase(a.ctx, 'm1_s1', FAILED);
  await playSimulatorPhase(a.ctx, 'm1_s1');
  expect((await a.ctx.post(`${API}/progress/m1_s1`)).status()).toBe(200);
  await completeStep(a.ctx, 'm1_v2');
  await playSimulatorPhase(a.ctx, 'm1_s2', INTERMEDIATE);
  return a;
}

test.describe('Seguimiento del avance por promoción y ficha del estudiante', () => {
  test.beforeAll(async () => {
    const admin = await adminSession();
    await ensureCohort(admin, { name: COHORT });
    await admin.dispose();
  });

  test('Reglas puras: resumen de minijuegos, paso actual, fechas y alertas', () => {
    expect(toIso('2026-11-24 10:00:00')).toBe('2026-11-24T10:00:00.000Z');
    expect(toIso(new Date('2026-11-24T10:00:00Z'))).toBe('2026-11-24T10:00:00.000Z');
    expect(toIso('no es fecha')).toBeNull();

    // El mejor resultado se elige por nivel y luego por porcentaje; los puntos se suman
    expect(summarizeMinigame([])).toMatchObject({ attempts: 0, bestTier: null, points: 0 });
    const summary = summarizeMinigame([
      { status: 'completed', score: 95, max_score: 100, tier: 'intermediate', points_awarded: 5, completed_at: '2026-11-20T10:00:00Z' },
      { status: 'completed', score: 72, max_score: 100, tier: 'perfect', points_awarded: 10, completed_at: '2026-11-21 09:00:00' },
      { status: 'started', score: null, max_score: null, tier: null, points_awarded: null, completed_at: null },
    ]);
    expect(summary).toEqual({ attempts: 2, bestTier: 'perfect', bestPercent: 72, points: 15, lastPlayedAt: '2026-11-21T09:00:00.000Z' });

    expect(currentStepOf(new Set(['m1_v1']), false)).toBe('m1_s1');
    expect(currentStepOf(new Set(), true)).toBeNull();

    const now = new Date('2026-11-24T12:00:00Z');
    const base = {
      certified: false, isActive: true, activated: true, accessState: 'open',
      createdAt: '2026-10-01T00:00:00.000Z', activatedAt: '2026-10-01T00:00:00.000Z',
      accessStartIso: '2026-10-01T00:00:00.000Z', lastActivityAt: '2026-11-23T00:00:00.000Z',
      startsOn: null, endsOn: null, percent: 50, minigames: {}, completed: new Set(), examAttemptsUsed: 0,
    };
    const codes = (s) => computeAlerts(s, now).map((a) => a.code);
    expect(codes(base)).toEqual([]);
    expect(codes({ ...base, lastActivityAt: '2026-11-10T00:00:00.000Z' })).toEqual(['inactive']);
    // Sin ninguna actividad cuenta desde el inicio de su acceso
    expect(computeAlerts({ ...base, lastActivityAt: null }, now)[0]).toMatchObject({ code: 'inactive', days: 54 });
    expect(codes({ ...base, activated: false, createdAt: '2026-11-01T00:00:00.000Z' })).toEqual(['not_activated']);
    expect(codes({ ...base, activated: false, createdAt: '2026-11-20T00:00:00.000Z' })).toEqual([]);
    // Promoción del 1 de octubre al 30 de noviembre: a esta altura se espera ~90 %
    expect(codes({ ...base, startsOn: '2026-10-01', endsOn: '2026-11-30', percent: 40 })).toEqual(['behind_schedule', 'cohort_closing']);
    expect(codes({ ...base, startsOn: '2026-10-01', endsOn: '2026-12-31', percent: 60 })).toEqual([]);
    const struggling = { m1_s1: { attempts: ALERT_RULES.STRUGGLING_ATTEMPTS, bestTier: 'failed' } };
    expect(computeAlerts({ ...base, minigames: struggling }, now)[0]).toMatchObject({ code: 'minigame_struggling', stepId: 'm1_s1' });
    expect(codes({ ...base, minigames: struggling, completed: new Set(['m1_s1']) })).toEqual([]);
    expect(codes({ ...base, examAttemptsUsed: MAX_EXAM_ATTEMPTS })).toEqual(['exam_exhausted']);
    // Sin alertas para certificados, cuentas desactivadas o promociones que no están abiertas
    const noisy = { ...base, lastActivityAt: null, examAttemptsUsed: MAX_EXAM_ATTEMPTS };
    expect(codes({ ...noisy, certified: true })).toEqual([]);
    expect(codes({ ...noisy, isActive: false })).toEqual([]);
    expect(codes({ ...noisy, accessState: 'closed' })).toEqual([]);
    expect(codes({ ...noisy, accessState: 'not_started' })).toEqual([]);

    expect(summarizeRows([
      { percent: 100, exam: { passed: true }, alerts: [] },
      { percent: 10, exam: { passed: false }, alerts: [{ code: 'inactive' }, { code: 'exam_exhausted' }] },
    ])).toEqual({ students: 2, averagePercent: 55, certified: 1, withAlerts: 1, alertsByCode: { inactive: 1, exam_exhausted: 1 } });
  });

  test('GET /api/admin/progress calcula avance, paso actual, mejor nivel por minijuego y alertas', async () => {
    const a = await prepareStudentA();
    // B: tres partidas no aprobadas en m1_s1 y los intentos del examen agotados
    const b = await freshStudent('seguimiento_b@test.com', 'Seguimiento2026!', { name: 'Dr. Seguimiento B', exam_attempts: MAX_EXAM_ATTEMPTS });
    await completeStep(b.ctx, 'm1_v1');
    for (let i = 0; i < ALERT_RULES.STRUGGLING_ATTEMPTS; i++) await playSimulatorPhase(b.ctx, 'm1_s1', FAILED);

    const admin = await adminSession();
    try {
      const res = await admin.get('/admin/progress?search=seguimiento_');
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.minigames).toHaveLength(15);
      expect(body.minigames[0]).toMatchObject({ stepId: 'm1_s1', module: 1, phase: 1, ready: true });
      expect(body.minigames.find((m) => m.stepId === 'm2_s1').ready).toBe(false);

      const rowA = body.students.find((s) => s.id === a.id);
      expect(rowA).toMatchObject({
        email: 'seguimiento_a@test.com', completedSteps: 3, totalSteps: 30, percent: 10, currentStep: 'm1_s2', reservePoints: 15,
        account: { isActive: true, activated: true }, alerts: [],
      });
      expect(rowA.minigames.m1_s1).toMatchObject({ attempts: 2, bestTier: 'perfect', bestPercent: 100, points: 10, completed: true });
      expect(rowA.minigames.m1_s2).toMatchObject({ attempts: 1, bestTier: 'intermediate', bestPercent: 80, points: 5, completed: false });
      expect(rowA.minigames.m1_s3).toMatchObject({ attempts: 0, bestTier: null, completed: false });
      expect(Date.now() - Date.parse(rowA.lastActivityAt)).toBeLessThan(10 * 60 * 1000);

      const rowB = body.students.find((s) => s.id === b.id);
      expect(rowB.minigames.m1_s1).toMatchObject({ attempts: 3, bestTier: 'failed', points: 0, completed: false });
      expect(rowB.alerts.map((x) => x.code).sort()).toEqual(['exam_exhausted', 'minigame_struggling']);
      expect(rowB.alerts.find((x) => x.code === 'minigame_struggling').stepId).toBe('m1_s1');

      expect(body.summary.students).toBe(body.students.length);
      expect(body.summary.withAlerts).toBeGreaterThanOrEqual(1);

      // "Solo con alertas" acota la lista pero no los totales
      const onlyAlerts = await (await admin.get('/admin/progress?search=seguimiento_&alerts=1')).json();
      expect(onlyAlerts.students.some((s) => s.id === b.id)).toBe(true);
      expect(onlyAlerts.students.some((s) => s.id === a.id)).toBe(false);
      expect(onlyAlerts.summary).toEqual(body.summary);

      // Paginación del lado del servidor
      const firstPage = await (await admin.get('/admin/progress?search=seguimiento_&limit=1')).json();
      expect(firstPage.students).toHaveLength(1);
      expect(firstPage.total).toBe(body.total);
    } finally {
      await admin.dispose();
      await a.ctx.dispose();
      await b.ctx.dispose();
    }
  });

  test('GET /api/admin/students/:id/detail arma la ficha completa con su línea de tiempo', async () => {
    const a = await prepareStudentA();
    // Un intento del examen entregado para el historial
    expect((await a.ctx.post(`${API}/start-exam`)).status()).toBe(200);
    const ids = (await (await a.ctx.get(`${API}/questions`)).json()).map((q) => q.id);
    expect((await a.ctx.post(`${API}/submit-exam`, { data: { answers: ids.map((id) => ({ question_id: id, answer: 'a' })) } })).status()).toBe(200);

    const admin = await adminSession();
    try {
      const res = await admin.get(`/admin/students/${a.id}/detail`);
      expect(res.status()).toBe(200);
      const detail = await res.json();
      expect(detail.student).toMatchObject({ id: a.id, name: 'Dra. Seguimiento A', percent: 10, currentStep: 'm1_s2' });
      expect(detail.steps).toHaveLength(30);

      const s1 = detail.steps.find((s) => s.stepId === 'm1_s1');
      expect(s1.type).toBe('minigame');
      expect(s1.completedAt).toBeTruthy();
      expect(s1.attempts.map((x) => x.tier)).toEqual(['failed', 'perfect']);
      expect(s1.attempts[1]).toMatchObject({ status: 'completed', score: 100, maxScore: 100, errorCount: 0, pointsAwarded: 10 });
      const v3 = detail.steps.find((s) => s.stepId === 'm1_v3');
      expect(v3).toMatchObject({ type: 'video', completedAt: null });

      expect(detail.exam.history).toHaveLength(1);
      expect(detail.exam.history[0]).toMatchObject({ number: 1, status: 'submitted', questionCount: ids.length });
      expect(detail.incidents).toEqual([]);

      const kinds = detail.timeline.map((e) => e.kind);
      expect(kinds.filter((k) => k === 'minigame_played')).toHaveLength(3);
      expect(kinds).toEqual(expect.arrayContaining(['account_created', 'step_completed', 'exam_started', 'exam_submitted', 'last_login']));
      // De lo más reciente a lo más antiguo
      const times = detail.timeline.map((e) => e.at);
      expect(times).toEqual([...times].sort().reverse());

      expect((await admin.get('/admin/students/999999999/detail')).status()).toBe(404);
      expect((await admin.get('/admin/students/abc/detail')).status()).toBe(400);
      // Solo para administradores
      expect((await a.ctx.get(`${API}/admin/students/${a.id}/detail`)).status()).toBe(403);
      expect((await a.ctx.get(`${API}/admin/progress`)).status()).toBe(403);
    } finally {
      await admin.dispose();
      await a.ctx.dispose();
    }
  });

  test('En el panel: la pestaña de seguimiento muestra la tabla y abre la ficha del estudiante', async ({ page }) => {
    test.setTimeout(90000); // la primera visita a la ficha compila la ruta en modo desarrollo
    const a = await prepareStudentA();
    await a.ctx.dispose();
    const admin = await adminSession(); // fija la contraseña del admin para la prueba
    await admin.dispose();

    await performLogin(page, 'admin@admin.com', ADMIN_PASSWORD, false);
    await page.goto('/admin');
    await page.fill('#input-admin-search', 'seguimiento_a@test.com');
    // La auditoría IES enlaza también la ficha
    await expect(page.locator(`#btn-detail-${a.id}`)).toBeVisible({ timeout: 15000 });

    await page.click('#tab-view-tracking');
    const row = page.locator('#progress-table tr[data-student-email="seguimiento_a@test.com"]');
    await expect(row).toBeVisible({ timeout: 15000 });
    await expect(row.locator('[data-progress]')).toHaveText('10% · 3/30 pasos');
    await expect(row.locator('[data-current-step]')).toContainText('Maestro del Haz');
    await expect(row.locator('[data-step="m1_s1"]')).toHaveAttribute('data-tier', 'perfect');
    await expect(row.locator('[data-step="m1_s1"]')).toHaveText('10 ✓');
    await expect(row.locator('[data-step="m1_s2"]')).toHaveText('5');
    await expect(row.locator('[data-step="m1_s3"]')).toHaveAttribute('data-tier', 'none');

    await page.click(`#link-student-detail-${a.id}`);
    await page.waitForURL(`**/admin/estudiantes/${a.id}`);
    await expect(page.locator('#detail-name')).toHaveText('Dra. Seguimiento A');
    await expect(page.locator('#detail-summary-progress')).toContainText('10%');
    await expect(page.locator('#detail-module-1 tr[data-step="m1_s1"]')).toContainText('Finalizado');
    await page.click('#btn-attempts-m1_s1');
    await expect(page.locator('#attempts-m1_s1 tbody tr')).toHaveCount(2);
    await expect(page.locator('#detail-timeline li[data-kind="minigame_played"]')).toHaveCount(3);

    await page.click('#link-back-admin');
    await page.waitForURL('**/admin');
  });
});
