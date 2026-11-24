import { test, expect } from '@playwright/test';
import { API, ADMIN_PASSWORD, adminSession, newApiContext, uniqueSuffix } from '../helpers/adminHelper.js';
import { performLogin } from '../helpers/loginHelper.js';
import { completeStep, playSimulatorPhase } from '../helpers/simulatorHelper.js';
import { reopenKind } from '../../server/services/reopen.js';

const INTERMEDIATE = { score: 80, maxScore: 100, passed: true, errorCount: 2 };

async function studentApi(email, password, reset = {}) {
  const ctx = await newApiContext();
  const res = await ctx.post(`${API}/test-reset`, { data: { email, password, reserve_points: 0, ...reset } });
  const { studentId } = await res.json();
  expect((await ctx.post(`${API}/login`, { data: { email, password } })).ok()).toBe(true);
  return { ctx, id: studentId, me: async () => (await ctx.get(`${API}/student/me`)).json() };
}

/** m1_v1, dos partidas en m1_s1 (perfecta e intermedia: 15 pts), m1_s1 finalizado y m1_v2 visto. */
async function studentWithFinishedMinigame(email) {
  const s = await studentApi(email, 'Reabrir2026!');
  await completeStep(s.ctx, 'm1_v1');
  await playSimulatorPhase(s.ctx, 'm1_s1');
  await playSimulatorPhase(s.ctx, 'm1_s1', INTERMEDIATE);
  expect((await s.ctx.post(`${API}/progress/m1_s1`)).status()).toBe(200);
  await completeStep(s.ctx, 'm1_v2');
  return s;
}

