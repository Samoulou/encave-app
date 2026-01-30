import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SALT_ROUNDS = 10;

async function main() {
  console.log('🌱 Starting database seed...');

  // Create admin user
  const adminEmail = 'admin@encave.ch';
  const adminPassword = 'admin123!'; // Development only!

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    console.log('✅ Admin user already exists');
  } else {
    const hashedPassword = await bcrypt.hash(adminPassword, SALT_ROUNDS);

    await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Admin User',
        role: 'ADMIN',
        emailVerified: true,
        // Better Auth stores password in the account table, not user table
        accounts: {
          create: {
            providerId: 'credential',
            accountId: adminEmail,
            password: hashedPassword,
          },
        },
      },
    });

    console.log('✅ Admin user created');
    console.log('   Email:', adminEmail);
    console.log('   Password:', adminPassword);
  }

  // Check if wineries already exist
  const existingWineries = await prisma.winery.count();
  if (existingWineries > 0) {
    console.log('✅ Wineries already exist, skipping...');
    console.log('🌱 Seed completed!');
    return;
  }

  // Create winemaker users
  const winemakers = [
    {
      email: 'pierre@domaine-lavaux.ch',
      name: 'Pierre Dubois',
      wineryName: 'Domaine de Lavaux',
      winerySlug: 'domaine-de-lavaux',
      description: 'Niché au cœur des terrasses de Lavaux, classées au patrimoine mondial de l\'UNESCO, notre domaine familial produit des vins d\'exception depuis 1892. Nos Chasselas et Pinot Noir reflètent la richesse de ce terroir unique.',
      address: 'Route de la Corniche 12',
      commune: 'Epesses',
      phone: '+41 21 799 12 34',
      wineryEmail: 'info@domaine-lavaux.ch',
      latitude: 46.4892,
      longitude: 6.7456,
    },
    {
      email: 'marie@cave-valais.ch',
      name: 'Marie Favre',
      wineryName: 'Cave du Valais',
      winerySlug: 'cave-du-valais',
      description: 'Au pied des Alpes valaisannes, notre cave perpétue la tradition viticole depuis quatre générations. Spécialistes du Fendant et de la Petite Arvine, nous vous accueillons pour des dégustations authentiques.',
      address: 'Rue des Vignerons 45',
      commune: 'Sion',
      phone: '+41 27 322 45 67',
      wineryEmail: 'contact@cave-valais.ch',
      latitude: 46.2333,
      longitude: 7.3667,
    },
    {
      email: 'jean@vignoble-geneve.ch',
      name: 'Jean-Marc Rochat',
      wineryName: 'Vignoble de Genève',
      winerySlug: 'vignoble-de-geneve',
      description: 'Situé sur les coteaux dominant le lac Léman, notre vignoble combine tradition et innovation. Découvrez nos crus genevois primés lors de visites guidées au cœur de nos vignes centenaires.',
      address: 'Chemin des Vignes 8',
      commune: 'Satigny',
      phone: '+41 22 753 89 01',
      wineryEmail: 'visite@vignoble-geneve.ch',
      latitude: 46.2167,
      longitude: 6.0333,
    },
  ];

  const password = await bcrypt.hash('winemaker123!', SALT_ROUNDS);

  for (const winemaker of winemakers) {
    console.log(`\n🍷 Creating winery: ${winemaker.wineryName}`);

    // Create winemaker user with Better Auth account (password in account table)
    const user = await prisma.user.create({
      data: {
        email: winemaker.email,
        name: winemaker.name,
        role: 'WINEMAKER',
        emailVerified: true,
        accounts: {
          create: {
            providerId: 'credential',
            accountId: winemaker.email,
            password,
          },
        },
      },
    });

    // Create winery
    const winery = await prisma.winery.create({
      data: {
        name: winemaker.wineryName,
        slug: winemaker.winerySlug,
        description: winemaker.description,
        address: winemaker.address,
        commune: winemaker.commune,
        phone: winemaker.phone,
        email: winemaker.wineryEmail,
        latitude: winemaker.latitude,
        longitude: winemaker.longitude,
        userId: user.id,
        status: 'VERIFIED',
        verifiedAt: new Date(),
        coverPhoto: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=1200',
      },
    });

    console.log(`   ✅ Winery created: ${winery.name}`);

    // Create experiences for each winery
    const experiences = getExperiencesForWinery(winemaker.winerySlug);

    for (const exp of experiences) {
      const experience = await prisma.experience.create({
        data: {
          wineryId: winery.id,
          title: exp.title,
          slug: exp.slug,
          description: exp.description,
          type: exp.type,
          duration: exp.duration,
          price: exp.price,
          minCapacity: exp.minCapacity,
          maxCapacity: exp.maxCapacity,
          coverPhoto: exp.coverPhoto,
          status: 'PUBLISHED',
        },
      });

      // Create availability slots (Tuesday to Sunday, 10:00-18:00)
      const slots = [
        { dayOfWeek: 2, startTime: '10:00', endTime: '12:00' },
        { dayOfWeek: 2, startTime: '14:00', endTime: '16:00' },
        { dayOfWeek: 3, startTime: '10:00', endTime: '12:00' },
        { dayOfWeek: 3, startTime: '14:00', endTime: '16:00' },
        { dayOfWeek: 4, startTime: '10:00', endTime: '12:00' },
        { dayOfWeek: 4, startTime: '14:00', endTime: '16:00' },
        { dayOfWeek: 5, startTime: '10:00', endTime: '12:00' },
        { dayOfWeek: 5, startTime: '14:00', endTime: '16:00' },
        { dayOfWeek: 6, startTime: '10:00', endTime: '12:00' },
        { dayOfWeek: 6, startTime: '14:00', endTime: '16:00' },
        { dayOfWeek: 6, startTime: '16:00', endTime: '18:00' },
        { dayOfWeek: 0, startTime: '10:00', endTime: '12:00' },
        { dayOfWeek: 0, startTime: '14:00', endTime: '16:00' },
      ];

      await prisma.availabilitySlot.createMany({
        data: slots.map((slot) => ({
          experienceId: experience.id,
          ...slot,
        })),
      });

      console.log(`   ✅ Experience created: ${experience.title}`);
    }
  }

  console.log('\n🌱 Seed completed!');
  console.log('\n📝 Test accounts:');
  console.log('   Admin: admin@encave.ch / admin123!');
  console.log('   Winemaker: pierre@domaine-lavaux.ch / winemaker123!');
}

