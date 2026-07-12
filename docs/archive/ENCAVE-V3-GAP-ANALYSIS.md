# Gap Analysis — EnCave V3 vs branche `dev`

> **Date** : 9 juillet 2026 · **Base auditée** : `dev` @ `8368daf` · **Référentiels** : PRD 3.1.0, BUSINESS 1.0, PAGES-EMAILS 1.0, PLANNING 3.1.0 (voir `docs/v3/`)
> **Méthode** : 8 audits parallèles exhaustifs du code (booking client, paiements, emails, dashboard encaveur, pages publiques, auth, admin, infra/tests).
> **Stratégie actée** : garder l'existant, ajouter le manquant selon le plan V3 (voir `docs/v3/README.md`).

## Verdict global

La branche `dev` est un **MVP V2 centré sur le mode Slot** : découverte → fiche → checkout invité → billet QR → check-in, avec Stripe Connect Express et un back-office encaveur/admin fonctionnel. C'est une vraie fondation (~60-70 % de la verticale Slot du launch V3), **mais les 4 features qui justifient le launch du 16 novembre sont à 0 % : bons cadeaux, Request/sur-mesure, anti no-show, fiche dégustation.** Toute la mécanique de monétisation V3 (fee client 2.50, grille Fondateurs/Découverte/Pro/Domaine, abonnements) est également à 0 %.

## 1. Divergence de stack — TRANCHÉE

Le planning V3 supposait Drizzle/Supabase/Trigger.dev/RLS/k6/monorepo ; le code est Prisma 5 + Neon + better-auth + Vercel Cron + Upstash, sans RLS ni invariants DB. **Décision (09.07.2026, Sam) : on garde la stack existante** ; les docs V3 restent la source produit/business, `CLAUDE.md` la source technique. Conséquence : « RLS 100 % » du gate G-R0 devient « isolation applicative testée + invariants DB (contraintes) ».

## 2. Modèle de données — fondations manquantes

Schéma actuel : User/Winery/Experience/AvailabilitySlot/Booking/BlockedDate + auth/notifications/logs. **Absents** :

| Concept V3                                                                                                                   | Statut  |
| ---------------------------------------------------------------------------------------------------------------------------- | ------- |
| `Wine` (catalogue light) + `BookingWine` (fiche dégustation)                                                                 | Absent  |
| `GiftCard` + ledger append-only (solde jamais négatif, passif, rédemption partielle)                                         | Absent  |
| `Request` / offres / échéances (sur-mesure)                                                                                  | Absent  |
| `Stay` (schéma dormant)                                                                                                      | Absent  |
| Entité occurrence (les sessions sont calculées depuis les slots hebdo — pas de capacité/fermeture par occurrence persistée)  | Absent  |
| Événements collectifs (`is_collective`, organisateur, caves participantes)                                                   | Absent  |
| Politiques annulation (flexible/standard/stricte) et no-show (0-50 CHF) par cave/expérience                                  | Absent  |
| Langues d'une expérience                                                                                                     | Absent  |
| Plan/abonnement par cave, taux de commission par cave                                                                        | Absent  |
| Horaires, altitude, hectares, famille, cépages signature sur Winery                                                          | Absent  |
| `ExperienceType` : pas de « repas » ni « événement » (actuel : TASTING, CELLAR_VISIT, WORKSHOP, VINEYARD_TOUR, FOOD_PAIRING) | Partiel |

## 3. Business model — écart total sur la monétisation

- Commission : taux unique global `PLATFORM_COMMISSION_RATE=0.12` (`src/lib/env.ts`), en `application_fee_amount` sur destination charges. Aucun palier, ni Fondateurs 0 %, ni 10 % lancement, ni abonnements 79/149 CHF, ni Shop 8 %.
- **Booking fee client 2.50 CHF : absent** — la ligne « Frais de service » existe dans l'UI (BookingWidget, OrderSummary, CheckoutClient) mais codée en dur à 0 CHF.
- « Frais de paiement refacturés au coût » : absent (frais Stripe absorbés).
- Dashboard « EnCave vous a apporté X CHF » / argumentaire bascule Pro : absent (Earnings montre brut/commission/net = matière première seulement).
- KPIs business (GMV, take rate, % Pro, ARPU, churn, passif bons cadeaux) : aucun suivi. Pas de Stripe Billing.
- TVA : rien — alors que le reçu PDF affirme « Taxes et frais de service inclus » (`booking-receipt.service.tsx`). Risque de conformité.
- Le Cercle : absent (conforme — 2027 S2, gate conversations).

## 4. Flow de réservation client

**Acquis** : sélection inline sur la fiche (pills jours/heures avec places restantes, stepper, total live, bottom-sheet mobile), checkout invité, anti-survente par transaction Serializable (`checkout.ts`), nuqs, confirmation avec QR/reçu PDF/.ics.

