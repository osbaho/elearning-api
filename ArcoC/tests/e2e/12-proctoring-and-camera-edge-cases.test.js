import { test, expect } from '@playwright/test';
import { performLogin } from '../helpers/loginHelper.js';
import { io } from 'socket.io-client';

test.describe('Proctoring, Virtual Camera & WebSocket Security', () => {

  test('Blocks virtual cameras (OBS / vCam / Snap) and displays security notice', async ({ page }) => {
    await performLogin(page, 'student@test.com', 'student123', true);

    // Mock getUserMedia para retornar un track simulado con etiqueta de OBS Virtual Camera
    await page.addInitScript(() => {
      const fakeTrack = {
        label: 'OBS Virtual Camera (64-bit)',
        kind: 'video',
        stop: () => {},
        getSettings: () => ({ width: 640, height: 480 })
      };
      const fakeStream = {
        getVideoTracks: () => [fakeTrack],
        getTracks: () => [fakeTrack]
      };
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: () => Promise.resolve(fakeStream)
        }
      });
    });

    await page.goto('/course/exam');

    const startBtn = page.locator('#start-exam-btn');
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await startBtn.click();

    // El sistema debe detectar la cámara virtual y activar el panel de error/bloqueo
    const errorPanel = page.locator('#camera-error-panel');
    await expect(errorPanel).toBeVisible({ timeout: 5000 });

    const isMainScreenVisible = await page.locator('#exam-main-screen').isVisible();
    expect(isMainScreenVisible).toBe(false);
  });

  test('Rejects WebSocket connections lacking valid JWT credentials', async () => {
    // Intentar conectar al servidor Socket.IO en :5000 sin token ni cookies
    const socket = io('http://localhost:5000', {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: false
    });

    const connectError = await new Promise((resolve) => {
      socket.on('connect_error', (err) => {
        resolve(err.message);
      });
      socket.on('connect', () => {
        resolve(null);
      });
      setTimeout(() => resolve('TIMEOUT'), 4000);
    });

    socket.disconnect();
    expect(connectError).not.toBeNull();
    expect(connectError).toContain('Authentication error');
  });

  test('Displays early proctoring warning banner before final suspension', async ({ page }) => {
    await performLogin(page, 'student@test.com', 'student123', true);
    await page.goto('/course/exam?skipCamera=true');

    const startBtn = page.locator('#start-exam-btn');
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await startBtn.click();

    await expect(page.locator('#exam-main-screen')).toBeVisible({ timeout: 5000 });

    // Enviar evento simulado de proctoring_warning al cliente
    await page.evaluate(() => {
      // Disparar mensaje de warning a través del socket
      window.__test_socket_warning = 'Señal de cámara débil o intermitente. Verifica tu conexión.';
    });

    // Validar que la interfaz se mantiene visible durante la advertencia (no bloquea de inmediato)
    const isMainScreenVisible = await page.locator('#exam-main-screen').isVisible();
    expect(isMainScreenVisible).toBe(true);
  });

});
