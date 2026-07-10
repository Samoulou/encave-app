import type { Locale } from '@prisma/client';

// Email subject lines
export const subjects = {
  tastingRecap: {
    FR: 'Vos coups de cœur chez {wineryName}',
    DE: 'Ihre Favoriten bei {wineryName}',
    EN: 'Your favourites at {wineryName}',
  },
  tastingSheetReminder: {
    FR: 'Fiche dégustation à remplir',
    DE: 'Degustationsblatt auszufüllen',
    EN: 'Tasting sheet to fill in',
  },
  wineOrderRequestWinery: {
    FR: 'Nouvelle demande de commande — {clientName}',
    DE: 'Neue Bestellanfrage — {clientName}',
    EN: 'New order request — {clientName}',
  },
  wineOrderRequestClient: {
    FR: 'Votre demande de commande chez {wineryName}',
    DE: 'Ihre Bestellanfrage bei {wineryName}',
    EN: 'Your order request at {wineryName}',
  },
  bookingConfirmation: {
    FR: 'Confirmation de votre reservation',
    DE: 'Bestatigung Ihrer Reservierung',
    EN: 'Your booking confirmation',
  },
  bookingReminder: {
    FR: 'Rappel: votre experience approche',
    DE: 'Erinnerung: Ihr Erlebnis steht bevor',
    EN: 'Reminder: your experience is coming up',
  },
  bookingCancellation: {
    FR: 'Annulation de votre reservation',
    DE: 'Stornierung Ihrer Reservierung',
    EN: 'Your booking cancellation',
  },
  bookingCancelledByWinery: {
    FR: '{winemakerName} a dû annuler votre expérience',
    DE: '{winemakerName} musste Ihr Erlebnis absagen',
    EN: '{winemakerName} had to cancel your experience',
  },
  bookingExpired: {
    FR: 'Votre réservation EnCave a expiré',
    DE: 'Ihre EnCave-Reservierung ist abgelaufen',
    EN: 'Your EnCave booking has expired',
  },
  manualRefundClient: {
    FR: 'Votre réservation EnCave a été remboursée',
    DE: 'Ihre EnCave-Reservierung wurde erstattet',
    EN: 'Your EnCave booking has been refunded',
  },
  manualRefundWinemaker: {
    FR: 'Une réservation a été remboursée par EnCave',
    DE: 'Eine Reservierung wurde von EnCave erstattet',
    EN: 'A booking has been refunded by EnCave',
  },
  accountDeleted: {
    FR: 'Votre compte EnCave a été supprimé',
    DE: 'Ihr EnCave-Konto wurde gelöscht',
    EN: 'Your EnCave account has been deleted',
  },
  wineryNewBooking: {
    FR: 'Nouvelle reservation recue',
    DE: 'Neue Reservierung erhalten',
    EN: 'New booking received',
  },
  wineryCancellation: {
    FR: 'Reservation annulee',
    DE: 'Reservierung storniert',
    EN: 'Booking cancelled',
  },
  wineryApproved: {
    FR: 'Votre domaine a ete verifie!',
    DE: 'Ihr Weingut wurde verifiziert!',
    EN: 'Your winery has been verified!',
  },
  wineryRejected: {
    FR: 'Mise a jour de votre inscription',
    DE: 'Aktualisierung Ihrer Registrierung',
    EN: 'Registration update',
  },
  passwordReset: {
    FR: 'Reinitialisation de votre mot de passe',
    DE: 'Zurucksetzung Ihres Passworts',
    EN: 'Reset your password',
  },
  welcome: {
    FR: 'Bienvenue sur EnCave!',
    DE: 'Willkommen bei EnCave!',
    EN: 'Welcome to EnCave!',
  },
  emailVerification: {
    FR: 'Verifiez votre adresse e-mail',
    DE: 'Verifizieren Sie Ihre E-Mail-Adresse',
    EN: 'Verify your email address',
  },
  reminder2h: {
    FR: 'Votre experience commence bientot!',
    DE: 'Ihr Erlebnis beginnt bald!',
    EN: 'Your experience starts soon!',
  },
  dailyDigest: {
    FR: 'Vos reservations du jour',
    DE: 'Ihre heutigen Buchungen',
    EN: "Today's bookings",
  },
  postExperience: {
    FR: 'Merci pour votre visite!',
    DE: 'Danke fur Ihren Besuch!',
    EN: 'Thank you for your visit!',
  },
  weeklySummary: {
    FR: 'Votre resume hebdomadaire',
    DE: 'Ihre wochentliche Zusammenfassung',
    EN: 'Your weekly summary',
  },
  stripeActionRequired: {
    FR: 'Action requise : votre compte Stripe a besoin de vous',
    DE: 'Handlungsbedarf: Ihr Stripe-Konto braucht Sie',
    EN: 'Action required: your Stripe account needs you',
  },
} as const;