test.describe('Reintentos auditados (reabrir pasos)', () => {
  test('Tipos de paso que se pueden reabrir', () => {
    expect(reopenKind('exam')).toBe('exam');
    expect(reopenKind('m1_v2')).toBe('video');
    expect(reopenKind('m3_s1')).toBe('minigame');
    expect(reopenKind('m9_x')).toBeNull();
    expect(reopenKind(undefined)).toBeNull();
  });

  test('Reabrir un minijuego anula sus partidas sin borrarlas, descuenta sus puntos y obliga a jugarlo de nuevo', async () => {
    const id = uniqueSuffix();
    const s = await studentWithFinishedMinigame(`reabrir_mg_${id}@test.com`);
    const admin = await adminSession();
    try {
      expect((await s.me()).reservePoints).toBe(15);

      expect((await admin.post(`/admin/students/${s.id}/reopen`, { stepId: 'm1_s1' })).status()).toBe(400);
      expect((await admin.post(`/admin/students/${s.id}/reopen`, { stepId: 'm9_x', reason: 'Prueba' })).status()).toBe(400);
      expect((await admin.post(`/admin/students/${s.id}/reopen`, { stepId: 'm1_s3', reason: 'Sin partidas' })).status()).toBe(409);
      expect((await s.ctx.post(`${API}/admin/students/${s.id}/reopen`, { data: { stepId: 'm1_s1', reason: 'Yo mismo' } })).status()).toBe(403);

      const reopened = await admin.post(`/admin/students/${s.id}/reopen`, {
        stepId: 'm1_s1', reason: 'Falla del simulador confirmada en su reporte',
      });
      expect(reopened.status()).toBe(200);
      expect(await reopened.json()).toMatchObject({ kind: 'minigame', voidedAttempts: 2, pointsRemoved: 15, reservePoints: 0 });

      // El paso queda pendiente; los posteriores siguen completados
      const me = await s.me();
      expect(me.completedModules).toEqual(expect.arrayContaining(['m1_v1', 'm1_v2']));
      expect(me.completedModules).not.toContain('m1_s1');
      expect(me.reservePoints).toBe(0);
      expect(await (await s.ctx.get(`${API}/simulator/steps/m1_s1`)).json())
        .toMatchObject({ completedAttempts: 0, pointsEarned: 0, stepCompleted: false });

      // Las partidas anuladas no sirven para finalizar; una nueva suma con la regla normal
      expect((await s.ctx.post(`${API}/progress/m1_s1`)).status()).toBe(403);
      const replay = await playSimulatorPhase(s.ctx, 'm1_s1');
      expect(replay.result.pointsAwarded).toBe(10);
      expect((await s.ctx.post(`${API}/progress/m1_s1`)).status()).toBe(200);

      // Evidencia: la ficha conserva las anuladas con su motivo; la bitácora y el correo
      const detail = await (await admin.get(`/admin/students/${s.id}/detail`)).json();
      const step = detail.steps.find((x) => x.stepId === 'm1_s1');
      expect(step.attempts).toHaveLength(3);
      expect(step.attempts.filter((a) => a.voided).map((a) => a.voidReason))
        .toEqual(['Falla del simulador confirmada en su reporte', 'Falla del simulador confirmada en su reporte']);
      expect(step.summary).toMatchObject({ attempts: 1, points: 10, completed: true });
      expect(detail.emails.some((e) => e.template === 'step_reopened')).toBe(true);
      const { actions } = await (await admin.get(`/admin/actions?targetType=student&targetId=${s.id}`)).json();
      expect(actions.find((a) => a.action === 'student.reopen')).toMatchObject({
        reason: 'Falla del simulador confirmada en su reporte',
        details: expect.objectContaining({ stepId: 'm1_s1', kind: 'minigame', voidedAttempts: 2, pointsRemoved: 15 }),
      });
    } finally {
      await admin.dispose();
      await s.ctx.dispose();
    }
  });

  test('Reabrir un video y conceder un intento adicional del examen (cuenta como autorizado en el estándar IES)', async () => {
    const id = uniqueSuffix();
    const admin = await adminSession();
    const video = await studentApi(`reabrir_video_${id}@test.com`, 'Reabrir2026!');
    const exam = await studentApi(`reabrir_examen_${id}@test.com`, 'Reabrir2026!', { exam_attempts: 3, exam_score: 60 });
    const passed = await studentApi(`reabrir_aprobado_${id}@test.com`, 'Reabrir2026!', { pass_exam: true, exam_score: 95 });
    try {
      // Video: deja de estar visto; sin nada registrado no hay qué reabrir
      await completeStep(video.ctx, 'm1_v1');
      expect((await admin.post(`/admin/students/${video.id}/reopen`, { stepId: 'm1_v1', reason: 'No cargaba el audio' })).status()).toBe(200);
      expect((await video.me()).completedModules).not.toContain('m1_v1');
      expect((await admin.post(`/admin/students/${video.id}/reopen`, { stepId: 'm1_v1', reason: 'Otra vez' })).status()).toBe(409);

      // Examen: con los 3 intentos usados no puede empezar; con uno concedido, sí
      expect((await exam.ctx.post(`${API}/start-exam`)).status()).toBe(403);
      const granted = await admin.post(`/admin/students/${exam.id}/reopen`, { stepId: 'exam', reason: 'Corte de luz documentado' });
      expect(await granted.json()).toMatchObject({ kind: 'exam', bonusAttempts: 1 });
      expect((await exam.me()).exam).toMatchObject({ maxAttempts: 4, bonusAttempts: 1, attemptsUsed: 3, attemptsLeft: 1 });
      const started = await exam.ctx.post(`${API}/start-exam`);
      expect(started.status()).toBe(200);
      expect(await started.json()).toMatchObject({ attemptsUsed: 4, maxAttempts: 4 });

      const compliance = await (await admin.get(`/admin/compliance/${exam.id}`)).json();
      const c4 = compliance.criteria.find((c) => c.code === 'STD_MAX_ATTEMPTS');
      expect(c4.met).toBe(true);
      expect(c4.details).toContain('adicional');

      // A quien ya aprobó no se le concede otro intento
      expect((await admin.post(`/admin/students/${passed.id}/reopen`, { stepId: 'exam', reason: 'No aplica' })).status()).toBe(409);
    } finally {
      await admin.dispose();
      await Promise.all([video.ctx.dispose(), exam.ctx.dispose(), passed.ctx.dispose()]);
    }
  });

  test('En la ficha: reabrir un minijuego con motivo y ver sus partidas anuladas', async ({ page }) => {
    test.setTimeout(90000);
    const id = uniqueSuffix();
    const s = await studentWithFinishedMinigame(`reabrir_ui_${id}@test.com`);
    await s.ctx.dispose();
    const admin = await adminSession();
    await admin.dispose();

    await performLogin(page, 'admin@admin.com', ADMIN_PASSWORD, false);
    await page.goto(`/admin/estudiantes/${s.id}`);
    const row = page.locator('#detail-module-1 tr[data-step="m1_s1"]');
    await expect(row).toContainText('Finalizado', { timeout: 15000 });
    await page.click('#btn-reopen-m1_s1');
    await page.fill('#reopen-reason-m1_s1', 'Revisado el caso: falla de carga');
    await page.click('#btn-reopen-confirm-m1_s1');
    await expect(row).toContainText('Reabierto', { timeout: 10000 });
    await page.click('#btn-attempts-m1_s1');
    await expect(page.locator('#attempts-m1_s1 tr[data-voided="true"]')).toHaveCount(2);
    await expect(page.locator('#detail-exam')).toContainText('Conceder un intento extra');
  });
});
