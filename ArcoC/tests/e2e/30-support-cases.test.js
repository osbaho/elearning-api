import { test, expect } from '@playwright/test';
import { API, ADMIN_PASSWORD, adminSession, newApiContext, uniqueSuffix } from '../helpers/adminHelper.js';
import { performLogin } from '../helpers/loginHelper.js';
import {
  MAX_OPEN_CASES_PER_STUDENT, validateNewCase, validateResolution,
} from '../../server/services/supportCases.js';

/** Estudiante nuevo (sin casos) con sesión propia. */
async function studentApi(email, password) {
  const ctx = await newApiContext();
  const res = await ctx.post(`${API}/test-reset`, { data: { email, password } });
  const { studentId } = await res.json();
  expect((await ctx.post(`${API}/login`, { data: { email, password } })).ok()).toBe(true);
  return { ctx, id: studentId };
}

const DESCRIPTION = 'El minijuego se quedó cargando después de la segunda fase.';

test.describe('Reportar un problema (casos del estudiante)', () => {
  test('Validaciones puras del reporte y de la respuesta', () => {
    expect(validateNewCase({ category: 'minigame', stepId: 'm1_s1', description: DESCRIPTION }).data)
      .toMatchObject({ category: 'minigame', stepId: 'm1_s1', description: DESCRIPTION, context: null });
    expect(validateNewCase({ category: 'exam', stepId: 'exam', description: DESCRIPTION }).data.stepId).toBe('exam');
    expect(validateNewCase({ category: 'other', description: DESCRIPTION }).data.stepId).toBeNull();
    expect(validateNewCase({ category: 'nada', description: DESCRIPTION }).error).toContain('categoría');
    expect(validateNewCase({ category: 'video', stepId: 'm9_x', description: DESCRIPTION }).error).toContain('paso');
    expect(validateNewCase({ category: 'video', description: 'corto' }).error).toContain('al menos');
    // Del contexto solo se guardan las claves conocidas
    const withContext = validateNewCase({
      category: 'video', description: DESCRIPTION, context: { url: 'https://x/course', userAgent: 'UA', evil: '<script>' },
    });
    expect(JSON.parse(withContext.data.context)).toEqual({ url: 'https://x/course', userAgent: 'UA' });

    expect(validateResolution({ resolution: 'Corregido en el simulador.' }).data).toEqual({ status: 'resolved', resolution: 'Corregido en el simulador.' });
    expect(validateResolution({ status: 'rejected', resolution: 'No se reproduce.' }).data.status).toBe('rejected');
    expect(validateResolution({ status: 'otro', resolution: 'x x x' }).error).toBeTruthy();
    expect(validateResolution({ resolution: ' ' }).error).toContain('respuesta');
  });

  test('El estudiante reporta, el admin responde: bitácora, correo, ficha y límite de casos abiertos', async () => {
    const id = uniqueSuffix();
    const email = `reportes_${id}@test.com`;
    const student = await studentApi(email, 'Reportes2026!');
    const admin = await adminSession();
    try {
      const created = await student.ctx.post(`${API}/support-cases`, {
        data: { category: 'minigame', stepId: 'm1_s1', description: DESCRIPTION, context: { url: 'http://localhost:3000/course/practice/m1_s1' } },
      });
      expect(created.status()).toBe(201);
      const { case: item } = await created.json();
      expect(item).toMatchObject({ category: 'minigame', stepId: 'm1_s1', status: 'open' });

      expect((await student.ctx.post(`${API}/support-cases`, { data: { category: 'video', description: 'corto' } })).status()).toBe(400);
      expect((await admin.post('/support-cases', { category: 'other', description: DESCRIPTION })).status()).toBe(403);
      expect((await student.ctx.get(`${API}/admin/support-cases`)).status()).toBe(403);

      // Bandeja del admin
      const inbox = await (await admin.get('/admin/support-cases?status=open')).json();
      const listed = inbox.cases.find((c) => c.id === item.id);
      expect(listed).toMatchObject({ studentId: student.id, studentEmail: email, description: DESCRIPTION });
      expect(listed.context.url).toContain('/course/practice/m1_s1');
      expect(inbox.counts.open).toBeGreaterThanOrEqual(1);

      // Cerrar exige respuesta; un caso cerrado no se vuelve a cerrar
      expect((await admin.post(`/admin/support-cases/${item.id}/resolve`, { resolution: '' })).status()).toBe(400);
      const resolved = await admin.post(`/admin/support-cases/${item.id}/resolve`, { status: 'resolved', resolution: 'Corregimos la carga de la fase 2.' });
      expect(resolved.status()).toBe(200);
      expect((await resolved.json()).case).toMatchObject({ status: 'resolved', resolution: 'Corregimos la carga de la fase 2.' });
      expect((await admin.post(`/admin/support-cases/${item.id}/resolve`, { resolution: 'Otra vez' })).status()).toBe(409);
      expect((await admin.post('/admin/support-cases/999999999/resolve', { resolution: 'Nada' })).status()).toBe(404);

      // El estudiante ve la respuesta
      const mine = await (await student.ctx.get(`${API}/support-cases/mine`)).json();
      expect(mine.cases[0]).toMatchObject({ id: item.id, status: 'resolved', resolution: 'Corregimos la carga de la fase 2.' });

      // Bitácora, correo y ficha
      const { actions } = await (await admin.get(`/admin/actions?targetType=student&targetId=${student.id}`)).json();
      expect(actions.find((a) => a.action === 'case.resolve')).toMatchObject({ reason: 'Corregimos la carga de la fase 2.' });
      const detail = await (await admin.get(`/admin/students/${student.id}/detail`)).json();
      expect(detail.cases.map((c) => [c.id, c.status])).toEqual([[item.id, 'resolved']]);
      expect(detail.emails.some((e) => e.template === 'case_answered')).toBe(true);
      expect(detail.timeline.map((e) => e.kind)).toEqual(expect.arrayContaining(['case_opened', 'case_closed']));

      // Límite de casos abiertos por estudiante
      for (let i = 0; i < MAX_OPEN_CASES_PER_STUDENT; i++) {
        const res = await student.ctx.post(`${API}/support-cases`, { data: { category: 'other', description: `${DESCRIPTION} (${i})` } });
        expect(res.status(), `caso ${i}`).toBe(201);
      }
      expect((await student.ctx.post(`${API}/support-cases`, { data: { category: 'other', description: DESCRIPTION } })).status()).toBe(429);
    } finally {
      await admin.dispose();
      await student.ctx.dispose();
    }
  });

  test('En el navegador: el estudiante reporta desde una tarjeta y el admin responde desde la bandeja', async ({ page, browser }) => {
    test.setTimeout(90000);
    const id = uniqueSuffix();
    const email = `reporte_ui_${id}@test.com`;
    const description = `No se escucha el audio del video 1 (${id}).`;

    await page.addInitScript(() => localStorage.setItem('tour_completed_arco', 'true'));
    await performLogin(page, email, 'ReporteUI2026!', true);
    await page.goto('/course');
    await page.click('#step-m1_v1 [data-report-step="m1_v1"]');
    await expect(page.locator('#report-category')).toHaveValue('video');
    await page.fill('#report-description', description);
    await page.click('#btn-send-report');
    await expect(page.locator('#report-problem-done')).toBeVisible({ timeout: 10000 });
    await page.click('#report-problem-done button');
    await page.click('#btn-my-reports');
    await expect(page.locator('#my-reports-modal')).toContainText(description);

    // El admin lo ve en la bandeja y lo resuelve
    const admin = await adminSession();
    await admin.dispose();
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await performLogin(adminPage, 'admin@admin.com', ADMIN_PASSWORD, false);
    await adminPage.goto('/admin');
    await expect(adminPage.locator('#support-cases-open-count')).toBeVisible({ timeout: 15000 });
    await adminPage.click('#btn-open-support-cases');
    const card = adminPage.locator('#support-cases-modal [data-case-id]', { hasText: description });
    await expect(card).toBeVisible();
    await card.locator('textarea').fill('Era el volumen del sistema; ya lo revisamos contigo.');
    await card.locator('button', { hasText: 'Resolver' }).click();
    await expect(adminPage.locator('#support-cases-modal [data-case-id]', { hasText: description })).toHaveCount(0);
    await adminPage.click('#cases-filter-resolved');
    await expect(adminPage.locator('#support-cases-modal [data-case-status="resolved"]', { hasText: description })).toBeVisible();
    await adminContext.close();
  });
});
