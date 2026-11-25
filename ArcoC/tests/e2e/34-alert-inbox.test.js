import { test, expect } from '@playwright/test';
import { API, ADMIN_PASSWORD, adminSession, ensureCohort, newApiContext, uniqueSuffix } from '../helpers/adminHelper.js';
import { performLogin } from '../helpers/loginHelper.js';
import { completeStep, playSimulatorPhase } from '../helpers/simulatorHelper.js';
import { ALERT_RULES } from '../../server/services/progressTracking.js';
import { MAX_EXAM_ATTEMPTS } from '../../server/config/examRules.js';
import {
  INBOX_RULES, addDays, alertKey, currentAlertsOf, parseDecision, planInboxSync,
} from '../../server/services/alertInbox.js';

const FAILED = { score: 40, maxScore: 100, passed: false, errorCount: 3 };
const PASSWORD = 'Bandeja2026!';
// Promoción propia y sin fechas: solo aparecen las alertas de minijuego y de examen
const COHORT = 'Bandeja E2E';

/** Estudiante reiniciado en la promoción de la suite, con sesión propia; devuelve { ctx, id }. */
async function freshStudent(email, reset = {}) {
  const ctx = await newApiContext();
  const res = await ctx.post(`${API}/test-reset`, {
    data: { email, password: PASSWORD, name: 'Dra. Bandeja', reserve_points: 0, exam_attempts: 0, cohort: COHORT, ...reset },
  });
  const { studentId } = await res.json();
  expect((await ctx.post(`${API}/login`, { data: { email, password: PASSWORD } })).ok()).toBe(true);
  return { ctx, id: studentId };
}

/** Con tres partidas no aprobadas en m1_s1: alerta «minijuego difícil». */
async function strugglingStudent(email) {
  const s = await freshStudent(email);
  await completeStep(s.ctx, 'm1_v1');
  for (let i = 0; i < ALERT_RULES.STRUGGLING_ATTEMPTS; i++) await playSimulatorPhase(s.ctx, 'm1_s1', FAILED);
  return s;
}

async function inbox(admin, query) {
  const res = await admin.get(`/admin/alerts?${new URLSearchParams(query)}`);
  expect(res.status()).toBe(200);
  return res.json();
}

