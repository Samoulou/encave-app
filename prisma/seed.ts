import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SALT_ROUNDS = 10;

// ============================================================================
// TEST ACCOUNTS (SEC-005 compliant passwords)
// ============================================================================
const ACCOUNTS = {
  admin: { email: 'admin@encave.ch', password: 'Admin1234!', name: 'Samuel Admin' },
  client1: { email: 'laura.meier@example.com', password: 'Client1234!', name: 'Laura Meier' },
  client2: { email: 'thomas.brunner@example.com', password: 'Client1234!', name: 'Thomas Brunner' },
  winemakers: [
    {
      email: 'jean-rene@example.com',
      password: 'Vigneron1!',
      name: 'Jean-René Germanier',
      winery: {
        name: 'Domaine Germanier',
        slug: 'domaine-germanier',
        description:
          "Fondé en 1896 à Vétroz, le Domaine Germanier est une référence incontournable du vignoble valaisan. Spécialiste de l'Amigne Grand Cru et de la Petite Arvine, notre famille cultive avec passion 22 hectares de vignes sur les coteaux ensoleillés du Valais central. Notre cave allie tradition séculaire et techniques modernes pour produire des vins d'une finesse remarquable.",
        address: 'Route du Village 50',
        commune: 'Vétroz',
        phone: '+41 27 346 12 16',
        wineryEmail: 'info@germanier.example.com',
        latitude: 46.2215,
        longitude: 7.2752,
        coverPhoto: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=1200',
      },
    },
    {
      email: 'nicolas@example.com',
      password: 'Vigneron1!',
      name: 'Nicolas Zufferey',
      winery: {
        name: 'Cave du Rhodan',
        slug: 'cave-du-rhodan',
        description:
          "Au cœur de Salgesch, village viticole par excellence du Haut-Valais, la Cave du Rhodan élabore des Pinot Noir de renommée internationale. Nos vignes bénéficient d'un microclimat exceptionnel et d'un terroir calcaire unique. Depuis trois générations, nous vinifions avec le respect du fruit et la patience que seul le temps peut offrir.",
        address: 'Dorfstrasse 40',
        commune: 'Salgesch',
        phone: '+41 27 455 68 28',
        wineryEmail: 'info@rhodan.example.com',
        latitude: 46.3166,
        longitude: 7.5716,
        coverPhoto: 'https://images.unsplash.com/photo-1560493676-04071c5f467b?w=1200',
      },
    },
    {
      email: 'isabelle@example.com',
      password: 'Vigneron1!',
      name: 'Isabelle Kellenberger',
      winery: {
        name: 'Cave Fin Bec',
        slug: 'cave-fin-bec',
        description:
          "Nichée entre les thermes de Saillon et les vignobles en terrasses, la Cave Fin Bec marie plaisir du palais et art de vivre valaisan. Notre philosophie : des vins gourmands, expressifs et accessibles, élaborés à partir de cépages traditionnels et de variétés oubliées que nous avons replantées avec amour.",
        address: 'Route de Fully 18',
        commune: 'Saillon',
        phone: '+41 27 744 30 44',
        wineryEmail: 'cave@finbec.example.com',
        latitude: 46.1726,
        longitude: 7.1907,
        coverPhoto: 'https://images.unsplash.com/photo-1528823872057-9c018a7a7553?w=1200',
      },
    },
    {
      email: 'robert@example.com',
      password: 'Vigneron1!',
      name: 'Robert Taramarcaz',
      winery: {
        name: 'Domaine des Muses',
        slug: 'domaine-des-muses',
        description:
          "Le Domaine des Muses est un bijou viticole de Sierre, la cité du soleil. Sur 5 hectares de vignes cultivées en biodynamie, nous créons des vins poétiques qui racontent l'histoire de notre terroir. Chaque cuvée porte le nom d'une muse, inspirant la créativité et l'émotion à chaque gorgée.",
        address: 'Chemin des Muses 4',
        commune: 'Sierre',
        phone: '+41 27 456 33 20',
        wineryEmail: 'accueil@muses.example.com',
        latitude: 46.292,
        longitude: 7.5348,
        coverPhoto: 'https://images.unsplash.com/photo-1474722883778-792e7990302f?w=1200',
      },
    },
    {
      email: 'marie-therese@example.com',
      password: 'Vigneron1!',
      name: 'Marie-Thérèse Chappaz',
      winery: {
        name: 'Domaine Chappaz',
        slug: 'domaine-chappaz',
        description:
          "Figure emblématique du vignoble valaisan, Marie-Thérèse Chappaz cultive ses vignes à Fully en biodynamie depuis plus de 30 ans. Ses Petites Arvines, Ermitages et Grains Nobles sont considérés parmi les plus grands vins suisses. Le domaine offre une expérience rare et authentique au cœur du plus grand vignoble de montagne d'Europe.",
        address: 'Chemin de la Liaudise 14',
        commune: 'Fully',
        phone: '+41 27 746 25 52',
        wineryEmail: 'visite@chappaz.example.com',
        latitude: 46.1526,
        longitude: 7.1116,
        coverPhoto: 'https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=1200',
      },
    },
  ],
} as const;

