import { Prisma, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SALT_ROUNDS = 10;

// ============================================================================
// TEST ACCOUNTS (SEC-005 compliant passwords)
// ============================================================================
const ACCOUNTS = {
  admin: {
    email: 'admin@encave.ch',
    password: 'Admin1234!',
    name: 'Samuel Admin',
  },
  client1: {
    email: 'laura.meier@example.com',
    password: 'Client1234!',
    name: 'Laura Meier',
  },
  client2: {
    email: 'thomas.brunner@example.com',
    password: 'Client1234!',
    name: 'Thomas Brunner',
  },
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
        coverPhoto:
          'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=1200',
        // V3 monetization & policies
        plan: 'FOUNDER',
        commissionRate: 0,
        cancellationPolicy: 'STANDARD',
        noShowFeeEnabled: true,
        noShowFeeCents: 1500,
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
        coverPhoto:
          'https://images.unsplash.com/photo-1560493676-04071c5f467b?w=1200',
        plan: 'FOUNDER',
        commissionRate: 0,
        cancellationPolicy: 'FLEXIBLE',
        noShowFeeEnabled: false,
        noShowFeeCents: 1500,
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
          'Nichée entre les thermes de Saillon et les vignobles en terrasses, la Cave Fin Bec marie plaisir du palais et art de vivre valaisan. Notre philosophie : des vins gourmands, expressifs et accessibles, élaborés à partir de cépages traditionnels et de variétés oubliées que nous avons replantées avec amour.',
        address: 'Route de Fully 18',
        commune: 'Saillon',
        phone: '+41 27 744 30 44',
        wineryEmail: 'cave@finbec.example.com',
        latitude: 46.1726,
        longitude: 7.1907,
        coverPhoto:
          'https://images.unsplash.com/photo-1528823872057-9c018a7a7553?w=1200',
        plan: 'FOUNDER',
        commissionRate: 0,
        cancellationPolicy: 'STRICT',
        noShowFeeEnabled: true,
        noShowFeeCents: 2000,
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
        coverPhoto:
          'https://images.unsplash.com/photo-1474722883778-792e7990302f?w=1200',
        plan: 'STANDARD',
        commissionRate: null,
        cancellationPolicy: 'FLEXIBLE',
        noShowFeeEnabled: false,
        noShowFeeCents: 1500,
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
        coverPhoto:
          'https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=1200',
        plan: 'STANDARD',
        commissionRate: null,
        cancellationPolicy: 'STRICT',
        noShowFeeEnabled: true,
        noShowFeeCents: 5000,
      },
    },
    {
      email: 'olivier@example.com',
      password: 'Vigneron1!',
      name: 'Olivier Carrupt',
      winery: {
        name: 'Cave Saint-Georges',
        slug: 'cave-saint-georges',
        description:
          "Au pied des majestueux Hauts de Cry, la Cave Saint-Georges cultive 12 hectares sur les éboulis calcaires de Chamoson, plus grande commune viticole du Valais. La famille Carrupt y élabore depuis quatre générations des Petite Arvine et des Johannisberg d'une minéralité ciselée, ainsi que des rouges de caractère.",
        address: 'Route de la Colline 8',
        commune: 'Chamoson',
        phone: '+41 27 306 21 47',
        wineryEmail: 'contact@saintgeorges.example.com',
        latitude: 46.2036,
        longitude: 7.2192,
        coverPhoto:
          'https://images.unsplash.com/photo-1560493676-04071c5f467b?w=1200',
        plan: 'STANDARD',
        commissionRate: null,
        cancellationPolicy: 'STANDARD',
        noShowFeeEnabled: true,
        noShowFeeCents: 1000,
      },
    },
    {
      email: 'celine@example.com',
      password: 'Vigneron1!',
      name: 'Céline Dubuis',
      winery: {
        name: "Domaine du Mont d'Or",
        slug: 'domaine-du-mont-dor',
        description:
          "Fondé en 1848 sur la colline de Pont-de-la-Morge, le Domaine du Mont d'Or est l'un des plus anciens domaines du Valais. Ses 22 hectares en terrasses, exposés plein sud, donnent naissance à des Johannisberg de légende et à des vins flétris qui ont fait la réputation de la maison bien au-delà des frontières suisses.",
        address: 'Rue de Savoie 64',
        commune: 'Sion',
        phone: '+41 27 346 20 32',
        wineryEmail: 'accueil@montdor.example.com',
        latitude: 46.2192,
        longitude: 7.3049,
        coverPhoto:
          'https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=1200',
        plan: 'STANDARD',
        commissionRate: null,
        cancellationPolicy: 'FLEXIBLE',
        noShowFeeEnabled: false,
        noShowFeeCents: 1500,
      },
    },
    {
      email: 'joel@example.com',
      password: 'Vigneron1!',
      name: 'Joël Bagnoud',
      winery: {
        name: 'Cave La Romaine',
        slug: 'cave-la-romaine',
        description:
          "Sur les coteaux de Flanthey, entre Sierre et le bisse de Sillonin, la Cave La Romaine tire son nom d'une ancienne voie romaine qui traversait ses vignes. Joël Bagnoud y signe des Cornalin et des Humagne Rouge régulièrement primés, dans un chai contemporain ouvert sur le vignoble.",
        address: 'Chemin de la Romaine 3',
        commune: 'Flanthey',
        phone: '+41 27 458 46 22',
        wineryEmail: 'cave@laromaine.example.com',
        latitude: 46.276,
        longitude: 7.4527,
        coverPhoto:
          'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=1200',
        plan: 'STANDARD',
        commissionRate: null,
        cancellationPolicy: 'STANDARD',
        noShowFeeEnabled: false,
        noShowFeeCents: 1500,
      },
    },
    {
      email: 'anne-sophie@example.com',
      password: 'Vigneron1!',
      name: 'Anne-Sophie Michellod',
      winery: {
        name: 'Cave du Vieux-Pressoir',
        slug: 'cave-du-vieux-pressoir',
        description:
          "À Leytron, au cœur du triangle d'or des rouges valaisans, la Cave du Vieux-Pressoir doit son nom au pressoir en bois de 1876 qui trône encore dans son caveau. Anne-Sophie Michellod y perpétue une tradition familiale tournée vers l'Humagne, dans le respect du travail à l'ancienne et des longues gardes.",
        address: 'Rue du Pressoir 12',
        commune: 'Leytron',
        phone: '+41 27 744 18 56',
        wineryEmail: 'info@vieuxpressoir.example.com',
        latitude: 46.1858,
        longitude: 7.2043,
        coverPhoto:
          'https://images.unsplash.com/photo-1528823872057-9c018a7a7553?w=1200',
        plan: 'STANDARD',
        commissionRate: null,
        cancellationPolicy: 'STRICT',
        noShowFeeEnabled: false,
        noShowFeeCents: 1500,
      },
    },
    {
      email: 'pierre-alain@example.com',
      password: 'Vigneron1!',
      name: 'Pierre-Alain Fontannaz',
      winery: {
        name: 'Cave de la Brunière',
        slug: 'cave-de-la-bruniere',
        description:
          "Domaine familial de Conthey, la Cave de la Brunière exploite 9 hectares entre plaine et coteaux, dont les fameuses terrasses des Bans. Pierre-Alain Fontannaz, troisième du nom, y produit des Fendant droits et salins ainsi qu'une Syrah élevée dix-huit mois en barrique, fierté de la maison.",
        address: 'Route des Bans 25',
        commune: 'Conthey',
        phone: '+41 27 346 55 09',
        wineryEmail: 'bonjour@labruniere.example.com',
        latitude: 46.2237,
        longitude: 7.279,
        coverPhoto:
          'https://images.unsplash.com/photo-1474722883778-792e7990302f?w=1200',
        plan: 'STANDARD',
        commissionRate: null,
        cancellationPolicy: 'FLEXIBLE',
        noShowFeeEnabled: false,
        noShowFeeCents: 1500,
      },
    },
  ],
} as const;