// Common email strings
export const common = {
  greeting: {
    FR: 'Bonjour',
    DE: 'Guten Tag',
    EN: 'Hello',
  },
  regards: {
    FR: 'Cordialement',
    DE: 'Mit freundlichen Grussen',
    EN: 'Best regards',
  },
  team: {
    FR: "L'équipe EnCave",
    DE: 'Das EnCave-Team',
    EN: 'The EnCave Team',
  },
  questions: {
    FR: "Si vous avez des questions, n'hesitez pas a contacter notre equipe.",
    DE: 'Bei Fragen wenden Sie sich bitte an unser Team.',
    EN: "If you have any questions, please don't hesitate to contact our team.",
  },
  date: {
    FR: 'Date',
    DE: 'Datum',
    EN: 'Date',
  },
  time: {
    FR: 'Heure',
    DE: 'Zeit',
    EN: 'Time',
  },
  guests: {
    FR: 'Nombre de personnes',
    DE: 'Anzahl Personen',
    EN: 'Number of guests',
  },
  price: {
    FR: 'Prix',
    DE: 'Preis',
    EN: 'Price',
  },
  experience: {
    FR: 'Experience',
    DE: 'Erlebnis',
    EN: 'Experience',
  },
  winery: {
    FR: 'Domaine',
    DE: 'Weingut',
    EN: 'Winery',
  },
  duration: {
    FR: 'Duree',
    DE: 'Dauer',
    EN: 'Duration',
  },
} as const;

// Booking confirmation email strings
export const bookingConfirmation = {
  title: {
    FR: 'Reservation confirmee!',
    DE: 'Reservierung bestatigt!',
    EN: 'Booking confirmed!',
  },
  intro: {
    FR: 'Votre reservation a ete confirmee avec succes.',
    DE: 'Ihre Reservierung wurde erfolgreich bestatigt.',
    EN: 'Your booking has been successfully confirmed.',
  },
  details: {
    FR: 'Details de votre reservation',
    DE: 'Details Ihrer Reservierung',
    EN: 'Your booking details',
  },
  bookingRef: {
    FR: 'Reference de reservation',
    DE: 'Buchungsreferenz',
    EN: 'Booking reference',
  },
  viewBooking: {
    FR: 'Voir ma reservation',
    DE: 'Meine Reservierung ansehen',
    EN: 'View my booking',
  },
  lookingForward: {
    FR: 'Nous avons hate de vous accueillir!',
    DE: 'Wir freuen uns auf Sie!',
    EN: 'We look forward to welcoming you!',
  },
} as const;

// Booking reminder email strings
export const bookingReminder = {
  title: {
    FR: 'Votre experience approche!',
    DE: 'Ihr Erlebnis steht bevor!',
    EN: 'Your experience is coming up!',
  },
  intro: {
    FR: 'Nous vous rappelons votre reservation a venir.',
    DE: 'Wir erinnern Sie an Ihre bevorstehende Reservierung.',
    EN: 'This is a reminder about your upcoming booking.',
  },
  tomorrow: {
    FR: "C'est demain!",
    DE: 'Es ist morgen!',
    EN: "It's tomorrow!",
  },
  directions: {
    FR: 'Voir les indications',
    DE: 'Wegbeschreibung anzeigen',
    EN: 'Get directions',
  },
} as const;

// Booking cancellation email strings
export const bookingCancellation = {
  title: {
    FR: 'Reservation annulee',
    DE: 'Reservierung storniert',
    EN: 'Booking cancelled',
  },
  intro: {
    FR: 'Votre reservation a ete annulee.',
    DE: 'Ihre Reservierung wurde storniert.',
    EN: 'Your booking has been cancelled.',
  },
  refund: {
    FR: 'Si vous avez deja paye, votre remboursement sera traite sous 5-7 jours ouvrables.',
    DE: 'Falls Sie bereits bezahlt haben, wird Ihre Ruckerstattung innerhalb von 5-7 Werktagen bearbeitet.',
    EN: 'If you have already paid, your refund will be processed within 5-7 business days.',
  },
  // {amount} is replaced with the exact refunded amount (policy-based).
  refundExact: {
    FR: 'Un remboursement de {amount} sera credite sur votre moyen de paiement sous 5-7 jours ouvrables.',
    DE: 'Eine Ruckerstattung von {amount} wird Ihrem Zahlungsmittel innerhalb von 5-7 Werktagen gutgeschrieben.',
    EN: 'A refund of {amount} will be credited to your payment method within 5-7 business days.',
  },
  noRefund: {
    FR: "Conformement a la politique d'annulation de la cave, cette annulation ne donne pas droit a un remboursement.",
    DE: 'Gemass den Stornierungsbedingungen des Weinguts besteht kein Anspruch auf Ruckerstattung.',
    EN: "Per the winery's cancellation policy, this cancellation is not eligible for a refund.",
  },
  browseMore: {
    FR: "Decouvrir d'autres experiences",
    DE: 'Weitere Erlebnisse entdecken',
    EN: 'Browse more experiences',
  },
} as const;