// ============================================================================
// EXPERIENCES DATA (10 total, 2 per winery, all 5 types covered)
// ============================================================================
type ExperienceData = {
  title: string;
  slug: string;
  description: string;
  type: 'TASTING' | 'CELLAR_VISIT' | 'WORKSHOP' | 'VINEYARD_TOUR' | 'FOOD_PAIRING';
  duration: number;
  price: number;
  minCapacity: number;
  maxCapacity: number;
  coverPhoto: string;
};

const EXPERIENCES: Record<string, ExperienceData[]> = {
  'domaine-germanier': [
    {
      title: "Dégustation Grands Crus de Vétroz",
      slug: 'degustation-grands-crus-vetroz',
      description:
        "Plongez dans l'univers des Grands Crus de Vétroz lors d'une dégustation commentée de 7 vins d'exception. De l'Amigne flétrie aux Pinot Noir élevés en barrique, Jean-René Germanier partage les secrets de quatre générations de savoir-faire. Accompagnement de fromages d'alpage et viande séchée du Valais.",
      type: 'TASTING',
      duration: 90,
      price: 5500,
      minCapacity: 2,
      maxCapacity: 12,
      coverPhoto: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800',
    },
    {
      title: 'Visite du Chai et de la Vinothèque',
      slug: 'visite-chai-vinotheque',
      description:
        "Découvrez notre chai moderne où tradition et technologie se rencontrent. Parcourez nos rangées de barriques en chêne et visitez notre vinothèque historique abritant des millésimes remontant à 1950. La visite se termine par une dégustation de 4 vins dont un millésime surprise de notre collection privée.",
      type: 'CELLAR_VISIT',
      duration: 75,
      price: 3500,
      minCapacity: 2,
      maxCapacity: 20,
      coverPhoto: 'https://images.unsplash.com/photo-1528823872057-9c018a7a7553?w=800',
    },
  ],
  'cave-du-rhodan': [
    {
      title: 'Balade Vigneronne dans les Coteaux de Salgesch',
      slug: 'balade-vigneronne-salgesch',
      description:
        "Randonnée guidée à travers les vignobles de Salgesch, au cœur du sentier viticole reliant Salgesch à Sierre. Apprenez à reconnaître les cépages, comprenez l'influence du terroir calcaire sur nos Pinot Noir et admirez les paysages alpins spectaculaires. Pique-nique vigneron avec dégustation en plein air inclus.",
      type: 'VINEYARD_TOUR',
      duration: 150,
      price: 7500,
      minCapacity: 4,
      maxCapacity: 15,
      coverPhoto: 'https://images.unsplash.com/photo-1560493676-04071c5f467b?w=800',
    },
    {
      title: 'Atelier Assemblage Pinot Noir',
      slug: 'atelier-assemblage-pinot-noir',
      description:
        "Devenez maître-assembleur le temps d'un après-midi ! Sous la guidance de notre œnologue, goûtez les vins de différentes parcelles et créez votre propre cuvée de Pinot Noir. Apprenez les techniques d'assemblage professionnel et repartez avec votre bouteille personnalisée étiquetée à votre nom.",
      type: 'WORKSHOP',
      duration: 180,
      price: 12000,
      minCapacity: 2,
      maxCapacity: 8,
      coverPhoto: 'https://images.unsplash.com/photo-1567696911980-2eed69a46042?w=800',
    },
  ],
  'cave-fin-bec': [
    {
      title: 'Dégustation Terroir & Cépages Oubliés',
      slug: 'degustation-terroir-cepages-oublies',
      description:
        "Une dégustation unique de 8 vins mettant à l'honneur les cépages rares et autochtones du Valais : Rèze, Himbertscha, Lafnetscha, Gwäss et Eyholzer. Isabelle vous raconte l'histoire de ces variétés ancestrales sauvées de l'oubli et leur renaissance sur notre domaine.",
      type: 'TASTING',
      duration: 90,
      price: 4800,
      minCapacity: 2,
      maxCapacity: 10,
      coverPhoto: 'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=800',
    },
    {
      title: 'Accord Mets & Vins : Raclette au Feu de Bois',
      slug: 'accord-raclette-feu-de-bois',
      description:
        "Vivez l'expérience ultime valaisanne : raclette au feu de bois avec fromage d'alpage de Bagnes, accompagnée de 5 vins soigneusement sélectionnés pour sublimer chaque bouchée. Viande séchée, cornichons maison et pain de seigle complètent ce festin authentique dans notre caveau voûté.",
      type: 'FOOD_PAIRING',
      duration: 150,
      price: 9500,
      minCapacity: 4,
      maxCapacity: 14,
      coverPhoto: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800',
    },
  ],
  'domaine-des-muses': [
    {
      title: 'Initiation aux Cépages Valaisans en Biodynamie',
      slug: 'initiation-cepages-biodynamie',
      description:
        "Découvrez la biodynamie appliquée au vignoble valaisan. Après une promenade dans nos parcelles certifiées Demeter, dégustez 6 vins biologiques issus de Cornalin, Humagne Rouge, Petite Arvine et Marsanne. Robert partage sa vision d'une viticulture en harmonie avec la nature.",
      type: 'TASTING',
      duration: 90,
      price: 5000,
      minCapacity: 2,
      maxCapacity: 10,
      coverPhoto: 'https://images.unsplash.com/photo-1474722883778-792e7990302f?w=800',
    },
    {
      title: 'Visite des Caves Historiques de Sierre',
      slug: 'visite-caves-historiques-sierre',
      description:
        "Plongez dans l'histoire viticole de Sierre, la cité du soleil, en visitant nos caves centenaires. Découvrez nos méthodes de vinification naturelle, nos amphores en terre cuite et nos fûts de chêne valaisan. La visite se conclut par une dégustation de 5 cuvées portant chacune le nom d'une muse grecque.",
      type: 'CELLAR_VISIT',
      duration: 75,
      price: 3800,
      minCapacity: 2,
      maxCapacity: 15,
      coverPhoto: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=800',
    },
  ],
  'domaine-chappaz': [
    {
      title: 'Randonnée dans les Vignes de Fully',
      slug: 'randonnee-vignes-fully',
      description:
        "Parcourez les vignobles escarpés de Fully, le plus grand vignoble de montagne d'Europe, avec Marie-Thérèse Chappaz elle-même. Entre coteaux vertigineux et murs en pierres sèches, découvrez la viticulture héroïque du Valais. Dégustation de 5 vins au sommet avec vue panoramique sur les Alpes.",
      type: 'VINEYARD_TOUR',
      duration: 180,
      price: 8500,
      minCapacity: 4,
      maxCapacity: 10,
      coverPhoto: 'https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=800',
    },
    {
      title: "Atelier Vendanges d'Exception",
      slug: 'atelier-vendanges-exception',
      description:
        "Participez aux vendanges sur les parcelles les plus prestigieuses du domaine. Récoltez à la main les grappes de Petite Arvine et d'Ermitage surmûris destinés aux vins liquoreux Grains Nobles. Repas vigneron, pressurage et dégustation de millésimes rares inclus. (Octobre uniquement)",
      type: 'WORKSHOP',
      duration: 360,
      price: 18000,
      minCapacity: 4,
      maxCapacity: 12,
      coverPhoto: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=800',
    },
  ],
};

