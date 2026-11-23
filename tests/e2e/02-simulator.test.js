import { test, expect } from '@playwright/test';
import { performLogin } from '../helpers/loginHelper.js';

test('Simulator points update correctly', async ({ page }) => {
  await performLogin(page);
  await page.goto('/course/practice/m1_s1');
  
  // Check points initialization
  const sessionPointsLocator = page.locator('#session-points');
  await expect(sessionPointsLocator).toBeVisible({ timeout: 5000 });
  await expect(sessionPointsLocator).toHaveText('+0');

  // Trigger game score simulation and wait for response
  const [response] = await Promise.all([
    page.waitForResponse(res => res.url().includes('/add-points') && res.status() === 200, { timeout: 5000 }),
    page.evaluate(() => window.simulateGameScore(25))
  ]);
  
  // Check updated points
  await expect(sessionPointsLocator).toHaveText('+25');
});