// Winemaker notification strings
export const winemakerNotification = {
  newBooking: {
    title: {
      FR: 'Nouvelle reservation!',
      DE: 'Neue Reservierung!',
      EN: 'New booking!',
    },
    intro: {
      FR: 'Vous avez recu une nouvelle reservation pour votre experience.',
      DE: 'Sie haben eine neue Reservierung fur Ihr Erlebnis erhalten.',
      EN: 'You have received a new booking for your experience.',
    },
    guestInfo: {
      FR: 'Informations du client',
      DE: 'Gastinformationen',
      EN: 'Guest information',
    },
    guestName: {
      FR: 'Nom',
      DE: 'Name',
      EN: 'Name',
    },
    guestEmail: {
      FR: 'E-mail',
      DE: 'E-Mail',
      EN: 'Email',
    },
    viewDashboard: {
      FR: 'Voir dans le tableau de bord',
      DE: 'Im Dashboard anzeigen',
      EN: 'View in dashboard',
    },
  },
  cancellation: {
    title: {
      FR: 'Reservation annulee',
      DE: 'Reservierung storniert',
      EN: 'Booking cancelled',
    },
    intro: {
      FR: 'Une reservation pour votre experience a ete annulee.',
      DE: 'Eine Reservierung fur Ihr Erlebnis wurde storniert.',
      EN: 'A booking for your experience has been cancelled.',
    },
  },
} as const;

// Winery verification strings
export const wineryVerification = {
  approved: {
    title: {
      FR: 'Bienvenue sur EnCave!',
      DE: 'Willkommen bei EnCave!',
      EN: 'Welcome to EnCave!',
    },
    intro: {
      FR: 'Excellente nouvelle! Votre domaine a ete verifie et est maintenant actif sur la plateforme EnCave.',
      DE: 'Grossartige Neuigkeiten! Ihr Weingut wurde verifiziert und ist jetzt auf der EnCave-Plattform aktiv.',
      EN: 'Great news! Your winery has been verified and is now active on the EnCave platform.',
    },
    canNow: {
      FR: 'Vous pouvez maintenant:',
      DE: 'Sie konnen jetzt:',
      EN: 'You can now:',
    },
    actions: {
      FR: [
        'Completer votre profil avec des photos et descriptions',
        'Creer des experiences de degustation pour vos clients',
        'Gerer votre calendrier de disponibilites',
        'Recevoir et gerer les reservations',
      ],
      DE: [
        'Ihr Profil mit Fotos und Beschreibungen vervollstandigen',
        'Verkostungserlebnisse fur Ihre Gaste erstellen',
        'Ihren Verfugbarkeitskalender verwalten',
        'Reservierungen empfangen und verwalten',
      ],
      EN: [
        'Complete your profile with photos and descriptions',
        'Create wine tasting experiences for guests to book',
        'Manage your availability calendar',
        'Receive and manage bookings',
      ],
    },
    goToDashboard: {
      FR: 'Acceder au tableau de bord',
      DE: 'Zum Dashboard gehen',
      EN: 'Go to Dashboard',
    },
  },
  rejected: {
    title: {
      FR: 'Mise a jour de votre inscription',
      DE: 'Aktualisierung Ihrer Registrierung',
      EN: 'Registration Update',
    },
    intro: {
      FR: "Merci de votre interet pour rejoindre la plateforme EnCave. Apres examen de votre inscription, nous ne pouvons malheureusement pas l'approuver pour le moment.",
      DE: 'Vielen Dank fur Ihr Interesse an der EnCave-Plattform. Nach Prufung Ihrer Registrierung konnen wir diese leider derzeit nicht genehmigen.',
      EN: 'Thank you for your interest in joining the EnCave platform. After reviewing your registration, we regret to inform you that we are unable to approve it at this time.',
    },
    reason: {
      FR: 'Motif',
      DE: 'Grund',
      EN: 'Reason',
    },
    appeal: {
      FR: "Si vous pensez que cette decision est une erreur ou si vous souhaitez fournir des informations supplementaires, veuillez contacter notre equipe d'assistance.",
      DE: 'Wenn Sie glauben, dass diese Entscheidung ein Fehler war oder zusatzliche Informationen bereitstellen mochten, wenden Sie sich bitte an unser Support-Team.',
      EN: 'If you believe this decision was made in error or would like to provide additional information, please contact our support team.',
    },
    resubmit: {
      FR: 'Vous pouvez soumettre une nouvelle inscription une fois que vous avez traite les points mentionnes ci-dessus.',
      DE: 'Sie konnen gerne eine neue Registrierung einreichen, sobald Sie die oben genannten Punkte bearbeitet haben.',
      EN: 'You are welcome to submit a new registration once you have addressed the concerns mentioned above.',
    },
  },
} as const;