function getExperiencesForWinery(winerySlug: string) {
  const experiencesByWinery: Record<string, Array<{
    title: string;
    slug: string;
    description: string;
    type: 'TASTING' | 'CELLAR_VISIT' | 'WORKSHOP' | 'VINEYARD_TOUR' | 'FOOD_PAIRING';
    duration: number;
    price: number;
    minCapacity: number;
    maxCapacity: number;
    coverPhoto: string;
  }>> = {
    'domaine-de-lavaux': [
      {
        title: 'Dégustation Prestige Lavaux',
        slug: 'degustation-prestige-lavaux',
        description: 'Découvrez notre sélection de 6 vins d\'exception accompagnés de fromages locaux. Notre sommelier vous guidera à travers les terroirs uniques de Lavaux, des Chasselas minéraux aux Pinot Noir veloutés.',
        type: 'TASTING',
        duration: 90,
        price: 4500, // 45 CHF in cents
        minCapacity: 2,
        maxCapacity: 12,
        coverPhoto: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800',
      },
      {
        title: 'Balade dans les Vignes UNESCO',
        slug: 'balade-vignes-unesco',
        description: 'Promenade guidée à travers nos parcelles classées au patrimoine mondial. Apprenez l\'histoire millénaire de ces terrasses et terminez par une dégustation panoramique face au lac.',
        type: 'VINEYARD_TOUR',
        duration: 120,
        price: 6500,
        minCapacity: 4,
        maxCapacity: 15,
        coverPhoto: 'https://images.unsplash.com/photo-1560493676-04071c5f467b?w=800',
      },
      {
        title: 'Visite de Cave Historique',
        slug: 'visite-cave-historique',
        description: 'Explorez nos caves voûtées du XIXe siècle et découvrez les secrets de la vinification traditionnelle. Dégustation de 4 vins incluse.',
        type: 'CELLAR_VISIT',
        duration: 75,
        price: 3500,
        minCapacity: 2,
        maxCapacity: 20,
        coverPhoto: 'https://images.unsplash.com/photo-1528823872057-9c018a7a7553?w=800',
      },
    ],
    'cave-du-valais': [
      {
        title: 'Initiation aux Cépages Valaisans',
        slug: 'initiation-cepages-valaisans',
        description: 'Partez à la découverte des cépages autochtones du Valais : Petite Arvine, Amigne, Cornalin et Humagne. Une immersion unique dans la diversité viticole alpine.',
        type: 'TASTING',
        duration: 75,
        price: 3800,
        minCapacity: 2,
        maxCapacity: 10,
        coverPhoto: 'https://images.unsplash.com/photo-1474722883778-792e7990302f?w=800',
      },
      {
        title: 'Accord Mets & Vins Raclette',
        slug: 'accord-mets-vins-raclette',
        description: 'Expérience gastronomique authentique : raclette valaisanne traditionnelle accompagnée de nos meilleurs crus. Un voyage gustatif au cœur des Alpes.',
        type: 'FOOD_PAIRING',
        duration: 150,
        price: 8500,
        minCapacity: 4,
        maxCapacity: 12,
        coverPhoto: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800',
      },
      {
        title: 'Atelier Assemblage',
        slug: 'atelier-assemblage',
        description: 'Devenez vigneron le temps d\'un atelier ! Créez votre propre assemblage sous la guidance de notre œnologue et repartez avec votre bouteille personnalisée.',
        type: 'WORKSHOP',
        duration: 180,
        price: 12000,
        minCapacity: 2,
        maxCapacity: 8,
        coverPhoto: 'https://images.unsplash.com/photo-1567696911980-2eed69a46042?w=800',
      },
    ],
    'vignoble-de-geneve': [
      {
        title: 'Découverte des Vins Genevois',
        slug: 'decouverte-vins-genevois',
        description: 'Initiez-vous aux vins AOC Genève à travers une dégustation commentée de 5 crus. Du Gamay fruité au Gamaret structuré, explorez la richesse du terroir genevois.',
        type: 'TASTING',
        duration: 60,
        price: 2800,
        minCapacity: 2,
        maxCapacity: 15,
        coverPhoto: 'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=800',
      },
      {
        title: 'Sunset & Wine',
        slug: 'sunset-wine',
        description: 'Dégustation exclusive au coucher du soleil sur notre terrasse panoramique. Vue imprenable sur le Mont-Blanc, champagne et amuse-bouches inclus.',
        type: 'TASTING',
        duration: 120,
        price: 7500,
        minCapacity: 2,
        maxCapacity: 20,
        coverPhoto: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=800',
      },
      {
        title: 'Journée Vendanges',
        slug: 'journee-vendanges',
        description: 'Vivez l\'effervescence des vendanges ! Participez à la récolte, découvrez le pressoir et dégustez le moût frais. Repas vigneron inclus. (Septembre uniquement)',
        type: 'WORKSHOP',
        duration: 360,
        price: 15000,
        minCapacity: 6,
        maxCapacity: 20,
        coverPhoto: 'https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=800',
      },
    ],
  };

  return experiencesByWinery[winerySlug] || [];
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
