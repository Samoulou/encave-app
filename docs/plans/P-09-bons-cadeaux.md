# P-09 — Bons cadeaux 💰

> **Statut** : en cours — **PR 1 (achat/envoi/PDF) implémentée** sur `claude/p-09-plan-prompt-doj30b` ; PR 2 (rédemption/compte/admin) à faire · **Branche** : `claude/p-09-plan-prompt-doj30b` (branche de travail imposée) · **PR** : # (2 PRs autorisées)
>
> **Avancement PR 1** (achat/envoi/PDF) : constants + validators, action `createGiftCardCheckoutAction` (Stripe, fee 2.50 en ligne à part, fonds plateforme), service `createGiftCardFromPayment` (ledger, idempotent), handler `GIFT_CARD_DELIVERY` au `JOB_REGISTRY`, webhook branché, PDF react-pdf 3 variantes, emails #6/#7, pages `/cadeaux` (flag OFF → 404) + `/bon/[code]`, i18n ×3. ✅
>
> **Avancement PR 2** (rédemption/compte/admin) : moteur de rédemption `redeemGiftCardInTx` (verrou `SELECT … FOR UPDATE`, partielle plafonnée, refus DISABLED/EXPIRED-statut/nominatif-hors-X/épuisé, mouvement REDEMPTION négatif, `CHECK balance>=0`), `previewGiftRedemption`, `/admin/bons-cadeaux` (passif = SUM(balance) hors DISABLED, ledger, `disableGiftCardAction`), `/compte/bons-cadeaux` (mes bons + renvoyer), i18n ×3. ✅ 46 tests unit verts (suite complète 1021 verts).
>
> **Câblage checkout** (design Luca implémenté) : champ code au checkout (`GiftCodeField` + `previewGiftRedemptionAction`, ligne bon + total net dans `OrderSummary`/`MobileOrderSummary`), **réservation du bon dans la transaction booking** (`redeemGiftCardInTx`), garde `GIFT_CHANGED`, **separate charges & transfers** (branche bon : charge plateforme `card`, `transfer_group`, pas de `transfer_data`/`application_fee`), **transfert `P` à la confirmation** (`settleGiftTransfer` idempotent via `giftTransferId`), **cas `card=0`** (`confirmGiftFullyCoveredBooking` + transfert inline), **refund sur abandon** (`releaseGiftForBooking` depuis expiry webhook + cron holds), **cron `reconcile-gift-transfers`**. Migration additive `Booking.giftCardId/giftAppliedCents/giftTransferId`. Flag OFF ⇒ chemin booking inchangé. ✅ tsc/lint/i18n/1039 tests verts.
>
> **Reste avant merge** : ⚠️ **money-routing NON vérifié end-to-end ici** (pas de Stripe/DB) → vérif Stripe-test + staging **obligatoire** (point bloquant ajouté à la DoD P-16). Puis test concurrence/k6 (L-087), `/code-review max` + `/security-review`. **Escalades Luca à traiter** : corrélation payout dashboard P-13 (`transfer.metadata.bookingId`), reversal sur annulation d'un booking financé par bon (ADR Jonas), buffer trésorerie (Marco).
> **Sources** : `docs/ENCAVE-V3-DELIVERY-PLAN.md` §P-09 + §3 socle · items `L-080→L-087` du backlog (E6, US-210) · specs `docs/v3/ENCAVE-V3-PAGES-EMAILS.md` (§2 `/cadeaux`, §5 `/compte/bons-cadeaux`, §7 `/admin/bons-cadeaux`, §8 emails #6/#7), `docs/v3/ENCAVE-V3-BUSINESS.md` §4, `docs/v3/ENCAVE-V3-PRD.md` US-210 + §13.2

## 1. Objectif (2 lignes max)

Un client achète un bon cadeau (montant libre 20–500 CHF **ou** expérience), reçoit un PDF personnalisé, et le bénéficiaire le reçoit à la date choisie ; ce code se rédime au checkout (partiel, solde reporté), l'admin voit le passif comptable total.

## 2. Scope

**IN** — items `L-080→L-087`, découpés en **2 PRs** :

- **PR 1 — Achat / envoi / PDF** (`L-080`, `L-081`, `L-082`, `L-083`) :
  - Page publique `/cadeaux` : vitrine + configurateur (**montant libre 20–500 CHF pas de 10** `AMOUNT` **ou** bon nominatif sur une expérience `EXPERIENCE`, message perso, destinataire, date d'envoi, aperçu live, FAQ 5 ans) — parcours ≤ 2 min
  - Checkout cadeau Stripe : **fee 2.50 à l'achat** (fonds plateforme, **pas de commission à l'achat**) + webhook → création `GiftCard` **via ledger** (mouvement `PURCHASE`)
  - PDF cadeau personnalisé (react-pdf, décliné de la charte, **3 variantes : Noël / anniversaire / neutre**)
  - Envoi programmé : **email #6** acheteur immédiat + **email #7** bénéficiaire à la date choisie (`ScheduledJob` type `GIFT_CARD_DELIVERY` + cron), renvoyable ; email #7 pointe vers **`/bon/[code]`**
  - Page publique **`/bon/[code]`** : solde, validité, CTA « utiliser » (→ catalogue, ou fiche X si nominatif)
- **PR 2 — Rédemption / compte / admin** (`L-084`, `L-085`, `L-086`, `L-087`) :
  - Rédemption au checkout **en invité possible** : champ code (déplie/applique/solde restant affiché et exact), rédemption **partielle**, **verrou transactionnel**, **commission du palier de la cave à la rédemption**, **transfert Stripe plateforme→cave** de la part couverte par le bon (net de commission). Bon `EXPERIENCE` : rédimable **uniquement** sur son `experienceId`. **Un seul code par checkout**. La **fee 2.50 est absorbable par le bon** (mais reste une ligne visible)
  - `/compte/bons-cadeaux` : mes bons (achetés/reçus), code, solde, expiration, renvoyer
  - `/admin/bons-cadeaux` : liste, **passif total = somme du ledger**, désactiver un code (fraude), historique ledger par code
  - Test de charge/concurrence gift codes (vitest + script k6) — **zéro double-rédemption** (G-R2)

**OUT** (explicitement) :

- Modèle `GiftCard` / `GiftCardTransaction` : **déjà livrés en P-02** (ledger append-only, `CHECK (balance >= 0)`, `CHECK` signe par type, trigger anti-UPDATE/DELETE). Ce package **consomme** le schéma, il ne le crée pas. Toute migration ici serait strictement additive (au plus : index de perf, jamais une refonte).
- Flag `GIFT_CARDS` : **déjà déclaré** dans `src/lib/flags.ts` (OFF par défaut) — on le câble, on ne le crée pas.
- Reventes / marketplace de bons, transfert entre comptes, avoirs (≠ bon cadeau), remboursement d'un bon acheté → **hors scope** (aucune US launch).
- Shop / Stay (V3.1/V3.2) — la rédemption ne cible que les expériences Slot au launch.

## 3. Definition of Done (gate — copiée du delivery plan §P-09, complétée)

DoD **P-09** (= US-210, chemin critique Noël), ligne par ligne :

- [ ] Achat montant libre (20–500) OU expérience → paiement (fee 2.50) → PDF personnalisé → email acheteur immédiat + bénéficiaire à la **date choisie** (cron testé)
- [ ] Rédemption au checkout : code appliqué, partielle, solde restant affiché et exact ; **test de concurrence : 2 rédemptions simultanées du même code → une seule passe** ; solde jamais négatif (invariant DB)
- [ ] Commission du palier de la cave appliquée à la rédemption (test Fondateur vs standard)
- [ ] `/compte/bons-cadeaux` (solde, renvoyer) et `/admin/bons-cadeaux` (**passif total = somme du ledger**, désactivation code, historique)
- [ ] Validité 5 ans ; flag OFF = pas de champ code, pas de page /cadeaux

Critères additionnels découverts au plan :

- [ ] `expiresAt` = achat + 5 ans, posé à la création ; un code `EXPIRED` (par `expiresAt` OU statut) est refusé à la rédemption avec message clair
- [ ] Un code `DISABLED` (désactivation admin fraude) est refusé à la rédemption ; la désactivation n'altère jamais le ledger (append-only) — elle bascule `status` uniquement
- [ ] Fee 2.50 du cadeau **jamais** comptée en commission cave ; commission = **0** à l'achat, palier de la cave **uniquement** à la rédemption
- [ ] `deliverAt` dans le passé (date du jour) → email #7 au prochain drain (pas de perte), `deliveredAt` posé une seule fois (idempotence job)
- [ ] Rédemption avec `bookingId` tracé dans `GiftCardTransaction.bookingId` (note du mouvement)

Socle transverse (§3 du delivery plan) vert :

- [ ] `npm run lint` + `format:check` + `i18n:check` + `test:run` + e2e existants verts
- [ ] Chaque server action : test unauthorized / validation / happy path ; **chaque invariant d'argent a son test de violation** (solde négatif, double-rédemption, signe de mouvement)
- [ ] Migrations additives uniquement (au plus index) ; `prisma migrate diff` relu
- [ ] Flag `GIFT_CARDS` livré OFF ; **flag OFF prouvé sans effet** (e2e checkout existant inchangé)
- [ ] Chaînes UI ×3 locales (fr/de/en) ; états loading/empty/error présents
- [ ] Aucun secret / `console.log` / `as any` / `!` ; conventions `CLAUDE.md`

## 4. Découpage technique

**Modèles (déjà existants — rappel du contrat)**
`GiftCard` : `code` unique, `status` (ACTIVE/DISABLED/EXPIRED), `initialAmount`/`balance` (cents, `CHECK balance >= 0`), `purchaserEmail/Name`, `recipientEmail/Name`, `message`, `experienceId?`, `deliverAt?`/`deliveredAt?`, `expiresAt`, `stripePaymentIntentId?`, `locale`. `GiftCardTransaction` : `type` (PURCHASE/REDEMPTION/REFUND/ADJUSTMENT), `amount` signé (`CHECK` : PURCHASE/REFUND > 0, REDEMPTION < 0, ADJUSTMENT ≠ 0), `bookingId?`, `note?`. **Règle d'or** : tout mouvement de `balance` = un `GiftCardTransaction` **dans la même transaction Prisma**.

### PR 1 — Achat / envoi / PDF

1. **Validators** (`src/lib/validators/giftCard.ts`) — Zod v4 : nature `AMOUNT` (montant libre `int` **2000–50000 cents, multiple de 1000** = pas de 10 CHF) **xor** `EXPERIENCE` (`experienceId` requis), variante PDF (`NOEL`/`ANNIVERSAIRE`/`NEUTRE`), message (long borné), destinataire, `deliverAt` (aujourd'hui→+1 an), locale. `safeParse` uniquement.
2. **Service** `giftCard.service.ts` : `generateGiftCode()` (préfixe lisible, unique — cf. `ensureUniqueSlug`/`generateBookingReference` comme modèles), `createGiftCardFromPayment()` (idempotent sur `stripePaymentIntentId`, crée `GiftCard` + mouvement `PURCHASE` en une transaction, arme `ScheduledJob` `GIFT_CARD_DELIVERY` `runAt = deliverAt`), `sendPurchaserEmail` (#6, immédiat).
3. **Server action** `giftCard.ts` : `createGiftCardCheckoutAction` — pas d'auth requise (achat invité possible, comme le checkout) mais **rate-limit par IP** + `safeParse`. Crée une Stripe Checkout Session (via `getStripe()`), montant = valeur du bon + **2.50 fee** ; **pas** de `transfer_data`/`application_fee` (fonds 100% plateforme, aucune cave impliquée à l'achat). Retour `ActionResult`.
4. **Webhook Stripe** : brancher l'événement `checkout.session.completed` de type cadeau sur `createGiftCardFromPayment` — idempotence via `StripeEvent` (même garde que checkout/connect, cf. Known Debt « stale »).
5. **PDF** `giftCard-pdf.service.tsx` (@react-pdf/renderer) : 2–3 variantes chartées (Fraunces titres, motif verre), message + code + solde + validité. Attaché à l'email (#6 acheteur, #7 bénéficiaire).
6. **Cron / job** : ajouter l'entrée au `JOB_REGISTRY` de `src/app/api/cron/process-scheduled-jobs/route.ts` — `{ type: 'GIFT_CARD_DELIVERY', flag: 'GIFT_CARDS', handler: processGiftCardDeliveryJob }` (type + flag + handler inséparables). Handler idempotent : n'envoie #7 que si `deliveredAt == null`, pose `deliveredAt`.
7. **UI** `/cadeaux` (route publique, ISR/`setRequestLocale`, mobile-first) : vitrine + configurateur client (aperçu live = client component isolé), FAQ 5 ans. `loading.tsx`/`error.tsx`. i18n ×3.

### PR 2 — Rédemption / compte / admin

8. **Service rédemption** `giftCard.service.ts::redeemGiftCard()` : dans `prisma.$transaction` avec **`SELECT … FOR UPDATE`** sur la ligne `GiftCard` (verrou pessimiste, cf. §6) → relit `balance`, **vérifie éligibilité** (ACTIVE, non DISABLED ; si nature `EXPERIENCE` → `experienceId` == expérience du checkout), calcule le montant appliqué (`min(balance, dûRestant)`), écrit le mouvement `REDEMPTION` (négatif) + décrémente `balance` dans la **même** transaction. Le `CHECK balance >= 0` est le dernier rempart. Le solde résiduel **reste exigible** même après `expiresAt` (décision §7).
9. **Point d'injection checkout** (`src/server/actions/checkout.ts::createBookingAndCheckout`, ~l.525-815) : **un** code appliqué → `redeemGiftCard` réduit le **montant payé par carte** (la fee 2.50 est absorbable par le bon mais reste une ligne visible) ; la **commission reste calculée sur le subtotal expérience** via `getEffectiveCommissionRate(winery, PLATFORM_COMMISSION_RATE)` + `computeCommissionCents` (palier de la cave), **pas** sur le net après bon. Solde restant affiché.
   9b. **Transfert Stripe de la part bon → cave** : à la **confirmation** de la résa (webhook `payment_intent`/checkout, pas à la création), déclencher un `transfer` plateforme→compte connecté de la cave = `(part réglée par le bon − commission du palier)`, via `getStripe()`, idempotent (clé = `bookingId`). Fonds déjà en balance plateforme depuis l'achat du bon. **À faire relire par Luca (payments-expert).**
10. **UI checkout** : champ « code cadeau » repliable (le placeholder existe dans la spec §4) — visible **seulement si flag ON** ; solde restant + total recalculé.
11. **`/compte/bons-cadeaux`** (protected) : query cachée `giftCard.queries.ts` (mes bons achetés/reçus par email du compte), code/solde/expiration, action « renvoyer » (relance email #7). États loading/empty/error.
12. **`/admin/bons-cadeaux`** (admin) : liste + **passif total = `SUM(balance)` sur ACTIVE non expirés** (le chiffre comptable — jamais un heuristique), détail ledger par code, action `disableGiftCardAction` (status → DISABLED, log Pino, **ne touche pas au ledger**).
13. **Flag OFF** : champ code masqué au checkout, `/cadeaux` renvoie 404/`notFound()`, aucune session cadeau créable. Prouvé par e2e checkout existant inchangé.

### PR 2 — câblage checkout : design paiements **validé par Luca** (2026-07-12), reste à implémenter en env Stripe-test

> **Livré + testé** (commits sur la branche) : moteur `redeemGiftCardInTx` (verrou `FOR UPDATE`), `previewGiftRedemption`, `releaseGiftForBooking` (REFUND idempotent sur abandon), `previewGiftRedemptionAction`, migration additive `Booking.giftCardId/giftAppliedCents/giftTransferId` (+ index réconciliation). **À implémenter** : le montage Stripe + confirmation, ci-dessous.

**Invariant qui pilote tout** — `P = wineryPayout = E − C` est **déterministe et indépendant de la couverture bon**. Avec `E` = prix×pers, `F` = fee, `C` = commission palier, `due = E + F`, `G = min(balance, due)`, `card = due − G` : la cave touche **toujours** `P`, la plateforme garde **toujours** `C + F`. C'est ce qui interdit de sous-payer la cave (test d'intégrité : `P` et reste plateforme constants quelle que soit la part du bon).

1. **Structure = separate charges & transfers** (PAS destination charge sur le montant réduit — casse quand `card→0`). Le chemin **sans bon reste le destination charge actuel inchangé** ; la branche bon n'est active que si un code est appliqué (blast radius minimal).
2. **Timing** : **réserver le bon à la création de session** (dans la transaction booking via `redeemGiftCardInTx`, écrit le `REDEMPTION` `−G`, stampe `booking.giftCardId/giftAppliedCents`) ; **transférer `P` à la confirmation** (webhook). Réserver-à-la-création (pas à la confirmation) ferme le trou de sous-financement concurrent : le `FOR UPDATE` sérialise deux sessions in-flight sur le même code.
3. **Session (`card > 0`)** : charge plateforme, `payment_intent_data.transfer_group = booking_{id}`, **pas** de `transfer_data`/`application_fee` ; appliquer `G` en remise (coupon éphémère `amount_off=G` — copy Théo — ou line-item consolidé à `card`). metadata `{kind:'booking', giftCardId, giftAppliedCents}`.
4. **Cas `card == 0`** (bon couvre tout) : **pas de session Stripe** (Checkout refuse un total 0) → confirmer le booking **server-side** + `transfers.create(P)` inline. ⚠️ nécessite d'extraire un cœur de confirmation session-agnostique de `confirmBookingFromPaidCheckoutSession` (refacto du chemin critique — à tester).
5. **Transfert cave (webhook `checkout.session.completed`)** : `transfers.create({amount: P, destination, transfer_group, idempotencyKey: gift_payout_{bookingId}})` ; garde durable `if (giftAppliedCents>0 && giftTransferId==null)` puis persiste `giftTransferId`. **Découplé** du claim de statut (rejoué à chaque traitement tant que `giftTransferId==null`).
6. **Garde `GIFT_CHANGED`** (miroir de `FEE_CHANGED`) : passer `displayedGiftAppliedCents` depuis l'UI, échouer fermé si `applied !== displayed` (bon vidé entre-temps).
7. **Abandon** : `releaseGiftForBooking(bookingId)` (déjà écrit) appelé depuis `handleCheckoutExpired` **et le cron holds** AVANT le `delete`.
8. **Cron de réconciliation** (nouveau type `JOB_REGISTRY`, kill-switch) : rejoue `transfers.create` pour les `CONFIRMED` avec `giftAppliedCents>0 && giftTransferId==null` (couvre `balance_insufficient` transitoire + KYC).
9. **Fee absorbable** : `dueCents = E + F` ; pas d'`application_fee` sur la branche bon (revenue plateforme = encaissé − `P`).

**Escalades Luca (à traiter, hors ce câblage)** : (a) **corrélation payout dashboard P-13 cassée** — le transfert bon n'est pas lié au `payment_intent` du booking ; la query `payouts.queries.ts` doit corréler via `transfer.metadata.bookingId`, sinon la cave voit un payout sans réservation. (b) **Annulation d'un booking financé par bon** — refund carte + REFUND bon + `transfers.createReversal(giftTransferId)` ; ADR avec Jonas. (c) **Buffer de trésorerie** plateforme pour couvrir `P` au transfert (part carte settle T+2) — Marco.

**Gate avant merge** : `/security-review` (package 💰) + `/code-review max` + tests de concurrence (2 rédemptions simultanées → une passe) + k6 (L-087) + smoke staging.

## 5. Tests & mesures

- **Tests automatisés ajoutés** :
  - Unit invariants argent (test de violation) : mouvement de mauvais signe rejeté, `balance` négative rejetée (CHECK), somme ledger == `balance` (propriété).
  - `redeemGiftCard` : partielle (solde reporté exact), code DISABLED refusé, rédemption > solde plafonnée, **solde résiduel encore rédimable après `expiresAt`** (décision §7), bon `EXPERIENCE` refusé sur une autre expérience / accepté sur la sienne.
  - **Transfert Stripe part-bon → cave** : montant = `part bon − commission palier`, idempotence sur `bookingId` (pas de double-transfert au rejeu du webhook).
  - **Test de concurrence dédié (`L-087`)** : 2 `redeemGiftCard` **simultanés** du même code (Promise.all sur 2 connexions) → exactement **une** passe, l'autre échoue proprement, `balance` finale correcte, jamais négative. Doublé d'un **script k6** de charge sur le endpoint.
  - Server actions (`createGiftCardCheckoutAction`, `disableGiftCardAction`, redemption) : unauthorized / validation / happy path.
  - Commission à la rédemption : cas **Fondateur (0%)** vs **standard (12%)** — assert commission en cents integer.
  - Job `GIFT_CARD_DELIVERY` : idempotence (`deliveredAt` posé une fois), `deliverAt` passé traité au drain.
  - Passif admin : `SUM(balance)` == somme attendue sur jeu de bons mixtes (actifs/expirés/désactivés).
  - Flag OFF : e2e checkout existant vert sans champ code ; `/cadeaux` → 404.
- **Mesures manuelles** : concurrence (k6, ci-dessus) ; envoi cron à J exact (avancer `deliverAt`, déclencher le drain, vérifier #7 + `deliveredAt`).
- **Scénario de test manuel pour Sam (reproductible)** :
  1. Flag `GIFT_CARDS` ON (admin). `/cadeaux` → configurer 100 CHF, destinataire, date = demain → payer (carte test) → recevoir email #6 + PDF, code lisible.
  2. Avancer la date / déclencher le cron → bénéficiaire reçoit email #7.
  3. Réserver une expérience (cave Fondateur puis cave standard) → appliquer le code → solde restant correct, commission attendue par palier.
  4. `/admin/bons-cadeaux` → passif total = somme des soldes ; désactiver le code → rédemption suivante refusée.
  5. Flag OFF → `/cadeaux` inaccessible, plus de champ code au checkout, parcours de résa normal.
- **Revue** : P-09 est en **`/code-review max`** (un des 3 runs « ultra » réservés) **+ `/security-review`** (package 💰) — tenant isolation, invariants argent, verrou de concurrence, idempotence webhook/job.

## 6. Risques & rollback

- **Risque principal — double-rédemption / solde négatif sous concurrence.** Mitigation : verrou pessimiste `SELECT … FOR UPDATE` sur la `GiftCard` dans la transaction de rédemption **+** `CHECK (balance >= 0)` comme dernier rempart **+** ledger append-only (trigger). Test de concurrence dédié bloquant (`L-087`, gate G-R2).
- **Risque — la part payée par le bon n'atteint pas la cave.** Résolu : **transfert Stripe séparé** plateforme→cave à la confirmation (§7, étape 9b), idempotent sur `bookingId`. Relecture Luca requise (double-transfert, remboursement, KYC cave incomplet).
- **Risque — bon nominatif `EXPERIENCE` sur une expérience archivée/complète/supprimée.** Le bon devient inutilisable sans faute du bénéficiaire. Mitigation : à définir au ③ (proposer un repli « valeur équivalente sur une autre expérience de la même cave » ou remboursement du bon) ; à défaut, message clair + contact support. `experienceId` en `onDelete: SetNull` (déjà au schéma) → gérer le cas `null`.
- **Risque — passif comptable non purgé (solde exigible à vie).** Le passif admin gonfle indéfiniment (décision §7). Mitigation : reporting clair (âge des bons), confirmation compta/nLPD avant launch.
- **Risque — fee 2.50 mal imputée** (comptée en commission, ou commission prise à l'achat). Mitigation : commission **0** à l'achat (aucune cave), palier **uniquement** à la rédemption, tests dédiés.
- **Risque — job d'envoi #7 rejoué** (double email / `deliveredAt` écrasé). Mitigation : handler idempotent gardé par `deliveredAt`, idempotence `StripeEvent` sur le webhook d'achat.
- **Rollback** : flag `GIFT_CARDS` OFF en < 1 min (toggle admin, cache 60 s) → `/cadeaux` 404, champ code masqué, type de job non drainé (jobs restent PENDING, réversible). **Les données déjà créées survivent** : bons achetés restent valides, aucun ledger détruit ; réactiver le flag les rend de nouveau utilisables. Revert PR possible sans migration destructive (schéma déjà en place depuis P-02).

## 7. Décisions (tranchées avec Sam — 2026-07-12)

- [x] **Flux paiement bon → cave = transfert Stripe séparé.** À la confirmation de la résa, la plateforme déclenche un `transfer` Stripe plateforme→compte connecté de la cave pour `(part réglée par le bon − commission du palier)`. Le client ne paie par carte que le reliquat. Impact archi paiements → **faire relire par Luca (payments-expert) au ③ BUILD** avant de coder la rédemption.
- [x] **Solde résiduel à 5 ans = reste exigible.** Pas de déchéance automatique du solde à `expiresAt` : un bon partiellement utilisé reste rédimable. ⚠️ **Conséquence** : le passif comptable ne se purge jamais tout seul → à confirmer côté compta/nLPD, et **à réconcilier avec la ligne DoD « Validité 5 ans »** (l'expiration ne force pas EXPIRED sur le résiduel ; option : n'expirer que les bons à solde plein jamais utilisés). Le passif admin inclut donc tous les soldes > 0, expirés ou non.
- [x] **Cadeau d'une expérience = bon nominatif « 1 place sur X ».** Le bon acheté pour l'expérience X n'est rédimable **que** sur X (pas une valeur libre). → Deux natures de bon : `AMOUNT` (montant libre, rédimable partout) et `EXPERIENCE` (nominatif, verrouillé sur `experienceId`). La rédemption vérifie `experienceId` du bon == expérience du checkout. Voir risque nouveau en §6 (X archivée/complète).
- [x] **Fee 2.50 absorbable par le bon.** La fee reste une **ligne visible** au checkout (règle CLAUDE.md), mais peut être réglée par le bon. ⚠️ **Conséquence éco** : sur ces transactions la fee ne couvre plus les coûts Stripe (la plateforme se paie sur ses propres fonds prépayés) — assumé par Sam. **Un seul code cadeau par checkout** (défaut retenu, non contredit) : évite le verrou concurrent multi-lignes.
- [x] **Bénéficiaire = page `/bon/[code]` + rédemption invitée.** L'email #7 mène à une page publique `/bon/[code]` (solde, validité, « utiliser »). La rédemption au checkout reste possible **en invité**, comme la résa actuelle — pas de compte obligatoire.
- [x] **PDF = 3 variantes : Noël, anniversaire, neutre.** Le configurateur propose le choix. Copy FR ×3 locales à caler avec Théo au ③.
- [x] **Montant libre = 20–500 CHF, pas de 10** (2000–50000 cents, incréments de 1000 cents). Validator borné en conséquence.

**Aucune décision produit ouverte restante** → feu vert pour ③ BUILD (après relecture paiements par Luca sur le transfert de rédemption).