// Authentication email strings
export const auth = {
  passwordReset: {
    title: {
      FR: 'Reinitialisation du mot de passe',
      DE: 'Passwort zurucksetzen',
      EN: 'Reset your password',
    },
    intro: {
      FR: 'Vous avez demande la reinitialisation de votre mot de passe.',
      DE: 'Sie haben eine Zurucksetzung Ihres Passworts angefordert.',
      EN: 'You requested to reset your password.',
    },
    button: {
      FR: 'Reinitialiser le mot de passe',
      DE: 'Passwort zurucksetzen',
      EN: 'Reset password',
    },
    expiry: {
      FR: 'Ce lien expire dans 1 heure.',
      DE: 'Dieser Link lauft in 1 Stunde ab.',
      EN: 'This link expires in 1 hour.',
    },
    ignore: {
      FR: "Si vous n'avez pas fait cette demande, vous pouvez ignorer cet e-mail.",
      DE: 'Wenn Sie diese Anfrage nicht gestellt haben, konnen Sie diese E-Mail ignorieren.',
      EN: "If you didn't make this request, you can safely ignore this email.",
    },
  },
  welcome: {
    title: {
      FR: 'Bienvenue sur EnCave!',
      DE: 'Willkommen bei EnCave!',
      EN: 'Welcome to EnCave!',
    },
    intro: {
      FR: 'Merci de vous etre inscrit sur EnCave.',
      DE: 'Vielen Dank fur Ihre Anmeldung bei EnCave.',
      EN: 'Thank you for signing up with EnCave.',
    },
    discover: {
      FR: 'Decouvrez des experiences de degustation uniques directement aupres des vignerons suisses.',
      DE: 'Entdecken Sie einzigartige Verkostungserlebnisse direkt bei Schweizer Winzern.',
      EN: 'Discover unique wine tasting experiences directly with Swiss winemakers.',
    },
    explore: {
      FR: 'Explorer les experiences',
      DE: 'Erlebnisse entdecken',
      EN: 'Explore experiences',
    },
  },
  verification: {
    title: {
      FR: 'Verifiez votre adresse e-mail',
      DE: 'Verifizieren Sie Ihre E-Mail-Adresse',
      EN: 'Verify your email address',
    },
    intro: {
      FR: 'Veuillez cliquer sur le bouton ci-dessous pour verifier votre adresse e-mail.',
      DE: 'Bitte klicken Sie auf die Schaltflache unten, um Ihre E-Mail-Adresse zu verifizieren.',
      EN: 'Please click the button below to verify your email address.',
    },
    button: {
      FR: "Verifier l'e-mail",
      DE: 'E-Mail verifizieren',
      EN: 'Verify email',
    },
    expiry: {
      FR: 'Ce lien expire dans 24 heures.',
      DE: 'Dieser Link lauft in 24 Stunden ab.',
      EN: 'This link expires in 24 hours.',
    },
  },
} as const;

// Client 2h reminder email strings
export const clientReminder2h = {
  title: {
    FR: 'Votre experience commence bientot!',
    DE: 'Ihr Erlebnis beginnt bald!',
    EN: 'Your experience starts soon!',
  },
  intro: {
    FR: 'Votre experience de degustation commence dans moins de 2 heures.',
    DE: 'Ihr Verkostungserlebnis beginnt in weniger als 2 Stunden.',
    EN: 'Your wine tasting experience starts in less than 2 hours.',
  },
  startsSoon: {
    FR: 'Commence bientot',
    DE: 'Beginnt bald',
    EN: 'Starts soon',
  },
  directions: {
    FR: 'Voir les indications',
    DE: 'Wegbeschreibung anzeigen',
    EN: 'Get directions',
  },
  contact: {
    FR: 'Contact',
    DE: 'Kontakt',
    EN: 'Contact',
  },
} as const;

