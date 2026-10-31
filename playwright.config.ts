import { config } from 'dotenv';
import { defineConfig, devices } from '@playwright/test';

const env = config({ path: '.env.test', quiet: true }).parsed ?? {};
const PORT = 3100;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices['Pixel 7'],
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
    geolocation: { latitude: 13.7465, longitude: 100.4825 },
    permissions: ['geolocation'],
  },
  webServer: {
    command: `pnpm exec next start -p ${PORT}`,
    url: `http://localhost:${PORT}/demo`,
    reuseExistingServer: false,
    env: { ...env, NODE_ENV: 'production' },
    timeout: 60_000,
  },
});
