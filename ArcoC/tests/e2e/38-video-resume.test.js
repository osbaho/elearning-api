import { test, expect } from '@playwright/test';
import { API, adminSession, newApiContext, uniqueSuffix } from '../helpers/adminHelper.js';
import { performLogin } from '../helpers/loginHelper.js';
import { MAX_VIDEO_SECONDS, parseVideoPosition } from '../../server/services/videoResume.js';

const PASSWORD = 'Retomar2026!';

async function studentApi(email) {
  const ctx = await newApiContext();
  await ctx.post(`${API}/test-reset`, { data: { email, password: PASSWORD } });
  expect((await ctx.post(`${API}/login`, { data: { email, password: PASSWORD } })).ok()).toBe(true);
  return ctx;
}

test.describe('Videos: retomar donde quedó el estudiante', () => {
  test('Validación pura de la posición', () => {
    expect(parseVideoPosition({ position: 42.46, maxWatched: 60 }).value).toEqual({ position: 42.5, maxWatched: 60 });
    // Sin maxWatched, o menor que la posición, cuenta la posición
    expect(parseVideoPosition({ position: 12 }).value).toEqual({ position: 12, maxWatched: 12 });
    expect(parseVideoPosition({ position: 30, maxWatched: 10 }).value).toEqual({ position: 30, maxWatched: 30 });
    for (const bad of [{}, { position: -1 }, { position: 'x' }, { position: MAX_VIDEO_SECONDS + 1 }, { position: 5, maxWatched: Number.NaN }]) {
      expect(parseVideoPosition(bad).error, JSON.stringify(bad)).toBeTruthy();
    }
  });

  test('El API guarda la posición; hasta dónde llegó nunca baja; respeta la secuencia y el modo revisión', async () => {
    const ctx = await studentApi(`retomar_api_${uniqueSuffix()}@test.com`);
    const admin = await adminSession();
    try {
      const get = async (step) => (await ctx.get(`${API}/progress/${step}/position`)).json();
      expect(await get('m1_v1')).toMatchObject({ position: 0, maxWatched: 0 });

      expect((await ctx.post(`${API}/progress/m1_v1/position`, { data: { position: 42.46, maxWatched: 60 } })).status()).toBe(200);
      expect(await get('m1_v1')).toMatchObject({ position: 42.5, maxWatched: 60, updatedAt: expect.any(String) });
      // Volver atrás: cambia la posición, pero no lo ya visto
      const back = await ctx.post(`${API}/progress/m1_v1/position`, { data: { position: 10, maxWatched: 30 } });
      expect(await back.json()).toMatchObject({ position: 10, maxWatched: 60 });

      expect((await ctx.post(`${API}/progress/m1_v1/position`, { data: { position: -3 } })).status()).toBe(400);
      expect((await ctx.post(`${API}/progress/m1_s1/position`, { data: { position: 3 } })).status()).toBe(400);
      expect((await ctx.get(`${API}/progress/m1_s1/position`)).status()).toBe(400);
      // m1_v2 sigue bloqueado (falta m1_s1)
      expect((await ctx.post(`${API}/progress/m1_v2/position`, { data: { position: 3 } })).status()).toBe(403);

      // El admin en modo revisión no guarda nada
      expect(await (await admin.post('/progress/m1_v1/position', { position: 50 })).json()).toMatchObject({ preview: true });
      expect(await (await admin.get('/progress/m1_v1/position')).json()).toMatchObject({ preview: true, position: 0 });
    } finally {
      await admin.dispose();
      await ctx.dispose();
    }
  });

  test('En el curso: el video ofrece retomar y deja moverse por lo ya visto, no más allá', async ({ page }) => {
    const email = `retomar_ui_${uniqueSuffix()}@test.com`;
    await performLogin(page, email, PASSWORD, true);
    expect((await page.request.post(`${API}/progress/m1_v1/position`, { data: { position: 42, maxWatched: 60 } })).status()).toBe(200);

    await page.goto('/course');
    const note = page.locator('#video-resume-m1_v1');
    await expect(note).toContainText('Retomas en 0:42', { timeout: 15000 });

    const video = page.locator('#step-m1_v1 video.video-el');
    const seek = (seconds) => video.evaluate((el, s) => {
      el.currentTime = s;
      el.dispatchEvent(new Event('seeking'));
    }, seconds);
    // Dentro de lo ya visto (hasta 60 s): permitido
    await seek(55);
    await expect(page.locator('#step-m1_v1 .video-seek-warning')).toHaveCount(0);
    // Más allá: se bloquea como siempre
    await seek(120);
    await expect(page.locator('#step-m1_v1 .video-seek-warning')).toContainText('No está permitido adelantar');

    await note.locator('button:has-text("Ver desde el inicio")').click();
    await expect(note).toHaveCount(0);
  });

  test('Abrir el curso sin reproducir no marca el video como empezado', async ({ page }) => {
    const email = `retomar_sin_play_${uniqueSuffix()}@test.com`;
    await performLogin(page, email, PASSWORD, true);
    await page.goto('/course');
    await expect(page.locator('#step-m1_v1 video.video-el')).toBeVisible({ timeout: 15000 });
    // Otra página: el reproductor se desmonta (ahí guarda si hubo algo visto)
    await page.goto('/course/ayuda');
    await expect(page.locator('#faq')).toBeVisible();
    const position = await (await page.request.get(`${API}/progress/m1_v1/position`)).json();
    expect(position).toMatchObject({ position: 0, maxWatched: 0, updatedAt: null });
  });
});
