# EnCave V3 — Product Requirements Document

> **Version** : 3.1.0 — 3 juillet 2026 (remplace 3.0.0)
> **Owner** : Sam
> **Changements clés vs 3.0** : suppression des rails MCP/agents ; ajout des modes Stay et Request, du Shop vin, des bons cadeaux, de l'anti no-show, de la fiche dégustation, des événements collectifs ; vision "Le Cercle" cadrée.
> **Docs liés** : `ENCAVE-V3-BUSINESS.md`, `ENCAVE-V3-PLANNING.md`, `ENCAVE-V3-PAGES-EMAILS.md`
> _(`ENCAVE-V3-ARCHITECTURE.md` et `ENCAVE-V3-DESIGN.md` référencés mais pas encore versionnés dans ce repo.)_

---

## 1. Vision & positionnement

**Vision** : le SaaS simple, rapide et fiable qui connecte les clients aux encaveurs suisses — réserver une expérience, séjourner à la cave, demander du sur-mesure, acheter les vins.

**Positionnement** : côté encaveur, UN dashboard qui gère tout (expériences, réservations, demandes, vins) en moins de 10 min/semaine. Côté client, réserver une cave aussi facilement qu'un restaurant.

**Le produit tient en un moteur + une boutique** :

- **Slot** — créneaux : dégustations, visites, repas, événements ponctuels et collectifs (type Jardin des Vins)
- **Stay** — séjours : nuitée œno-dégustation, réservation par dates
- **Request** — sur-mesure : le client décrit son besoin, l'encaveur envoie une offre, paiement par lien
- **Shop** — marketplace vin des encaveurs inscrits (1 commande = 1 cave)

---

## 2. Problème & opportunité

### Côté encaveur

- Réservations par téléphone/email/WhatsApp : chronophage, erreurs, no-shows non compensés
- Demandes de groupes/entreprises gérées à la main (devis par email, relances, paiement en retard)
- Nuitées et repas œno souvent invisibles en ligne ou dispersés sur Booking (commissions 15-18%, zéro spécialisation)
- Le vin découvert en dégustation n'est presque jamais racheté après la visite : la boucle est cassée

### Côté client

- "Quoi faire ce week-end autour du vin en Valais" = recherche fragmentée, sites datés, réservation par téléphone
- Impossible d'offrir facilement une expérience cave (le cadeau vin n°1 en Suisse romande)
- Racheter les vins aimés après la visite = friction maximale

### Opportunité

~600 encaveurs en Valais, ~1'100 en Romandie, digitalisation du booking quasi nulle. Aucun acteur ne couvre expérience + séjour + sur-mesure + vin dans un seul outil pensé pour les caves suisses (TWINT, CHF, FR).

---

## 3. Personas & Jobs-to-be-Done

### P1 — L'encaveur (B2B, payeur)

Domaine familial 3-15 ha, 45-60 ans, digital minimal, smartphone omniprésent.

- **JTBD-1** : "Quand un client veut visiter, je veux qu'il réserve et paie seul."
- **JTBD-2** : "Quand une entreprise me demande une soirée sur mesure, je veux répondre avec une offre propre en 5 minutes, pas en 3 emails."
- **JTBD-3** : "Quand un visiteur repart conquis, je veux qu'il puisse racheter mes vins sans friction."
- **JTBD-4** : "Quand j'ai des chambres, je veux les remplir sans payer 18% à Booking."

### P2 — Le client romand (B2C, source de GMV)

30-50 ans, sortie week-end en couple ou entre amis, mobile-first.

- **JTBD-5** : "Trouver et réserver une expérience vin près de chez moi en moins de 2 minutes."
- **JTBD-6** : "Offrir une expérience cave à quelqu'un sans me tromper de date."
- **JTBD-7** : "Racheter les vins que j'ai aimés à la dégustation."

### P3 — L'organisateur de groupe (B2B2C)

RH/office manager, EVG-EVF, famille pour un anniversaire. Passe par **Request**.

- **JTBD-8** : "Organiser une sortie cave pour 15 personnes avec un budget, sans passer 2 semaines en allers-retours."

