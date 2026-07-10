# EnCave V3 — Inventaire des pages & emails

> **Version** : 1.0 — 3 juillet 2026
> **Rôle** : la carte complète des écrans et emails, par release. Chaque epic `/ultraplan` référence ce doc + ENCAVE-V3-DESIGN.md v2.
> **Tags release** : **[L]** launch 16.11 · **[3.1]** Shop · **[3.2]** Stay · **[3.3]** Confiance · **[A]** admin (launch, version fonctionnelle).

---

## 0. Décisions UX actées dans ce document

1. **Recherche home = 2 champs** (Où + Quand). Le type, le budget, la langue deviennent des filtres sur la page résultats. Les chips raccourcis du hero restent (elles préremplissent le filtre type sans charger la barre).
2. **Inscription encaveur self-service + validation admin** : signup ouvert → domaine en statut `pending` → l'admin valide/refuse. L'invitation directe (les 20 caves fondatrices) coexiste et saute la validation.
3. **Réservation : pas de stepper multi-pages.** Sur mobile, un stepper classique casse le contexte et fait chuter la conversion. À la place : **sheet progressive** (voir §4). Le seul vrai changement de page est le checkout.
4. **Compte client optionnel** : checkout invité par défaut ; les billets invités sont accessibles par lien magique (token), la création de compte est proposée après paiement, jamais avant.

---

## 1. Sitemap

```
PUBLIC                              ENCAVEUR (/encaveur)              ADMIN (/admin)
/                        [L]        /connexion             [L]        /                       [A]
/experiences             [L]        /inscription           [L]        /domaines               [A]
/experiences/[slug]      [L]        /bienvenue (wizard)    [L]        /domaines/[id]          [A]
/encaveurs               [L]        /en-attente            [L]        /evenements             [A]
/encaveurs/[slug]        [L]        / (Aujourd'hui)        [L]        /reservations           [A]
/cadeaux                 [L]        /experiences           [L]        /utilisateurs           [A]
/sur-mesure              [L]        /experiences/[id]      [L]        /bons-cadeaux           [A]
/checkout/[bookingId]    [L]        /reservations          [L]
/reservation/succes/[id] [L]        /reservations/[id]     [L]        AUTH SYSTÈME
/reservation/erreur      [L]        /scan (PWA)            [L]        /connexion (client)     [L]
/billets/[token]         [L]        /demandes              [L]        /auth/verifier          [L]
/compte + sous-pages     [L]        /demandes/[id]         [L]        /auth/callback          [L]
/cgv /confidentialite    [L]        /vins                  [L]        /auth/lien-expire       [L]
/mentions-legales        [L]        /domaine               [L]        /invitation/[token]     [L]
/contact                 [L]        /paiements             [L]
/404 /500 /maintenance   [L]        /parametres            [L]
/boutique/[cave]         [3.1]      /boutique (stock)      [3.1]      V3.x
/commande/* (panier)     [3.1]      /sejours (calendrier)  [3.2]      /sejours (filtres dates)[3.2]
                                                                      /avis (modération)      [3.3]
```

---

## 2. Pages publiques

### `/` — Home **[L]**

Validée par le POC. Hero photo + recherche **Où + Quand** + chips raccourcis (Ce week-end, Dégustations, Avec repas, Nuit au domaine) → redirige vers `/experiences?où&quand[&type]`. Sections : expériences en vedette (3), comment ça marche, bon cadeau, sur-mesure, encaveurs, footer.
États : aucune donnée dynamique bloquante (vedettes en ISR).

### `/experiences` — Résultats & catalogue **[L]**

Une seule page pour les deux modes : sans paramètres = catalogue complet trié par prochaine disponibilité ; avec paramètres = résultats.

- **Barre de filtres** (sticky sous la nav) : chips scrollables — Type, Date, Région, Budget (< 50 / 50-100 / 100+), Langue. Compteur de résultats. Filtres actifs = pills wine avec ×.
- **Toggle Liste / Carte** (Mapbox lazy, plein écran mobile avec cartes en carrousel bas).
- Tri : prochaine dispo (défaut), prix, distance (si géoloc accordée).
- États : chargement (skeletons cartes), **vide** (« Rien ce jour-là — élargissez la date ou explorez tout le Valais » + CTA reset), erreur (retry).
- URL = état des filtres (partageable, SEO par région/type).