// ============================================================================
// AVAILABILITY SLOTS (Tue-Sun, varied per winery for realism)
// ============================================================================
function getAvailabilitySlots() {
  return [
    // Tuesday
    { dayOfWeek: 2, startTime: '10:00', endTime: '12:00' },
    { dayOfWeek: 2, startTime: '14:00', endTime: '16:00' },
    // Wednesday
    { dayOfWeek: 3, startTime: '10:00', endTime: '12:00' },
    { dayOfWeek: 3, startTime: '14:00', endTime: '16:00' },
    // Thursday
    { dayOfWeek: 4, startTime: '10:00', endTime: '12:00' },
    { dayOfWeek: 4, startTime: '14:00', endTime: '16:00' },
    // Friday
    { dayOfWeek: 5, startTime: '10:00', endTime: '12:00' },
    { dayOfWeek: 5, startTime: '14:00', endTime: '16:00' },
    { dayOfWeek: 5, startTime: '16:00', endTime: '18:00' },
    // Saturday
    { dayOfWeek: 6, startTime: '10:00', endTime: '12:00' },
    { dayOfWeek: 6, startTime: '14:00', endTime: '16:00' },
    { dayOfWeek: 6, startTime: '16:00', endTime: '18:00' },
    // Sunday
    { dayOfWeek: 0, startTime: '10:00', endTime: '12:00' },
    { dayOfWeek: 0, startTime: '14:00', endTime: '16:00' },
  ];
}

