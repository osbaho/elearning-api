import { test, expect } from '@playwright/test';
import { performLogin } from '../helpers/loginHelper.js';

test.describe('Focus loss', () => {
  test.use({ permissions: ['camera'] });

  test('Shows overlay when window loses focus and dismisses correctly', async ({ page }) => {
    await performLogin(page);

    await page.goto('/course/exam?skipCamera=true');
    
    const startBtn = page.locator('#start-exam-btn');
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await expect(startBtn).toBeEnabled({ timeout: 10000 });
    await startBtn.click();
    
    await expect(page.locator('#exam-main-screen')).toBeVisible({ timeout: 5000 });
    
    // Trigger blur event to simulate user switching tabs or windows
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    
    // Check anti-cheat overlay
    const overlay = page.locator('#focus-overlay');
    await expect(overlay).toBeVisible({ timeout: 5000 });
    await expect(overlay).toContainText('Pérdida de Foco Detectada');

    // Click dismiss button to return to the exam
    const dismissBtn = page.locator('#dismiss-focus-btn');
    await expect(dismissBtn).toBeVisible();
    await dismissBtn.click();
    await expect(overlay).not.toBeVisible({ timeout: 3000 });
  });
});
