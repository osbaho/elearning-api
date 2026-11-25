import { test, expect } from '@playwright/test';
import { API, ADMIN_PASSWORD, adminSession, newApiContext } from '../helpers/adminHelper.js';
import { performLogin } from '../helpers/loginHelper.js';
import { completeStep, playSimulatorPhase } from '../helpers/simulatorHelper.js';
import { pickExamQuestionIds } from '../../server/services/examQuestions.js';
import { pendingCourseContent } from '../../server/services/launchReadiness.js';
import { attemptBlockReason, getSimulatorEntry } from '../../server/config/simulatorCatalog.js';
import { COURSE_STEPS, VIDEO_DURATION_SECONDS, isPracticeStep, isVideoStep } from '../../server/config/curriculum.js';
import { EXAM_QUESTION_BANK_TARGET, EXAM_QUESTION_COUNT, MAX_EXAM_ATTEMPTS } from '../../server/config/examRules.js';
import { QUESTION_BANK, buildQuestionRows } from '../../server/scripts/seed_50_questions.js';

/** Generador pseudoaleatorio con semilla (mulberry32): selección reproducible en las pruebas. */
function seededRandom(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const sorted = (ids) => [...ids].sort((a, b) => a - b);
const overlap = (a, b) => a.filter((id) => b.includes(id));

/** Contexto de API con un estudiante reiniciado y con sesión iniciada. */
async function studentApi(email, password, reset = {}) {
  const ctx = await newApiContext();
  await ctx.post(`${API}/test-reset`, { data: { email, password, ...reset } });
  const login = await ctx.post(`${API}/login`, { data: { email, password } });
  if (!login.ok()) throw new Error(`Login de ${email} falló: ${login.status()}`);
  return ctx;
}

test.describe('Malla de lanzamiento (30 pasos) y examen sin preguntas repetidas', () => {
  test('Selección de preguntas: no repite mientras queden preguntas sin ver', () => {
    const random = seededRandom(20261124);

    // Banco oficial de 50: los 3 intentos de 10 preguntas nunca comparten una
    const bank50 = range(1, 50);
    const a1 = pickExamQuestionIds(bank50, [], 10, random);
    const a2 = pickExamQuestionIds(bank50, [a1], 10, random);
    const a3 = pickExamQuestionIds(bank50, [a1, a2], 10, random);
    for (const ids of [a1, a2, a3]) {
      expect(ids).toHaveLength(10);
      expect(new Set(ids).size).toBe(10);
      expect(ids.every((id) => bank50.includes(id))).toBe(true);
    }
    expect(new Set([...a1, ...a2, ...a3]).size).toBe(30);

    // Banco de 25: el 3.er intento usa las 5 que quedan sin ver y completa con las del intento
    // más antiguo (el 1.º), no con las del más reciente
    const bank25 = range(1, 25);
    const b1 = pickExamQuestionIds(bank25, [], 10, random);
    const b2 = pickExamQuestionIds(bank25, [b1], 10, random);
    const b3 = pickExamQuestionIds(bank25, [b1, b2], 10, random);
    expect(overlap(b1, b2)).toEqual([]);
    const unseen = bank25.filter((id) => !b1.includes(id) && !b2.includes(id));
    expect(unseen).toHaveLength(5);
    expect(unseen.every((id) => b3.includes(id))).toBe(true);
    expect(overlap(b3, b2)).toEqual([]);
    expect(overlap(b3, b1)).toHaveLength(5);

    // Banco menor que un intento: todas sus preguntas, sin duplicados aunque el banco los traiga
    expect(sorted(pickExamQuestionIds([1, 2, 3, 4, 5], [], 10, random))).toEqual([1, 2, 3, 4, 5]);
    expect(sorted(pickExamQuestionIds([1, 2, 3, 4, 5], [[1, 2, 3, 4, 5]], 10, random))).toEqual([1, 2, 3, 4, 5]);
    expect(sorted(pickExamQuestionIds([1, 1, 2, 2, 3], [], 10, random))).toEqual([1, 2, 3]);
  });

  test('Banco oficial: 50 preguntas, 10 por categoría, la correcta repartida por igual y un 50/50 sin pistas', () => {
    expect(QUESTION_BANK).toHaveLength(EXAM_QUESTION_BANK_TARGET);
    const perCategory = {};
    for (const q of QUESTION_BANK) perCategory[q.category] = (perCategory[q.category] || 0) + 1;
    expect(Object.values(perCategory)).toEqual([10, 10, 10, 10, 10]);
    expect(new Set(QUESTION_BANK.map((q) => q.text.trim().toLowerCase())).size).toBe(QUESTION_BANK.length);

    // El seed es reproducible: mismos ids y mismas letras correctas cada vez
    const rows = buildQuestionRows();
    expect(buildQuestionRows()).toEqual(rows);
    const letters = ['a', 'b', 'c', 'd'];
    expect(letters.map((k) => rows.filter((r) => r.correct_answer === k).length)).toEqual([13, 13, 12, 12]);
    rows.forEach((row, i) => {
      const q = QUESTION_BANK[i];
      const options = { a: row.option_a, b: row.option_b, c: row.option_c, d: row.option_d };
      expect(options[row.correct_answer], `pregunta ${i + 1}`).toBe(q.b);
      expect(Object.values(options).sort()).toEqual([q.a, q.b, q.c, q.d].sort());
      expect(row.wildcard_eliminates).toMatch(/^[a-d]{2}$/);
      expect(row.wildcard_eliminates).not.toContain(row.correct_answer);
      expect(row.poison_text).not.toContain(`"${row.correct_answer.toUpperCase()}"`);
    });
    // Tras el 50/50 quedan la correcta y una incorrecta cualquiera: la que queda no delata a la correcta
    const kept = rows.map((r) => letters.find((k) => k !== r.correct_answer && !r.wildcard_eliminates.includes(k)));
    expect(new Set(kept).size).toBe(4);
  });

  test('Un minijuego pendiente no admite partidas en producción; fuera de producción sí', () => {
    expect(attemptBlockReason('m1_s1', { production: true })).toBeNull();
    expect(attemptBlockReason('m9_s9', { production: false })).toContain('no tiene contenido');
    expect(attemptBlockReason('m1_v1', { production: false })).toContain('no tiene contenido');

    const { videos, minigames } = pendingCourseContent();
    for (const step of minigames) {
      expect(getSimulatorEntry(step).ready, step).toBe(false);
      expect(attemptBlockReason(step, { production: true }), step).toContain('todavía no está disponible');
      expect(attemptBlockReason(step, { production: false }), step).toBeNull();
    }
    // Lo pendiente es exactamente lo que no tiene contenido definitivo; el módulo 1 está completo
    expect(videos).toEqual(COURSE_STEPS.filter((s) => isVideoStep(s) && !(VIDEO_DURATION_SECONDS[s] > 0)));
    expect(minigames).toEqual(COURSE_STEPS.filter((s) => isPracticeStep(s) && !getSimulatorEntry(s).ready));
    expect([...videos, ...minigames].some((s) => s.startsWith('m1_'))).toBe(false);

    // Estándar de nombres: cada módulo es la escena ModuloNN y cada minijuego, una de sus fases
    for (const step of COURSE_STEPS.filter(isPracticeStep)) {
      const [, moduleNumber, phase] = /^m(\d+)_s(\d+)$/.exec(step);
      expect(getSimulatorEntry(step), step).toMatchObject({ scene: `Modulo${moduleNumber.padStart(2, '0')}`, phase: Number(phase) });
    }
  });

  test('Todo minijuego exige una partida terminada, también los que aún no están en el simulador', async () => {
    const ctx = await studentApi('malla_30_pasos@test.com', 'Malla2026!');
    try {
      for (const step of ['m1_v1', 'm1_s1', 'm1_v2', 'm1_s2', 'm1_v3', 'm1_s3', 'm2_v1']) {
        await completeStep(ctx, step);
      }
      expect(getSimulatorEntry('m2_s1').ready).toBe(false);

      // Sin partida no se puede finalizar (antes, los minijuegos sin simulador se saltaban)
      const unplayed = await ctx.post(`${API}/progress/m2_s1`);
      expect(unplayed.status()).toBe(403);
      expect((await unplayed.json()).error).toContain('al menos una partida');
      // ni avanzar al paso siguiente
      expect((await ctx.post(`${API}/progress/m2_v2`)).status()).toBe(403);

      // Fuera de producción la partida se registra por API (lo que hacen los botones de simulación)
      await playSimulatorPhase(ctx, 'm2_s1');
      expect((await ctx.post(`${API}/progress/m2_s1`)).status()).toBe(200);
      expect((await ctx.post(`${API}/progress/m2_v2`)).status()).toBe(200);
    } finally {
      await ctx.dispose();
    }
  });

  test('El examen no repite preguntas entre intentos y guarda el historial', async () => {
    const admin = await adminSession();
    const readiness = await (await admin.get('/admin/launch-readiness')).json();
    await admin.dispose();
    const bankSize = readiness.checks.find((c) => c.id === 'question_bank').count;
    expect(bankSize).toBeGreaterThan(0);

    const ctx = await studentApi('rotacion_examen@test.com', 'Rotacion2026!', { exam_attempts: 0 });
    try {
      const attempts = [];
      for (let i = 0; i < MAX_EXAM_ATTEMPTS; i++) {
        expect((await ctx.post(`${API}/start-exam`)).status()).toBe(200);
        const ids = (await (await ctx.get(`${API}/questions`)).json()).map((q) => q.id);
        expect(ids).toHaveLength(Math.min(EXAM_QUESTION_COUNT, bankSize));
        expect(new Set(ids).size).toBe(ids.length);

        // Solo se repite lo inevitable: con el banco oficial de 50, nada
        const seen = new Set(attempts.flat());
        const unseenInBank = bankSize - seen.size;
        expect(ids.filter((id) => seen.has(id)).length, `intento ${i + 1}`)
          .toBe(Math.max(0, ids.length - unseenInBank));
        attempts.push(ids);

        // Respuestas fijas ('a'): el banco tiene respuestas variadas, así que no aprueba
        const submit = await ctx.post(`${API}/submit-exam`, {
          data: { answers: ids.map((id) => ({ question_id: id, answer: 'a' })) },
        });
        expect(submit.status()).toBe(200);
      }
      if (bankSize >= MAX_EXAM_ATTEMPTS * EXAM_QUESTION_COUNT) {
        expect(new Set(attempts.flat()).size).toBe(MAX_EXAM_ATTEMPTS * EXAM_QUESTION_COUNT);
      }
      expect((await ctx.post(`${API}/start-exam`)).status()).toBe(403);

      const me = await (await ctx.get(`${API}/student/me`)).json();
      expect(me.exam.history.map((a) => [a.number, a.status])).toEqual(
        range(1, MAX_EXAM_ATTEMPTS).map((n) => [n, 'submitted'])
      );
      for (const attempt of me.exam.history) {
        expect(typeof attempt.score).toBe('number');
        expect(attempt.questionCount).toBe(Math.min(EXAM_QUESTION_COUNT, bankSize));
        expect(attempt.finishedAt).toBeTruthy();
      }
    } finally {
      await ctx.dispose();
    }
  });

  test('Reiniciar un intento abierto conserva sus preguntas y lo deja como abandonado', async () => {
    const ctx = await studentApi('rotacion_examen@test.com', 'Rotacion2026!', { exam_attempts: 0 });
    try {
      expect((await ctx.post(`${API}/start-exam`)).status()).toBe(200);
      const first = (await (await ctx.get(`${API}/questions`)).json()).map((q) => q.id);
      const restart = await ctx.post(`${API}/start-exam`);
      expect(restart.status()).toBe(200);
      expect((await restart.json()).attemptsUsed).toBe(2);
      const second = (await (await ctx.get(`${API}/questions`)).json()).map((q) => q.id);
      expect(second).toEqual(first);

      const me = await (await ctx.get(`${API}/student/me`)).json();
      expect(me.exam.history.map((a) => [a.number, a.status])).toEqual([[1, 'abandoned'], [2, 'in_progress']]);
    } finally {
      await ctx.dispose();
    }
  });

  test('Preparación del lanzamiento: el admin ve el contenido pendiente y el banco de preguntas', async ({ page }) => {
    const { videos, minigames } = pendingCourseContent();
    const admin = await adminSession();
    const res = await admin.get('/admin/launch-readiness');
    expect(res.status()).toBe(200);
    const body = await res.json();
    await admin.dispose();
    const check = Object.fromEntries(body.checks.map((c) => [c.id, c]));
    expect(check.videos.pending).toEqual(videos);
    expect(check.videos.detail).toBe(`${15 - videos.length} de 15 publicados`);
    expect(check.minigames.pending).toEqual(minigames);
    expect(check.minigames.detail).toBe(`${15 - minigames.length} de 15 disponibles`);
    expect(check.question_bank.target).toBe(50);
    expect(body.ready).toBe(videos.length === 0 && minigames.length === 0 && check.question_bank.count >= 50);

    // Solo para administradores
    const student = await studentApi('malla_30_pasos@test.com', 'Malla2026!');
    expect((await student.get(`${API}/admin/launch-readiness`)).status()).toBe(403);
    await student.dispose();

    // En el panel: la tarjeta lista cada verificación y, a pedido, los pasos pendientes
    await performLogin(page, 'admin@admin.com', ADMIN_PASSWORD, false);
    await page.goto('/admin');
    const card = page.locator('#launch-readiness');
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect(card).toHaveAttribute('data-ready', body.ready ? 'true' : 'false');
    if (!body.ready) {
      await expect(card.locator('[data-check]')).toHaveCount(3);
      await expect(card.locator('[data-check="minigames"]')).toContainText(check.minigames.detail);
      if (minigames.length > 0) {
        await page.click('#btn-toggle-pending-content');
        await expect(page.locator('#pending-content-list')).toContainText(minigames[0]);
      }
    }
  });

  test('La práctica de un minijuego pendiente se muestra en desarrollo y solo se finaliza tras una partida', async ({ page }) => {
    const pendingStep = 'm2_s1';
    test.skip(getSimulatorEntry(pendingStep).ready, 'El minijuego ya está publicado en el simulador');

    await performLogin(page, 'malla_30_pasos@test.com', 'Malla2026!', true);
    for (const step of ['m1_v1', 'm1_s1', 'm1_v2', 'm1_s2', 'm1_v3', 'm1_s3', 'm2_v1']) {
      await completeStep(page.request, step);
    }

    await page.goto(`/course/practice/${pendingStep}`);
    await expect(page.locator('.sim-placeholder-title')).toHaveText('Práctica en desarrollo', { timeout: 15000 });
    const finish = page.locator('button:has-text("🏁 Finalizar Práctica")');
    await expect(finish).toBeDisabled();

    // En desarrollo, los botones de simulación registran una partida y habilitan la finalización
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/simulator/attempts/') && r.url().endsWith('/result') && r.status() === 200),
      page.click('button:has-text("Simular partida perfecta")'),
    ]);
    await expect(finish).toBeEnabled();
  });
});
