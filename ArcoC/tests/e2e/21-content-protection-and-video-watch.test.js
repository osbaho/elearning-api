import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { performLogin } from '../helpers/loginHelper.js';

const API = 'http://localhost:5000/api';
const PROTECTED_CONTENT = [
  '/videos/modulo1/M01_V01_SER.mp4',
  '/webgl/index.html',
  '/documents/lectura_parte1.pdf',
  '/images/modulo1/five_tissue_densities_tibia.jpg',
];

test.describe('Contenido protegido y registro de visualización de videos', () => {

  test('Sin sesión no se descarga contenido del curso', async ({ browser }) => {
    const context = await browser.newContext();
    for (const url of PROTECTED_CONTENT) {
      const res = await context.request.get(url, { maxRedirects: 0 });
      expect(res.status(), url).toBe(401);
    }
    // Abrir un PDF del curso directamente en la pestaña lleva al login
    const page = await context.newPage();
    await page.goto('/documents/lectura_parte1.pdf');
    await expect(page).toHaveURL(/\/login/);
    await context.close();
  });

  test('Con sesión el contenido se sirve con caché privada', async ({ page }) => {
    await performLogin(page, 'student@test.com', 'student123', true);
    const res = await page.request.get('/documents/lectura_parte1.pdf');
    expect(res.status()).toBe(200);
    expect(res.headers()['cache-control']).toContain('private');
  });

  test('El backend ya no publica los archivos de ArcoC/public (fuentes de las lecturas)', async ({ request }) => {
    const res = await request.get('http://localhost:5000/documents/lectura_parte1.md');
    expect(res.status()).toBe(404);
  });

  test('El inicio de reproducción de un video se registra una sola vez y respeta la secuencia', async ({ page }) => {
    await performLogin(page, 'student@test.com', 'student123', true);

    const first = await page.request.post(`${API}/progress/m1_v1/start`);
    expect(first.status()).toBe(200);
    const view = await first.json();
    // 175 s de video: 90 % visto a 2x, menos 5 s de margen
    expect(view).toMatchObject({ stepId: 'm1_v1', minWatchSeconds: 73 });

    const again = await (await page.request.post(`${API}/progress/m1_v1/start`)).json();
    expect(again.startedAt).toBe(view.startedAt);

    expect((await page.request.post(`${API}/progress/m1_s1/start`)).status()).toBe(400); // no es un video
    expect((await page.request.post(`${API}/progress/m1_v2/start`)).status()).toBe(403); // paso previo pendiente
  });

  test('Al reproducir un video, la página registra su inicio en la API', async ({ page }) => {
    test.skip(!fs.existsSync(path.resolve('client/public/videos/modulo1/M01_V01_SER.mp4')),
      'Videos no generados: ejecuta scripts/prepare-module-videos.ps1 -Module 1');
    await performLogin(page, 'student@test.com', 'student123', true);
    await page.goto('/course');
    await page.waitForSelector('.course-layout-container');
    await page.keyboard.press('Escape');

    const [request] = await Promise.all([
      page.waitForRequest(r => r.url().endsWith('/progress/m1_v1/start') && r.method() === 'POST'),
      page.locator('video.video-el').first().evaluate(v => { v.muted = true; return v.play(); }),
    ]);
    expect(request).toBeTruthy();
  });
});