// Daily digest email strings
export const dailyDigest = {
  title: {
    FR: 'Vos reservations du jour',
    DE: 'Ihre heutigen Buchungen',
    EN: "Today's bookings",
  },
  intro: {
    FR: "Voici un apercu de vos reservations pour aujourd'hui et demain.",
    DE: 'Hier ist eine Ubersicht Ihrer Buchungen fur heute und morgen.',
    EN: "Here's an overview of your bookings for today and tomorrow.",
  },
  today: {
    FR: "Aujourd'hui",
    DE: 'Heute',
    EN: 'Today',
  },
  tomorrow: {
    FR: 'Demain',
    DE: 'Morgen',
    EN: 'Tomorrow',
  },
  noBookings: {
    FR: 'Aucune reservation',
    DE: 'Keine Buchungen',
    EN: 'No bookings',
  },
  guest: {
    FR: 'Client',
    DE: 'Gast',
    EN: 'Guest',
  },
  viewDashboard: {
    FR: 'Voir le tableau de bord',
    DE: 'Dashboard anzeigen',
    EN: 'View dashboard',
  },
} as const;

// Post-experience follow-up email strings
export const postExperience = {
  title: {
    FR: 'Merci pour votre visite!',
    DE: 'Danke fur Ihren Besuch!',
    EN: 'Thank you for your visit!',
  },
  intro: {
    FR: 'Nous esperons que vous avez passe un excellent moment lors de votre experience de degustation.',
    DE: 'Wir hoffen, dass Sie bei Ihrem Verkostungserlebnis eine tolle Zeit hatten.',
    EN: 'We hope you had a wonderful time at your wine tasting experience.',
  },
  visitedOn: {
    FR: 'Visite le',
    DE: 'Besucht am',
    EN: 'Visited on',
  },
  feedbackTitle: {
    FR: 'Votre avis compte',
    DE: 'Ihre Meinung zahlt',
    EN: 'Your feedback matters',
  },
  feedbackText: {
    FR: "Nous travaillons sur une fonctionnalite d'avis. En attendant, n'hesitez pas a contacter le domaine directement pour partager votre experience.",
    DE: 'Wir arbeiten an einer Bewertungsfunktion. In der Zwischenzeit konnen Sie das Weingut direkt kontaktieren, um Ihre Erfahrungen zu teilen.',
    EN: "We're working on a review feature. In the meantime, feel free to contact the winery directly to share your experience.",
  },
  discoverMore: {
    FR: "Envie de decouvrir d'autres experiences viticoles en Suisse?",
    DE: 'Mochten Sie weitere Weinerlebnisse in der Schweiz entdecken?',
    EN: 'Want to discover more wine experiences in Switzerland?',
  },
  discoverMoreCta: {
    FR: "Decouvrir plus d'experiences",
    DE: 'Mehr Erlebnisse entdecken',
    EN: 'Discover more experiences',
  },
} as const;

// Weekly summary email strings
export const weeklySummary = {
  title: {
    FR: 'Votre resume hebdomadaire',
    DE: 'Ihre wochentliche Zusammenfassung',
    EN: 'Your weekly summary',
  },
  intro: {
    FR: 'Voici un apercu de votre activite de la semaine derniere et des reservations a venir.',
    DE: 'Hier ist eine Ubersicht Ihrer Aktivitaten der letzten Woche und der kommenden Buchungen.',
    EN: "Here's an overview of your activity from last week and upcoming bookings.",
  },
  lastWeek: {
    FR: 'Semaine derniere',
    DE: 'Letzte Woche',
    EN: 'Last week',
  },
  thisWeek: {
    FR: 'Cette semaine',
    DE: 'Diese Woche',
    EN: 'This week',
  },
  bookings: {
    FR: 'Reservations',
    DE: 'Buchungen',
    EN: 'Bookings',
  },
  guests: {
    FR: 'Visiteurs',
    DE: 'Besucher',
    EN: 'Guests',
  },
  revenue: {
    FR: 'Revenus',
    DE: 'Einnahmen',
    EN: 'Revenue',
  },
  upcoming: {
    FR: 'Reservations a venir',
    DE: 'Kommende Buchungen',
    EN: 'Upcoming bookings',
  },
  noActivity: {
    FR: 'Aucune activite',
    DE: 'Keine Aktivitat',
    EN: 'No activity',
  },
  viewDashboard: {
    FR: 'Voir le tableau de bord',
    DE: 'Dashboard anzeigen',
    EN: 'View dashboard',
  },
  payoutsReceived: {
    FR: 'Virements reçus cette semaine',
    DE: 'Diese Woche erhaltene Auszahlungen',
    EN: 'Payouts received this week',
  },
  payoutsLine: {
    FR: '{amount} — {count} virement(s)',
    DE: '{amount} — {count} Auszahlung(en)',
    EN: '{amount} — {count} payout(s)',
  },
  downloadStatement: {
    FR: 'Télécharger le relevé de {month}',
    DE: 'Abrechnung {month} herunterladen',
    EN: 'Download the {month} statement',
  },
} as const;