test.describe('Bandeja de alertas del admin', () => {
  test.beforeAll(async () => {
    const admin = await adminSession();
    await ensureCohort(admin, { name: COHORT });
    await admin.dispose();
  });

  test('Reglas puras: clave de la alerta, plan de la revisión y validación de las decisiones', () => {
    expect(alertKey({ code: 'inactive' })).toBe('inactive');
    expect(alertKey({ code: 'minigame_struggling', stepId: 'm1_s2' })).toBe('minigame_struggling:m1_s2');
    expect(addDays('2026-11-28', 3)).toBe('2026-12-01');

    const rows = [
      { id: 1, isTest: false, alerts: [{ code: 'inactive', label: 'Sin actividad hace 9 días', days: 9 }] },
      { id: 2, isTest: true, alerts: [{ code: 'inactive', label: 'Sin actividad hace 9 días', days: 9 }] },
    ];
    expect(currentAlertsOf(rows)).toEqual([{ studentId: 1, code: 'inactive', key: 'inactive', details: rows[0].alerts[0] }]);

    const alert = (studentId, code, extra = {}) => ({
      studentId, code, key: alertKey({ code, ...extra }), details: { code, label: code, ...extra },
    });
    const current = [
      alert(1, 'inactive'), alert(2, 'exam_exhausted'), alert(3, 'minigame_struggling', { stepId: 'm1_s1' }),
      alert(4, 'inactive'), alert(5, 'inactive'), alert(7, 'behind_schedule'),
    ];
    const json = (a) => JSON.stringify(a.details);
    const open = [
      { id: 10, studentId: 1, key: 'inactive', status: 'pending', postponedUntil: null, details: json(current[0]) },
      { id: 11, studentId: 2, key: 'exam_exhausted', status: 'postponed', postponedUntil: '2026-11-24', details: json(current[1]) },
      { id: 12, studentId: 3, key: 'minigame_struggling:m1_s1', status: 'pending', postponedUntil: null, details: '{"antes":true}' },
      { id: 13, studentId: 6, key: 'inactive', status: 'pending', postponedUntil: null, details: '{}' },
      { id: 14, studentId: 4, key: 'inactive', status: 'postponed', postponedUntil: '2026-12-31', details: json(current[3]) },
    ];
    const plan = planInboxSync({ current, open, covered: new Set(['5|inactive']), today: '2026-11-24' });
    // Nueva: solo la 7 (la 5 está en espera tras una decisión; las demás ya tienen entrada)
    expect(plan.insert).toEqual([current[5]]);
    // La 11 vuelve a pendientes (su fecha llegó) y la 12 cambió de detalle; la 10 y la 14 no cambian
    expect(plan.refresh).toEqual([
      { id: 11, details: json(current[1]), reactivate: true },
      { id: 12, details: json(current[2]), reactivate: false },
    ]);
    // La 13 ya no se cumple: se cierra sola
    expect(plan.resolve).toEqual([13]);

    expect(parseDecision({ action: 'send', ids: [1] }).error).toContain('action');
    expect(parseDecision({ action: 'dismiss', ids: [] }).error).toBeTruthy();
    expect(parseDecision({ action: 'dismiss', ids: ['1'] }).error).toBeTruthy();
    expect(parseDecision({ action: 'postpone', ids: [1], days: 2 }).error).toContain('days');
    expect(parseDecision({ action: 'dismiss', ids: [1], note: 'x'.repeat(INBOX_RULES.NOTE_MAX + 1) }).error).toContain('nota');
    const tooMany = Array.from({ length: INBOX_RULES.MAX_BATCH + 1 }, (_, i) => i + 1);
    expect(parseDecision({ action: 'dismiss', ids: tooMany }).error).toContain(String(INBOX_RULES.MAX_BATCH));
    expect(parseDecision({ action: 'postpone', ids: [3, 3, 4] }).value)
      .toEqual({ action: 'postpone', ids: [3, 4], days: INBOX_RULES.DEFAULT_POSTPONE_DAYS, note: null });
    expect(parseDecision({ action: 'dismiss', ids: [5], note: '  Avisado por teléfono  ' }).value.note).toBe('Avisado por teléfono');
  });

  test('La revisión llena la bandeja; posponer y descartar quedan registrados y una alerta que deja de cumplirse se cierra sola', async () => {
    const id = uniqueSuffix();
    const a = await strugglingStudent(`bandeja_a_${id}@test.com`);
    const b = await freshStudent(`bandeja_b_${id}@test.com`, { exam_attempts: MAX_EXAM_ATTEMPTS });
    const t = await strugglingStudent(`bandeja_t_${id}@test.com`);
    const admin = await adminSession();
    try {
      // Un estudiante de prueba no llega a la bandeja
      expect((await admin.patch(`/admin/students/${t.id}`, { isTest: true })).status()).toBe(200);

      // Dos revisiones a la vez no duplican entradas
      const [first, second] = await Promise.all([inbox(admin, { search: id }), inbox(admin, { search: id })]);
      expect(first.entries.map((e) => e.id).sort()).toEqual(second.entries.map((e) => e.id).sort());
      const pending = await inbox(admin, { search: id });
      expect(pending).toMatchObject({ view: 'pending', total: 2, counts: { pending: 2, postponed: 0, history: 0 } });
      expect(pending.entries.map((e) => `${e.studentId}|${e.key}`).sort())
        .toEqual([`${a.id}|minigame_struggling:m1_s1`, `${b.id}|exam_exhausted`].sort());
      const entryA = pending.entries.find((e) => e.studentId === a.id);
      const entryB = pending.entries.find((e) => e.studentId === b.id);
      expect(entryA).toMatchObject({
        status: 'pending', code: 'minigame_struggling',
        student: { email: `bandeja_a_${id}@test.com`, cohort: COHORT },
        alert: { stepId: 'm1_s1', attempts: ALERT_RULES.STRUGGLING_ATTEMPTS },
        progress: { percent: 3, currentStep: 'm1_s1' },
        decidedBy: null,
      });
      expect(pending.summary.pending).toBeGreaterThanOrEqual(2);

      // Posponer: sale de pendientes y queda con fecha, quién y nota
      const postponed = await admin.post('/admin/alerts/decide', {
        ids: [entryA.id], action: 'postpone', days: 7, note: 'Espera a la tutoría del jueves',
      });
      expect(postponed.status()).toBe(200);
      const decided = await postponed.json();
      expect(decided.results[0]).toMatchObject({ id: entryA.id, ok: true, status: 'postponed' });
      expect(decided.results[0].postponedUntil).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const listPostponed = await inbox(admin, { view: 'postponed', search: id });
      expect(listPostponed.entries.map((e) => e.id)).toEqual([entryA.id]);
      expect(listPostponed.entries[0]).toMatchObject({
        postponedUntil: decided.results[0].postponedUntil, note: 'Espera a la tutoría del jueves',
        decidedBy: { name: expect.any(String) },
      });
      expect((await inbox(admin, { search: id })).entries.map((e) => e.id)).toEqual([entryB.id]);

      // Descartar; decidir de nuevo da 409, una alerta inexistente 404, una acción inválida 400
      // y un estudiante no puede decidir (403)
      expect((await admin.post('/admin/alerts/decide', { ids: [entryB.id], action: 'dismiss', note: 'Ya habló con coordinación' })).status()).toBe(200);
      expect((await admin.post('/admin/alerts/decide', { ids: [entryB.id], action: 'dismiss' })).status()).toBe(409);
      expect((await admin.post('/admin/alerts/decide', { ids: [999999999], action: 'dismiss' })).status()).toBe(404);
      expect((await admin.post('/admin/alerts/decide', { ids: [entryB.id], action: 'archivar' })).status()).toBe(400);
      expect((await b.ctx.post(`${API}/admin/alerts/decide`, { data: { ids: [entryB.id], action: 'dismiss' } })).status()).toBe(403);

      // B sigue sin intentos, pero la alerta descartada no vuelve durante el período de espera
      expect((await inbox(admin, { search: id })).entries).toEqual([]);

      // A aprueba el minijuego: su alerta pospuesta deja de cumplirse y se cierra sola
      await playSimulatorPhase(a.ctx, 'm1_s1');
      const history = await inbox(admin, { view: 'history', search: id });
      expect(history.entries.map((e) => `${e.studentId}|${e.status}`).sort()).toEqual([`${a.id}|resolved`, `${b.id}|dismissed`].sort());
      expect(history.entries.find((e) => e.studentId === b.id)).toMatchObject({
        note: 'Ya habló con coordinación', decidedBy: { id: expect.any(Number) }, decidedAt: expect.any(String),
      });
      expect(history.entries.find((e) => e.studentId === a.id).resolvedAt).toEqual(expect.any(String));
      expect(history.counts).toMatchObject({ pending: 0, postponed: 0, dismissed: 1, resolved: 1, history: 2 });

      // Bitácora del estudiante
      const { actions } = await (await admin.get(`/admin/actions?targetType=student&targetId=${b.id}`)).json();
      expect(actions.find((x) => x.action === 'alert.dismiss')).toMatchObject({
        reason: 'Ya habló con coordinación',
        details: expect.objectContaining({ alertCode: 'exam_exhausted', alertKey: 'exam_exhausted' }),
      });
      const summary = await (await admin.get('/admin/alerts/summary')).json();
      expect(summary).toMatchObject({ success: true, pending: expect.any(Number), postponed: expect.any(Number) });
    } finally {
      await admin.dispose();
      await Promise.all([a.ctx.dispose(), b.ctx.dispose(), t.ctx.dispose()]);
    }
  });

  test('Decidir en grupo: varias alertas a la vez; las que ya no están abiertas se informan sin frenar el resto', async () => {
    const id = uniqueSuffix();
    const c = await strugglingStudent(`bandeja_c_${id}@test.com`);
    const d = await strugglingStudent(`bandeja_d_${id}@test.com`);
    const admin = await adminSession();
    try {
      const { entries } = await inbox(admin, { search: id, code: 'minigame_struggling' });
      expect(entries).toHaveLength(2);
      const [entryC, entryD] = [c, d].map((s) => entries.find((e) => e.studentId === s.id));
      expect((await admin.post('/admin/alerts/decide', { ids: [entryD.id], action: 'dismiss' })).status()).toBe(200);

      const res = await admin.post('/admin/alerts/decide', { ids: [entryC.id, entryD.id], action: 'postpone', days: 14 });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.done).toBe(1);
      expect(body.results).toEqual([
        expect.objectContaining({ id: entryC.id, ok: true, status: 'postponed' }),
        expect.objectContaining({ id: entryD.id, ok: false, status: 'dismissed' }),
      ]);
      expect((await inbox(admin, { view: 'postponed', search: id })).entries.map((e) => e.id)).toEqual([entryC.id]);
    } finally {
      await admin.dispose();
      await Promise.all([c.ctx.dispose(), d.ctx.dispose()]);
    }
  });

  test('En el panel: la pestaña «Alertas» muestra el contador; se pospone una y se descarta otra en grupo', async ({ page }) => {
    test.setTimeout(90000);
    const id = uniqueSuffix();
    const e = await strugglingStudent(`bandeja_ui_e_${id}@test.com`);
    const f = await strugglingStudent(`bandeja_ui_f_${id}@test.com`);
    await Promise.all([e.ctx.dispose(), f.ctx.dispose()]);

    await performLogin(page, 'admin@admin.com', ADMIN_PASSWORD, false);
    await page.goto('/admin');
    await expect(page.locator('#alerts-pending-count')).toBeVisible({ timeout: 15000 });
    await page.fill('#input-admin-search', String(id));
    await page.click('#tab-view-alerts');

    const rowE = page.locator(`#alert-inbox-table tr[data-student-email="bandeja_ui_e_${id}@test.com"]`);
    const rowF = page.locator(`#alert-inbox-table tr[data-student-email="bandeja_ui_f_${id}@test.com"]`);
    await expect(rowE).toHaveAttribute('data-alert-code', 'minigame_struggling', { timeout: 15000 });
    await expect(rowF).toBeVisible();
    const alertE = await rowE.getAttribute('data-alert-id');
    const alertF = await rowF.getAttribute('data-alert-id');

    // Posponer una, con plazo y nota
    await page.click(`#btn-alert-postpone-${alertE}`);
    await page.selectOption('#alert-decision-days', '7');
    await page.fill('#alert-decision-note', 'Revisar tras la tutoría');
    await page.click('#btn-alert-decision-confirm');
    await expect(page.locator('#alert-inbox-notice')).toContainText('1 alerta(s) pospuesta(s) 7 días');
    await expect(rowE).toHaveCount(0);

    // Descartar la otra con la selección y la barra de acciones en grupo
    await page.check(`#alert-select-${alertF}`);
    await page.click('#btn-alerts-bulk-dismiss');
    await page.click('#btn-alert-decision-confirm');
    await expect(page.locator('#alert-inbox-notice')).toContainText('1 alerta(s) descartada(s)');
    await expect(rowF).toHaveCount(0);

    await page.click('#alerts-view-postponed');
    await expect(page.locator(`#alert-inbox-table tr[data-alert-id="${alertE}"]`)).toContainText('Revisar tras la tutoría');
    await page.click('#alerts-view-history');
    await expect(page.locator(`#alert-history-table tr[data-alert-id="${alertF}"]`)).toContainText('Descartada');
  });
});
