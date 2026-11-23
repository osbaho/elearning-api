import { test, expect } from '@playwright/test';
import { performLogin } from '../helpers/loginHelper.js';

test.describe('Proctoring blockage', () => {
  test.use({ permissions: ['camera'] });

  test('Exam suspended when proctoring violation occurs', async ({ page }) => {
    await performLogin(page);

    await page.goto('/course/exam?skipCamera=true');
    
    // Start exam
    const startBtn = page.locator('#start-exam-btn');
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await expect(startBtn).toBeEnabled({ timeout: 10000 });
    await startBtn.click();
    
    // Check that active exam screen is visible
    await expect(page.locator('#exam-main-screen')).toBeVisible({ timeout: 5000 });
    
    // Simulate proctoring violation / suspension event
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('__test_suspend_exam')));
    
    // Check that camera error panel shows up with suspension notice
    const cameraErrorPanel = page.locator('#camera-error-panel');
    await expect(cameraErrorPanel).toBeVisible({ timeout: 5000 });
    
    const panelText = await cameraErrorPanel.textContent();
    expect(panelText).toContain('EXAMEN SUSPENDIDO');
    
    // Check that the active exam screen is now blocked/hidden
    const isMainScreenVisible = await page.locator('#exam-main-screen').isVisible();
    expect(isMainScreenVisible).toBe(false);
  });
});