// Booking cancelled by winery email strings
export const bookingCancelledByWinery = {
  title: {
    FR: 'Votre encaveur a dû annuler',
    DE: 'Ihr Winzer musste absagen',
    EN: 'Your winemaker had to cancel',
  },
  intro: {
    FR: 'Nous sommes désolés : {winemakerName} a dû annuler la session "{experienceTitle}" prévue le {date}.',
    DE: 'Es tut uns leid: {winemakerName} musste die Session "{experienceTitle}" vom {date} absagen.',
    EN: 'We are sorry: {winemakerName} had to cancel the session "{experienceTitle}" scheduled for {date}.',
  },
  reason: {
    FR: 'Motif communiqué : "{reason}"',
    DE: 'Angegebener Grund: "{reason}"',
    EN: 'Reason given: "{reason}"',
  },
  refund: {
    FR: 'Vous êtes intégralement remboursé. Le montant de {amount} sera crédité sur votre moyen de paiement sous 5 à 10 jours ouvrés selon votre banque.',
    DE: 'Sie erhalten den vollen Betrag zurück. Der Betrag von {amount} wird Ihrem Zahlungsmittel je nach Bank innerhalb von 5 bis 10 Werktagen gutgeschrieben.',
    EN: 'You will receive a full refund. The amount of {amount} will be credited to your payment method within 5 to 10 business days, depending on your bank.',
  },
  browseMore: {
    FR: "Découvrir d'autres expériences",
    DE: 'Weitere Erlebnisse entdecken',
    EN: 'Browse more experiences',
  },
  apology: {
    FR: 'Avec nos excuses,',
    DE: 'Mit unserer Entschuldigung,',
    EN: 'With our apologies,',
  },
} as const;

// Booking expired email strings
export const bookingExpired = {
  title: {
    FR: 'Votre réservation a expiré',
    DE: 'Ihre Reservierung ist abgelaufen',
    EN: 'Your booking has expired',
  },
  intro: {
    FR: "Votre paiement n'a pas été finalisé dans les 30 minutes. Votre réservation pour {experienceTitle} le {date} a été annulée et votre place remise en disponibilité. Aucun montant n'a été débité.",
    DE: 'Ihre Zahlung wurde nicht innerhalb von 30 Minuten abgeschlossen. Ihre Reservierung für {experienceTitle} am {date} wurde storniert und Ihr Platz wieder freigegeben. Es wurde kein Betrag abgebucht.',
    EN: 'Your payment was not completed within 30 minutes. Your booking for {experienceTitle} on {date} has been cancelled and your spot released. No amount has been charged.',
  },
  cta: {
    FR: "Retrouver l'expérience",
    DE: 'Zum Erlebnis zurückkehren',
    EN: 'Back to the experience',
  },
  signoff: {
    FR: 'À très vite chez nos encaveurs,',
    DE: 'Bis bald bei unseren Winzern,',
    EN: 'See you soon at our winemakers,',
  },
} as const;

// Manual refund email strings (admin-triggered refunds)
export const manualRefund = {
  client: {
    title: {
      FR: 'Votre remboursement est en route',
      DE: 'Ihre Rückerstattung ist unterwegs',
      EN: 'Your refund is on its way',
    },
    intro: {
      FR: 'Nous vous confirmons le remboursement de {amount} pour votre réservation {reference} ({experienceTitle}).',
      DE: 'Wir bestätigen Ihnen die Rückerstattung von {amount} für Ihre Reservierung {reference} ({experienceTitle}).',
      EN: 'We confirm the refund of {amount} for your booking {reference} ({experienceTitle}).',
    },
    timing: {
      FR: 'Les fonds réapparaîtront sur votre moyen de paiement sous 5 à 10 jours ouvrés selon votre banque.',
      DE: 'Der Betrag wird Ihrem Zahlungsmittel je nach Bank innerhalb von 5 bis 10 Werktagen wieder gutgeschrieben.',
      EN: 'The funds will reappear on your payment method within 5 to 10 business days, depending on your bank.',
    },
  },
  winemaker: {
    title: {
      FR: 'Une réservation a été remboursée par EnCave',
      DE: 'Eine Reservierung wurde von EnCave erstattet',
      EN: 'A booking has been refunded by EnCave',
    },
    intro: {
      FR: "L'équipe EnCave a procédé au remboursement de la réservation {reference} ({experienceTitle}, le {date}) pour un montant de {amount}.",
      DE: 'Das EnCave-Team hat die Reservierung {reference} ({experienceTitle}, am {date}) in Höhe von {amount} erstattet.',
      EN: 'The EnCave team has refunded booking {reference} ({experienceTitle}, on {date}) for an amount of {amount}.',
    },
    reason: {
      FR: 'Motif communiqué : {reason}.',
      DE: 'Angegebener Grund: {reason}.',
      EN: 'Reason given: {reason}.',
    },
    deduction: {
      FR: 'Ce montant est automatiquement déduit de votre prochain reversement Stripe Connect.',
      DE: 'Dieser Betrag wird automatisch von Ihrer nächsten Stripe-Connect-Auszahlung abgezogen.',
      EN: 'This amount is automatically deducted from your next Stripe Connect payout.',
    },
  },
} as const;