// ============================================================================
// HELPER: generate booking reference
// ============================================================================
function generateReference(index: number): string {
  return `ENC-${String(100000 + index).slice(-6)}`;
}

// ============================================================================
// HELPER: relative dates from now
// ============================================================================
function daysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(0, 0, 0, 0);
  return date;
}

// ============================================================================
// MAIN SEED
// ============================================================================
async function main() {
  console.log('🌱 Starting database seed...\n');

  // -------------------------------------------------------------------
  // 1. ADMIN USER
  // -------------------------------------------------------------------
  console.log('👤 Creating admin user...');
  const adminHash = await bcrypt.hash(ACCOUNTS.admin.password, SALT_ROUNDS);
  const admin = await prisma.user.create({
    data: {
      email: ACCOUNTS.admin.email,
      name: ACCOUNTS.admin.name,
      role: 'ADMIN',
      emailVerified: true,
      accounts: {
        create: {
          providerId: 'credential',
          accountId: ACCOUNTS.admin.email,
          password: adminHash,
        },
      },
    },
  });
  console.log(`   ✅ ${admin.name} (${admin.email})\n`);

  // -------------------------------------------------------------------
  // 2. CLIENT USERS
  // -------------------------------------------------------------------
  console.log('👥 Creating client users...');
  const clientHash = await bcrypt.hash(ACCOUNTS.client1.password, SALT_ROUNDS);

  const client1 = await prisma.user.create({
    data: {
      email: ACCOUNTS.client1.email,
      name: ACCOUNTS.client1.name,
      role: 'CLIENT',
      emailVerified: true,
      accounts: {
        create: {
          providerId: 'credential',
          accountId: ACCOUNTS.client1.email,
          password: clientHash,
        },
      },
    },
  });
  console.log(`   ✅ ${client1.name} (${client1.email})`);

  const client2 = await prisma.user.create({
    data: {
      email: ACCOUNTS.client2.email,
      name: ACCOUNTS.client2.name,
      role: 'CLIENT',
      emailVerified: true,
      accounts: {
        create: {
          providerId: 'credential',
          accountId: ACCOUNTS.client2.email,
          password: clientHash,
        },
      },
    },
  });
  console.log(`   ✅ ${client2.name} (${client2.email})\n`);

  // -------------------------------------------------------------------
  // 3. WINEMAKER USERS + WINERIES + EXPERIENCES
  // -------------------------------------------------------------------
  console.log('🍷 Creating winemakers, wineries & experiences...');
  const winemakerHash = await bcrypt.hash(ACCOUNTS.winemakers[0].password, SALT_ROUNDS);

  const createdWineries: Array<{ wineryId: string; experienceIds: string[] }> = [];

  for (const wm of ACCOUNTS.winemakers) {
    const user = await prisma.user.create({
      data: {
        email: wm.email,
        name: wm.name,
        role: 'WINEMAKER',
        emailVerified: true,
        accounts: {
          create: {
            providerId: 'credential',
            accountId: wm.email,
            password: winemakerHash,
          },
        },
      },
    });

    const winery = await prisma.winery.create({
      data: {
        name: wm.winery.name,
        slug: wm.winery.slug,
        description: wm.winery.description,
        address: wm.winery.address,
        commune: wm.winery.commune,
        phone: wm.winery.phone,
        email: wm.winery.wineryEmail,
        latitude: wm.winery.latitude,
        longitude: wm.winery.longitude,
        userId: user.id,
        status: 'VERIFIED',
        verifiedAt: new Date('2026-01-15'),
        verifiedBy: admin.id,
        coverPhoto: wm.winery.coverPhoto,
      },
    });

    // Verification log (admin approved)
    await prisma.verificationLog.create({
      data: {
        wineryId: winery.id,
        action: 'APPROVED',
        adminId: admin.id,
        reason: 'Documents conformes, inscription validée.',
      },
    });

    // Notification preferences
    await prisma.notificationPreferences.create({
      data: {
        wineryId: winery.id,
        dailyDigest: true,
        weeklySummary: true,
        instantBookingAlerts: true,
        bookingReminders: true,
        marketingEmails: true,
      },
    });

    console.log(`   🏠 ${winery.name} (${winery.commune})`);

    // Create experiences
    const wineryExperiences = EXPERIENCES[wm.winery.slug] || [];
    const experienceIds: string[] = [];

    for (const exp of wineryExperiences) {
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

      experienceIds.push(experience.id);

      // Availability slots
      await prisma.availabilitySlot.createMany({
        data: getAvailabilitySlots().map((slot) => ({
          experienceId: experience.id,
          ...slot,
        })),
      });

      console.log(`      🍇 ${experience.title} (${exp.type}, ${exp.price / 100} CHF)`);
    }

    createdWineries.push({ wineryId: winery.id, experienceIds });
  }

  // -------------------------------------------------------------------
  // 4. SAMPLE BOOKINGS (show full lifecycle)
  // -------------------------------------------------------------------
  console.log('\n📅 Creating sample bookings...');

  const COMMISSION_RATE = 0.12;
  const bookingsData = [
    {
      // Upcoming confirmed booking - Laura at Germanier tasting
      visitorName: ACCOUNTS.client1.name,
      visitorEmail: ACCOUNTS.client1.email,
      visitorPhone: '+41 79 123 45 67',
      wineryIdx: 0,
      experienceIdx: 0,
      date: daysFromNow(7),
      timeSlot: '14:00',
      guestCount: 4,
      status: 'CONFIRMED' as const,
    },
    {
      // Upcoming confirmed booking - Thomas at Rhodan vineyard tour
      visitorName: ACCOUNTS.client2.name,
      visitorEmail: ACCOUNTS.client2.email,
      visitorPhone: '+41 78 987 65 43',
      wineryIdx: 1,
      experienceIdx: 0,
      date: daysFromNow(14),
      timeSlot: '10:00',
      guestCount: 6,
      status: 'CONFIRMED' as const,
    },
    {
      // Completed booking - Laura at Muses tasting (past)
      visitorName: ACCOUNTS.client1.name,
      visitorEmail: ACCOUNTS.client1.email,
      visitorPhone: '+41 79 123 45 67',
      wineryIdx: 3,
      experienceIdx: 0,
      date: daysFromNow(-21),
      timeSlot: '10:00',
      guestCount: 2,
      status: 'COMPLETED' as const,
    },
    {
      // Completed booking - Thomas at Fin Bec raclette (past)
      visitorName: ACCOUNTS.client2.name,
      visitorEmail: ACCOUNTS.client2.email,
      visitorPhone: '+41 78 987 65 43',
      wineryIdx: 2,
      experienceIdx: 1,
      date: daysFromNow(-10),
      timeSlot: '14:00',
      guestCount: 4,
      status: 'COMPLETED' as const,
    },
    {
      // Cancelled booking - Laura at Chappaz vendanges
      visitorName: ACCOUNTS.client1.name,
      visitorEmail: ACCOUNTS.client1.email,
      visitorPhone: '+41 79 123 45 67',
      wineryIdx: 4,
      experienceIdx: 1,
      date: daysFromNow(30),
      timeSlot: '10:00',
      guestCount: 4,
      status: 'CANCELLED_BY_CLIENT' as const,
    },
  ];

  for (let i = 0; i < bookingsData.length; i++) {
    const b = bookingsData[i]!;
    const winery = createdWineries[b.wineryIdx]!;
    const { wineryId, experienceIds } = winery;
    const experienceId = experienceIds[b.experienceIdx]!;

    // Look up price from the experienc
    const experience = await prisma.experience.findUnique({
      where: { id: experienceId },
    });
    if (!experience) continue;

    const totalPrice = experience.price * b.guestCount;
    const platformFee = Math.round(totalPrice * COMMISSION_RATE);
    const wineryPayout = totalPrice - platformFee;

    await prisma.booking.create({
      data: {
        reference: generateReference(i + 1),
        visitorName: b.visitorName,
        visitorEmail: b.visitorEmail,
        visitorPhone: b.visitorPhone,
        experienceId,
        wineryId,
        date: b.date,
        timeSlot: b.timeSlot,
        guestCount: b.guestCount,
        totalPrice,
        platformFee,
        wineryPayout,
        status: b.status,
        confirmationSentAt:
          b.status !== 'CANCELLED_BY_CLIENT' ? new Date() : null,
        wineryNotifiedAt:
          b.status !== 'CANCELLED_BY_CLIENT' ? new Date() : null,
        cancelledAt: b.status === 'CANCELLED_BY_CLIENT' ? new Date() : null,
      },
    });

    console.log(
      `   📋 ${b.visitorName} → ${experience.title} (${b.status}, ${b.guestCount} guests, ${totalPrice / 100} CHF)`
    );
  }

  // -------------------------------------------------------------------
  // 5. NEWSLETTER SUBSCRIPTIONS (demo data)
  // -------------------------------------------------------------------
  console.log('\n📧 Creating newsletter subscriptions...');
  await prisma.newsletterSubscription.createMany({
    data: [
      { email: 'wine-lover@example.com', source: 'coming-soon' },
      { email: 'touriste@example.fr', source: 'coming-soon' },
      { email: 'vino-fan@example.de', source: 'coming-soon' },
    ],
  });
  console.log('   ✅ 3 newsletter subscriptions created');

  // -------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------
  console.log('\n' + '='.repeat(60));
  console.log('🌱 SEED COMPLETED SUCCESSFULLY');
  console.log('='.repeat(60));
  console.log('\n📝 TEST ACCOUNTS:');
  console.log('─'.repeat(60));
  console.log(`   🔑 ADMIN`);
  console.log(`      Email:    ${ACCOUNTS.admin.email}`);
  console.log(`      Password: ${ACCOUNTS.admin.password}`);
  console.log('');
  console.log(`   🔑 CLIENTS`);
  console.log(`      Email:    ${ACCOUNTS.client1.email}`);
  console.log(`      Password: ${ACCOUNTS.client1.password}`);
  console.log(`      Email:    ${ACCOUNTS.client2.email}`);
  console.log(`      Password: ${ACCOUNTS.client2.password}`);
  console.log('');
  console.log(`   🔑 WINEMAKERS (all same password: ${ACCOUNTS.winemakers[0].password})`);
  for (const wm of ACCOUNTS.winemakers) {
    console.log(`      Email:    ${wm.email}  (${wm.winery.name})`);
  }
  console.log('');
  console.log('📊 DATA SUMMARY:');
  console.log('─'.repeat(60));
  console.log('   1 admin, 2 clients, 5 winemakers');
  console.log('   5 verified wineries (Valais)');
  console.log('   10 published experiences');
  console.log('   5 sample bookings (2 upcoming, 2 completed, 1 cancelled)');
  console.log('   5 verification logs, 5 notification preference sets');
  console.log('   3 newsletter subscriptions');
  console.log('');
  console.log('🚀 Run: npx prisma migrate reset    (clear + re-seed)');
  console.log('   Or:  npm run db:seed              (seed only)');
  console.log('='.repeat(60));
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