### `/experiences/[slug]` — Détail expérience **[L]**

Galerie plein largeur → titre Fraunces + eyebrow type + cave (lien) + note (3.3) → infos clés (durée, langues, capacité, lieu) → description → **panneau de réservation** (§4) → politique d'annulation + no-show en clair → la cave (teaser → `/encaveurs/[slug]`) → expériences similaires.
Si `is_collective` : bandeau organisateur + grille des caves participantes + programme.
Mobile : barre sticky bas (prix Fraunces + CTA « Réserver »). JSON-LD Event/Offer.
États : complet (prochaines dates proposées), archivé (redirect cave), preview encaveur (bandeau « brouillon »).

### `/encaveurs` — Liste des domaines **[L]**

Grille de cartes domaine (photo, nom Fraunces, village, cépages signature en chips cognac, nb d'expériences actives) + toggle carte. Filtre région simple. Tri alphabétique/région.
État vide par région : « Bientôt — les domaines de [région] arrivent » + CTA « Vous êtes encaveur ? ».

### `/encaveurs/[slug]` — Détail domaine **[L]**

Cover photo → identité (nom, famille, village, altitude, hectares — les chiffres en Fraunces) → histoire courte → **ses expériences** (cartes) → **ses vins** (catalogue light : nom, cépage, millésime, prix — sans achat [L], bouton « Commander » en [3.1]) → infos pratiques (adresse, carte, horaires) → **bloc sur-mesure** (« Une envie particulière ? » → formulaire prérempli avec la cave) → JSON-LD LocalBusiness.

### `/cadeaux` — Bon cadeau **[L]**

Vitrine (l'objet noir du POC) + configurateur : montant libre (20-500) ou choix d'expérience → message personnel → destinataire + **date d'envoi** → aperçu live de la carte → paiement. Section FAQ courte (validité 5 ans, utilisable en plusieurs fois).

### `/sur-mesure` — Request global **[L]**

Formulaire : cave souhaitée (optionnel, « laissez EnCave proposer » sinon), date souhaitée, nb personnes, budget indicatif, description. Accusé immédiat + explication du délai 48 h. Version courte intégrée à chaque page domaine.

### Légal & support **[L]**

`/cgv` (client + conditions encaveur), `/confidentialite` (nLPD : traitements, droits, effacement), `/mentions-legales`, `/contact` (formulaire simple). `/404` et `/500` sur la charte (motif verre en filaire cognac — le clin d'œil), `/maintenance` (page statique pour le freeze Maldives).

---

## 3. Authentification — 3 rôles **[L]**

| Rôle         | Entrée                              | Méthodes                                                   | Après login                                   |
| ------------ | ----------------------------------- | ---------------------------------------------------------- | --------------------------------------------- |
| **Client**   | `/connexion` (+ inline au checkout) | Email + mot de passe · « Recevoir un code » (OTP) · Google | Retour à la page d'origine ou `/compte`       |
| **Encaveur** | `/encaveur/connexion`               | Email + mot de passe (principal) · OTP en secours · Google | `/encaveur` ou wizard si onboarding incomplet |
| **Admin**    | `/admin` (rôle en DB)               | Email + mot de passe + TOTP obligatoire                    | `/admin`                                      |

Notes : **pas de flow « mot de passe oublié »** — l'OTP le remplace (connexion par code → changement du mot de passe dans `/compte/profil` ou `/encaveur/parametres`). Sessions longues (refresh ~90 j) pour le dashboard encaveur en PWA : le mot de passe n'est retapé qu'au changement d'appareil. Client : mot de passe défini à l'inscription, ou proposé après le premier achat invité.

Pages système : `/auth/verifier` (« email envoyé », renvoyer), `/auth/callback`, `/auth/lien-expire`. `/encaveur/inscription` : email + nom du domaine + village + téléphone → crée le compte + domaine `pending` → `/encaveur/en-attente` (statut, ce qui se passe ensuite, contact). `/invitation/[token]` : voie fondateurs, saute la validation.
Garde-fous : un compte = un rôle principal ; middleware par préfixe de route ; RLS en dernier rempart.

---

## 4. Flow de réservation (réponse au « stepper »)

**Reco : sheet progressive, pas de stepper multi-pages.**
Sur la fiche expérience, le CTA ouvre une **bottom sheet** (mobile) / **panneau latéral sticky** (desktop) qui déroule trois micro-étapes _dans le même contexte_ — la fiche reste visible derrière, l'utilisateur ne perd jamais l'objet de son désir :

1. **Jour** — chips horizontales des 14 prochaines dates disponibles (« sam 21 nov »), lien « autre date » → mini-calendrier. Les dates complètes sont grisées barrées.
2. **Heure** — pills des créneaux du jour choisi avec places restantes (« 16h00 · 5 places »). Sélection wine.
3. **Personnes** — stepper +/− (borné par les places restantes), total live en Fraunces qui se met à jour à chaque tap.

Un indicateur discret 3 points cognac remplace le stepper visuel lourd. CTA final « Continuer — 84 CHF » → **création du hold 10 min** → `/checkout/[bookingId]`.

**`/checkout/[bookingId]`** **[L]** — la seule vraie page du tunnel : compte à rebours du hold (10:00, discret, cognac), récap (image mini, date/heure/pers, total détaillé avec booking fee ligne à part). **Connecté : coordonnées repliées et pré-remplies** (« Vous réservez en tant que… — modifier ») ; invité : email + prénom/nom + téléphone (mémorisés ensuite). **Champ code cadeau** (déplie, applique, solde restant affiché), case « Enregistrer ma carte pour la prochaine fois » (`setup_future_usage`), acceptation politique d'annulation + CGV, puis **Stripe Checkout** (TWINT premier, **Link activé**, cartes sauvegardées proposées). Cas no-show/gratuit : l'empreinte carte (SetupIntent) remplace le paiement, avec le montant des frais affiché en clair avant validation.

**`/reservation/succes/[id]`** **[L]** — confirmation immédiate : billet inline (objet noir, QR pastille claire), PDF + .ics _(passes Wallet Apple/Google : post-launch — nécessitent le compte développeur Apple, décision du 03.07)_, adresse et itinéraire, proposition de créer un compte (1 tap — email, coordonnées et carte enregistrée sont conservés), partage. **`/reservation/erreur`** — cause lisible (paiement refusé / hold expiré), si hold encore actif : retry direct ; sinon : re-sélection avec les choix mémorisés.
**`/billets/[token]`** — billet public par lien magique (invités), regroupe les billets d'une commande.

---

## 5. Espace client — `/compte` **[L]**

- **`/compte`** — Mes réservations : segmented control À venir / Passées. Cartes : image, date, cave, statut pill. Vide : « Votre première cave vous attend » + CTA explorer.
- **`/compte/reservations/[id]`** — billet + détail + **annulation self-service** (la politique et le montant remboursé affichés _avant_ confirmation) + re-réserver.
- **`/compte/bons-cadeaux`** — mes bons (achetés/reçus) : code, solde restant, expiration, renvoyer au bénéficiaire.
- **`/compte/demandes`** — mes requests : statut (En attente / Offre reçue / Payée / Expirée), détail offre + CTA payer avant échéance.
- **`/compte/profil`** — identité complète (prénom, nom, email, téléphone), **moyens de paiement** (cartes sauvegardées chez Stripe : liste, supprimer — EnCave ne stocke que des IDs), préférences email (récap dégustation opt-out), langue, adresses de livraison [3.1], **supprimer mon compte** (nLPD, double confirmation).

---

## 6. Dashboard encaveur — `/encaveur/*` **[L]**

Shell : bottom nav mobile 4 onglets (**Aujourd'hui · Expériences · Réservations · Vins**), le reste dans un menu « Plus ». Desktop : sidebar paper-2.

- **`/encaveur` — Aujourd'hui** : KPIs Fraunces (réservations aujourd'hui, couverts à venir 7 j, CA du mois, taux de remplissage 30 j), prochains créneaux avec jauge de remplissage, **bouton scan flottant**, alertes (demandes sans réponse > 24 h, fiche dégustation d'hier non remplie, KYC Stripe incomplet).
- **`/encaveur/experiences`** : liste (statut, prochaine occurrence, remplissage moyen) + **Dupliquer** (le vrai gain de temps) + créer.
  **Wizard de création** (≤ 5 champs/écran, sauvegarde à chaque étape) : 1. L'essentiel (type, titre, description courte) → 2. Prix & capacité (+ langue, durée) → 3. **Créneaux** : ponctuel (dates + heures multiples en chips) **ou** récurrent (jours de semaine × heures, période de validité, blackouts en tap sur calendrier), aperçu des 8 prochaines occurrences généré en live → 4. Photos (upload, recadrage) → 5. Politiques (annulation, no-show on/off + montant) → Publier ou brouillon.
- **`/encaveur/experiences/[id]`** : édition + **calendrier des occurrences** (mois) : tap sur une occurrence → fermer, ajuster la capacité, voir les inscrits.
- **`/encaveur/reservations`** : filtres (date, expérience, statut), export CSV. **Détail** : la **liste des inscrits** (nom, pers., contact, payé/à encaisser), check-in manuel, annuler + rembourser (motif), **marquer no-show** (déclenche les frais si politique active), **fiche dégustation** (toggles vins ≥ 48 px, « Envoyer le récap »).
- **`/encaveur/scan`** : PWA plein écran, caméra, feedback géant (✓ vert nom + pers. / ✗ déjà scanné / ✗ mauvaise date), liste du jour préchargée (offline-tolerant), compteur scannés/attendus.
- **`/encaveur/demandes`** : inbox requests (badge nav), détail → **composer l'offre** (message, prix total, validité) → envoyée avec lien de paiement ; relance auto visible.
- **`/encaveur/vins`** : CRUD léger (nom, cépage, millésime, prix, dispo). Note « Bientôt : vendez en ligne » [3.1].
- **`/encaveur/domaine`** : profil public (aperçu live), photos, géoloc, horaires, politiques par défaut.
- **`/encaveur/paiements`** : statut Stripe (badge), prochain virement (montant + date), historique des payouts, relevés PDF mensuels.
- **`/encaveur/parametres`** : notifications (email/push par type d'événement), langue, compte.
- **`/encaveur/bienvenue`** : wizard onboarding 3 étapes (Domaine → Stripe KYC → 1ʳᵉ expérience), barre de progression, reprise automatique. **`/encaveur/en-attente`** : statut de validation.

Pense-bêtes intégrés (ce que tu n'avais pas listé mais qui compte) : duplication d'expérience, calendrier d'occurrences éditables, export CSV, alertes actionnables sur l'accueil, statut Stripe visible en permanence.

---

## 7. Admin — `/admin` **[A]** _(fonctionnel avant beau : tables shadcn, zéro polish)_

- **`/admin`** : file d'attente domaines `pending` (le job n°1), GMV/résas du jour, santé webhooks (lag), derniers échecs de jobs.
- **`/admin/domaines`** : liste + détail → **Valider / Refuser (motif) / Suspendre**. La validation déclenche l'email de bienvenue et ouvre l'onboarding.
- **`/admin/evenements`** : créer/gérer les **événements collectifs** organisés par EnCave (type Jardin des Vins) : infos, caves participantes, billetterie, stats de scan multi-points.
- **`/admin/reservations`** : recherche transverse (email, code), détail, **remboursement support** (motif journalisé).
- **`/admin/utilisateurs`** : clients et encaveurs, effacement nLPD (anonymisation), changement de rôle (journalisé).
- **`/admin/bons-cadeaux`** : liste, **passif total** (somme des soldes — le chiffre comptable), désactiver un code (fraude), historique ledger par code.

---

## 8. Emails transactionnels (Resend + React Email)

Charte : header logo Fraunces sur paper, corps encre, un seul CTA wine, footer légal. Objets courts, français, sans emoji sauf mention.

| #            | Email                           | Déclencheur                  | Contenu clé                                                                             | Rel. |
| ------------ | ------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------- | ---- |
| **Client**   |                                 |                              |                                                                                         |      |
| 1            | Confirmation + billet           | Paiement validé              | Billet QR inline, PDF, .ics, adresse, politique annulation                              | L    |
| 2            | Rappel J-1                      | Cron veille 18h              | Heure, adresse + itinéraire, contact cave, météo du lieu                                | L    |
| 3            | Vos coups de cœur (J+2)         | Fiche dégustation remplie    | Vins servis + prix, CTA « Commander ces vins » (demande → cave [L], achat direct [3.1]) | L    |
| 4            | Annulation confirmée            | Client annule                | Montant remboursé, délai bancaire, CTA re-réserver                                      | L    |
| 5            | Annulation par la cave          | Encaveur annule              | Excuses, remboursement intégral auto, 3 alternatives proches                            | L    |
| 6            | Reçu bon cadeau (acheteur)      | Achat cadeau                 | Confirmation, facture, rappel date d'envoi choisie                                      | L    |
| 7            | Votre bon cadeau (bénéficiaire) | Date d'envoi                 | Carte visuelle, code, message personnel, CTA réserver                                   | L    |
| 8            | Demande envoyée                 | Request créée                | Accusé, délai 48 h, récap                                                               | L    |
| 9            | Offre reçue                     | Encaveur répond              | Détail offre, prix, **échéance**, CTA payer                                             | L    |
| 10           | Offre bientôt expirée           | J-1 échéance                 | Relance unique                                                                          | L    |
| 11           | Code de connexion               | OTP demandé                  | Code 6 chiffres bien lisible, expiration 15 min                                         | L    |
| 12           | Vos billets                     | Achat invité                 | Lien magique `/billets/[token]`                                                         | L    |
| 13           | Frais de no-show prélevés       | Encaveur déclenche           | Montant, rappel de la politique acceptée (horodatée), contact                           | L    |
| **Encaveur** |                                 |                              |                                                                                         |      |
| 14           | Nouvelle réservation            | Booking confirmé             | Qui, quand, combien, total — CTA détail                                                 | L    |
| 15           | Nouvelle demande sur-mesure     | Request reçue                | Résumé, **CTA répondre**, rappel SLA 48 h                                               | L    |
| 16           | Annulation client               | Client annule                | Créneau libéré, places remises en vente                                                 | L    |
| 17           | Virement envoyé + récap hebdo   | Payout lundi                 | Montant, période, lien relevé PDF, stats semaine                                        | L    |
| 18           | Action requise Stripe           | Webhook account              | Ce qui manque au KYC, CTA reprendre                                                     | L    |
| 19           | Domaine validé — bienvenue      | Admin valide                 | CTA onboarding, contact Sam                                                             | L    |
| 20           | Domaine refusé                  | Admin refuse                 | Motif, voie de recours (contact)                                                        | L    |
| 21           | Fiche dégustation à remplir     | Soir de l'event 21h, si vide | « Cochez les vins servis » — active la boucle                                           | L    |
| **Admin**    |                                 |                              |                                                                                         |      |
| 22           | Nouveau domaine à valider       | Signup encaveur              | Résumé + CTA valider                                                                    | L    |

_(Alertes système — webhook lag, échec payout — partent vers Slack/monitoring, pas en email template.)_

---

## 9. Ce qui n'existe volontairement pas au launch

Modification de réservation (= annuler + re-réserver), avis publics [3.3], messagerie in-app client↔cave (l'email + le téléphone suffisent, la messagerie est un gouffre), multi-utilisateurs par domaine, app native, DE/IT. Boutique et panier [3.1], recherche par dates de séjour [3.2].
