/**
 * Playwright Global Setup
 *
 * Ce fichier s'exécute UNE FOIS avant tous les tests E2E.
 * Il prépare l'environnement de test.
 *
 * Configuration dans playwright.config.ts:
 *   globalSetup: './tests/e2e/scripts/global-setup.ts'
 */

import { execSync } from 'child_process';
import { FullConfig } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

import { assertLocalDbUrl } from '../../helpers/assert-local-db';

// Charger .env.test AVANT tout le reste
dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });

async function globalSetup(config: FullConfig) {
  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║       E2E Test Setup Starting          ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');

  // Le setup fait `db push` + wipe/reseed : allowlist stricte d'hôtes
  // locaux, y compris en CI (les services CI sont toujours sur localhost).
  // Remplace l'ancienne blocklist `includes('test')` qui laissait passer
  // une URL cloud dont le nom de base contenait « test ».
  assertLocalDbUrl(process.env.DATABASE_URL || '', 'DATABASE_URL');

  try {
    // 1. Appliquer les migrations Prisma (créer le schéma)
    console.log('📦 Application des migrations Prisma...');
    execSync('npx prisma db push --skip-generate', {
      stdio: 'inherit',
      env: process.env,
    });

    // 2. Seeder la base de données
    console.log('');
    console.log('🌱 Seeding de la base de données...');
    execSync('npx tsx tests/e2e/scripts/setup-test-db.ts', {
      stdio: 'inherit',
      env: process.env,
    });

    console.log('');
    console.log('✅ Setup terminé avec succès');
    console.log('');
  } catch (error) {
    console.error('❌ Erreur pendant le setup:', error);
    throw error;
  }
}

export default globalSetup;