### P4 — L'organisateur d'événement collectif

Association, commune, ou EnCave elle-même (type Jardin des Vins, balade des cépages).

- **JTBD-9** : "Vendre des billets pour un événement multi-caves avec une billetterie propre."

---

## 4. Principes produit

1. **Simple avant tout.** Chaque écran a un job. Si une feature demande une explication, elle est mal conçue.
2. **Vitesse perçue = feature n°1.** Pages découverte < 1.5 s sur 4G, checkout ≤ 3 écrans, feedback < 100 ms.
3. **Fiabilité = confiance.** Zéro double-booking (slots ET nuits), zéro paiement fantôme, remboursements automatiques.
4. **L'encaveur d'abord.** Gestion ≤ 10 min/semaine, onboarding ≤ 30 min, tout faisable depuis le téléphone à la cave.
5. **La boucle est le produit.** Dégustation → fiche des vins servis → email J+2 → achat. C'est le pont unique d'EnCave entre expérience et commerce.
6. **Suisse dans l'ADN.** TWINT natif, CHF, FR d'abord (DE/IT prêts structurellement), nLPD, TVA incluse.

---

## 5. Scope par release (MoSCoW)

### Launch — 16 novembre 2026 (« Réserver, offrir, demander »)

**Must — Encaveur**

- Onboarding : profil cave, photos, géoloc, KYC Stripe Connect Express
- Expériences **Slot** : dégustation, visite+dégustation, repas, événement — prix, durée, capacité, langues, récurrence + occurrences ponctuelles, blackouts
- Dashboard réservations : liste, détail, check-in QR (PWA offline-tolerant), annulation manuelle
- **Catalogue vins light** : CRUD nom/cépage/millésime/prix (pas de vente en ligne — prépare le Shop et alimente la fiche dégustation)
- **Fiche dégustation** : cocher les vins servis à chaque réservation → email client J+2 « vos coups de cœur » avec demande de commande en 1 clic (la cave reçoit, confirme, encaisse comme elle veut)
- **Request** : réception des demandes sur-mesure, création d'offre (description, prix, échéance), envoi du lien de paiement
- Notifications email + push web

**Must — Client**

