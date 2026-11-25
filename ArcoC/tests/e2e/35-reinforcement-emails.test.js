import { test, expect } from '@playwright/test';
import { API, ADMIN_PASSWORD, adminSession, ensureCohort, newApiContext, uniqueSuffix } from '../helpers/adminHelper.js';
import { performLogin } from '../helpers/loginHelper.js';
import { completeStep, playSimulatorPhase } from '../helpers/simulatorHelper.js';
import { ALERT_RULES } from '../../server/services/progressTracking.js';
import { MAX_EXAM_ATTEMPTS } from '../../server/config/examRules.js';
import {
  DEFAULT_TEMPLATES, SAMPLE_VALUES, TEMPLATE_LIMITS, TEMPLATE_VARIABLES, renderTemplate, templateVariablesIn, validateTemplate,
} from '../../server/config/reinforcementTemplates.js';
import {
  REINFORCEMENT_RULES, reinforcementEmailFor, reinforcementValues, stepDescription,
} from '../../server/services/reinforcement.js';

const FAILED = { score: 40, maxScore: 100, passed: false, errorCount: 3 };
const PASSWORD = 'Refuerzo2026!';
// Promoción propia y sin fechas: solo aparecen las alertas de minijuego y de examen
const COHORT = 'Refuerzo E2E';
const STRUGGLING_SUBJECT = 'Consejos para el minijuego «Protocolo Cero: Arquitectura del Arco»';

/** Con tres partidas no aprobadas en m1_s1 (alerta «minijuego difícil»); devuelve { ctx, id }. */
async function strugglingStudent(email, reset = {}) {
  const ctx = await newApiContext();
  const res = await ctx.post(`${API}/test-reset`, {
    data: { email, password: PASSWORD, name: 'Dra. Refuerzo', reserve_points: 0, exam_attempts: 0, cohort: COHORT, ...reset },
  });
  const { studentId } = await res.json();
  expect((await ctx.post(`${API}/login`, { data: { email, password: PASSWORD } })).ok()).toBe(true);
  await completeStep(ctx, 'm1_v1');
  for (let i = 0; i < ALERT_RULES.STRUGGLING_ATTEMPTS; i++) await playSimulatorPhase(ctx, 'm1_s1', FAILED);
  return { ctx, id: studentId };
}

async function inbox(admin, query) {
  const res = await admin.get(`/admin/alerts?${new URLSearchParams(query)}`);
  expect(res.status()).toBe(200);
  return res.json();
}

