import { test, expect } from '@playwright/test';
import { performLogin } from '../helpers/loginHelper.js';

test.describe('Exam flow', () => {
  test.use({ permissions: ['camera'] });

  test('Completes the exam flow successfully', async ({ page }) => {
    // Auto-accept any dialogs
    page.on('dialog', dialog => dialog.accept());

    await performLogin(page);
    await page.goto('/course/exam?skipCamera=true');
    
    // Wait for start button to become enabled and click
    const startBtn = page.locator('#start-exam-btn');
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await expect(startBtn).toBeEnabled({ timeout: 10000 });
    await startBtn.click();
    
    // Wait for exam active content to appear
    await expect(page.locator('#exam-main-screen')).toBeVisible({ timeout: 5000 });
    
    // Wait for questions to load
    await page.waitForSelector('.question-card', { state: 'visible' });
    const questionCards = await page.locator('.question-card').all();
    expect(questionCards.length).toBeGreaterThan(0);
    
    // Answer every question by clicking its first option
    for (const card of questionCards) {
      const firstOption = card.locator('.option-btn').first();
      await expect(firstOption).toBeVisible();
      await firstOption.click();
    }
    
    // Submit answers
    const submitBtn = page.locator('#btn-submit');
    await expect(submitBtn).toBeEnabled({ timeout: 5000 });
    await submitBtn.click();
    
    // Verify result screen and percentage display
    const resultScreen = page.locator('#result-screen');
    await expect(resultScreen).toBeVisible({ timeout: 5000 });
    
    const scoreText = await page.locator('#result-score-display').textContent();
    expect(scoreText).toContain('%');
  });
});
