import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT) || 3000

export default defineConfig({
  testDir: './test/e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    locale: 'zh-CN'
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        /**
         * 默认直接用本机已安装的 Chrome，免去 `npx playwright install` 下载内核
         * （内网/代理不通时那一步会卡死）。想用自带内核就设
         * E2E_CHANNEL=chromium，此时需要先执行过 playwright install。
         */
        channel: (process.env.E2E_CHANNEL || 'chrome') as 'chrome' | 'chromium'
      }
    }
  ],
  webServer: {
    command: 'node ./node_modules/vite/bin/vite.js --port 3000 --strictPort',
    url: `http://127.0.0.1:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
})
