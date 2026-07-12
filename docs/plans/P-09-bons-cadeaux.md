# P-09 — Bons cadeaux 💰

> **Statut** : plan · **Branche** : `samuel/enc-XX-bons-cadeaux` (fallback sans Linear : `claude/p-09-bons-cadeaux`) · **PR** : # (2 PRs autorisées)
> **Sources** : `docs/ENCAVE-V3-DELIVERY-PLAN.md` §P-09 + §3 socle · items `L-080→L-087` du backlog (E6, US-210) · specs `docs/v3/ENCAVE-V3-PAGES-EMAILS.md` (§2 `/cadeaux`, §5 `/compte/bons-cadeaux`, §7 `/admin/bons-cadeaux`, §8 emails #6/#7), `docs/v3/ENCAVE-V3-BUSINESS.md` §4, `docs/v3/ENCAVE-V3-PRD.md` US-210 + §13.2

## 1. Objectif (2 lignes max)

Un client achète un bon cadeau (montant libre 20–500 CHF **ou** expérience), reçoit un PDF personnalisé, et le bénéficiaire le reçoit à la date choisie ; ce code se rédime au checkout (partiel, solde reporté), l'admin voit le passif comptable total.

## 2. Scope

**IN** — items `L-080→L-087`, découpés en **2 PRs** :

- **PR 1 — Achat / envoi / PDF** (`L-080`, `L-081`, `L-082`, `L-083`) :
  - Page publique `/cadeaux` : vitrine + configurateur (montant libre 20–500 **ou** expérience, message perso, destinataire, date d'envoi, aperçu live, FAQ 5 ans) — parcours ≤ 2 min
  - Checkout cadeau Stripe : **fee 2.50 à l'achat** (fonds plateforme, **pas de commission à l'achat**) + webhook → création `GiftCard` **via ledger** (mouvement `PURCHASE`)
  - PDF cadeau personnalisé (react-pdf, décliné de la charte, 2–3 variantes)
  - Envoi programmé : **email #6** acheteur immédiat + **email #7** bénéficiaire à la date choisie (`ScheduledJob` type `GIFT_CARD_DELIVERY` + cron), renvoyable
- **PR 2 — Rédemption / compte / admin** (`L-084`, `L-085`, `L-086`, `L-087`) :
  - Rédemption au checkout : champ code (déplie/applique/solde restant affiché et exact), rédemption **partielle**, **verrou transactionnel**, **commission du palier de la cave à la rédemption**
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

1. **Validators** (`src/lib/validators/giftCard.ts`) — Zod v4 : montant libre `int` 2000–50000 cents **xor** `experienceId`, message (long borné), destinataire, `deliverAt` (aujourd'hui→+1 an), locale. `safeParse` uniquement.
2. **Service** `giftCard.service.ts` : `generateGiftCode()` (préfixe lisible, unique — cf. `ensureUniqueSlug`/`generateBookingReference` comme modèles), `createGiftCardFromPayment()` (idempotent sur `stripePaymentIntentId`, crée `GiftCard` + mouvement `PURCHASE` en une transaction, arme `ScheduledJob` `GIFT_CARD_DELIVERY` `runAt = deliverAt`), `sendPurchaserEmail` (#6, immédiat).
3. **Server action** `giftCard.ts` : `createGiftCardCheckoutAction` — pas d'auth requise (achat invité possible, comme le checkout) mais **rate-limit par IP** + `safeParse`. Crée une Stripe Checkout Session (via `getStripe()`), montant = valeur du bon + **2.50 fee** ; **pas** de `transfer_data`/`application_fee` (fonds 100% plateforme, aucune cave impliquée à l'achat). Retour `ActionResult`.
4. **Webhook Stripe** : brancher l'événement `checkout.session.completed` de type cadeau sur `createGiftCardFromPayment` — idempotence via `StripeEvent` (même garde que checkout/connect, cf. Known Debt « stale »).
5. **PDF** `giftCard-pdf.service.tsx` (@react-pdf/renderer) : 2–3 variantes chartées (Fraunces titres, motif verre), message + code + solde + validité. Attaché à l'email (#6 acheteur, #7 bénéficiaire).
6. **Cron / job** : ajouter l'entrée au `JOB_REGISTRY` de `src/app/api/cron/process-scheduled-jobs/route.ts` — `{ type: 'GIFT_CARD_DELIVERY', flag: 'GIFT_CARDS', handler: processGiftCardDeliveryJob }` (type + flag + handler inséparables). Handler idempotent : n'envoie #7 que si `deliveredAt == null`, pose `deliveredAt`.
7. **UI** `/cadeaux` (route publique, ISR/`setRequestLocale`, mobile-first) : vitrine + configurateur client (aperçu live = client component isolé), FAQ 5 ans. `loading.tsx`/`error.tsx`. i18n ×3.

### PR 2 — Rédemption / compte / admin

8. **Service rédemption** `giftCard.service.ts::redeemGiftCard()` : dans `prisma.$transaction` avec **`SELECT … FOR UPDATE`** sur la ligne `GiftCard` (verrou pessimiste, cf. §6) → relit `balance`, calcule le montant appliqué (`min(balance, dûRestant)`), écrit le mouvement `REDEMPTION` (négatif) + décrémente `balance` dans la **même** transaction. Le `CHECK balance >= 0` est le dernier rempart.
9. **Point d'injection checkout** (`src/server/actions/checkout.ts::createBookingAndCheckout`, ~l.525-815) : champ code appliqué → `redeemGiftCard` réduit le **montant payé par carte** ; la **commission reste calculée sur le subtotal expérience** via `getEffectiveCommissionRate(winery, PLATFORM_COMMISSION_RATE)` + `computeCommissionCents` (palier de la cave), **pas** sur le net après bon. Solde restant affiché. (Voir §7 décision paiement : comment la part couverte par le bon atteint la cave.)
10. **UI checkout** : champ « code cadeau » repliable (le placeholder existe dans la spec §4) — visible **seulement si flag ON** ; solde restant + total recalculé.
11. **`/compte/bons-cadeaux`** (protected) : query cachée `giftCard.queries.ts` (mes bons achetés/reçus par email du compte), code/solde/expiration, action « renvoyer » (relance email #7). États loading/empty/error.
12. **`/admin/bons-cadeaux`** (admin) : liste + **passif total = `SUM(balance)` sur ACTIVE non expirés** (le chiffre comptable — jamais un heuristique), détail ledger par code, action `disableGiftCardAction` (status → DISABLED, log Pino, **ne touche pas au ledger**).
13. **Flag OFF** : champ code masqué au checkout, `/cadeaux` renvoie 404/`notFound()`, aucune session cadeau créable. Prouvé par e2e checkout existant inchangé.

## 5. Tests & mesures

- **Tests automatisés ajoutés** :
  - Unit invariants argent (test de violation) : mouvement de mauvais signe rejeté, `balance` négative rejetée (CHECK), somme ledger == `balance` (propriété).
  - `redeemGiftCard` : partielle (solde reporté exact), code EXPIRED refusé, code DISABLED refusé, rédemption > solde plafonnée.
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
- **Risque — la part payée par le bon n'atteint pas la cave.** Le bon = fonds plateforme prépayés ; à la rédemption la cave doit toucher son net même si le client paie 0 par carte. Voir §7 (décision paiement) — à trancher AVANT ③.
- **Risque — fee 2.50 mal imputée** (comptée en commission, ou commission prise à l'achat). Mitigation : commission **0** à l'achat (aucune cave), palier **uniquement** à la rédemption, tests dédiés.
- **Risque — job d'envoi #7 rejoué** (double email / `deliveredAt` écrasé). Mitigation : handler idempotent gardé par `deliveredAt`, idempotence `StripeEvent` sur le webhook d'achat.
- **Rollback** : flag `GIFT_CARDS` OFF en < 1 min (toggle admin, cache 60 s) → `/cadeaux` 404, champ code masqué, type de job non drainé (jobs restent PENDING, réversible). **Les données déjà créées survivent** : bons achetés restent valides, aucun ledger détruit ; réactiver le flag les rend de nouveau utilisables. Revert PR possible sans migration destructive (schéma déjà en place depuis P-02).

## 7. Décisions ouvertes (à trancher AVANT ③ BUILD)

- [ ] **Flux paiement de la part couverte par le bon → cave.** À la rédemption, comment la cave touche son net sur la portion réglée par le bon (fonds plateforme) ? Options : (a) transfert Stripe séparé plateforme→compte connecté au moment de la confirmation, (b) top-up du `application_fee` inversé, (c) règlement différé hors Stripe. **Impact archi paiements — à valider avec Luca/Sam avant de coder la rédemption.**
- [ ] **Variantes de PDF** : combien (2 ou 3) et quels visuels/occasions (Noël, anniversaire, neutre) ? Copy FR à valider avec Théo.
- [ ] **Bornes montant libre** : confirmer **20–500 CHF** (2000–50000 cents) et le pas (1 CHF ? 10 CHF ?).
- [ ] **Bénéficiaire sans compte** : le lien du bon dans l'email #7 mène-t-il à `/cadeaux` (info), directement au checkout avec code prérempli, ou à une page dédiée `/bon/[code]` ? Et la rédemption exige-t-elle un compte, ou reste-t-elle possible en invité (comme la résa) ?
- [ ] **Code partiellement utilisé puis expiré** : à `expiresAt`, le solde résiduel est-il perdu (statut EXPIRED, exclu du passif) ou reste-t-il exigible ? (Impact comptable sur le passif admin.)
- [ ] **Achat cadeau d'une expérience** : bon = valeur en cents du prix figé à l'achat (rédimable partout), ou bon nominatif « 1 place sur l'expérience X » ? La spec dit « ou expérience » — préciser si c'est juste un préréglage de montant.
- [ ] **Cumul** : un bon cadeau est-il cumulable avec la booking fee 2.50 (la fee reste-t-elle due, payée par carte) et avec un second code ? (Défaut proposé : fee toujours due par carte, un seul code par checkout.)