// ============================================================================
// EXPERIENCES DATA (40 total, 4 per winery, all 7 types covered)
// ============================================================================
type ExperienceLanguage = 'FR' | 'DE' | 'EN';

type ExperienceData = {
  title: string;
  slug: string;
  description: string;
  type:
    | 'TASTING'
    | 'CELLAR_VISIT'
    | 'WORKSHOP'
    | 'VINEYARD_TOUR'
    | 'FOOD_PAIRING'
    | 'MEAL'
    | 'EVENT';
  duration: number;
  price: number;
  minCapacity: number;
  maxCapacity: number;
  coverPhoto: string;
  languages: ExperienceLanguage[];
  isCollective?: boolean;
};

const EXPERIENCES: Record<string, ExperienceData[]> = {
  'domaine-germanier': [
    {
      title: 'Dégustation Grands Crus de Vétroz',
      slug: 'degustation-grands-crus-vetroz',
      description:
        "Plongez dans l'univers des Grands Crus de Vétroz lors d'une dégustation commentée de 7 vins d'exception. De l'Amigne flétrie aux Pinot Noir élevés en barrique, Jean-René Germanier partage les secrets de quatre générations de savoir-faire. Accompagnement de fromages d'alpage et viande séchée du Valais.",
      type: 'TASTING',
      duration: 90,
      price: 5500,
      minCapacity: 2,
      maxCapacity: 12,
      coverPhoto:
        'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800',
      languages: ['FR', 'EN'],
    },
    {
      title: 'Visite du Chai et de la Vinothèque',
      slug: 'visite-chai-vinotheque',
      description:
        'Découvrez notre chai moderne où tradition et technologie se rencontrent. Parcourez nos rangées de barriques en chêne et visitez notre vinothèque historique abritant des millésimes remontant à 1950. La visite se termine par une dégustation de 4 vins dont un millésime surprise de notre collection privée.',
      type: 'CELLAR_VISIT',
      duration: 75,
      price: 3500,
      minCapacity: 2,
      maxCapacity: 20,
      coverPhoto:
        'https://images.unsplash.com/photo-1528823872057-9c018a7a7553?w=800',
      languages: ['FR'],
    },
    {
      title: 'Table du Vigneron — Menu Terroir en 5 Plats',
      slug: 'table-vigneron-menu-terroir',
      description:
        "Prenez place à la grande table du domaine pour un menu de saison en cinq plats, imaginé autour des produits valaisans et accordé aux cuvées de la maison. Chaque service est présenté par Jean-René, qui raconte l'histoire des vins servis. Une immersion gourmande au cœur de Vétroz.",
      type: 'MEAL',
      duration: 180,
      price: 14500,
      minCapacity: 2,
      maxCapacity: 16,
      coverPhoto:
        'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800',
      languages: ['FR', 'EN'],
    },
    {
      title: 'Caves Ouvertes de Vétroz — Édition Estivale',
      slug: 'caves-ouvertes-vetroz',
      description:
        'Une journée de fête à travers quatre caves emblématiques du Valais central, orchestrée par le Domaine Germanier. Verre de dégustation gravé, navette entre les domaines, stands gourmands et animations musicales. Billet unique donnant accès à toutes les caves participantes.',
      type: 'EVENT',
      duration: 300,
      price: 3900,
      minCapacity: 1,
      maxCapacity: 80,
      coverPhoto:
        'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=800',
      languages: ['FR', 'DE', 'EN'],
      isCollective: true,
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
      coverPhoto:
        'https://images.unsplash.com/photo-1560493676-04071c5f467b?w=800',
      languages: ['FR', 'DE', 'EN'],
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
      coverPhoto:
        'https://images.unsplash.com/photo-1567696911980-2eed69a46042?w=800',
      languages: ['FR', 'DE', 'EN'],
    },
    {
      title: 'Verticale de Pinot Noir — 6 Millésimes',
      slug: 'verticale-pinot-noir',
      description:
        "Une plongée rare dans six millésimes de notre Pinot Noir de Salgesch, du fruit éclatant de la jeunesse aux notes tertiaires des années mûres. Nicolas commente l'évolution du terroir calcaire au fil des saisons. Réservé aux amateurs curieux.",
      type: 'TASTING',
      duration: 120,
      price: 8900,
      minCapacity: 2,
      maxCapacity: 10,
      coverPhoto:
        'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800',
      languages: ['FR', 'DE', 'EN'],
    },
    {
      title: "Brisolée d'Automne à la Cave",
      slug: 'brisolee-automne-cave',
      description:
        "La brisolée traditionnelle comme on l'aime : châtaignes rôties au feu de bois, fromages d'alpage, viande séchée, raisin et moût de saison. Le tout accompagné de nos vins nouveaux dans l'ambiance chaleureuse du carnotzet. (Septembre à novembre)",
      type: 'MEAL',
      duration: 150,
      price: 6500,
      minCapacity: 4,
      maxCapacity: 24,
      coverPhoto:
        'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800',
      languages: ['FR', 'DE', 'EN'],
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
      coverPhoto:
        'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=800',
      languages: ['FR'],
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
      coverPhoto:
        'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800',
      languages: ['FR', 'EN'],
    },
    {
      title: 'Visite du Caveau Voûté et des Foudres',
      slug: 'visite-caveau-voute',
      description:
        'Descendez dans notre caveau voûté du XIXe siècle où reposent foudres de chêne et amphores. Isabelle vous dévoile les étapes de la vinification des cépages rares du domaine. Dégustation de trois vins en fin de parcours.',
      type: 'CELLAR_VISIT',
      duration: 60,
      price: 2900,
      minCapacity: 2,
      maxCapacity: 12,
      coverPhoto:
        'https://images.unsplash.com/photo-1528823872057-9c018a7a7553?w=800',
      languages: ['FR'],
    },
    {
      title: 'Soirée Jazz & Vins au Caveau',
      slug: 'soiree-jazz-vins-caveau',
      description:
        'Un quartet de jazz, des bougies sous les voûtes et cinq vins servis au fil des sets : la soirée signature de la Cave Fin Bec. Planchettes valaisannes à discrétion. Places limitées, réservation indispensable.',
      type: 'EVENT',
      duration: 240,
      price: 5900,
      minCapacity: 2,
      maxCapacity: 40,
      coverPhoto:
        'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=800',
      languages: ['FR', 'EN'],
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
      coverPhoto:
        'https://images.unsplash.com/photo-1474722883778-792e7990302f?w=800',
      languages: ['FR', 'EN'],
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
      coverPhoto:
        'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=800',
      languages: ['FR'],
    },
    {
      title: 'Balade Biodynamique dans les Parcelles',
      slug: 'balade-biodynamique-parcelles',
      description:
        'Marchez entre les rangs certifiés Demeter et découvrez les préparations biodynamiques, la vie du sol et les ruches du domaine. Robert explique comment la lune rythme les travaux de la vigne. Dégustation de trois cuvées au retour.',
      type: 'VINEYARD_TOUR',
      duration: 120,
      price: 6200,
      minCapacity: 2,
      maxCapacity: 12,
      coverPhoto:
        'https://images.unsplash.com/photo-1474722883778-792e7990302f?w=800',
      languages: ['FR', 'EN'],
    },
    {
      title: "Atelier Dégustation à l'Aveugle",
      slug: 'atelier-degustation-aveugle',
      description:
        'Verres noirs, esprit léger : apprenez à décrire un vin sans le voir. Six vins du Valais à identifier par le nez et le palais, avec les conseils avisés de notre équipe. Fous rires garantis, aucune connaissance requise.',
      type: 'WORKSHOP',
      duration: 120,
      price: 7500,
      minCapacity: 2,
      maxCapacity: 8,
      coverPhoto:
        'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800',
      languages: ['FR'],
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
      coverPhoto:
        'https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=800',
      languages: ['FR', 'EN'],
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
      coverPhoto:
        'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=800',
      languages: ['FR'],
    },
    {
      title: 'Grains Nobles & Vins Rares — Dégustation Privée',
      slug: 'degustation-grains-nobles',
      description:
        "Une dégustation confidentielle des légendaires Grains Nobles de Marie-Thérèse Chappaz : Petite Arvine flétrie, Ermitage et Malvoisie de grandes années. Six vins rares servis dans l'intimité du carnotzet familial de Fully.",
      type: 'TASTING',
      duration: 90,
      price: 9500,
      minCapacity: 2,
      maxCapacity: 8,
      coverPhoto:
        'https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=800',
      languages: ['FR', 'EN'],
    },
    {
      title: "Accord Fromages d'Alpage & Petite Arvine",
      slug: 'accord-fromages-alpage-arvine',
      description:
        "Cinq fromages d'alpage affinés de la vallée de Bagnes rencontrent cinq expressions de la Petite Arvine, du sec au flétri. Un dialogue de terroirs guidé par notre équipe, dans le respect des saisons.",
      type: 'FOOD_PAIRING',
      duration: 120,
      price: 7800,
      minCapacity: 2,
      maxCapacity: 10,
      coverPhoto:
        'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800',
      languages: ['FR'],
    },
  ],
  'cave-saint-georges': [
    {
      title: 'Les Crus de Chamoson en 6 Verres',
      slug: 'crus-chamoson-6-verres',
      description:
        "Petite Arvine, Johannisberg, Cornalin : six vins pour comprendre pourquoi Chamoson est la plus vaste commune viticole du Valais. Olivier partage l'histoire des Hauts de Cry et de leurs éboulis calcaires qui signent nos vins.",
      type: 'TASTING',
      duration: 90,
      price: 4200,
      minCapacity: 2,
      maxCapacity: 12,
      coverPhoto:
        'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800',
      languages: ['FR'],
    },
    {
      title: 'Sous les Hauts de Cry — Visite de la Cave',
      slug: 'visite-cave-hauts-de-cry',
      description:
        "Des cuves inox au vieux pressoir de 1904, parcourez notre cave familiale au pied des Hauts de Cry. La visite s'achève par une dégustation de quatre vins accompagnée de pain de seigle et fromage du village.",
      type: 'CELLAR_VISIT',
      duration: 75,
      price: 3200,
      minCapacity: 2,
      maxCapacity: 15,
      coverPhoto:
        'https://images.unsplash.com/photo-1528823872057-9c018a7a7553?w=800',
      languages: ['FR', 'EN'],
    },
    {
      title: 'Repas Vigneron au Mazot',
      slug: 'repas-vigneron-mazot',
      description:
        "Dans notre mazot restauré au milieu des vignes, partagez l'assiette du vigneron : soupe de courge, ragoût de bœuf d'Hérens et tarte aux pommes du verger. Quatre vins du domaine servis à table, ambiance familiale garantie.",
      type: 'MEAL',
      duration: 150,
      price: 8800,
      minCapacity: 4,
      maxCapacity: 20,
      coverPhoto:
        'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800',
      languages: ['FR'],
    },
    {
      title: 'Sentier Viticole des Coteaux de Chamoson',
      slug: 'sentier-coteaux-chamoson',
      description:
        'Trois heures de marche facile entre bisses, murs en pierres sèches et parcelles escarpées, avec les Hauts de Cry en toile de fond. Pause dégustation à mi-parcours face au Rhône. Chaussures de marche recommandées.',
      type: 'VINEYARD_TOUR',
      duration: 150,
      price: 5500,
      minCapacity: 4,
      maxCapacity: 14,
      coverPhoto:
        'https://images.unsplash.com/photo-1560493676-04071c5f467b?w=800',
      languages: ['FR', 'DE', 'EN'],
    },
  ],
  'domaine-du-mont-dor': [
    {
      title: 'Johannisberg Prestige — Dégustation au Domaine',
      slug: 'degustation-johannisberg-prestige',
      description:
        "Le Johannisberg est l'âme du Domaine du Mont d'Or depuis 1848. Céline vous fait déguster six cuvées, des vendanges classiques aux flétris sur souche, dans le pavillon dominant les vignes de Pont-de-la-Morge.",
      type: 'TASTING',
      duration: 90,
      price: 5800,
      minCapacity: 2,
      maxCapacity: 12,
      coverPhoto:
        'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=800',
      languages: ['FR', 'EN'],
    },
    {
      title: "Les Caves Centenaires du Mont d'Or",
      slug: 'caves-centenaires-mont-dor',
      description:
        "Creusées dans la colline en 1886, nos caves abritent une collection de millésimes remontant au début du XXe siècle. Visite guidée des galeries, suivie d'une dégustation de cinq vins dont un flétri de collection.",
      type: 'CELLAR_VISIT',
      duration: 75,
      price: 3600,
      minCapacity: 2,
      maxCapacity: 18,
      coverPhoto:
        'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=800',
      languages: ['FR', 'DE', 'EN'],
    },
    {
      title: 'Vins Doux & Desserts — Accords Sucrés',
      slug: 'accords-vins-doux-desserts',
      description:
        "Un voyage sucré en cinq étapes : nos vins flétris et Grains Nobles face aux créations d'un pâtissier sédunois. De la tarte aux abricots du Valais au chocolat grand cru, l'accord parfait existe — venez le trouver.",
      type: 'FOOD_PAIRING',
      duration: 105,
      price: 6400,
      minCapacity: 2,
      maxCapacity: 12,
      coverPhoto:
        'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800',
      languages: ['FR'],
    },
    {
      title: 'Nuit des Épicuriens dans les Vignes',
      slug: 'nuit-epicuriens-vignes',
      description:
        "Une soirée d'été hors du temps : tables dressées entre les rangs de vigne, menu en quatre actes, vins du domaine et ciel étoilé du Valais. Musique acoustique jusqu'à minuit. Une seule date par an, places très limitées.",
      type: 'EVENT',
      duration: 270,
      price: 9900,
      minCapacity: 2,
      maxCapacity: 60,
      coverPhoto:
        'https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=800',
      languages: ['FR', 'EN'],
    },
  ],
  'cave-la-romaine': [
    {
      title: 'Cornalin & Humagne — Les Rouges du Valais',
      slug: 'degustation-cornalin-humagne',
      description:
        'Les deux grands rouges autochtones du Valais face à face : Cornalin éclatant et Humagne Rouge sauvage, en six vins et plusieurs millésimes. Joël raconte la renaissance de ces cépages sur les coteaux de Flanthey.',
      type: 'TASTING',
      duration: 90,
      price: 4600,
      minCapacity: 2,
      maxCapacity: 10,
      coverPhoto:
        'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800',
      languages: ['FR'],
    },
    {
      title: 'Balade des Bisses et des Vignes',
      slug: 'balade-bisses-vignes',
      description:
        "Suivez le bisse de Sillonin entre châtaigniers et parcelles en terrasses, jusqu'au point de vue sur la plaine du Rhône. Deux pauses dégustation en plein air rythment cette balade accessible à tous.",
      type: 'VINEYARD_TOUR',
      duration: 150,
      price: 6800,
      minCapacity: 4,
      maxCapacity: 12,
      coverPhoto:
        'https://images.unsplash.com/photo-1474722883778-792e7990302f?w=800',
      languages: ['FR', 'EN'],
    },
    {
      title: 'Atelier Œnologie — Les Bases de la Dégustation',
      slug: 'atelier-oenologie-bases',
      description:
        "Robe, nez, bouche : deux heures trente pour acquérir la méthode des professionnels. Huit vins d'exercice, fiches de dégustation et vocabulaire essentiel. Vous ne boirez plus jamais un verre de la même manière.",
      type: 'WORKSHOP',
      duration: 150,
      price: 8500,
      minCapacity: 2,
      maxCapacity: 10,
      coverPhoto:
        'https://images.unsplash.com/photo-1567696911980-2eed69a46042?w=800',
      languages: ['FR'],
    },
    {
      title: 'Brunch Vigneron du Dimanche',
      slug: 'brunch-vigneron-dimanche',
      description:
        "Le dimanche matin à la cave : pains au levain, confitures d'abricot maison, charcuteries d'Anniviers, œufs de la ferme et fromages de la région. Jus de raisin du domaine pour les enfants, Fendant et Dôle pour les grands.",
      type: 'MEAL',
      duration: 150,
      price: 7200,
      minCapacity: 2,
      maxCapacity: 20,
      coverPhoto:
        'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800',
      languages: ['FR', 'DE', 'EN'],
    },
  ],
  'cave-du-vieux-pressoir': [
    {
      title: "L'Humagne dans Tous ses États",
      slug: 'humagne-tous-etats',
      description:
        "Blanche ou rouge, jeune ou patinée : l'Humagne comme vous ne l'avez jamais dégustée, en six vins issus des coteaux de Leytron et de Chamoson. Anne-Sophie partage les secrets de ce cépage au caractère bien trempé.",
      type: 'TASTING',
      duration: 90,
      price: 4400,
      minCapacity: 2,
      maxCapacity: 10,
      coverPhoto:
        'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=800',
      languages: ['FR'],
    },
    {
      title: 'Du Pressoir Ancestral à la Cuve Inox',
      slug: 'visite-pressoir-ancestral',
      description:
        "Notre pressoir en bois de 1876, classé au patrimoine, ouvre la visite ; les cuves thermorégulées la concluent. Entre les deux, 150 ans d'évolution de la vinification valaisanne. Dégustation de trois vins incluse.",
      type: 'CELLAR_VISIT',
      duration: 60,
      price: 2800,
      minCapacity: 2,
      maxCapacity: 16,
      coverPhoto:
        'https://images.unsplash.com/photo-1528823872057-9c018a7a7553?w=800',
      languages: ['FR', 'EN'],
    },
    {
      title: 'Planchette Valaisanne & Vieux Millésimes',
      slug: 'planchette-valaisanne-millesimes',
      description:
        'Viande séchée, lard sec, fromage à rebibes et pain de seigle AOP face à quatre vieux millésimes sortis de notre vinothèque. Une dégustation qui prouve que les vins du Valais savent vieillir.',
      type: 'FOOD_PAIRING',
      duration: 90,
      price: 5600,
      minCapacity: 2,
      maxCapacity: 12,
      coverPhoto:
        'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800',
      languages: ['FR'],
    },
    {
      title: 'Atelier Taille de la Vigne en Hiver',
      slug: 'atelier-taille-vigne-hiver',
      description:
        'Sécateur en main, apprenez la taille Guyot sur nos parcelles de Fendant. Une matinée au grand air conclue par une soupe chaude au carnotzet et une dégustation des vins issus des vignes que vous venez de tailler. (Décembre à février)',
      type: 'WORKSHOP',
      duration: 180,
      price: 9800,
      minCapacity: 4,
      maxCapacity: 10,
      coverPhoto:
        'https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=800',
      languages: ['FR'],
    },
  ],
  'cave-de-la-bruniere': [
    {
      title: 'Découverte des Cépages de Conthey',
      slug: 'decouverte-cepages-conthey',
      description:
        'Six vins pour faire connaissance avec notre domaine familial : Fendant des Bans, Petite Arvine, Gamay vieilles vignes et Syrah élevée en barrique. Pierre-Alain reçoit lui-même chaque groupe au caveau.',
      type: 'TASTING',
      duration: 75,
      price: 3900,
      minCapacity: 2,
      maxCapacity: 12,
      coverPhoto:
        'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800',
      languages: ['FR', 'EN'],
    },
    {
      title: 'Visite de Cave & Dégustation sur Fût',
      slug: 'visite-cave-degustation-fut',
      description:
        "Pipette en main, goûtez les vins en cours d'élevage directement sur fût, puis comparez-les aux millésimes en bouteille. Une visite pour comprendre ce que le temps apporte au vin.",
      type: 'CELLAR_VISIT',
      duration: 90,
      price: 4100,
      minCapacity: 2,
      maxCapacity: 14,
      coverPhoto:
        'https://images.unsplash.com/photo-1528823872057-9c018a7a7553?w=800',
      languages: ['FR'],
    },
    {
      title: 'Les Terrasses au Coucher du Soleil',
      slug: 'terrasses-coucher-soleil',
      description:
        "En fin de journée, montez avec nous jusqu'aux terrasses dominant Conthey pour l'heure dorée. Apéritif vigneron face aux Alpes bernoises : trois vins, viande séchée et silence des vignes. Le Valais dans ce qu'il a de plus beau.",
      type: 'VINEYARD_TOUR',
      duration: 120,
      price: 5900,
      minCapacity: 2,
      maxCapacity: 16,
      coverPhoto:
        'https://images.unsplash.com/photo-1474722883778-792e7990302f?w=800',
      languages: ['FR', 'DE', 'EN'],
    },
    {
      title: 'Raclette AOP & Fendant sur la Terrasse',
      slug: 'raclette-aop-fendant-terrasse',
      description:
        "Le mariage le plus célèbre du Valais servi dans les règles de l'art : fromage de Bagnes raclé à la flamme et trois Fendants de terroirs différents. Vue imprenable sur la vallée du Rhône comprise.",
      type: 'FOOD_PAIRING',
      duration: 135,
      price: 8200,
      minCapacity: 4,
      maxCapacity: 18,
      coverPhoto:
        'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800',
      languages: ['FR'],
    },
  ],
};