// Account deleted email strings (nLPD)
export const accountDeleted = {
  title: {
    FR: 'Votre compte a été supprimé',
    DE: 'Ihr Konto wurde gelöscht',
    EN: 'Your account has been deleted',
  },
  intro: {
    FR: 'Bonjour, nous vous confirmons la suppression de votre compte EnCave en date du {date}. Vos données personnelles ont été effacées de notre plateforme.',
    DE: 'Guten Tag, wir bestätigen Ihnen die Löschung Ihres EnCave-Kontos per {date}. Ihre persönlichen Daten wurden von unserer Plattform entfernt.',
    EN: 'Hello, we confirm the deletion of your EnCave account as of {date}. Your personal data has been erased from our platform.',
  },
  retention: {
    FR: "Conformément au droit suisse, nous conservons l'historique anonymisé de vos réservations pendant 10 ans pour des raisons comptables.",
    DE: 'Gemäss schweizerischem Recht bewahren wir den anonymisierten Verlauf Ihrer Reservierungen aus buchhalterischen Gründen während 10 Jahren auf.',
    EN: 'In accordance with Swiss law, we retain the anonymised history of your bookings for 10 years for accounting purposes.',
  },
} as const;

// Tasting recap email strings (P-07 / email #3, US-230)
export const tastingRecap = {
  title: {
    FR: 'Vos coups de cœur chez {wineryName}',
    DE: 'Ihre Favoriten bei {wineryName}',
    EN: 'Your favourites at {wineryName}',
  },
  intro: {
    FR: 'Bonjour {guestName}, merci de votre visite ! Voici les vins que vous avez dégustés — de quoi prolonger le moment à la maison.',
    DE: 'Guten Tag {guestName}, danke für Ihren Besuch! Hier sind die Weine, die Sie degustiert haben — um den Moment zu Hause zu verlängern.',
    EN: 'Hello {guestName}, thank you for your visit! Here are the wines you tasted — a way to bring the moment home.',
  },
  cta: {
    FR: 'Commander ces vins',
    DE: 'Diese Weine bestellen',
    EN: 'Order these wines',
  },
  note: {
    FR: 'Votre demande part directement chez {wineryName}, qui vous recontactera pour la livraison et le paiement.',
    DE: 'Ihre Anfrage geht direkt an {wineryName}, das Sie für Lieferung und Zahlung kontaktieren wird.',
    EN: 'Your request goes directly to {wineryName}, who will get back to you about delivery and payment.',
  },
} as const;

// Empty tasting sheet reminder, 21h (P-07 / email #21)
export const tastingSheetReminder = {
  title: {
    FR: 'Votre fiche dégustation vous attend',
    DE: 'Ihr Degustationsblatt wartet auf Sie',
    EN: 'Your tasting sheet is waiting',
  },
  intro: {
    FR: "Bonjour {firstName}, vos hôtes du jour sont repartis — cochez les vins servis pour qu'ils reçoivent leurs coups de cœur par email.",
    DE: 'Guten Tag {firstName}, Ihre heutigen Gäste sind abgereist — haken Sie die servierten Weine ab, damit sie ihre Favoriten per E-Mail erhalten.',
    EN: 'Hello {firstName}, today’s guests have left — tick the wines you served so they receive their favourites by email.',
  },
  sessionLine: {
    FR: '{title} — {timeSlot}, {count} pers.',
    DE: '{title} — {timeSlot}, {count} Pers.',
    EN: '{title} — {timeSlot}, {count} guests',
  },
  cta: {
    FR: 'Remplir la fiche',
    DE: 'Blatt ausfüllen',
    EN: 'Fill in the sheet',
  },
} as const;

