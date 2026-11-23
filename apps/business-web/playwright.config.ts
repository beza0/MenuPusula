import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Yerel Supabase yığınının anahtarlarını okur (infra/local-supabase/scripts/up.sh üretir).
config({
  path: process.env.SUPABASE_ENV_FILE ?? fileURLToPath(new URL('../../infra/local-supabase/.env', import.meta.url)),
  quiet: true,
});

// Ortamda önceden kurulu Chromium varsa onu kullan (CI'da `npx playwright install` yeterli).
const preinstalled = '/opt/pw-browsers/chromium';
const launchOptions = existsSync(preinstalled) && !process.env.PW_USE_BUNDLED ? { executablePath: preinstalled } : {};

const PORT = 5174;

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
    trace: 'off',
    launchOptions,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /public-menu-mobile/ },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: `http://localhost:${process.env.API_PORT ?? 54321}`,
      VITE_SUPABASE_ANON_KEY: process.env.ANON_KEY ?? '',
      VITE_PUBLIC_MENU_BASE_URL: `http://localhost:${PORT}`,
    },
  },
});