// ============================================================================
// COLLECTIVE EVENT PARTICIPANTS (US-250 light) — other wineries shown on the
// single collective experience; the organizer stays the experience's winery.
// ============================================================================
const EVENT_PARTICIPANTS = [
  {
    slug: 'cave-du-rhodan',
    order: 1,
    description: 'Verticale de Pinot Noir de Salgesch au stand du caveau.',
  },
  {
    slug: 'cave-fin-bec',
    order: 2,
    description:
      'Cépages oubliés en dégustation libre et raclette au feu de bois.',
  },
  {
    slug: 'domaine-des-muses',
    order: 3,
    description:
      'Vins biodynamiques et accords surprises de la cité du soleil.',
  },
];

// ============================================================================
// WINES — Valais cépages (deterministic, 6 per winery = 60 total)
// ============================================================================
const VALAIS_CEPAGES = [
  { grape: 'Fendant', basePrice: 1600 },
  { grape: 'Petite Arvine', basePrice: 2900 },
  { grape: 'Johannisberg', basePrice: 1900 },
  { grape: 'Heida', basePrice: 2600 },
  { grape: 'Amigne', basePrice: 3100 },
  { grape: 'Ermitage', basePrice: 3300 },
  { grape: 'Rèze', basePrice: 2700 },
  { grape: 'Muscat', basePrice: 2000 },
  { grape: 'Pinot Noir', basePrice: 2200 },
  { grape: 'Dôle', basePrice: 1700 },
  { grape: 'Cornalin', basePrice: 3200 },
  { grape: 'Humagne Rouge', basePrice: 2800 },
  { grape: 'Syrah', basePrice: 3400 },
  { grape: 'Gamay', basePrice: 1500 },
  { grape: 'Humagne Blanche', basePrice: 2500 },
];

