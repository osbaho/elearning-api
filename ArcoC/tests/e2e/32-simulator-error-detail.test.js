import { test, expect } from '@playwright/test';
import { API, ADMIN_PASSWORD, adminSession, newApiContext, uniqueSuffix } from '../helpers/adminHelper.js';
import { performLogin } from '../helpers/loginHelper.js';
import { completeStep } from '../helpers/simulatorHelper.js';
import { MAX_ERROR_ENTRIES, parseErrorDetail, readErrorDetail } from '../../server/services/simulatorErrors.js';

const ERRORS = [
  { code: 'PZ_FIRE_INVERTED', message: 'Disparó con el arco invertido (tubo arriba): la dispersión va hacia el operador.', atSeconds: 12.34 },
  { code: 'PZ_PPE_MISSING', message: 'Disparó sin el equipo de protección completo (3/5).', atSeconds: 41 },
];

/**
 * Página que sustituye al build de Unity: habla el mismo protocolo (ready / phase-result) y
 * envía el detalle de errores como lo hace el build nuevo (PhaseResultMessage.errors).
 */
const FAKE_UNITY_PAGE = `<!doctype html><html><body><script>
  var params = new URLSearchParams(location.search);
  window.sendPhaseResult = function (errors) {
    window.parent.postMessage({
      source: 'carm-sim', v: 1, type: 'phase-result',
      attemptId: params.get('attempt'), stepId: params.get('step'), phase: Number(params.get('phase')),
      score: 70, maxScore: 100, passed: true, errorCount: errors.length, doseMsv: 0.2, timeSeconds: 1,
      errors: errors
    }, location.origin);
  };
  window.parent.postMessage({ source: 'carm-sim', v: 1, type: 'ready' }, location.origin);
</script></body></html>`;

