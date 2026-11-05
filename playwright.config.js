const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests', testMatch: '*.spec.js', timeout: 60000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:4173', headless: true,
    launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
    screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'npm run build && node scripts/serve-build.cjs', url: 'http://127.0.0.1:4173', reuseExistingServer: false, timeout: 120000 }
});