const CUVEE_NAMES = [
  'Réserve',
  'Les Terrasses',
  'Vieilles Vignes',
  'Tradition',
  'du Clos',
  'Grand Cru',
];

const WINES_PER_WINERY = 6;

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

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function yearsFromNow(years: number): Date {
  const date = new Date();
  date.setFullYear(date.getFullYear() + years);
  return date;
}

// Upcoming dates (starting tomorrow) matching a weekday, within N days.
// A 14-day window always contains exactly 2 of each weekday.
function nextDatesForDay(dayOfWeek: number, withinDays: number): Date[] {
  const dates: Date[] = [];
  for (let d = 1; d <= withinDays; d++) {
    const date = daysFromNow(d);
    if (date.getDay() === dayOfWeek) {
      dates.push(date);
    }
  }
  return dates;
}

// ============================================================================
// HELPERS: strict-safe access (noUncheckedIndexedAccess without `!`)
// ============================================================================
function pick<T>(arr: readonly T[], index: number): T {
  const item = arr[index % arr.length];
  if (item === undefined) {
    throw new Error('pick: empty array');
  }
  return item;
}

function required<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) {
    throw new Error(`Seed invariant violated: missing ${label}`);
  }
  return value;
}

// The seed WIPES every table before reseeding. Only ever run it against a
// disposable database: local hosts pass silently; any remote host requires
// an explicit SEED_ALLOW_DESTRUCTIVE=1; production is refused outright.
const LOCAL_DB_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'db',
  'postgres',
]);

