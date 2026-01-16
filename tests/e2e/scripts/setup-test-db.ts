/**
 * Setup Test Database
 *
 * Ce script prépare la base de données pour les tests E2E :
 * 1. Reset la base (supprime toutes les données)
 * 2. Seed avec des données de test connues
 *
 * Usage:
 *   npx tsx tests/e2e/scripts/setup-test-db.ts
 *
 * Ou via npm script:
 *   npm run test:e2e:setup
 */

import { PrismaClient } from '@prisma/client';
import { TEST_WINERIES, TEST_EXPERIENCES, TEST_VISITORS, TEST_USERS } from '../fixtures/test-data';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Nettoyage de la base de données de test...');

  // Supprimer dans l'ordre inverse des dépendances (foreign keys)
  await prisma.booking.deleteMany();
  await prisma.availabilitySlot.deleteMany();
  await prisma.experience.deleteMany();
  await prisma.winery.deleteMany();
  // Supprimer uniquement les users de test (pas tous les users)
  await prisma.user.deleteMany({
    where: {
      id: {
        in: Object.values(TEST_USERS).map((u) => u.id),
      },
    },
  });

  console.log('✅ Base nettoyée');

  console.log('🌱 Seeding des données de test...');

  // 0. Créer les Users (winemakers)
  for (const [key, user] of Object.entries(TEST_USERS)) {
    await prisma.user.create({
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: 'WINEMAKER',
      },
    });
    console.log(`  ✓ User: ${user.name}`);
  }

  // 1. Créer les Wineries
  for (const [key, winery] of Object.entries(TEST_WINERIES)) {
    await prisma.winery.create({
      data: {
        id: winery.id,
        name: winery.name,
        slug: winery.slug,
        description: winery.description,
        commune: winery.commune,
        address: winery.address,
        phone: winery.phone,
        email: winery.email,
        userId: winery.userId,
        stripeAccountId: winery.stripeConnected ? winery.stripeAccountId : null,
        stripeOnboardingComplete: winery.stripeConnected,
        status: 'VERIFIED',
      },
    });
    console.log(`  ✓ Winery: ${winery.name}`);
  }

  // 2. Créer les Experiences avec leurs disponibilités
  for (const [key, experience] of Object.entries(TEST_EXPERIENCES)) {
    await prisma.experience.create({
      data: {
        id: experience.id,
        slug: experience.slug,
        title: experience.title,
        description: experience.description,
        type: experience.type,
        price: experience.price,
        minCapacity: experience.minCapacity,
        maxCapacity: experience.maxCapacity,
        duration: experience.duration,
        coverPhoto: experience.coverPhoto,
        wineryId: experience.wineryId,
        status: 'PUBLISHED',
        availabilitySlots: {
          create: experience.availabilitySlots.map((slot) => ({
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
          })),
        },
      },
    });
    console.log(`  ✓ Experience: ${experience.title}`);
  }

  console.log('');
  console.log('🎉 Base de données de test prête !');
  console.log('');
  console.log('Données créées:');
  console.log(`  - ${Object.keys(TEST_USERS).length} users`);
  console.log(`  - ${Object.keys(TEST_WINERIES).length} wineries`);
  console.log(`  - ${Object.keys(TEST_EXPERIENCES).length} experiences`);
}

main()
  .catch((e) => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