- Découverte : liste + carte + filtres (date, région, type, prix), tri proximité
- Fiche expérience : photos, description, sélecteur de créneaux temps réel
- Checkout invité ou compte : TWINT, carte, Apple/Google Pay, booking fee 2.50 CHF transparent
- **Bons cadeaux** : montant libre ou expérience précise, PDF élégant personnalisable, validité 5 ans, rédemption partielle au checkout
- **Anti no-show** : empreinte carte sur les offres gratuites ou payables sur place (frais paramétrables par la cave, prélevés en cas d'absence non annulée)
- Billets : email + PDF + QR + wallet ; annulation self-service selon politique cave (flexible/standard/stricte) avec remboursement auto
- Formulaire Request : date, nb personnes, budget, envies → suivi du statut → paiement de l'offre

**Must — Événements collectifs (version simple)**

- Un événement Slot peut avoir des **caves participantes** (tags, logos, mini-programme) et UN organisateur payé (cave, association onboardée comme organisateur, ou EnCave)
- Billetterie centrale, scan multi-points
- _Le split automatique multi-caves viendra en 2027 ; au launch, la redistribution est gérée par l'organisateur_

**Should (dégradable si la vélocité l'exige)**

- Recherche plein texte tolérante aux typos ; OG images dynamiques ; compte client complet (le minimum : retrouver ses billets par email)

**Won't (launch)**

- Shop en ligne, Stay, avis publics, widget, DE/IT actifs, app native

### V3.1 — Shop (janvier → 7 février 2027)

- Boutique par cave : catalogue public (depuis le catalogue light), stock, photos
- Panier **mono-cave**, retrait à la cave ou expédition par la cave (zéro logistique EnCave), commission 5-10%
- **Vérification d'âge 18+** (déclaration + date de naissance) et **TVA incluse** dans les prix encaveur
- Upgrade de la boucle dégustation : l'email J+2 devient achat direct en ligne
- Bons cadeaux utilisables sur le Shop

### V3.2 — Stay (9 février → mi-mars 2027, prêt pour la saison)

- Expériences **Stay** : inventaire par nuit (nb d'unités), calendrier, min-nights, jours d'arrivée
- Réservation par dates check-in/check-out, package dégustation incluse, petit-déjeuner en option
- Mêmes garanties anti-surréservation que Slot (invariants en base)

### V3.3 — Confiance & distribution (mars → avril 2027)

- **Avis vérifiés** : seuls les billets scannés peuvent noter ; réponse encaveur
- **Widget embarquable** (iframe simple) pour le site de la cave — si ≥ 3 caves le demandent
- **Pass multi-caves** week-end (exploration)

### Vision 2027 S2 — **Le Cercle** (nom de travail)

Pas un abonnement de caisses découverte — ça existe déjà dans la région. Un **club d'accès** :

- **Membres limités** (100-150), cotisation annuelle (~490 CHF), liste d'attente assumée
- **Allocations trimestrielles curées par un sommelier partenaire** : cuvées confidentielles, vieux millésimes, barriques uniques, vins de garde des grands domaines valaisans — des bouteilles qu'on ne trouve pas, pas des bouteilles qu'on reçoit
- **Événements privés membres** : verticales chez le vigneron, dîners accords mets-vins, primeurs de cave
- **Revenus** : cotisations + marge sur allocations + billetterie événements privés
- **Effet système** : canal premium pour recruter les caves prestigieuses sur la plateforme, et le sommelier apporte la crédibilité qu'un pure player tech n'a pas
- **Gate d'entrée** : 2-3 domaines haut de gamme partants + 1 sommelier identifié. À valider par conversations avant tout développement.

---

## 6. User stories clés & critères d'acceptation

_Backlog détaillé généré par Claude Code (`/ultraplan` par epic) à partir de ce PRD. Ici, les stories structurantes._

### US-101 — Création d'une expérience Slot (encaveur)

- Créer "Dégustation 5 vins, 25 CHF, sam 10h/16h, cap. 8" génère 12 occurrences visibles publiquement en < 60 s.
- Création ≤ 4 min mesurés ; validation bloquante (prix > 0, capacité 1-50, durée 30-480 min).

### US-201 — Réservation express (client)

- 2 clients simultanés sur 3 places restantes → exactement un succès, un refus propre. Zéro survente (test de charge CI).
- Hold panier 10 min, libération auto ; TWINT → billet QR en < 30 s ; ≤ 3 écrans, aucun compte requis.

### US-210 — Bon cadeau

- Achat montant libre (20-500 CHF) ou expérience → PDF personnalisé (message, design EnCave) envoyé à l'offreur ou au bénéficiaire à une date choisie.
- Rédemption partielle : solde restant conservé, jamais négatif (invariant en base), utilisable en plusieurs fois, validité 5 ans.
- Un code = usage concurrent impossible (verrou transactionnel).

### US-220 — Anti no-show

- Sur une offre gratuite/payable sur place, la cave active des frais de no-show (ex. 15 CHF/pers.) : le client enregistre sa carte sans débit à la réservation.
- No-show constaté (pas de scan + pas d'annulation dans les délais) → l'encaveur déclenche le prélèvement en 1 tap ; le client est notifié avec la politique acceptée.
- Aucune donnée carte ne transite par EnCave (Stripe SetupIntent).

### US-230 — Fiche dégustation → boucle vin

- Pendant/après la visite, l'encaveur coche les vins servis (≤ 30 s, mobile).
- J+2 : le client reçoit « vos coups de cœur chez [Cave] » avec les vins, prix, et un bouton de demande de commande en 1 clic ; la cave reçoit la demande avec les coordonnées.
- Taux d'ouverture et de clic tracés par cave (futur argument commercial du Shop).

### US-240 — Request (sur-mesure)

- Client : formulaire (date souhaitée, nb pers., budget indicatif, description) → accusé immédiat, statut suivable.
- Encaveur : notification, création d'offre (texte, prix total, échéance de validité) en ≤ 5 min, envoi d'un lien de paiement.
- Client paie → réservation confirmée, billets émis. Offre expirée → relance automatique unique puis clôture.
- SLA visible : "réponse sous 48 h" ; sans réponse, EnCave notifie la cave (et Sam, en phase pilote).

### US-250 — Événement collectif

- L'organisateur crée l'événement, ajoute les caves participantes (logo + descriptif), publie ; billetterie et scan fonctionnent sur plusieurs points d'entrée.
- Chaque cave participante voit les stats de l'événement (billets, scans) en lecture.

### US-301 — Check-in QR

- Scan → statut "utilisé" temps réel ; double scan détecté ; fonctionne avec réseau dégradé (liste du jour pré-chargée, sync au retour).

### US-501 — Payout encaveur

- Transfers Stripe batchés lundi 06:00 (événements J-7→J-1), relevé PDF mensuel : brut, commission, fees, no-show fees, net.

### V3.2 / US-601 — Réservation Stay

- Recherche par dates + nb personnes → disponibilités réelles ; réservation de N nuits = décrément atomique sur chaque nuit dans une transaction (tout ou rien).
- Min-nights et jours d'arrivée respectés ; annulation selon politique ; zéro surréservation (même invariant que Slot, test CI dédié).

---

## 7. Parcours critiques

**Booking Slot** : Découverte → Fiche → Créneau + nb pers. → Hold 10 min → Stripe Checkout (TWINT) → Billet QR. _(3 écrans après la fiche)_
**Bon cadeau** : Choix montant/expérience → Personnalisation (message, date d'envoi) → Paiement → PDF. _(2 min)_
**Request** : Formulaire client → Offre encaveur → Lien de paiement → Billets. _(2 allers-retours max)_
**Onboarding encaveur** — deux voies : _Fondateurs_ : invitation (lien Sam), validation sautée. _Self-service_ : inscription → domaine `pending` → validation admin → email de bienvenue. Puis, commun : Profil (15 min) → KYC Stripe (10 min) → 1ʳᵉ expérience guidée par template → **Activation = publication**. _(≤ 30 min, Sam présent pour les 20 premières)_

---

## 8. Exigences non-fonctionnelles

| Domaine       | Exigence                                                                                                                                      | Mesure                             |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Performance   | LCP < 1.5 s p75 mobile 4G (découverte) ; TTFB < 200 ms edge ; API dispo < 300 ms p95                                                          | Speed Insights, Lighthouse CI ≥ 95 |
| Fiabilité     | 99.9% dispo publique ; zéro survente Slot & Stay (invariants DB) ; webhooks idempotents, alerte lag > 5 min                                   | SLOs + k6 hebdo                    |
| Argent        | PCI délégué à Stripe (Checkout hosted only) ; bons cadeaux = ledger append-only, solde jamais négatif ; audit trail des mutations financières | Tests d'invariants                 |
| Sécurité      | RLS 100% tables + tests ; CSP stricte ; secrets managés                                                                                       | Audit avant launch                 |
| Conformité    | nLPD (registre, DPA, données UE/CH, effacement) ; bons cadeaux validité 5 ans ; Shop : 18+ et TVA incluse (V3.1)                              | Checklist gate                     |
| i18n          | FR actif, clés externalisées jour 1 (next-intl), lint CI                                                                                      | —                                  |
| Accessibilité | WCAG 2.1 AA sur booking et bons cadeaux                                                                                                       | Playwright + axe                   |

---

## 9. Modèle économique

Hybride séquencé — grille complète, unit economics et scaling : **`ENCAVE-V3-BUSINESS.md`**.

- **Phase 1 (launch → 31.03.2027)** : booking fee client 2.50 CHF/billet, **Programme Fondateurs 0% de commission** (20 premières caves), 10% pour les suivantes. Objectif de phase : supply + preuve + donnée, pas le revenu. Bons cadeaux : fee 2.50 à l'achat, commission du palier à la rédemption.
- **Phase 2 (avril 2027)** — la grille : **Découverte 0 CHF/mois + 12%** · **Pro 79 CHF/mois + 0% de commission** (« aucun frais caché » — frais de paiement refacturés au coût réel) · **Domaine 149 CHF/mois** (+ Shop 0%, widget, mise en avant, multi-utilisateurs). Shop : 8% hors Domaine. La bascule Découverte→Pro se vend seule via le dashboard (économie affichée) ; Pro à 0% dissout le leakage par alignement.
- **Le Cercle (2027 S2)** : cotisations (~490 CHF/an × 100-150 membres) + marge sur allocations + billetterie événements privés.
- **Unit economics launch** : panier Slot 45 CHF → marge contributive ~5.7-6.6 CHF/billet au tarif standard (~1.15 en Fondateurs) ; Request : le flux le plus rentable par transaction. Point mort infra ≈ 3 caves Pro.

---

## 10. KPIs

**North Star** : billets confirmés / mois (Stay = 1 séjour, 1 billet).

| Jalon                   | KPI                                     | Cible     |
| ----------------------- | --------------------------------------- | --------- |
| Beta (nov)              | Caves activées (1ʳᵉ expérience publiée) | 10        |
| Beta                    | Onboarding médian                       | ≤ 30 min  |
| Launch +6 sem (fin déc) | Billets confirmés                       | 100       |
| Launch +6 sem           | CA bons cadeaux (saison Noël)           | 3'000 CHF |
| Launch +6 sem           | Conversion fiche → billet               | ≥ 4%      |
| Request                 | Taux d'offre sous 48 h                  | ≥ 80%     |
| Boucle vin              | Clic email J+2                          | ≥ 15%     |
| Transverse              | NPS encaveur                            | ≥ 50      |

---

## 11. Risques & mitigations

| #   | Risque                                                   | Prob.   | Impact | Mitigation                                                                                                                         |
| --- | -------------------------------------------------------- | ------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| R-1 | **Supply insuffisante** — risque n°1                     | Haute   | Fatal  | Workstream acquisition parallèle, gate launch = 8 caves actives. Le code n'est pas le chemin critique.                             |
| R-2 | Demande B2C froide                                       | Moyenne | Haut   | Launch calé sur la saison bons cadeaux (Noël) ; Request capte les sorties d'entreprise nov-déc ; scale sur Caves Ouvertes mai 2027 |
| R-3 | Solo + day job : vélocité                                | Haute   | Moyen  | MoSCoW strict, Stay et Shop volontairement post-launch, buffers calendaire (Edinburgh, Maldives)                                   |
| R-4 | Scope launch dense (Request + cadeaux + no-show + fiche) | Moyenne | Moyen  | Should dégradables identifiés ; launch glissable au 23.11 sans casser la saison                                                    |
| R-5 | No-show fees mal vécus par les clients                   | Moyenne | Moyen  | Opt-in par cave, politique affichée avant réservation, prélèvement déclenché par l'encaveur (jamais automatique)                   |
| R-6 | Litiges Shop (casse, retards)                            | Moyenne | Moyen  | CGV claires : la cave est vendeur et expéditeur, EnCave intermédiaire technique ; médiation simple                                 |
| R-7 | Double-booking / incident paiement                       | Faible  | Haut   | Invariants DB, idempotence, k6 en CI, runbooks                                                                                     |

---

## 12. Out of scope V3

MCP/API agents, corporate > 50 pers., DE/IT actifs, app native, panier multi-caves, logistique EnCave, white-label, international hors Suisse.

---

## 13. Décisions ouvertes (avant S0)

1. **Frais no-show par défaut** — **Tranché le 03.07** : 15 CHF/pers., paramétrable par cave (0–50 CHF), opt-in. À confronter aux caves pilotes en beta.
2. **Design des bons cadeaux PDF** : 2-3 templates (élégant/festif/sobre) déclinés de l'objet noir « Cuir & Taupe » validé (cf. ENCAVE-V3-DESIGN.md v2 + POC) — session dédiée.
3. **Événement collectif pilote** : viser un événement réel (marché de Noël vigneron ? Saint-Vincent janvier ?) comme cas d'usage launch.
4. **Le Cercle** : lancer les 2-3 conversations domaines haut de gamme dès l'automne (coût zéro, signal précieux) ?