function assertSeedTargetIsSafe(): void {
  if (process.env.VERCEL_ENV === 'production') {
    throw new Error(
      'Seed aborted: VERCEL_ENV=production — this seed wipes every table.'
    );
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('Seed aborted: DATABASE_URL is not set.');
  }
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error('Seed aborted: DATABASE_URL is not a parseable URL.');
  }
  if (LOCAL_DB_HOSTS.has(host)) {
    return;
  }
  if (process.env.SEED_ALLOW_DESTRUCTIVE === '1') {
    console.warn(
      `⚠️  SEED_ALLOW_DESTRUCTIVE=1 — wiping and reseeding REMOTE database "${host}"`
    );
    return;
  }
  throw new Error(
    `Seed aborted: DATABASE_URL points to remote host "${host}" and this seed WIPES every table (including the gift-card ledger). ` +
      'Set SEED_ALLOW_DESTRUCTIVE=1 only for a disposable dev/preview database — never production.'
  );
}

// ============================================================================
// MAIN SEED
// ============================================================================
async function main() {
  assertSeedTargetIsSafe();

  console.log('🌱 Starting database seed...\n');

  // -------------------------------------------------------------------
  // 0. CLEANUP (idempotent re-seed) — children before parents (FK order)
  // -------------------------------------------------------------------
  console.log('🧹 Cleaning existing data...');
  await prisma.scheduledJob.deleteMany();
  await prisma.bookingWine.deleteMany();
  // gift_card_transactions is APPEND-ONLY on migrated databases: triggers
  // forbid UPDATE/DELETE and TRUNCATE (see the v3_foundations and
  // gift_card_ledger_hardening migrations). Wiping the ledger is legitimate
  // for a dev seed only, so the guards are disabled explicitly and loudly,
  // then re-enabled — an honest override, NEVER for application code.
  console.warn('   ⚠️  Disabling gift-card ledger triggers for the wipe');
  await prisma.$executeRaw`ALTER TABLE "gift_card_transactions" DISABLE TRIGGER USER`;
  try {
    await prisma.$executeRaw`TRUNCATE TABLE "gift_card_transactions", "gift_cards" CASCADE`;
  } finally {
    await prisma.$executeRaw`ALTER TABLE "gift_card_transactions" ENABLE TRIGGER USER`;
  }
  await prisma.requestOffer.deleteMany();
  await prisma.request.deleteMany();
  await prisma.eventParticipant.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.experienceOccurrence.deleteMany();
  await prisma.blockedDate.deleteMany();
  await prisma.availabilitySlot.deleteMany();
  await prisma.experienceGalleryImage.deleteMany();
  await prisma.experience.deleteMany();
  await prisma.wine.deleteMany();
  await prisma.verificationLog.deleteMany();
  await prisma.notificationPreferences.deleteMany();
  await prisma.wineryGalleryImage.deleteMany();
  await prisma.winery.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
  await prisma.newsletterSubscription.deleteMany();
  console.log('   ✅ Database cleared\n');

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
  const winemakerHash = await bcrypt.hash(
    ACCOUNTS.winemakers[0].password,
    SALT_ROUNDS
  );

  const createdWineries: Array<{
    slug: string;
    wineryId: string;
    experienceIds: string[];
  }> = [];
  let collectiveExperienceId: string | null = null;

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
        // Public visibility (ENC-027) requires Stripe KYC — without these
        // flags NOT ONE seeded winery appears on the public site. Real
        // payments still need a genuine test-mode connected account:
        // provide it via SEED_STRIPE_TEST_ACCOUNT (acct_...) and the first
        // winery gets it (the column is unique, so only one can).
        stripeOnboardingComplete: true,
        stripeDetailsSubmitted: true,
        stripeAccountId:
          createdWineries.length === 0
            ? (process.env.SEED_STRIPE_TEST_ACCOUNT ?? null)
            : null,
        // V3 monetization & policies (P-02)
        plan: wm.winery.plan,
        commissionRate: wm.winery.commissionRate,
        cancellationPolicy: wm.winery.cancellationPolicy,
        noShowFeeEnabled: wm.winery.noShowFeeEnabled,
        noShowFeeCents: wm.winery.noShowFeeCents,
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

    console.log(
      `   🏠 ${winery.name} (${winery.commune}) — ${wm.winery.plan}, ${wm.winery.cancellationPolicy}${
        wm.winery.noShowFeeEnabled
          ? `, no-show ${wm.winery.noShowFeeCents / 100} CHF`
          : ''
      }`
    );

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
          languages: exp.languages,
          isCollective: exp.isCollective ?? false,
        },
      });

      experienceIds.push(experience.id);
      if (exp.isCollective) {
        collectiveExperienceId = experience.id;
      }

      // Availability slots
      await prisma.availabilitySlot.createMany({
        data: getAvailabilitySlots().map((slot) => ({
          experienceId: experience.id,
          ...slot,
        })),
      });

      console.log(
        `      🍇 ${experience.title} (${exp.type}, ${exp.price / 100} CHF)`
      );
    }

    createdWineries.push({
      slug: wm.winery.slug,
      wineryId: winery.id,
      experienceIds,
    });
  }

  const wineryBySlug = (slug: string) =>
    required(
      createdWineries.find((w) => w.slug === slug),
      `winery ${slug}`
    );

  // -------------------------------------------------------------------
  // 4. COLLECTIVE EVENT PARTICIPANTS (one collective EVENT experience)
  // -------------------------------------------------------------------
  console.log('\n🎪 Creating collective event participants...');
  const eventExperienceId = required(
    collectiveExperienceId,
    'collective experience'
  );
  for (const participant of EVENT_PARTICIPANTS) {
    await prisma.eventParticipant.create({
      data: {
        experienceId: eventExperienceId,
        wineryId: wineryBySlug(participant.slug).wineryId,
        description: participant.description,
        order: participant.order,
      },
    });
    console.log(`   🤝 ${participant.slug} (order ${participant.order})`);
  }

  // -------------------------------------------------------------------
  // 5. WINES (Valais cépages, 6 per winery)
  // -------------------------------------------------------------------
  console.log('\n🍾 Creating wines...');
  const wineRows: Prisma.WineCreateManyInput[] = [];
  for (let w = 0; w < createdWineries.length; w++) {
    const entry = pick(createdWineries, w);
    for (let i = 0; i < WINES_PER_WINERY; i++) {
      const globalIndex = w * WINES_PER_WINERY + i;
      const cepage = pick(VALAIS_CEPAGES, globalIndex);
      const cuvee = pick(CUVEE_NAMES, w + i);
      wineRows.push({
        wineryId: entry.wineryId,
        name: `${cepage.grape} ${cuvee}`,
        grapeVariety: cepage.grape,
        vintage: 2020 + ((w + i) % 5),
        price: cepage.basePrice + (globalIndex % 4) * 150,
        // A few wines are sold out (every 15th wine)
        available: (globalIndex + 1) % 15 !== 0,
      });
    }
  }
  const winesCreated = await prisma.wine.createMany({ data: wineRows });
  console.log(
    `   ✅ ${winesCreated.count} wines created (${wineRows.filter((wine) => wine.available === false).length} unavailable)`
  );

  // -------------------------------------------------------------------
  // 6. EXPERIENCE OCCURRENCES (next 14 days, matching availability slots)
  // -------------------------------------------------------------------
  console.log('\n🗓️  Creating experience occurrences...');
  const germanierTastingId = required(
    wineryBySlug('domaine-germanier').experienceIds[0],
    'Germanier tasting experience'
  );
  const rhodanTourId = required(
    wineryBySlug('cave-du-rhodan').experienceIds[0],
    'Rhodan vineyard tour experience'
  );
  const finBecRacletteId = required(
    wineryBySlug('cave-fin-bec').experienceIds[1],
    'Fin Bec raclette experience'
  );

  const fridays = nextDatesForDay(5, 14);
  const saturdays = nextDatesForDay(6, 14);
  const sundays = nextDatesForDay(0, 14);

  const occurrenceRows: Prisma.ExperienceOccurrenceCreateManyInput[] = [];

  // Germanier tasting: Fri + Sat at 10:00 and 14:00 (8 occurrences).
  // The first Saturday afternoon has a reduced capacity (private group).
  const firstSaturday = pick(saturdays, 0);
  for (const date of [...fridays, ...saturdays]) {
    for (const startTime of ['10:00', '14:00']) {
      occurrenceRows.push({
        experienceId: germanierTastingId,
        date,
        startTime,
        capacityOverride:
          date.getTime() === firstSaturday.getTime() && startTime === '14:00'
            ? 8
            : null,
      });
    }
  }

  // Rhodan vineyard tour: Saturday mornings (2 occurrences).
  for (const date of saturdays) {
    occurrenceRows.push({
      experienceId: rhodanTourId,
      date,
      startTime: '10:00',
    });
  }

  // Fin Bec raclette: Sunday afternoons (2), the second closed by the winery.
  sundays.forEach((date, index) => {
    occurrenceRows.push({
      experienceId: finBecRacletteId,
      date,
      startTime: '14:00',
      status: index === 1 ? 'CLOSED' : 'OPEN',
    });
  });

  const occurrencesCreated = await prisma.experienceOccurrence.createMany({
    data: occurrenceRows,
  });
  console.log(
    `   ✅ ${occurrencesCreated.count} occurrences created (1 capacity override, 1 closed)`
  );

  // -------------------------------------------------------------------
  // 7. SAMPLE BOOKINGS (show full lifecycle)
  // -------------------------------------------------------------------
  console.log('\n📅 Creating sample bookings...');

  // Default platform rate (mirrors the PLATFORM_COMMISSION_RATE env var);
  // FOUNDER wineries carry commissionRate 0 on their record instead.
  const DEFAULT_COMMISSION_RATE = Number(
    process.env.PLATFORM_COMMISSION_RATE ?? '0.12'
  );
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

  const createdBookingIds: string[] = [];

  for (let i = 0; i < bookingsData.length; i++) {
    const b = required(bookingsData[i], `bookingsData[${i}]`);
    const { wineryId, experienceIds } = required(
      createdWineries[b.wineryIdx],
      `createdWineries[${b.wineryIdx}]`
    );
    const experienceId = required(
      experienceIds[b.experienceIdx],
      `experienceIds[${b.experienceIdx}]`
    );

    // Look up price from the experience
    const experience = await prisma.experience.findUnique({
      where: { id: experienceId },
    });
    if (!experience) continue;

    const wineryRecord = await prisma.winery.findUnique({
      where: { id: wineryId },
    });
    if (!wineryRecord) continue;

    const totalPrice = experience.price * b.guestCount;
    // Use the winery's own rate so FOUNDER (0%) bookings don't show a
    // 12% fee on the P-03 earnings screens.
    const rate = wineryRecord.commissionRate ?? DEFAULT_COMMISSION_RATE;
    const platformFee = Math.round(totalPrice * rate);
    const wineryPayout = totalPrice - platformFee;

    const booking = await prisma.booking.create({
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

    createdBookingIds.push(booking.id);

    console.log(
      `   📋 ${b.visitorName} → ${experience.title} (${b.status}, ${b.guestCount} guests, ${totalPrice / 100} CHF)`
    );
  }

  // -------------------------------------------------------------------
  // 8. TASTING SHEET (US-230) — wines served on a completed booking
  // -------------------------------------------------------------------
  console.log('\n📝 Creating tasting sheet (wines served)...');
  const completedMusesBookingId = required(
    createdBookingIds[2],
    'completed Muses booking'
  );
  const servedWines = await prisma.wine.findMany({
    where: {
      wineryId: wineryBySlug('domaine-des-muses').wineryId,
      available: true,
    },
    orderBy: { name: 'asc' },
    take: 3,
  });
  await prisma.bookingWine.createMany({
    data: servedWines.map((wine) => ({
      bookingId: completedMusesBookingId,
      wineId: wine.id,
    })),
  });
  console.log(
    `   ✅ ${servedWines.length} wines checked on the completed Muses booking`
  );

  // -------------------------------------------------------------------
  // 9. GIFT CARDS (US-210) — every movement has its ledger row; the sum
  //    of a card's transactions always equals its materialized balance.
  // -------------------------------------------------------------------
  console.log('\n🎁 Creating gift cards...');

  // 1) Active, full balance
  const giftCard1 = await prisma.giftCard.create({
    data: {
      code: 'ENCV-K4M2-P7RD',
      status: 'ACTIVE',
      initialAmount: 10000,
      balance: 10000,
      purchaserEmail: ACCOUNTS.client1.email,
      purchaserName: ACCOUNTS.client1.name,
      recipientEmail: 'marc.dupont@example.com',
      recipientName: 'Marc Dupont',
      message:
        'Joyeux anniversaire Marc ! Offre-toi une belle dégustation en Valais.',
      deliveredAt: new Date(),
      expiresAt: yearsFromNow(5),
      stripePaymentIntentId: 'pi_test_seed_giftcard_1',
      transactions: {
        create: [
          {
            type: 'PURCHASE',
            amount: 10000,
            note: 'Achat en ligne — carte cadeau 100 CHF',
          },
        ],
      },
    },
  });
  console.log(`   💳 ${giftCard1.code} — 100.00 CHF (full balance)`);

  // 2) Partially redeemed: PURCHASE + negative REDEMPTION summing to balance
  const giftCard2 = await prisma.giftCard.create({
    data: {
      code: 'ENCV-W8XQ-4TZN',
      status: 'ACTIVE',
      initialAmount: 15000,
      balance: 9000,
      purchaserEmail: ACCOUNTS.client2.email,
      purchaserName: ACCOUNTS.client2.name,
      recipientEmail: 'sophie.favre@example.com',
      recipientName: 'Sophie Favre',
      message: 'Pour découvrir les caves du Valais ensemble !',
      deliveredAt: daysFromNow(-30),
      expiresAt: yearsFromNow(5),
      stripePaymentIntentId: 'pi_test_seed_giftcard_2',
      transactions: {
        create: [
          {
            type: 'PURCHASE',
            amount: 15000,
            note: 'Achat en ligne — carte cadeau 150 CHF',
            createdAt: daysFromNow(-30),
          },
          {
            type: 'REDEMPTION',
            amount: -6000,
            bookingId: createdBookingIds[3] ?? null,
            note: "Rachat partiel lors du paiement d'une réservation",
            createdAt: daysFromNow(-10),
          },
        ],
      },
    },
  });
  console.log(
    `   💳 ${giftCard2.code} — 90.00 / 150.00 CHF (partially redeemed)`
  );

  // 3) Scheduled delivery in the future (deliverAt set, not delivered yet)
  const giftCard3DeliverAt = daysFromNow(10);
  const giftCard3 = await prisma.giftCard.create({
    data: {
      code: 'ENCV-J6VB-9HSL',
      status: 'ACTIVE',
      initialAmount: 5000,
      balance: 5000,
      purchaserEmail: ACCOUNTS.client2.email,
      purchaserName: ACCOUNTS.client2.name,
      recipientEmail: 'nadia.roux@example.com',
      recipientName: 'Nadia Roux',
      message: 'Pour tes 30 ans — rendez-vous dans les vignes !',
      deliverAt: giftCard3DeliverAt,
      expiresAt: yearsFromNow(5),
      stripePaymentIntentId: 'pi_test_seed_giftcard_3',
      transactions: {
        create: [
          {
            type: 'PURCHASE',
            amount: 5000,
            note: 'Achat en ligne — carte cadeau 50 CHF (envoi programmé)',
          },
        ],
      },
    },
  });
  console.log(
    `   💳 ${giftCard3.code} — 50.00 CHF (scheduled delivery in 10 days)`
  );

  // -------------------------------------------------------------------
  // 10. SUR-MESURE REQUESTS (US-240) — PENDING / OFFERED / PAID
  // -------------------------------------------------------------------
  console.log('\n📨 Creating sur-mesure requests...');

  // 1) PENDING, no winery ("laissez EnCave proposer")
  const requestPending = await prisma.request.create({
    data: {
      reference: 'REQ-A7K2M9QX',
      status: 'PENDING',
      wineryId: null,
      clientEmail: ACCOUNTS.client2.email,
      clientName: ACCOUNTS.client2.name,
      clientPhone: '+41 78 987 65 43',
      desiredDate: daysFromNow(45),
      guestCount: 12,
      budget: 150000,
      description:
        "Sortie d'entreprise pour notre équipe de 12 personnes : dégustation suivie d'un repas typique, idéalement un vendredi après-midi dans le Valais central. Nous n'avons pas de cave en tête — laissez EnCave nous proposer le bon domaine.",
    },
  });
  console.log(`   📄 ${requestPending.reference} — PENDING (no winery)`);

  // 2) OFFERED, with a SENT offer expiring in 48h
  const requestOffered = await prisma.request.create({
    data: {
      reference: 'REQ-B3TR8WLD',
      status: 'OFFERED',
      wineryId: wineryBySlug('domaine-des-muses').wineryId,
      clientEmail: ACCOUNTS.client1.email,
      clientName: ACCOUNTS.client1.name,
      clientPhone: '+41 79 123 45 67',
      desiredDate: daysFromNow(21),
      guestCount: 8,
      budget: 80000,
      description:
        'Enterrement de vie de jeune fille pour ma meilleure amie : dégustation privée, ambiance détendue, si possible avec un atelier ou une activité dans les vignes puis un apéritif dînatoire.',
    },
  });
  const offerSent = await prisma.requestOffer.create({
    data: {
      requestId: requestOffered.id,
      status: 'SENT',
      message:
        "Nous serions ravis de vous accueillir ! Proposition : balade privée dans nos parcelles en biodynamie, atelier dégustation à l'aveugle puis apéritif valaisan au caveau (3h30 au total). Prix pour 8 personnes, vins compris.",
      totalPrice: 76000,
      expiresAt: hoursFromNow(48),
    },
  });
  console.log(
    `   📄 ${requestOffered.reference} — OFFERED (offer 760 CHF, expires in 48h)`
  );

  // 3) PAID, with its offer PAID
  const requestPaid = await prisma.request.create({
    data: {
      reference: 'REQ-C9NF4JZS',
      status: 'PAID',
      wineryId: wineryBySlug('domaine-germanier').wineryId,
      clientEmail: 'julie.perret@example.com',
      clientName: 'Julie Perret',
      clientPhone: '+41 76 512 33 90',
      desiredDate: daysFromNow(9),
      guestCount: 6,
      budget: 60000,
      description:
        "Anniversaire de mariage de mes parents : dégustation des grands crus suivie d'un repas au domaine pour 6 personnes.",
    },
  });
  await prisma.requestOffer.create({
    data: {
      requestId: requestPaid.id,
      status: 'PAID',
      message:
        'Avec plaisir ! Nous vous proposons notre dégustation Grands Crus suivie de la Table du Vigneron en formule privée. Prix total pour 6 personnes, accord mets-vins inclus.',
      totalPrice: 57000,
      expiresAt: hoursFromNow(-12),
      stripeCheckoutSessionId: 'cs_test_seed_request_offer',
    },
  });
  console.log(`   📄 ${requestPaid.reference} — PAID (offer 570 CHF paid)`);

  // -------------------------------------------------------------------
  // 11. SCHEDULED JOBS (Vercel Cron consumers, P-03+)
  // -------------------------------------------------------------------
  console.log('\n⏰ Creating scheduled jobs...');
  await prisma.scheduledJob.createMany({
    data: [
      {
        type: 'GIFT_CARD_DELIVERY',
        runAt: giftCard3DeliverAt,
        status: 'PENDING',
        payload: { giftCardId: giftCard3.id },
        dedupeKey: `GIFT_CARD_DELIVERY:${giftCard3.id}`,
      },
      {
        type: 'REQUEST_OFFER_REMINDER',
        runAt: hoursFromNow(24),
        status: 'PENDING',
        payload: { requestOfferId: offerSent.id, requestId: requestOffered.id },
        dedupeKey: `REQUEST_OFFER_REMINDER:${offerSent.id}`,
      },
    ],
  });
  console.log(
    '   ✅ 2 scheduled jobs created (gift-card delivery, offer reminder)'
  );

  // -------------------------------------------------------------------
  // 12. NEWSLETTER SUBSCRIPTIONS (demo data)
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
  const counts = {
    wineries: await prisma.winery.count(),
    experiences: await prisma.experience.count(),
    eventParticipants: await prisma.eventParticipant.count(),
    wines: await prisma.wine.count(),
    occurrences: await prisma.experienceOccurrence.count(),
    bookings: await prisma.booking.count(),
    bookingWines: await prisma.bookingWine.count(),
    giftCards: await prisma.giftCard.count(),
    giftCardTransactions: await prisma.giftCardTransaction.count(),
    requests: await prisma.request.count(),
    requestOffers: await prisma.requestOffer.count(),
    scheduledJobs: await prisma.scheduledJob.count(),
  };

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
  console.log(
    `   🔑 WINEMAKERS (all same password: ${ACCOUNTS.winemakers[0].password})`
  );
  for (const wm of ACCOUNTS.winemakers) {
    console.log(`      Email:    ${wm.email}  (${wm.winery.name})`);
  }
  console.log('');
  console.log('📊 DATA SUMMARY:');
  console.log('─'.repeat(60));
  console.log(
    `   1 admin, 2 clients, ${ACCOUNTS.winemakers.length} winemakers`
  );
  console.log(
    `   ${counts.wineries} verified wineries (Valais) — 3 FOUNDER (0% commission), 4 with no-show fee`
  );
  console.log(
    `   ${counts.experiences} published experiences (7 types, 1 collective event, ${counts.eventParticipants} participants)`
  );
  console.log(`   ${counts.wines} wines (Valais cépages)`);
  console.log(
    `   ${counts.occurrences} persisted occurrences (next 14 days, 1 capacity override, 1 closed)`
  );
  console.log(
    `   ${counts.bookings} sample bookings (2 upcoming, 2 completed, 1 cancelled) + ${counts.bookingWines} tasting-sheet wines`
  );
  console.log(
    `   ${counts.giftCards} gift cards (${counts.giftCardTransactions} ledger transactions)`
  );
  console.log(
    `   ${counts.requests} sur-mesure requests (${counts.requestOffers} offers)`
  );
  console.log(`   ${counts.scheduledJobs} scheduled jobs`);
  console.log(
    `   ${counts.wineries} verification logs, ${counts.wineries} notification preference sets`
  );
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
