import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Charger .env.test pour les tests E2E
dotenv.config({ path: path.resolve(__dirname, '.env.test') });

/**
 * Playwright E2E Test Configuration
 *
 * Pour exécuter les tests:
 *   npm run test:e2e           - Tous les tests
 *   npm run test:e2e:ui        - Avec interface visuelle
 *   npx playwright test --headed  - Voir le navigateur
 *
 * Variables d'environnement:
 *   DATABASE_URL    - Base de données de TEST (pas prod!)
 *   STRIPE_SECRET_KEY - Clé Stripe de TEST
 */
export default defineConfig({
  testDir: './tests/e2e',

  // Setup/Teardown globaux
  globalSetup: './tests/e2e/scripts/global-setup.ts',
  globalTeardown: './tests/e2e/scripts/global-teardown.ts',

  // Parallélisation
  fullyParallel: true,
  workers: process.env.CI ? 1 : undefined,

  // Retries pour flakiness
  retries: process.env.CI ? 2 : 0,

  // Empêcher .only en CI
  forbidOnly: !!process.env.CI,

  // Timeout
  timeout: 30000,
  expect: { timeout: 5000 },

  // Reporter
  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: 'http://localhost:3000',

    // Traces et screenshots pour debug
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Timeouts
    actionTimeout: 10000,
    navigationTimeout: 15000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Décommenter pour tester sur d'autres navigateurs
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'mobile',
    //   use: { ...devices['iPhone 13'] },
    // },
  ],

  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      // Passer explicitement les variables d'environnement de test
      NODE_ENV: 'production',
      ...(process.env.DATABASE_URL && { DATABASE_URL: process.env.DATABASE_URL }),
      ...(process.env.BETTER_AUTH_SECRET && { BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET }),
      ...(process.env.BETTER_AUTH_URL && { BETTER_AUTH_URL: process.env.BETTER_AUTH_URL }),
      ...(process.env.STRIPE_SECRET_KEY && { STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY }),
      ...(process.env.STRIPE_PUBLISHABLE_KEY && { STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY }),
      ...(process.env.STRIPE_WEBHOOK_SECRET && { STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET }),
    },
  },
});