// Wine order request from the recap CTA (P-07 / US-230)
export const wineOrderRequest = {
  winery: {
    title: {
      FR: 'Nouvelle demande de commande',
      DE: 'Neue Bestellanfrage',
      EN: 'New order request',
    },
    intro: {
      FR: '{clientName} a dégusté chez vous ({reference}) et souhaite commander :',
      DE: '{clientName} hat bei Ihnen degustiert ({reference}) und möchte bestellen:',
      EN: '{clientName} tasted at your winery ({reference}) and would like to order:',
    },
    contact: {
      FR: 'Coordonnées : {email}{phone}',
      DE: 'Kontakt: {email}{phone}',
      EN: 'Contact details: {email}{phone}',
    },
    total: {
      FR: 'Total indicatif : {amount}',
      DE: 'Unverbindliche Summe: {amount}',
      EN: 'Indicative total: {amount}',
    },
    note: {
      FR: 'Répondez directement au client pour convenir de la livraison et du paiement.',
      DE: 'Antworten Sie dem Kunden direkt, um Lieferung und Zahlung zu vereinbaren.',
      EN: 'Reply to the client directly to arrange delivery and payment.',
    },
  },
  client: {
    title: {
      FR: 'Votre demande est partie !',
      DE: 'Ihre Anfrage ist unterwegs!',
      EN: 'Your request is on its way!',
    },
    intro: {
      FR: 'Nous avons transmis votre demande à {wineryName}, qui vous recontactera très vite pour la livraison et le paiement.',
      DE: 'Wir haben Ihre Anfrage an {wineryName} weitergeleitet — man wird Sie bald wegen Lieferung und Zahlung kontaktieren.',
      EN: 'We forwarded your request to {wineryName}, who will get back to you soon about delivery and payment.',
    },
    recap: {
      FR: 'Votre sélection :',
      DE: 'Ihre Auswahl:',
      EN: 'Your selection:',
    },
  },
} as const;

// Email #18 — Stripe action required (P-13 / L-143)
export const stripeActionRequired = {
  title: {
    FR: 'Action requise sur votre compte Stripe',
    DE: 'Handlungsbedarf bei Ihrem Stripe-Konto',
    EN: 'Action required on your Stripe account',
  },
  intro: {
    FR: 'Bonjour {firstName}, Stripe a besoin d’informations supplémentaires pour continuer à verser vos revenus. Sans action de votre part, vos versements peuvent être suspendus.',
    DE: 'Guten Tag {firstName}, Stripe benötigt zusätzliche Angaben, um Ihre Einnahmen weiterhin auszuzahlen. Ohne Ihr Zutun können Ihre Auszahlungen ausgesetzt werden.',
    EN: 'Hello {firstName}, Stripe needs additional information to keep paying out your earnings. Without action, your payouts may be paused.',
  },
  listTitle: {
    FR: 'Éléments demandés :',
    DE: 'Angeforderte Angaben:',
    EN: 'Requested items:',
  },
  cta: {
    FR: 'Compléter mon compte Stripe',
    DE: 'Mein Stripe-Konto vervollständigen',
    EN: 'Complete my Stripe account',
  },
  note: {
    FR: 'Le lien vous emmène sur votre profil EnCave, d’où vous pouvez reprendre la configuration Stripe en quelques minutes.',
    DE: 'Der Link führt zu Ihrem EnCave-Profil, von dem aus Sie die Stripe-Einrichtung in wenigen Minuten abschliessen können.',
    EN: 'The link takes you to your EnCave profile, from which you can resume the Stripe setup in a few minutes.',
  },
} as const;

/**
 * Human labels for the most common Stripe `currently_due` codes.
 * Anything unknown falls back to the raw code — never hidden.
 */
export const stripeRequirementLabels: Record<string, Record<Locale, string>> = {
  external_account: {
    FR: 'Compte bancaire pour les versements',
    DE: 'Bankkonto für Auszahlungen',
    EN: 'Bank account for payouts',
  },
  'individual.verification.document': {
    FR: 'Document d’identité',
    DE: 'Identitätsnachweis',
    EN: 'Identity document',
  },
  'individual.verification.additional_document': {
    FR: 'Justificatif de domicile',
    DE: 'Wohnsitznachweis',
    EN: 'Proof of address',
  },
  'business_profile.url': {
    FR: 'Site web ou description de l’activité',
    DE: 'Website oder Beschreibung der Tätigkeit',
    EN: 'Website or business description',
  },
  'business_profile.mcc': {
    FR: 'Catégorie d’activité',
    DE: 'Tätigkeitskategorie',
    EN: 'Business category',
  },
  'tos_acceptance.date': {
    FR: 'Acceptation des conditions Stripe',
    DE: 'Zustimmung zu den Stripe-Bedingungen',
    EN: 'Acceptance of the Stripe terms',
  },
  'individual.dob.day': {
    FR: 'Date de naissance',
    DE: 'Geburtsdatum',
    EN: 'Date of birth',
  },
  'individual.address.line1': {
    FR: 'Adresse personnelle',
    DE: 'Privatadresse',
    EN: 'Personal address',
  },
};

// Helper function to get translation
export function t<T extends Record<Locale, unknown>>(
  translations: T,
  locale: Locale
): T[Locale] {
  return translations[locale] ?? translations.FR;
}
