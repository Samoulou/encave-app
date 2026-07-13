# P-08 — Anti no-show 💰

> **Statut** : plan · **Branche** : `claude/p-08-implementation-plan-f2vdwf` (fallback sans Linear ; commits `feat(p-08): …`, titre PR `P-08: Anti no-show`) · **PR** : #
> **Sources** : `docs/ENCAVE-V3-DELIVERY-PLAN.md` §P-08 · items `L-070→L-073` (E5, US-220) · specs `docs/v3/ENCAVE-V3-PRD.md` US-220 + R-5, `docs/v3/ENCAVE-V3-PAGES-EMAILS.md` (§6 espace encaveur, email #13), `docs/v3/ENCAVE-V3-BUSINESS.md` §2/§4 · **dépend de** : P-02 (schéma), P-04 (checkout V3)
> **Review** : `/code-review high` + **`/security-review`** (package 💰). Relecture **Luca (payments)** obligatoire sur le montage Stripe (empreinte + débit off-session) AVANT de coder L-072.

## Context — pourquoi ce package

Les caves subissent des no-shows non compensés sur leurs offres gratuites ou payables sur place (point de douleur encaveur n°1, PRD §2). P-08 livre le pilier **anti no-show** (US-220) : la cave active des frais (0–50 CHF, défaut 15/pers.), le client **enregistre sa carte sans débit** à la réservation (empreinte Stripe SetupIntent — aucune donnée carte chez EnCave), et en cas de `NO_SHOW` l'encaveur **déclenche manuellement** le prélèvement en 1 tap, off-session, avec notification citant la politique acceptée (email #13). Tout est **feature-flaggé** (`NO_SHOW_FEES`) et livré **flag OFF** — checkout actuel strictement inchangé. Feature non dégradable (delivery plan : « Jamais dégradés : E1, E2, E3, E5, E6 »).

**Deux constats d'exploration qui élargissent le package au-delà de l'hypothèse des 14 h du backlog** :

1. **Le type « offre gratuite / payable sur place » n'existe pas** dans le modèle (`experience.price` doit être `> 0` — `experience.ts:105-108` ; aucun flag « sur place »). Or c'est **l'offre** qui déclenche l'empreinte. → P-08 doit l'introduire.
2. **Aucune infra Stripe Customer / SetupIntent / carte sauvegardée / `paymentIntents.create` n'existe** (L-054 reporté en P-04, confirmé non implémenté). → P-08 construit la brique « empreinte + débit off-session » de zéro.

Ce qui **existe déjà et est réutilisé** : flag `NO_SHOW_FEES` (`src/lib/flags.ts:21`, non lu), colonnes `Winery.noShowFeeEnabled`/`noShowFeeCents` (`schema.prisma:172-173`, non lues), `getEffectiveCommissionRate`/`computeCommissionCents` (`src/lib/business-rules/commission.ts`), snapshot `Booking.cancellationPolicy` + consentement versionné `ageConfirmedAt`/`ageConfirmedVersion` (`src/lib/constants/consent.ts`), la ligne « No-show fees » du relevé PDF (déjà rendue, câblée à un `0` en dur — `earnings.queries.ts:451`, `monthly-statement.service.tsx:288-291`), `markBookingNoShow`/`revertBookingNoShow` (`event-detail.ts:265`/`:442`), l'UI `OccurrenceDetailSheet` + `BookingActionsMenu/Sheet`, l'idempotence `StripeEvent` (`stripe-event.service.ts`), le pattern email `ManualRefundEmail`.

## 1. Objectif (2 lignes)

Une cave active les frais de no-show ; un client réservant une offre gratuite/sur place laisse une empreinte carte sans débit après avoir accepté la politique (horodatée + versionnée) ; en cas de `NO_SHOW`, l'encaveur prélève le montant en 1 tap (off-session, net de commission vers la cave), le client est notifié (email #13), et le montant apparaît dans Earnings/relevés.

## 2. Scope

**IN** — items `L-070 → L-073` :

- **L-070** — Réglage cave : opt-in no-show + montant 0–50 CHF (défaut 15), dans le profil domaine **et** exposé au wizard/édition d'expérience (mode de paiement) ; politique **affichée avant réservation**.
- **L-071** — Empreinte carte au checkout : offre **gratuite / payable sur place** + flag ON + cave opt-in → Stripe Checkout `mode: 'setup'` (SetupIntent), **zéro débit** ; montant des frais affiché en clair ; **acceptation horodatée + versionnée persistée** ; aucune donnée carte chez EnCave.
- **L-072** — Prélèvement 1 tap (encaveur) : PaymentIntent **off-session** (destination charge, net de commission → cave), **uniquement** si `NO_SHOW` + politique active + flag ON ; **jamais automatique** ; email #13 au client citant la politique acceptée.
- **L-073** — Gestion des échecs (carte refusée/SCA : statut FAILED, retry manuel, info cave) + no-show fees visibles dans **Earnings/relevés**.

**OUT** (explicitement) :

- Flag `NO_SHOW_FEES` + colonnes `Winery.noShowFee*` : **déjà livrés** (P-03/P-02). On les câble.
- Politiques d'annulation (barèmes flexible/standard/strict) : **livrées P-03**, réutilisées à l'affichage.
- Prélèvement automatique / par cron : **exclu par spec** (toujours manuel).
- No-show fees sur offres **payées d'avance** : hors sujet (montant déjà encaissé ; l'anti no-show ne vaut que pour gratuit/sur place).
- **Gestion générale des cartes sauvegardées** (`setup_future_usage` sur le checkout payant, `/compte` liste/suppression — L-054 Should) : hors scope. L'empreinte P-08 est **liée à la réservation**, pas au compte User ; pas de réutilisation multi-achats.
- Relance client de ré-autorisation SCA (décision D3) : reportée post-launch.

