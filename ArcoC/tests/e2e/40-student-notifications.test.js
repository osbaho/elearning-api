import { test, expect } from '@playwright/test';
import { API, adminSession, newApiContext, uniqueSuffix } from '../helpers/adminHelper.js';
import { performLogin } from '../helpers/loginHelper.js';
import { completeStep, playSimulatorPhase } from '../helpers/simulatorHelper.js';
import { ALERT_RULES } from '../../server/services/progressTracking.js';
import { notificationFor, stepLink } from '../../server/services/studentNotifications.js';

const PASSWORD = 'Avisos2026!';
const FAILED = { score: 40, maxScore: 100, passed: false, errorCount: 3 };

async function studentApi(email) {
  const ctx = await newApiContext();
  const res = await ctx.post(`${API}/test-reset`, { data: { email, password: PASSWORD, reserve_points: 0, cohort: 'Avisos E2E' } });
  const { studentId } = await res.json();
  expect((await ctx.post(`${API}/login`, { data: { email, password: PASSWORD } })).ok()).toBe(true);
  return {
    ctx,
    id: studentId,
    notifications: async () => (await ctx.get(`${API}/student/notifications`)).json(),
  };
}

test.describe('Avisos del estudiante dentro de la plataforma', () => {
  test.beforeAll(async () => {
    const admin = await adminSession();
    await admin.post('/admin/cohorts', { name: 'Avisos E2E' });
    await admin.dispose();
  });

  test('Textos y enlaces de cada aviso', () => {
    expect(stepLink('m1_s2')).toBe('/course/practice/m1_s2');
    expect(stepLink('m2_v1')).toBe('/course');
    expect(stepLink('exam')).toBe('/course/exam');
    expect(notificationFor('case_answered', { status: 'resolved', resolution: 'Listo' })).toEqual({ title: 'Respondieron tu reporte', body: 'Listo', link: '/course' });
    expect(notificationFor('case_answered', { status: 'rejected', resolution: 'Sin cambios' }).title).toBe('Revisaron tu reporte');
    expect(notificationFor('step_reopened', { stepId: 'm1_s1', reason: 'Falla' })).toMatchObject({
      body: expect.stringContaining('Protocolo Cero'), link: '/course/practice/m1_s1',
    });
    expect(notificationFor('exam_attempt_granted', { reason: 'Corte de luz' })).toMatchObject({ body: 'Motivo: Corte de luz', link: '/course/exam' });
    expect(notificationFor('reinforcement', { subject: 'Hola', text: 'Texto' }).title).toBe('Mensaje de tu coordinador: Hola');
    expect(() => notificationFor('otro')).toThrow();
  });

  test('Responder un reporte, reabrir un paso, conceder un intento y enviar un refuerzo dejan un aviso', async () => {
    const id = uniqueSuffix();
    const s = await studentApi(`avisos_a_${id}@test.com`);
    const t = await studentApi(`avisos_t_${id}@test.com`);
    const admin = await adminSession();
    try {
      expect(await s.notifications()).toEqual({ success: true, unread: 0, items: [] });

      // Reporte respondido
      await completeStep(s.ctx, 'm1_v1');
      await playSimulatorPhase(s.ctx, 'm1_s1');
      const reported = await s.ctx.post(`${API}/support-cases`, {
        data: { stepId: 'm1_s1', category: 'minigame', description: 'La fase se quedó cargando un buen rato.' },
      });
      expect(reported.status()).toBe(201);
      const caseId = (await reported.json()).case.id;
      expect((await admin.post(`/admin/support-cases/${caseId}/resolve`, { status: 'resolved', resolution: 'Corregimos la carga.' })).status()).toBe(200);

      // Paso reabierto e intento adicional del examen
      expect((await admin.post(`/admin/students/${s.id}/reopen`, { stepId: 'm1_s1', reason: 'Falla confirmada' })).status()).toBe(200);
      expect((await admin.post(`/admin/students/${s.id}/reopen`, { stepId: 'exam', reason: 'Corte de luz' })).status()).toBe(200);

      const list = await s.notifications();
      expect(list.unread).toBe(3);
      expect(list.items.map((n) => n.kind)).toEqual(['exam_attempt_granted', 'step_reopened', 'case_answered']);
      expect(list.items[1]).toMatchObject({ link: '/course/practice/m1_s1', read: false, body: expect.stringContaining('Falla confirmada') });
      expect(list.items[2]).toMatchObject({ title: 'Respondieron tu reporte', body: 'Corregimos la carga.' });

      // Marcar uno y luego todos
      const one = await s.ctx.post(`${API}/student/notifications/read`, { data: { ids: [list.items[2].id] } });
      expect(await one.json()).toMatchObject({ unread: 2 });
      expect((await s.ctx.post(`${API}/student/notifications/read`, { data: { ids: ['x'] } })).status()).toBe(400);
      expect(await (await s.ctx.post(`${API}/student/notifications/read`, { data: {} })).json()).toMatchObject({ unread: 0 });
      // Los avisos de otro estudiante no se tocan
      expect((await t.notifications()).unread).toBe(0);

      // Refuerzo enviado desde la bandeja
      await completeStep(t.ctx, 'm1_v1');
      for (let i = 0; i < ALERT_RULES.STRUGGLING_ATTEMPTS; i++) await playSimulatorPhase(t.ctx, 'm1_s1', FAILED);
      const inbox = await (await admin.get(`/admin/alerts?search=${encodeURIComponent(`avisos_t_${id}`)}`)).json();
      const entry = inbox.entries.find((e) => e.code === 'minigame_struggling');
      expect((await admin.post('/admin/alerts/decide', { ids: [entry.id], action: 'send' })).status()).toBe(200);
      const fromCoordinator = (await t.notifications()).items[0];
      expect(fromCoordinator).toMatchObject({ kind: 'reinforcement', title: expect.stringContaining('Mensaje de tu coordinador'), read: false });

      // Solo estudiantes
      expect((await admin.get('/student/notifications')).status()).toBe(403);
    } finally {
      await admin.dispose();
      await Promise.all([s.ctx.dispose(), t.ctx.dispose()]);
    }
  });

  test('En el curso: la campana muestra los avisos sin leer y se pueden marcar como leídos', async ({ page }) => {
    const email = `avisos_ui_${uniqueSuffix()}@test.com`;
    const s = await studentApi(email);
    await completeStep(s.ctx, 'm1_v1');
    await s.ctx.dispose();
    const admin = await adminSession();
    expect((await admin.post(`/admin/students/${s.id}/reopen`, { stepId: 'm1_v1', reason: 'El audio no cargaba' })).status()).toBe(200);
    await admin.dispose();

    await performLogin(page, email, PASSWORD, false);
    await expect(page.locator('#notifications-unread')).toHaveText('1', { timeout: 15000 });
    await page.click('#btn-notifications');
    const item = page.locator('#notifications-panel [data-notification="step_reopened"]');
    await expect(item).toContainText('Se reabrió un paso de tu curso');
    await expect(item).toContainText('El audio no cargaba');
    await page.click('#btn-notifications-read-all');
    await expect(page.locator('#notifications-unread')).toHaveCount(0);
  });
});
