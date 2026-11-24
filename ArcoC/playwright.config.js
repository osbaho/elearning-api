import { defineConfig, devices } from '@playwright/test';

// Reutilizar los servidores que ya estén corriendo agiliza el desarrollo, pero esos servidores
// usan la base de desarrollo (SQLite). En CI y al probar contra PostgreSQL (DATABASE_URL,
// npm run test:pg) siempre se levantan servidores nuevos con el entorno de la prueba.
const reuseExistingServer = !process.env.CI && !process.env.DATABASE_URL;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream'
      ]
    }
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'node server.js',
      url: 'http://localhost:5000/api/health',
      reuseExistingServer,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 30000,
    },
    {
      command: 'npm --workspace=client run dev',
      url: 'http://localhost:3000',
      reuseExistingServer,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 45000,
    },
  ],
});
