import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { API, ADMIN_PASSWORD, uniqueSuffix } from '../helpers/adminHelper.js';
import { performLogin } from '../helpers/loginHelper.js';
import { WORKER_STALL_MS, frameRoute } from '../../client/src/lib/proctoringFrames.js';

const CLIENT_SRC = fileURLToPath(new URL('../../client/src/', import.meta.url));
const SECRET = { 'x-test-secret': process.env.TEST_RESET_SECRET || 'test-reset-secret-local' };
// Clases que no son de estilo: el recorrido guiado del curso las usa como selectores
const CLASS_HOOKS = new Set(['tour-exam', 'tour-progress']);

function filesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  });
}

/** Clases escritas literalmente en className (cadenas y partes fijas de plantillas) sin regla en el CSS. */
function undefinedClasses() {
  const files = filesUnder(CLIENT_SRC);
  const css = files.filter((f) => f.endsWith('.css')).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const defined = new Set([...css.matchAll(/\.(-?[_a-zA-Z][_a-zA-Z0-9-]*)/g)].map((m) => m[1]));
  const missing = new Map();
  for (const file of files.filter((f) => f.endsWith('.js'))) {
    const src = fs.readFileSync(file, 'utf8');
    const literals = [
      ...[...src.matchAll(/className="([^"]*)"/g)].map((m) => m[1]),
      ...[...src.matchAll(/className=\{`([^`]*)`\}/g)].map((m) => m[1].replace(/\$\{[^}]*\}/g, ' ')),
    ];
    for (const cls of literals.flatMap((l) => l.split(/\s+/))) {
      if (!/^[_a-zA-Z][_a-zA-Z0-9-]*$/.test(cls) || defined.has(cls) || CLASS_HOOKS.has(cls)) continue;
      missing.set(cls, path.relative(CLIENT_SRC, file).replace(/\\/g, '/'));
    }
  }
  return Object.fromEntries(missing);
}

test.describe('Fase 6: correcciones del perfil del estudiante', () => {
  test('Supervisión: cada cuadro va al worker, espera o pasa al hilo principal sin errores', () => {
    const now = 100000;
    expect(frameRoute({ workerReady: true, workerBusySince: null, now })).toBe('worker');
    // Ocupado con el cuadro anterior: se espera (antes caía al hilo principal sin modelos)
    expect(frameRoute({ workerReady: true, workerBusySince: now - 2500, now })).toBe('wait');
    // Sin respuesta durante demasiado tiempo: se da por caído
    expect(frameRoute({ workerReady: true, workerBusySince: now - WORKER_STALL_MS, now })).toBe('reset');
    // Sin worker (no se pudo crear, falló al iniciar o no hay createImageBitmap)
    expect(frameRoute({ workerReady: false, now })).toBe('main');
    expect(frameRoute({ workerReady: false, mainBusy: true, now })).toBe('skip');
  });

  test('Toda clase escrita en el marcado tiene estilos (salvo los ganchos del recorrido guiado)', () => {
    expect(undefinedClasses()).toEqual({});
  });

  test('Práctica: el subtítulo queda alineado con el título', async ({ page }) => {
    const email = `fase6_practica_${uniqueSuffix()}@test.com`;
    await performLogin(page, email, 'Fase6Practica!', true);
    await page.request.post(`${API}/progress/m1_v1`);
    await page.goto('/course/practice/m1_s1');
    const title = page.locator('.page-header h1.hero-title');
    const subtitle = page.locator('.page-header .hero-subtitle');
    await expect(title).toBeVisible({ timeout: 15000 });
    const [t, s] = [await title.boundingBox(), await subtitle.boundingBox()];
    expect(Math.abs(t.x - s.x)).toBeLessThan(2);
  });

  test('Móvil (390 px): el encabezado del estudiante y del admin no se desborda', async ({ browser }) => {
    test.setTimeout(60000);
    const suffix = uniqueSuffix();
    for (const [email, password, isAdmin] of [[`fase6_movil_${suffix}@test.com`, 'Fase6Movil!', false], ['admin@admin.com', ADMIN_PASSWORD, true]]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, baseURL: 'http://localhost:3000' });
      const page = await context.newPage();
      try {
        await performLogin(page, email, password, !isAdmin);
        await page.goto(isAdmin ? '/admin' : '/course');
        const header = page.locator('header.modern-header');
        const logout = header.locator('.btn-logout, button:has-text("Cerrar sesión")').first();
        await expect(logout).toBeVisible({ timeout: 15000 });
        const [h, l] = [await header.boundingBox(), await logout.boundingBox()];
        // Todo el contenido del encabezado cabe dentro de él
        expect(l.y).toBeGreaterThanOrEqual(h.y);
        expect(l.y + l.height).toBeLessThanOrEqual(h.y + h.height + 1);
        expect(l.x + l.width).toBeLessThanOrEqual(390);
        // Y la página no tiene desplazamiento horizontal
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      } finally {
        await context.close();
      }
    }
  });

  test('Examen con cámara real (simulada por el navegador): la supervisión analiza cuadros sin errores en la consola', async ({ page }) => {
    test.setTimeout(90000);
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('dialog', (dialog) => dialog.accept());
    await page.context().grantPermissions(['camera']);

    const email = `fase6_camara_${uniqueSuffix()}@test.com`;
    await page.request.post(`${API}/test-reset`, {
      headers: SECRET, data: { email, password: 'Fase6Camara!', complete_course: true, exam_attempts: 0 },
    });
    await performLogin(page, email, 'Fase6Camara!', false);
    await page.goto('/course/exam');
    const start = page.locator('#start-exam-btn');
    await expect(start).toBeEnabled({ timeout: 20000 });
    await start.click();
    await expect(page.locator('#exam-main-screen')).toBeVisible({ timeout: 20000 });

    // La cámara simulada no muestra un rostro: cuando se analiza un cuadro, el panel lo indica
    await expect(page.locator('.proctoring-status')).toContainText('Rostro no detectado', { timeout: 45000 });
    // Varios ciclos más (cada 3 s) sin caer al hilo principal sin modelos
    await page.waitForTimeout(7000);
    expect(errors.filter((e) => /Main thread detection error|load model before inference/i.test(e))).toEqual([]);
  });
});