test.describe('Detalle de errores de las partidas', () => {
  test('Validación pura del detalle: acota, normaliza y rechaza lo inválido', () => {
    expect(parseErrorDetail(undefined)).toEqual({ value: null });
    expect(parseErrorDetail(null)).toEqual({ value: null });
    expect(parseErrorDetail('x').error).toContain('lista');
    expect(parseErrorDetail(Array.from({ length: MAX_ERROR_ENTRIES + 1 }, () => ({ code: 'A' }))).error).toContain(`${MAX_ERROR_ENTRIES}`);
    expect(parseErrorDetail([{ code: 'con espacios' }]).error).toContain('code');
    expect(parseErrorDetail([null]).error).toContain('objeto');

    const { value } = parseErrorDetail([
      { code: ' IC_FAILED_SHOT ', message: 'x'.repeat(300), atSeconds: 7.26 },
      { code: 'ERROR', atSeconds: -3 },
    ]);
    expect(value[0]).toEqual({ code: 'IC_FAILED_SHOT', message: 'x'.repeat(200), atSeconds: 7.3 });
    expect(value[1]).toEqual({ code: 'ERROR', message: '', atSeconds: null });

    expect(readErrorDetail(null)).toEqual([]);
    expect(readErrorDetail('no es json')).toEqual([]);
    expect(readErrorDetail(JSON.stringify(ERRORS))).toEqual(ERRORS);
  });

  test('La API guarda el detalle de cada partida y la ficha lo muestra; uno inválido se rechaza', async () => {
    const id = uniqueSuffix();
    const ctx = await newApiContext();
    const reset = await ctx.post(`${API}/test-reset`, { data: { email: `errores_${id}@test.com`, password: 'Errores2026!' } });
    const { studentId } = await reset.json();
    await ctx.post(`${API}/login`, { data: { email: `errores_${id}@test.com`, password: 'Errores2026!' } });
    const admin = await adminSession();
    try {
      await completeStep(ctx, 'm1_v1');
      const attempt = await (await ctx.post(`${API}/simulator/attempts`, { data: { stepId: 'm1_s1' } })).json();
      const base = { phase: attempt.phase, score: 70, maxScore: 100, passed: true, errorCount: 2, doseMsv: 0.1, timeSeconds: 1 };

      const invalid = await ctx.post(`${API}/simulator/attempts/${attempt.attemptId}/result`, { data: { ...base, errors: [{ code: 'mal código' }] } });
      expect(invalid.status()).toBe(400);
      const ok = await ctx.post(`${API}/simulator/attempts/${attempt.attemptId}/result`, { data: { ...base, errors: ERRORS } });
      expect(ok.status()).toBe(200);

      // Una partida sin detalle (build anterior) sigue funcionando
      const old = await (await ctx.post(`${API}/simulator/attempts`, { data: { stepId: 'm1_s1' } })).json();
      expect((await ctx.post(`${API}/simulator/attempts/${old.attemptId}/result`, { data: { ...base, phase: old.phase } })).status()).toBe(200);

      const detail = await (await admin.get(`/admin/students/${studentId}/detail`)).json();
      const attempts = detail.steps.find((s) => s.stepId === 'm1_s1').attempts;
      expect(attempts[0].errors).toEqual([
        { ...ERRORS[0], atSeconds: 12.3 },
        ERRORS[1],
      ]);
      expect(attempts[1].errors).toEqual([]);
    } finally {
      await admin.dispose();
      await ctx.dispose();
    }
  });

  test('La página de práctica reenvía a la API el detalle que manda Unity y la ficha lo muestra', async ({ page, browser }) => {
    const id = uniqueSuffix();
    const email = `errores_ui_${id}@test.com`;
    await performLogin(page, email, 'ErroresUI2026!', true);
    await page.request.post(`${API}/progress/m1_v1`);
    await page.route('**/webgl/index.html*', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: FAKE_UNITY_PAGE })
    );

    await page.goto('/course/practice/m1_s1');
    await page.click('button:has-text("Comenzar minijuego")');
    await expect(page.locator('aside')).toContainText('Simulador listo', { timeout: 15000 });
    const frame = page.frames().find((f) => f.url().includes('/webgl/index.html'));
    expect(frame).toBeTruthy();

    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().endsWith('/result') && req.method() === 'POST'),
      frame.evaluate((errors) => window.sendPhaseResult(errors), ERRORS),
    ]);
    expect(request.postDataJSON().errors).toEqual(ERRORS);
    await expect(page.locator('#session-points')).toHaveText('+5');

    const admin = await adminSession();
    const list = await (await admin.get(`/admin/students?search=${encodeURIComponent(email)}`)).json();
    const detail = await (await admin.get(`/admin/students/${list.students[0].id}/detail`)).json();
    await admin.dispose();
    const stored = detail.steps.find((s) => s.stepId === 'm1_s1').attempts[0].errors;
    expect(stored.map((e) => e.code)).toEqual(['PZ_FIRE_INVERTED', 'PZ_PPE_MISSING']);

    // En la ficha del admin, «Ver partidas» lista cada error con su segundo, su código y el mensaje
    const adminContext = await browser.newContext({ baseURL: 'http://localhost:3000' });
    try {
      const adminPage = await adminContext.newPage();
      await performLogin(adminPage, 'admin@admin.com', ADMIN_PASSWORD, false);
      await adminPage.goto(`/admin/estudiantes/${list.students[0].id}`);
      await adminPage.click('#btn-attempts-m1_s1');
      const errorList = adminPage.locator('#attempts-m1_s1 .attempt-errors');
      await expect(errorList.locator('li[data-error-code]')).toHaveCount(2);
      await expect(errorList.locator('li[data-error-code="PZ_FIRE_INVERTED"]')).toContainText('12.3 s');
      await expect(errorList.locator('li[data-error-code="PZ_PPE_MISSING"]')).toContainText('sin el equipo de protección');
    } finally {
      await adminContext.close();
    }
  });
});
