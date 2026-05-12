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

// Charger .env.test AVANT tout le reste
dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });

async function globalSetup(config: FullConfig) {
  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║       E2E Test Setup Starting          ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');

  // Vérifier que DATABASE_URL pointe vers la base de test
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl.includes('test') && !dbUrl.includes('localhost')) {
    console.error(
      '⚠️  ATTENTION: DATABASE_URL ne semble pas pointer vers une base de test!'
    );
    console.error('   Valeur actuelle:', dbUrl.substring(0, 50) + '...');
    console.error('');
    console.error(
      '   Configurez DATABASE_URL vers votre base de test avant de continuer.'
    );
    console.error(
      '   Exemple: DATABASE_URL=postgresql://localhost:5432/encave_test'
    );
    console.error('');

    // En CI, on peut vouloir continuer quand même
    if (!process.env.CI) {
      throw new Error('DATABASE_URL doit pointer vers une base de test');
    }
  }

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