## 3. Definition of Done (gate = US-220, copiée du delivery plan §P-08, complétée)

- [ ] Opt-in par cave, montant 0–50 CHF (défaut 15), politique **affichée AVANT réservation et acceptée** (horodatage persisté avec version)
- [ ] Offre gratuite/sur place → empreinte carte via SetupIntent, **zéro débit** à la réservation ; aucune donnée carte chez EnCave
- [ ] Prélèvement : uniquement **manuel**, uniquement si statut `NO_SHOW`, 1 tap → débit off-session + email #13 citant la politique acceptée (**tests : nominal + carte refusée + tentative sur booking non-`NO_SHOW` rejetée**)
- [ ] No-show fees visibles dans Earnings/relevés ; **flag OFF = checkout actuel inchangé**

Critères additionnels découverts au plan :

- [ ] **Money-routing** du débit = destination charge, `application_fee_amount` = commission du palier de la cave sur le fee (BUSINESS §2 « no-show fees » soumis à commission) ; **montant chargé = snapshot accepté × `guestCount`** (jamais le réglage courant de la cave)
- [ ] **Idempotence** : double-tap = un seul débit (garde write-once `noShowFeeChargePaymentIntentId` + clé d'idempotence Stripe déterministe)
- [ ] **Revert après débit** (D2) : `revertBookingNoShow` rembourse automatiquement le fee (reverse transfer) avant de repasser `CONFIRMED`
- [ ] `paymentMode` ON_SITE autorise `price = 0` ; ONLINE conserve `price > 0` (validator)
- [ ] **Flag OFF prouvé sans effet** : aucun sélecteur mode paiement, aucune ON_SITE créable, aucune empreinte, aucun bouton prélèvement ; e2e checkout existants verts sans modification
- [ ] Socle transverse (§3 delivery plan) vert (lint/format/i18n×3/tests/build) ; chaque server action : test unauthorized/validation/happy ; chaque invariant d'argent a son test de violation

## 4. Découpage technique

### 4.1 Migration additive (invariants + tests de violation)

`prisma/schema.prisma` — **additif uniquement** :

- **Enums** : `ExperiencePaymentMode { ONLINE, ON_SITE }` · `NoShowChargeStatus { CHARGED, FAILED }`.
- **Experience** (`:279-325`) : `paymentMode ExperiencePaymentMode @default(ONLINE)`.
- **Booking** (`:370-442`) : empreinte `stripeCustomerId String?`, `noShowSetupIntentId String?`, `noShowPaymentMethodId String?` ; consentement `noShowPolicyAcceptedAt DateTime?`, `noShowPolicyVersion String?`, `noShowFeeCentsSnapshot Int?` (montant/pers. accepté) ; débit `noShowFeeChargeStatus NoShowChargeStatus?`, `noShowFeeChargedCents Int?`, `noShowFeeChargePaymentIntentId String?` (write-once), `noShowFeeRefundId String?`, `noShowFeeRefundedCents Int?`.
- Index sur `noShowFeeChargePaymentIntentId` (corrélation payout, cf. 4.6).

### 4.2 Réglage cave + mode expérience (L-070)

- **Validators** (`src/lib/validators/winery.ts`) : `setWineryNoShowPolicySchema` = `{ wineryId, enabled: boolean, feeCents: z.number().int().min(0).max(5000) }` (mirror `setWineryCancellationPolicySchema` `:64-67`).
- **Action** `setWineryNoShowPolicy` dans `src/server/actions/winery-policy.ts` — **mirror exact** de `setWineryCancellationPolicy` (auth → safeParse → owner check → `db.winery.update` → `logInfo` audit → `invalidateWineryCaches`).
- **UI** `NoShowFeeSection.tsx` (`src/components/features/winery/`) — carte sœur de `CancellationPolicySection.tsx` sur `dashboard/winery/profile/page.tsx` : toggle opt-in + champ montant (0–50 CHF, défaut 15), **visible seulement si flag `NO_SHOW_FEES` ON**.
- **Wizard expérience** : ajouter le sélecteur `paymentMode` (En ligne / Sur place) dans `CreateExperienceForm.tsx` + `EditExperienceForm.tsx` + `createExperienceSchema`/update (`experience.ts`) + `experience-crud.ts` (`:116-137` / `:206+`). **Relax** `price` : `> 0` si ONLINE, `>= 0` si ON_SITE. Sélecteur **gated par le flag**.

### 4.3 Checkout empreinte (L-071)

- Constante `NO_SHOW_POLICY_VERSION = '1'` dans `src/lib/constants/consent.ts`.
- Dans `createBookingAndCheckout` (`checkout.ts:431-1074`) : lire `const noShowOn = await isFlagEnabled('NO_SHOW_FEES')`. **Branche empreinte** si `noShowOn && experience.paymentMode === 'ON_SITE' && winery.noShowFeeEnabled` :
  - garde `NO_SHOW_CHANGED` (miroir de `FEE_CHANGED` `:553-565`) : `displayedNoShowFeeCents` vs `winery.noShowFeeCents` → échec fermé si divergence.
  - snapshot `noShowFeeCentsSnapshot`, `noShowPolicyAcceptedAt = now`, `noShowPolicyVersion` sur le booking (au claim `:605-608` et fallback create `:713-716`, à côté de `ageConfirmedAt`).
  - session Stripe **`mode: 'setup'`** (au lieu de `buildSessionParams`/`'payment'` `:883-1032`) : `payment_method_types: ['card']` (SetupIntent off-session = carte, pas TWINT — D5), `customer_creation`/`customer_email`, `metadata: { bookingId, kind: 'no_show_setup' }`, `success_url`/`cancel_url` alignés, `expires_at` = hold.
  - **Branche ON_SITE sans empreinte** (`winery.noShowFeeEnabled === false`) : confirmer le booking **server-side sans Stripe** (nouveau `confirmOnSiteBooking`, calqué sur `confirmGiftFullyCoveredBooking` `checkout-confirmation.service.ts:296-336`).
- **Webhook** `src/app/api/webhooks/stripe/checkout/route.ts` — dans `handleCheckoutCompleted` (`:106-135`), ajouter la branche `session.mode === 'setup'` (avant le check `payment_intent` qui sinon renvoie `not_paid`) : retrouver `session.setup_intent` → `payment_method` + `session.customer`, persister (`stripeCustomerId`/`noShowSetupIntentId`/`noShowPaymentMethodId`), puis confirmer (`PENDING_PAYMENT → CONFIRMED`, updateMany gardé, **sans** `stripePaymentIntentId`). Idempotence `StripeEvent` déjà appliquée au routeur (`:61`). Abandon → `checkout.session.expired` (`:141-206`) supprime le booking PENDING et libère la place (comportement existant correct pour l'empreinte).
- **UI checkout** (`CheckoutClient.tsx`) : pour un booking empreinte, afficher la politique no-show (montant/pers.) + **checkbox obligatoire** « J'accepte les frais de no-show de X CHF/pers. » (mirror `ageConfirmed` `:510-552`), et un bandeau « empreinte carte, aucun débit maintenant ». Passer `displayedNoShowFeeCents` à l'action.

### 4.4 Prélèvement 1 tap (L-072) — **montage à relire par Luca avant code**

- **Action** `chargeNoShowFee(bookingId)` (`src/server/actions/event-detail.ts`, à côté de `markBookingNoShow`) : réutiliser `resolveContext` (`:121-169`, auth + owner check). Gardes : flag ON, `winery.noShowFeeEnabled`, `booking.status === NO_SHOW` (sinon `NOT_NO_SHOW`), empreinte présente (sinon `NO_IMPRINT`), snapshot > 0, **write-once** `noShowFeeChargePaymentIntentId == null` (claim atomique `updateMany`).
- **Stripe** `getStripe().paymentIntents.create({ amount: snapshot × guestCount, currency: 'chf', customer, payment_method, off_session: true, confirm: true, application_fee_amount: computeCommissionCents(amount, getEffectiveCommissionRate(winery, PLATFORM_COMMISSION_RATE)), transfer_data: { destination: stripeAccountId }, metadata: { bookingId, kind: 'no_show_fee' } }, { idempotencyKey: `no-show-fee:${bookingId}` })` — clé **déterministe** (pattern `winery-session-cancel` `event-detail.ts:640`) : anti-double-charge prioritaire sur le résidu « erreur cachée 24 h ».
- Succès → persister `noShowFeeChargedCents`/`noShowFeeChargePaymentIntentId`/`status CHARGED` + **email #13** (client, `Booking.locale`). `StripeCardError` (refus / `authentication_required`) → `status FAILED` + message → **retry manuel** (D3), pas de relance client.

### 4.5 Email #13 (client)

- `NoShowFeeChargedEmail.tsx` (`src/emails/templates/`) + enregistrement `templates/index.ts` ; `subjects.noShowFeeCharged` + bloc `noShowFeeCharged` (title/intro/amount/policy/acceptedDate/contact) dans `src/emails/translations.ts` (mirror `manualRefund` `:720-760`) ; `sendNoShowFeeChargedEmail(clientEmail, data, booking.locale)` dans `email.service.ts` (mirror `sendManualRefundWinemakerEmail` `:526-551`). Cite montant + version de politique + date d'acceptation. i18n ×3.

### 4.6 Échecs + comptabilité (L-073)

- **Relevé mensuel** : `getMonthlyStatementData` (`earnings.queries.ts:393-459`) — remplacer `noShowFeesCents: 0` (`:451`) par la somme du **net cave** (`noShowFeeChargedCents − commission − refunds`) des bookings `NO_SHOW` du mois. La ligne PDF existe déjà (`monthly-statement.service.tsx:288-291`).
- **Payouts live** (`payouts.queries.ts`) : corréler le transfert du débit no-show via `noShowFeeChargePaymentIntentId` (sinon `unmatchedLines` `:301-307`). ⚠️ **vérif Stripe/staging bout-en-bout non réalisable ici** (pas de Stripe/DB) → ligne de vérif ajoutée à **P-16** (comme les gift cards P-09).
- **UI détail session** : bouton « Prélever les frais de no-show » dans la branche `status === NO_SHOW` de `BookingActionsMenu.tsx` (`:212-223`) + `BookingActionsSheet.tsx` (`:182-189`), avec dialog de confirmation (montant), désactivé si pas d'empreinte / déjà `CHARGED` ; état `FAILED` + retry. Le DTO attendee (`occurrence.queries.ts`) expose `hasImprint`/`noShowFeeChargeStatus`/`noShowFeeCentsSnapshot`.

### 4.7 Revert après débit (D2)

- `revertBookingNoShow` (`event-detail.ts:442-508`) : si `noShowFeeChargeStatus === CHARGED`, **rembourser d'abord** (`refunds.create({ payment_intent: noShowFeeChargePaymentIntentId, reverse_transfer: true, refund_application_fee: true }, { idempotencyKey })` — pattern `admin.ts:382-405`), persister `noShowFeeRefundId`/`noShowFeeRefundedCents`, puis repasser `CONFIRMED`. Log Pino.

### 4.8 Feature flag

- `NO_SHOW_FEES` gate **toute** la surface P-08 (config cave, sélecteur mode, branche empreinte, bouton prélèvement). Flag OFF → toutes les expériences restent ONLINE → checkout identique → e2e existants inchangés.

## 5. Tests & mesures

**Automatisés** :

- `setWineryNoShowPolicy` : unauthorized / validation (montant 0–5000, hors bornes rejeté) / happy.
- `paymentMode` : ON_SITE autorise `price=0` ; ONLINE rejette `price=0`.
- Checkout empreinte : session `mode:'setup'` créée (mock Stripe), consentement persisté (acceptedAt + version + snapshot), garde `NO_SHOW_CHANGED`.
- Webhook setup : persiste customer/payment_method + confirme le booking (idempotent au rejeu).
- `chargeNoShowFee` : **nominal** (montant = snapshot×guests, `application_fee` = commission du palier — **cas Fondateur 0 % vs standard**, cents integer), **carte refusée** → FAILED, **tentative sur booking non-`NO_SHOW`** → rejet, **flag OFF** → rejet, **double-tap** → un seul débit (write-once + clé idempotence), empreinte absente → rejet.
- Revert après débit : refund créé (reverse_transfer), statut repassé CONFIRMED.
- Relevé : `noShowFeesCents` = net cave attendu sur jeu mixte.
- **Flag OFF** : e2e checkout existant vert, aucune régression.

**Manuel (Sam)** :

1. Flag `NO_SHOW_FEES` ON (admin) → profil cave : activer no-show 15 CHF → créer une expérience « paiement sur place » (gratuite ou prix affiché).
2. Réserver → checkbox frais no-show + bandeau empreinte → carte test `4242…` → **aucun débit**, booking confirmé (vérifier Stripe : SetupIntent, pas de charge).
3. Marquer `NO_SHOW` (après fin de session) → « Prélever les frais » → 1 tap → débit `15 × pers.`, email #13 reçu, transfert cave = net commission.
4. Relevé mensuel → ligne no-show correcte.
5. Carte qui échoue off-session → statut FAILED + retry visible.
6. Revert `NO_SHOW` après débit → remboursement automatique vérifié.
7. Flag OFF → plus de sélecteur mode, plus de bouton, checkout normal inchangé.

## 6. Risques & rollback

- **No-show mal vécu** (PRD R-5) → opt-in cave, politique affichée + **acceptée** avant réservation, déclenchement **manuel** jamais automatique.
- **Money-routing** (fee net commission → cave) **non vérifiable hors Stripe/staging** → relecture Luca au build + **vérif bout-en-bout portée à P-16** (destination charge, `application_fee`, corrélation payout).
- **Débit off-session SCA `authentication_required`** → FAILED + retry (D3), pas de relance client au launch (réversible).
- **Scope > 14 h estimées** : l'infra empreinte (Stripe Customer + SetupIntent + débit off-session) et le type « sur place / gratuit » n'existaient pas → charge réelle probablement au-dessus des L-070→L-073. Feature **non dégradable** (pilier launch) → à signaler à Sam pour le calage vélocité, pas à couper.
- **Rollback** : `NO_SHOW_FEES` OFF en < 1 min (toggle admin, cache 60 s) → plus d'empreinte ni de bouton ; empreintes/colonnes déjà posées **inertes**, réversibles ; revert PR possible (migration additive inerte). Aucune donnée détruite.

## 7. Décisions

- [x] **D1 — Représentation gratuit/sur place** (Sam : sans préférence → défaut retenu) : enum `paymentMode ONLINE/ON_SITE` **par expérience**, gated par le flag ; ON_SITE autorise `price = 0` (gratuit) et « payable sur place » (prix affiché à régler au domaine).
- [x] **D2 — Revert après débit** (Sam) : **remboursement automatique** du fee au revert (reverse transfer) avant repassage `CONFIRMED`.
- [x] **D3 — Échec de débit** (Sam) : statut **FAILED + retry manuel**, info encaveur ; **pas** de lien de ré-autorisation client au launch.
- [x] **D4 — Money-routing** (spec BUSINESS §2, à valider Luca au ③) : destination charge, `application_fee_amount` = commission du palier sur le fee ; montant = snapshot accepté × `guestCount` ; clé d'idempotence Stripe **déterministe** `no-show-fee:${bookingId}`.
- [x] **D5 — Empreinte = carte** (technique) : SetupIntent off-session sur `['card']` uniquement (TWINT non fiable en vaulting off-session) ; à confirmer par Sam en mode test.
- [ ] **À relire par Luca AVANT ③ BUILD de L-072** : montage empreinte + débit off-session (destination charge, reverse transfer au refund, idempotence, KYC cave incomplet).