**Écarts** :

- Hold créé seulement à la soumission du checkout (pas au « Continuer »), **30 min** (vs 10 spec), **sans compte à rebours**, pas de Redis. Avant soumission, la place n'est pas tenue (re-check 60 s).
- Paiement : `payment_method_types: ['card']` uniquement — **pas de TWINT**, pas de Link/wallets explicites, pas de `setup_future_usage`, **pas de champ code cadeau**.
- Pas de proposition de création de compte post-paiement (décision UX #4 à moitié).
- Pas de page `/reservation/erreur` (alerte inline).
- Annulation : règle unique >24 h = remboursement intégral, codée en dur — pas de politiques par cave. (La page légale décrit un barème >24 h / 12-24 h / <12 h qui ne correspond pas au code.)
- Wallet passes : absents (conforme — post-launch). Modification de réservation : absente (conforme).

## 5. Les 4 piliers launch + événements collectifs — tous à 0 %

| Pilier (Must launch)                        | Constat                                                                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Bons cadeaux (US-210, chemin critique Noël) | Rien : ni modèle, ni `/cadeaux`, ni ledger, ni rédemption checkout, ni PDF, ni envoi programmé, ni admin passif                 |
| Request/sur-mesure (US-240)                 | Rien : ni formulaire, ni inbox, ni offres, ni liens de paiement, ni relances, ni SLA 48 h                                       |
| Anti no-show (US-220)                       | Statut `NO_SHOW` + marquage/revert existent (ADR-0001 ✅), mais zéro SetupIntent/empreinte carte/frais paramétrable/prélèvement |
| Fiche dégustation → boucle vin (US-230)     | Rien : pas de vins, pas de vins servis, pas d'email J+2 (seul un follow-up générique J+1, non planifié en cron)                 |
| Événements collectifs (US-250)              | Rien — `/admin/events` est une console de modération d'expériences, pas des événements multi-caves                              |

## 6. Sitemap V3 [L] — mapping

**Public** : ✅ légal (CGV client+encaveur, confidentialité, annulation), 404/500, catalogue, fiche expérience, liste/fiche domaines, checkout, confirmation. ⚠️ home (recherche « Où + Pour » **sans champ Quand** — et **aucun filtre date au catalogue**), fiche domaine (pas de vins/horaires/altitude/bloc sur-mesure), billets par token (page OK, lien jamais délivré — bug §10), compte client (profil minimal, pas de moyens de paiement, pas de suppression). ❌ `/cadeaux`, `/sur-mesure`, `/contact` (formulaire), `/mentions-legales`, `/maintenance`, `/reservation/erreur`.

**Encaveur** : ✅ en-attente, inscription (checkbox register), scan (base). ⚠️ pas de page « Aujourd'hui » (redirect vers réservations ; « taux d'occupation » = formule `mois/(mois+5)`), création = formulaire unique long (pas de wizard, pas de langues/politiques/recadrage), vue sessions riche (inscrits, check-in, no-show, annulation motif) sans calendrier mensuel ni capacité par occurrence, paiements = Earnings (payouts **estimés** J+5 ouvrés, relevé YTD pas mensuel), paramètres email only, onboarding 2 étapes (sans Stripe KYC ni 1ʳᵉ expérience intégrés). ❌ `/demandes`, `/vins`, connexion encaveur dédiée, bottom nav 4 onglets, bouton scan flottant.

**Admin** : ✅ file pending + valider/refuser (motif)/suspendre + emails, recherche transverse réservations. ⚠️ pas de liste complète des domaines, remboursement support implémenté serveur **sans UI**, `VerificationLog`/`AdminAction` écrits jamais affichés. ❌ `/utilisateurs`, `/bons-cadeaux`, événements collectifs, GMV/santé webhooks/jobs.