test.describe('Correos de refuerzo aprobados por el admin', () => {
  test.beforeAll(async () => {
    const admin = await adminSession();
    await ensureCohort(admin, { name: COHORT });
    await admin.dispose();
  });

  test('Reglas puras: plantillas, variables, valores y la invitación de «Sin activar»', async () => {
    expect(Object.keys(DEFAULT_TEMPLATES).sort())
      .toEqual(['behind_schedule', 'cohort_closing', 'exam_exhausted', 'inactive', 'minigame_struggling']);
    for (const [code, template] of Object.entries(DEFAULT_TEMPLATES)) {
      expect(validateTemplate(template).value, code).toBeTruthy();
    }
    expect(validateTemplate({ subject: '', body: 'x' }).error).toContain('asunto');
    expect(validateTemplate({ subject: 'a\nb', body: 'x' }).error).toContain('una sola línea');
    expect(validateTemplate({ subject: 'x'.repeat(TEMPLATE_LIMITS.SUBJECT_MAX + 1), body: 'x' }).error)
      .toContain(String(TEMPLATE_LIMITS.SUBJECT_MAX));
    expect(validateTemplate({ subject: 'Hola', body: '   ' }).error).toContain('texto');
    expect(validateTemplate({ subject: 'Hola {{nombr}}', body: '{{otra}} y {{nombre}}' }).error)
      .toBe('Variables desconocidas: {{nombr}}, {{otra}}.');
    expect(validateTemplate({ subject: '  Hola  ', body: 'a\r\nb  ' }).value).toEqual({ subject: 'Hola', body: 'a\nb' });
    expect(templateVariablesIn('{{ nombre }} y {{avance}}')).toEqual(['nombre', 'avance']);
    expect(renderTemplate('{{nombre}}: {{partidas}} · {{ avance }} %', { nombre: 'Ana', avance: 0 })).toBe('Ana: — · 0 %');
    // La vista previa del editor tiene un valor de muestra por variable
    expect(Object.keys(SAMPLE_VALUES).sort()).toEqual(Object.keys(TEMPLATE_VARIABLES).sort());

    expect(stepDescription('m1_v2')).toBe('el video 2 del módulo 1');
    expect(stepDescription('m1_s1')).toContain('«Protocolo Cero');
    expect(stepDescription('exam')).toBe('el examen final');
    const values = reinforcementValues({
      student: { name: 'Ana', cohort: 'P1' },
      row: { percent: 10, completedSteps: 3, totalSteps: 30, currentStep: 'm1_s2', access: { endsOn: '2026-12-15' } },
      alert: { code: 'minigame_struggling', stepId: 'm1_s1', attempts: 4 },
    });
    expect(values).toMatchObject({
      nombre: 'Ana', promocion: 'P1', avance: 10, pasos_completados: 3, pasos_totales: 30, fecha_cierre: '15/12/2026',
      partidas: 4, minijuego: expect.stringContaining('Protocolo Cero'), paso_actual: expect.stringContaining('minijuego 2 del módulo 1'),
    });
    expect(values.enlace_curso).toMatch(/\/login$/);

    // «Sin activar»: la invitación; en la vista previa el enlace es de muestra y no se emite ninguno
    const invitation = await reinforcementEmailFor({
      code: 'not_activated', student: { id: 1, name: 'Ana', email: 'ana@test.com', cohort: 'P1' },
    });
    expect(invitation).toMatchObject({ kind: 'invitation', template: 'reinforcement_not_activated', secrets: [] });
    expect(invitation.html).toContain('/activar?token=');
    expect(REINFORCEMENT_RULES).toEqual({ MIN_HOURS_BETWEEN: 24, MAX_PER_WEEK: 2 });
  });

  test('Vista previa y envío: el correo usa la plantilla y los datos del estudiante, y el límite frena el siguiente', async () => {
    const id = uniqueSuffix();
    const email = `refuerzo_a_${id}@test.com`;
    // Dos alertas del mismo estudiante: minijuego difícil e intentos del examen agotados
    const s = await strugglingStudent(email, { exam_attempts: MAX_EXAM_ATTEMPTS });
    const admin = await adminSession();
    try {
      const { entries } = await inbox(admin, { search: id });
      const struggling = entries.find((e) => e.code === 'minigame_struggling');
      const exhausted = entries.find((e) => e.code === 'exam_exhausted');
      expect(struggling && exhausted).toBeTruthy();

      const preview = await (await admin.get(`/admin/alerts/${struggling.id}/preview`)).json();
      expect(preview).toMatchObject({
        success: true, to: email, kind: 'template', open: true, accountActive: true,
        subject: STRUGGLING_SUBJECT, allowance: { allowed: true, sentThisWeek: 0 },
      });
      expect(preview.text).toContain(`Llevas ${ALERT_RULES.STRUGGLING_ATTEMPTS} partidas del minijuego`);
      expect(preview.html).toContain('Ir a mi curso');
      expect((await admin.get('/admin/alerts/999999999/preview')).status()).toBe(404);

      // Los dos a la vez: sale el primero y el segundo sigue pendiente por el límite de 24 horas
      const res = await admin.post('/admin/alerts/decide', { ids: [struggling.id, exhausted.id], action: 'send', note: 'Refuerzo semanal' });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.done).toBe(1);
      expect(body.results[0]).toMatchObject({ id: struggling.id, ok: true, status: 'sent', emailLogId: expect.any(Number) });
      expect(body.results[1]).toMatchObject({ id: exhausted.id, ok: false, limited: true });
      expect(body.results[1].error).toContain(`${REINFORCEMENT_RULES.MIN_HOURS_BETWEEN} horas`);

      // Solo, el segundo responde 429; el «Recordatorio» de la auditoría respeta el mismo límite
      expect((await admin.post('/admin/alerts/decide', { ids: [exhausted.id], action: 'send' })).status()).toBe(429);
      expect((await admin.post(`/admin/send-reminder/${s.id}`)).status()).toBe(429);
      const blocked = await (await admin.get(`/admin/alerts/${exhausted.id}/preview`)).json();
      expect(blocked.allowance).toMatchObject({ allowed: false, sentThisWeek: 1, lastSentAt: expect.any(String) });
      expect((await inbox(admin, { search: id })).entries.map((e) => e.id)).toEqual([exhausted.id]);

      // Historial con el estado del correo, el correo en la ficha y la bitácora
      const history = await inbox(admin, { view: 'history', search: id });
      expect(history.entries).toHaveLength(1);
      expect(history.entries[0]).toMatchObject({
        id: struggling.id, status: 'sent', note: 'Refuerzo semanal', emailLogId: body.results[0].emailLogId,
      });
      expect(['queued', 'sent', 'simulated']).toContain(history.entries[0].emailStatus);
      const detail = await (await admin.get(`/admin/students/${s.id}/detail`)).json();
      expect(detail.emails.some((m) => m.template === 'reinforcement_minigame_struggling')).toBe(true);
      const { actions } = await (await admin.get(`/admin/actions?targetType=student&targetId=${s.id}`)).json();
      expect(actions.find((a) => a.action === 'alert.send')).toMatchObject({
        reason: 'Refuerzo semanal',
        details: expect.objectContaining({ alertCode: 'minigame_struggling', template: 'reinforcement_minigame_struggling' }),
      });

      // Una alerta ya enviada no se reenvía
      expect((await admin.post('/admin/alerts/decide', { ids: [struggling.id], action: 'send' })).status()).toBe(409);
    } finally {
      await admin.dispose();
      await s.ctx.dispose();
    }
  });

  test('A una cuenta desactivada no se le envía el refuerzo', async () => {
    const id = uniqueSuffix();
    const s = await strugglingStudent(`refuerzo_b_${id}@test.com`);
    const admin = await adminSession();
    try {
      const [entry] = (await inbox(admin, { search: id })).entries;
      expect((await admin.post(`/admin/students/${s.id}/deactivate`, { reason: 'Retiro voluntario' })).status()).toBe(200);
      const res = await admin.post('/admin/alerts/decide', { ids: [entry.id], action: 'send' });
      expect(res.status()).toBe(409);
      expect((await res.json()).error).toContain('desactivada');
      // La revisión siguiente la cierra sola: una cuenta desactivada no tiene alertas
      const history = await inbox(admin, { view: 'history', search: id });
      expect(history.entries.map((e) => [e.id, e.status])).toEqual([[entry.id, 'resolved']]);
    } finally {
      await admin.dispose();
      await s.ctx.dispose();
    }
  });

  test('Plantillas: editar con variables, vista previa, envío con el texto editado y vuelta al original', async () => {
    const code = 'minigame_struggling';
    const edited = { subject: 'Ánimo con «{{minijuego}}», {{nombre}}', body: 'Hola, {{nombre}}:\n\nVas {{partidas}} partidas. ¡Tú puedes!' };
    const admin = await adminSession();
    const id = uniqueSuffix();
    const s = await strugglingStudent(`refuerzo_t_${id}@test.com`);
    try {
      const list = await (await admin.get('/admin/reinforcement-templates')).json();
      expect(list.templates.map((t) => t.code).sort()).toEqual(Object.keys(DEFAULT_TEMPLATES).sort());
      expect(list.variables).toEqual(TEMPLATE_VARIABLES);
      expect(list.templates.find((t) => t.code === code)).toMatchObject({ isDefault: true, subject: DEFAULT_TEMPLATES[code].subject });

      const put = (target, data) => admin.ctx.put(`${API}/admin/reinforcement-templates/${target}`, { data });
      expect((await put(code, { subject: 'Hola {{nombr}}', body: 'x' })).status()).toBe(400);
      expect((await put(code, { subject: 'Hola', body: '' })).status()).toBe(400);
      expect((await put('not_activated', { subject: 'Hola', body: 'x' })).status()).toBe(404);
      expect((await s.ctx.get(`${API}/admin/reinforcement-templates`)).status()).toBe(403);

      const saved = await put(code, edited);
      expect(saved.status()).toBe(200);
      expect((await saved.json()).template).toMatchObject({
        code, isDefault: false, subject: edited.subject, updatedBy: { name: expect.any(String) }, updatedAt: expect.any(String),
      });
      const sample = await (await admin.post(`/admin/reinforcement-templates/${code}/preview`, edited)).json();
      expect(sample.subject).toBe(`Ánimo con «${SAMPLE_VALUES.minijuego}», ${SAMPLE_VALUES.nombre}`);
      expect((await admin.post(`/admin/reinforcement-templates/${code}/preview`, { subject: '{{x}}', body: 'y' })).status()).toBe(400);

      // El correo de una alerta de ese tipo ya usa el texto editado, con los datos del estudiante
      const [entry] = (await inbox(admin, { search: id })).entries;
      const preview = await (await admin.get(`/admin/alerts/${entry.id}/preview`)).json();
      expect(preview.subject).toBe('Ánimo con «Protocolo Cero: Arquitectura del Arco», Dra. Refuerzo');
      expect(preview.text).toContain(`Vas ${ALERT_RULES.STRUGGLING_ATTEMPTS} partidas. ¡Tú puedes!`);

      const restored = await admin.ctx.delete(`${API}/admin/reinforcement-templates/${code}`);
      expect((await restored.json()).template).toMatchObject({ isDefault: true, subject: DEFAULT_TEMPLATES[code].subject, updatedBy: null });
      const { actions } = await (await admin.get(`/admin/actions?targetType=template&targetId=${code}`)).json();
      expect(actions.map((a) => a.action)).toEqual(expect.arrayContaining(['template.update', 'template.restore']));
    } finally {
      // Si algo falló a mitad, la plantilla vuelve al original para las demás pruebas
      await admin.ctx.delete(`${API}/admin/reinforcement-templates/${code}`);
      await admin.dispose();
      await s.ctx.dispose();
    }
  });

  test('En el panel: vista previa y envío de un refuerzo, y el editor de plantillas', async ({ page }) => {
    test.setTimeout(90000);
    const id = uniqueSuffix();
    const email = `refuerzo_ui_${id}@test.com`;
    const s = await strugglingStudent(email);
    await s.ctx.dispose();

    await performLogin(page, 'admin@admin.com', ADMIN_PASSWORD, false);
    await page.goto('/admin');
    await page.fill('#input-admin-search', String(id));
    await page.click('#tab-view-alerts');
    const row = page.locator(`#alert-inbox-table tr[data-student-email="${email}"]`);
    await expect(row).toBeVisible({ timeout: 15000 });
    const alertId = await row.getAttribute('data-alert-id');

    await page.click(`#btn-alert-send-${alertId}`);
    await expect(page.locator('#reinforcement-preview-subject')).toHaveText(STRUGGLING_SUBJECT);
    await expect(page.locator('#reinforcement-preview-to')).toHaveText(email);
    await expect(page.frameLocator('#reinforcement-preview iframe').locator('body')).toContainText('partidas del minijuego');
    await page.fill('#reinforcement-preview-note', 'Enviado desde la prueba del panel');
    await page.click('#btn-reinforcement-send');
    await expect(page.locator('#alert-inbox-notice')).toContainText(`Correo de refuerzo en cola para ${email}`);
    await expect(row).toHaveCount(0);
    await page.click('#alerts-view-history');
    await expect(page.locator(`#alert-history-table tr[data-alert-id="${alertId}"]`)).toContainText('Correo enviado');

    // Editor: vista previa con datos de muestra, guardar y volver al original
    try {
      await page.click('#btn-reinforcement-templates');
      await page.click('#template-tab-inactive');
      await expect(page.locator('#template-status')).toContainText('Texto original');
      await page.fill('#template-subject', 'Te extrañamos, {{nombre}}');
      await expect(page.locator('#template-status')).toContainText('Hay cambios sin guardar');
      await page.click('#btn-template-preview');
      await expect(page.locator('#template-preview')).toContainText(`Te extrañamos, ${SAMPLE_VALUES.nombre}`);
      await page.click('#btn-template-save');
      await expect(page.locator('#template-notice')).toContainText('Plantilla guardada');
      await expect(page.locator('#template-status')).toContainText('Editada');
      page.once('dialog', (dialog) => dialog.accept());
      await page.click('#btn-template-restore');
      await expect(page.locator('#template-status')).toContainText('Texto original');
      await expect(page.locator('#template-subject')).toHaveValue(DEFAULT_TEMPLATES.inactive.subject);
    } finally {
      const admin = await adminSession();
      await admin.ctx.delete(`${API}/admin/reinforcement-templates/inactive`);
      await admin.dispose();
    }
  });
});
