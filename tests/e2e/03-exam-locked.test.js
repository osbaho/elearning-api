import { test, expect } from '@playwright/test';
import { performLogin } from '../helpers/loginHelper.js';

test.describe('Exam camera blocked', () => {
  test.use({ permissions: [] }); // Blocks everything including camera

  test('Exam does not start when camera is blocked', async ({ page }) => {
    await performLogin(page);
    
    // Explicitly mock getUserMedia to throw an error (simulating permission denied or no camera)
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: () => Promise.reject(new Error('Permission denied'))
        }
      });
    });

    await page.goto('/course/exam');
    
    // Click start exam
    await page.click('#start-exam-btn');
    
    // Check that error panel shows camera error
    const errorPanel = page.locator('#camera-error-panel');
    await expect(errorPanel).toBeVisible({ timeout: 5000 });
    
    const errorTitle = await page.locator('#camera-error-title').textContent();
    const isValidError = 
      errorTitle?.includes('Cámara no detectada') ||
      errorTitle?.includes('bloqueada') ||
      errorTitle?.includes('No se encontró ninguna cámara') || 
      errorTitle?.includes('Permiso de cámara denegado') ||
      errorTitle?.includes('Error al iniciar la cámara');
    expect(isValidError).toBeTruthy();
    
    // Check that the exam did not start
    const isMainScreenVisible = await page.locator('#exam-main-screen').isVisible();
    expect(isMainScreenVisible).toBe(false);
  });
});