**Auth** : ✅ email+mdp, Google (si env), self-service encaveur → `pending` → validation (décision UX #2 déjà faite). ❌ OTP « recevoir un code » (et aucun reset password — mailto), TOTP admin, `/invitation/[token]` fondateurs, pages `/auth/*`, sessions 90 j (actuel : 7 j), changement mdp/email. Apple OAuth : config env sans bouton UI.

## 7. Emails — 5 ✅ / 6 ⚠️ / 11 ❌ sur 22

✅ nouvelle réservation, annulation client (encaveur), domaine validé, domaine refusé (+ accusés). ⚠️ confirmation billet (sans PDF/.ics joints, sans QR ni lien billet — bug §10), rappel J-1 (sans météo), annulation client (sans montant), annulation cave (sans 3 alternatives), lien magique invité (jamais envoyé), récap hebdo (sans payout/relevé, cron non planifié). ❌ bons cadeaux ×2, Request ×3, OTP, no-show, J+2 coups de cœur, rappel fiche 21 h, action requise Stripe KYC, notif admin nouveau domaine.

Extras existants : digest quotidien, rappel 2 h, expiration, remboursement manuel ×2, bienvenue encaveur, vérif email + reset password (templates orphelins). Transverse : 5 templates ignorent la locale (FR en dur) ; **`sendEmail` retourne `true` silencieusement sans `RESEND_API_KEY`**.

## 8. Infra / NFR du PRD

- Zéro survente : Serializable ✅ mais **pas de k6** ; cron de libération des holds **non planifié** (§10).
- Webhooks : checkout idempotent ✅ (StripeEvent + retry) ; **Connect sans idempotence** ; aucune alerte lag ; `/api/health` = stub.
- **Feature flags : aucun système** (exigé pour tout financier).
- RLS : absent (cf. §1). CSP ✅ (avec `unsafe-inline`/`unsafe-eval`). Rate limiting ✅ mais `AUTH_RATE_LIMIT`/`REGISTRATION_RATE_LIMIT` jamais câblés.
- nLPD : PostHog EU consent-gated ✅, export ✅, anonymisation ✅ — mais **pas d'UI client de suppression** ; privacy sans mention nLPD ; pas de mentions légales.
- Perf : pas de Lighthouse CI, home sans ISR. Cache tags ✅. A11y : pas d'axe. e2e hors CI (CI = lint+tsc+vitest+build). Tests : 45 unit + 18 integration + 5 e2e.
- PWA : manifest ✅, **pas de service worker** → scan non offline (US-301).
- TWINT/TVA : absents. **DE : complet et routé** (Levier 0 quasi gratuit) ; IT absent (conforme).
- Docs : 1 seul ADR, pas de ENCAVE-V3-DESIGN.md versionné (mais Fraunces + palette premium implémentées), 48 specs ENC-XXX d'époque V2, backlog.md (mai 2026) partiellement obsolète.
- Divers : géocodage OSM Nominatim (pas Mapbox), `vite` en dependencies, gate Coming Soon codé en dur sur `encave.ch` dans le middleware.

## 9. Acquis à conserver

Lifecycle domaine + validation admin + emails (décision UX #2 ✅) ; checkout invité + token hashé (UX #4 aux ¾) ; anti-survente transactionnelle ; Stripe Connect Express complet (KYC, statuts, refunds full/partiels avec idempotency keys, webhook checkout robuste, API pinnée) ; scan QR + check-in/no-show/revert (ADR-0001) ; duplication d'expérience + export CSV ; i18n 3 locales synchrones + garde CI ; SEO (sitemap hreflang, JSON-LD, robots, 2 pages contenu) ; design Fraunces/premium ; 19 templates email avec retry/logs ; suite de tests.

## 10. Bugs réels sur `dev` (indépendants de la V3)

1. **Email de confirmation sans QR ni lien billet** : `checkout-confirmation.service.ts` n'envoie pas `bookingId`/`accessToken` → bouton vers la homepage, lien magique invité jamais délivré. Idem `resendConfirmationEmail`.
2. **`expire-pending-bookings` absent de `vercel.json`** → holds jamais libérés automatiquement en prod. `follow-ups` et `weekly-summary` orphelins aussi.
3. **QR écran de confirmation encode `/checkin/{bookingId}`** — route inexistante, format incompatible avec le scanner.
4. Webhook Stripe **Connect sans idempotence**.
5. `ModifyBookingCard` → lien mort `/bookings/[id]/manage`.
6. Onglets « À venir / Passées » de my-bookings non fonctionnels.
7. `requestAccountDeletion` (nLPD) et `refundBookingManually` (admin) sans aucune UI.
8. `sendEmail` succès silencieux sans `RESEND_API_KEY`.
9. KPI « taux d'occupation » = `mois/(mois+5)`.
10. « Prochain virement » et statuts payés = heuristique J+5 ouvrés, non réconciliés Stripe.
11. Reçu PDF « Taxes et frais de service inclus » sans TVA calculée.
12. Dead code : `HowItWorks.tsx`, `PopularExperiences.tsx`, `HeroSearchBar.tsx`.
13. Mineur : référence `ENC-` + 8 chars cuid2 (doc disait ENC-XXXXXX).

## 11. Lecture par rapport au planning V3

**A** (schéma + invariants) : à étendre — seul le sous-ensemble Slot existe, sans invariants DB. **B** : largement acquis sauf B4 (vins, événements collectifs) et fiche dégustation (B5). **C** : C1-C3 en version simplifiée (cartes only, hold 30 min, pas de fee), C4 à moitié (emails à réparer), C5 à moitié (annulation ✅, anti no-show ❌), **C6 et C7 à 0 %**. **D** : k6, Lighthouse, checklist nLPD, e2e en CI — tout à construire.
