/**
 * Playwright Global Teardown
 *
 * Ce fichier s'exécute UNE FOIS après tous les tests E2E.
 * Il nettoie l'environnement de test.
 *
 * Configuration dans playwright.config.ts:
 *   globalTeardown: './tests/e2e/scripts/global-teardown.ts'
 */

import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║       E2E Test Teardown                ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');

  // Optionnel: Nettoyer la base de données après les tests
  // Par défaut, on garde les données pour pouvoir debugger

  if (process.env.CLEANUP_TEST_DB === 'true') {
    console.log('🧹 Nettoyage de la base de données de test...');
    // Ajouter la logique de nettoyage si nécessaire
  } else {
    console.log('ℹ️  Base de données conservée pour debug');
    console.log('   Pour nettoyer: CLEANUP_TEST_DB=true npm run test:e2e');
  }

  console.log('');
  console.log('✅ Teardown terminé');
  console.log('');
}

export default globalTeardown;
