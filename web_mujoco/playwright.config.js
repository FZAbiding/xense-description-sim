import { defineConfig } from '@playwright/test';

const baseURL = process.env.FLEXIV_BASE_URL || 'http://127.0.0.1:4175/';
export default defineConfig({
  testDir: './tests',
  timeout: 90000,
  workers: 1,
  use: {
    baseURL,
    headless: true,
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader']
    }
  },
  webServer: process.env.FLEXIV_BASE_URL ? undefined : {
    command: 'npm run dev -- --port 4175 --strictPort',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30000
  }
});
