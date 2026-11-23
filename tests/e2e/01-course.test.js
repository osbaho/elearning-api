import { test, expect } from '@playwright/test';
import { performLogin } from '../helpers/loginHelper.js';

test('Course loads correctly after login', async ({ page }) => {
  await performLogin(page);
  
  // Verify we are on the course page
  await expect(page).toHaveURL(/.*course/);
  await expect(page).toHaveTitle(/C-Arm Master/);

  // Check navbar points display
  const pointsLocator = page.locator('#nav-points-display');
  await expect(pointsLocator).toBeVisible();
  await expect(pointsLocator).toContainText(/pts/i);
});

test('Landing page is public', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/C-Arm Master/);
  const heroBadge = page.locator('.hero-badge');
  await expect(heroBadge).toBeVisible();
  await expect(heroBadge).toContainText(/Capacitación Técnica/i);
});
