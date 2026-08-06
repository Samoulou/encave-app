# MONEY-ROUTING-PROTOCOL — Volet D : validation argent & ops (gate bloquant launch)

> **Exécutant** : Sam · **Durée** : ~1,5 j étalé sur 2 jours calendaires
> (le Bloc A.e exige J+1 — payouts test quotidiens).
> **Environnement** : staging `https://encave-dev.vercel.app` + Dashboard
> Stripe **mode test** + console Neon (base `development`).
> **Critère de sortie** : (a)→(f) verts **avec captures Dashboard Stripe**
> (exigence P-16 §5), matrice B 12/12, C 6/6, D 3/3, E 5/5 dans les cibles —
> sinon fusible planning 23.11, jamais de bypass silencieux.
>
> Convention : les blancs `` `____` `` sont à remplir pendant l'exécution.

## Faits code (base des maths — vérifiés au SHA de préparation)

- `platformFee = round(totalPrice × taux)` sur le **sous-total expérience
  seul** (fee exclu) — `src/lib/business-rules/commission.ts`. Taux =
  `wineries."commissionRate"`, fallback env `PLATFORM_COMMISSION_RATE` (0.12)
  si null.
- Booking fee : **250 cts/billet** (`BOOKING_FEE_CENTS`), ligne Stripe
  séparée. Bon cadeau : fee d'achat **250 une fois**
  (`GIFT_CARD_PURCHASE_FEE_CENTS`).
- **Branche carte pure** : destination charge —
  `application_fee_amount = platformFee + serviceFeeCents`,
  `transfer_data.destination` = compte cave.
- **Branche gift** : charge **plateforme** de `cardCents` (SANS
  `transfer_data` ni application fee, `transfer_group = booking_{id}`) +
  **transfert standalone** `wineryPayout` à la confirmation
  (`metadata.bookingId`, clé d'idempotence `gift_payout_{bookingId}`,
  write-once sur `bookings."giftTransferId"`). Reversal d'annulation : clé
  `gift_reversal_{bookingId}`, write-once sur `"giftTransferReversalId"`.
- **Barèmes** : FLEXIBLE 100 % ≥ 2 h · STANDARD 100 % ≥ 24 h · STRICT
  100 % ≥ 168 h / 50 % ≥ 48 h — sur payé = billets + fee, split **carte
  d'abord** (`splitRefundBetweenCardAndGift`), policy = snapshot du booking.
- `refundBookingManually` (admin) **refuse** un booking gift-funded
  (CONFLICT).
- **No-show** : `noShowFeeCentsSnapshot × guestCount`, destination charge
  off-session, clé d'idempotence **fraîche par tentative**
  (`no-show-fee:{id}:{cuid}`), anti-double-débit = CAS `CHARGE_IN_PROGRESS`,
  `StripeCardError` → FAILED retry.
- **Seule la cave 1** (Domaine Germanier) a un compte Connect réel
  (`SEED_STRIPE_TEST_ACCOUNT`) → tout passe par elle ; on fait varier son
  `commissionRate`/`cancellationPolicy` **AVANT chaque création** (snapshotés
  au booking).

## Jeu de montants canonique

Cave 1 à **10 %**, EXP-A **30 CHF × 2 pers.**, `BOOKING_FEE` ON :

| Grandeur                       | Centimes | CHF   |
| ------------------------------ | -------- | ----- |
| Dû client (6000 + 500)         | **6500** | 65.00 |
| Carte après bon 50 CHF         | **1500** | 15.00 |
| `platformFee` (10 % de 6000)   | **600**  | 6.00  |
| `wineryPayout` (6000 − 600)    | **5400** | 54.00 |
| App fee carte pure (600 + 500) | **1100** | 11.00 |

Chaque nombre est unique → zéro ambiguïté dans Stripe.

---

## Les 6 requêtes SQL (console Neon — colonnes camelCase TOUJOURS entre guillemets)

**Q1 — état argent d'un booking**

```sql
SELECT reference, status, "totalPrice", "serviceFeeCents", "platformFee",
       "wineryPayout", "cancellationPolicy", "giftCardId", "giftAppliedCents",
       "giftTransferId", "giftTransferReversalId", "stripePaymentIntentId",
       "stripeCheckoutSessionId", "refundIssued", "refundAmount",
       "stripeRefundId", "refundError", "cancelledAt"
FROM bookings WHERE reference = 'ENC-XXXXXXXX';
```

**Q2 — ledger d'un bon**

```sql
SELECT t.type, t.amount, t."bookingId", t.note, t."createdAt"
FROM gift_card_transactions t
JOIN gift_cards g ON g.id = t."giftCardId"
WHERE g.code = 'ENCV-XXXX-XXXX'
ORDER BY t."createdAt";
```

**Q3 — invariant balance = Σ ledger (attendu : 0 ligne, TOUJOURS)**

```sql
SELECT g.code, g.balance, COALESCE(SUM(t.amount), 0) AS ledger_sum
FROM gift_cards g
LEFT JOIN gift_card_transactions t ON t."giftCardId" = g.id
GROUP BY g.id, g.code, g.balance
HAVING g.balance <> COALESCE(SUM(t.amount), 0);
```

**Q4 — santé StripeEvent (conclure CHAQUE cas ici, jamais sur la page succès)**

```sql
SELECT "stripeEventId", type, status, "errorMessage", "updatedAt"
FROM stripe_events
WHERE status IN ('FAILED', 'PROCESSING')
ORDER BY "updatedAt" DESC LIMIT 20;
```

**Q5 — no-show d'un booking**

```sql
SELECT reference, status, "stripeCustomerId", "noShowSetupIntentId",
       "noShowPaymentMethodId", "noShowPolicyAcceptedAt", "noShowPolicyVersion",
       "noShowFeeCentsSnapshot", "noShowFeeChargeStatus", "noShowFeeChargedCents",
       "noShowFeeChargePaymentIntentId", "noShowFeeRefundId", "noShowFeeRefundedCents"
FROM bookings WHERE reference = 'ENC-XXXXXXXX';
```

**Q6 — emails récents**

```sql
SELECT type, "recipientId", "bookingId", status, "errorMessage",
       "resendMessageId", "createdAt"
FROM email_logs ORDER BY "createdAt" DESC LIMIT 30;
```

---

## Phase 0 — mise en place (~45 min)

| #   | Action                                                                                                                                                                                                            | Fait |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 1   | Re-seed staging : `SEED_ALLOW_DESTRUCTIVE=1 SEED_STRIPE_TEST_ACCOUNT=acct_… npx prisma db seed` (URL Neon development)                                                                                            | [ ]  |
| 2   | Vérifier le compte Connect : Dashboard Stripe → Connect → Comptes → `acct_…` → **charges_enabled** ; croiser `SELECT "stripeAccountId", "stripeOnboardingComplete" FROM wineries WHERE slug='domaine-germanier';` | [ ]  |
| 3   | Vérifier `E2E_TEST` absent des env staging (Vercel → Settings → Environment Variables) — sinon transferts synthétiques `tr_e2e_…`, campagne invalide                                                              | [ ]  |
| 4   | Flags ON : `GIFT_CARDS`, `BOOKING_FEE`, `NO_SHOW_FEES` (`/fr/admin`, panneau flags)                                                                                                                               | [ ]  |
| 5   | Webhooks : 2 endpoints test **distincts**, secrets séparés, API `2025-12-15.clover` — `…/api/webhooks/stripe/checkout` et `…/api/webhooks/stripe/connect`. Dashboard Stripe → Développeurs → Webhooks             | [ ]  |
| 6   | Commission cave 1 → 10 % : `UPDATE wineries SET "commissionRate" = 0.10 WHERE slug = 'domaine-germanier';` (policy STANDARD par défaut — sera changée par cas au Bloc B)                                          | [ ]  |
| 7   | Créer **EXP-A** « UAT Money 30 » (cave 1, ONLINE, 30.00 CHF, cap. 8) avec occurrences à **J+10, J+3, J+2, J+1, aujourd'hui +3 h (<24 h), aujourd'hui +1 h 30 (<2 h)**                                             | [ ]  |
| 8   | Créer **EXP-B** « UAT Sur place » (cave 1, **ON_SITE**, cap. 8) avec occurrences aujourd'hui/J+1                                                                                                                  | [ ]  |
| 9   | Ouvrir la table de suivi (ci-dessous) : **1 booking neuf par cas, jamais de réutilisation**                                                                                                                       | [ ]  |
| 10  | Stripe CLI connecté au compte plateforme test (`stripe login`) — nécessaire pour `checkout sessions expire` et `events resend`                                                                                    | [ ]  |

Table de suivi (dupliquer autant que nécessaire) :

```
| Cas | ENC-ref | cs_ / pi_ | tr_ / trr_ / re_ | Verdict | Capture |
| --- | ------- | --------- | ---------------- | ------- | ------- |
```

---

## Bloc A — Money-routing gift (a)→(f)

### A.0 — Achat du bon G1 (levier buffer)

| #   | Action / attendu                                                                                                                                         | PASS | FAIL |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 1   | `/fr/cadeaux` : bon **50.00 CHF**, payer avec **`4000 0000 0000 0077`** (les fonds arrivent **available** immédiatement — c'est le levier buffer de A.f) | [ ]  | [ ]  |
| 2   | Stripe → Paiements : PI **52.50** avec 2 lignes (50.00 + 2.50), **charge plateforme pure** (pas de destination, pas d'app fee)                           | [ ]  | [ ]  |
| 3   | Q2 sur le code G1 (noté depuis l'email #6) : `PURCHASE +5000` · Q3 vide                                                                                  | [ ]  | [ ]  |

```
Code G1 : ENCV-____-____ · pi_____________
```

### A.a — Rédemption partielle (les 4 vérifs de routing)

| #   | Action / attendu                                                                                                                                             | PASS | FAIL |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ---- |
| 4   | Booking EXP-A 2 pers. J+2 avec G1 : checkout affiche carte à payer **15.00** → payer `4242`                                                                  | [ ]  | [ ]  |
| 5   | Stripe → Paiements → PI **15.00** : **sans** `transfer_data`, **sans** application fee, `transfer_group = booking_{id}` — **capture**                        | [ ]  | [ ]  |
| 6   | Stripe → Connect → Transferts : transfert **54.00** vers la cave, `metadata.bookingId` = l'id du booking (PAS de `source_transaction` — voulu) — **capture** | [ ]  | [ ]  |
| 7   | Q1 : `giftAppliedCents=5000`, `giftTransferId=tr_…`, `wineryPayout=5400`, `platformFee=600` · Q2 : `REDEMPTION −5000`, balance 0 · Q3 **vide** · Q4 **vide** | [ ]  | [ ]  |

### A.f — Buffer plateforme (observation, décision finance)

| #   | Action / attendu                                                                                                                                                        | PASS | FAIL |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 8   | Stripe → Balance : noter available/pending **avant** et **après** A.a — le transfert 54.00 part du **solde plateforme** pendant que la carte 15.00 est _pending_        | [ ]  | [ ]  |
| 9   | Documenter la règle d'exploitation (hors code, décision finance Sam) : `available ≥ Σ wineryPayout gift en vol` — consigner la formulation retenue au rapport de sortie | [ ]  | [ ]  |

### A.b — Card = 0 (transfert inline, sans Stripe checkout)

| #   | Action / attendu                                                                                                                                                 | PASS | FAIL |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 10  | Booking EXP-A **1 pers.** (dû **32.50**) entièrement couvert par le bon seedé **`ENCV-K4M2-P7RD`** (solde 100.00) → **pas de page Stripe**, confirmation directe | [ ]  | [ ]  |
| 11  | Q1 : `stripePaymentIntentId` **null**, `giftAppliedCents=3250`, `giftTransferId=tr_…` · Stripe : transfert **27.00** (3000 − 300 de commission) — **capture**    | [ ]  | [ ]  |
| 12  | Q2 (K4M2) : `REDEMPTION −3250`, balance 6750 · Q3 vide                                                                                                           | [ ]  | [ ]  |

### A.c — Abandon de session (rédemption relâchée)

| #   | Action / attendu                                                                                                                                                                        | PASS | FAIL |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 13  | Acheter un bon **20.00** (G2, carte 4242). Booking EXP-A 2 pers. avec G2 appliqué (carte restante 45.00) → aller sur Stripe, **ne pas payer**. Noter `cs_…` (Q1 sur le dernier booking) | [ ]  | [ ]  |
| 14  | Forcer l'expiration : `stripe checkout sessions expire cs_XXXX` (CLI) → webhook `checkout.session.expired`                                                                              | [ ]  | [ ]  |
| 15  | Le booking hold est supprimé/annulé ; Q2 (G2) : `REDEMPTION −2000` **puis** `REFUND +2000` (les mouvements survivent au booking — pas de FK, voulu) ; **aucun transfert** ; Q3 vide     | [ ]  | [ ]  |
| 16  | Renvoyer l'event (`stripe events resend evt_…` du expired) → réponse duplicate, ledger **inchangé** (pas de double REFUND)                                                              | [ ]  | [ ]  |

### A.d — Idempotence + réconciliation

| #   | Action / attendu                                                                                                                                                                                                                                                       | PASS | FAIL |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 17  | **d1** : renvoyer le `checkout.session.completed` de A.a (`stripe events resend evt_…`) → 200 duplicate ; Stripe → Transferts : toujours **UN SEUL** transfert 54.00 (triple verrou)                                                                                   | [ ]  | [ ]  |
| 18  | **d2** : vider le solde available de la plateforme (Dashboard Stripe test → Balance → payout manuel) puis rejouer un booking type A.a avec un bon neuf acheté via `4242` (fonds _pending_ → rien d'available)                                                          | [ ]  | [ ]  |
| 19  | Le webhook échoue sur le transfert : Q4 → event **FAILED** (`balance_insufficient`) ; Q1 : booking **CONFIRMED** avec `giftTransferId` **null** (l'état « cave non payée » du runbook incident-paiement)                                                               | [ ]  | [ ]  |
| 20  | Top-up : acheter un bon **60.00** via `0077` (fonds available directs) → `curl -H "Authorization: Bearer $CRON_SECRET" https://encave-dev.vercel.app/api/cron/reconcile-gift-transfers` → `transferred:1` dans la réponse `{scanned, transferred, failed, durationMs}` | [ ]  | [ ]  |
| 21  | Q1 : `giftTransferId=tr_…` posé ; Stripe : transfert **unique** (pas de doublon malgré le retry) — **capture**                                                                                                                                                         | [ ]  | [ ]  |
| 22  | **Flag-gate** : `GIFT_CARDS` OFF (SQL une ligne) → re-curl du cron → `{"skipped":"flag_off"}` → remettre ON                                                                                                                                                            | [ ]  | [ ]  |

### A.e — Payout dashboard (⚠ J+1 obligatoire — payouts test quotidiens)

| #   | Action / attendu                                                                                                                                                                  | PASS | FAIL |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 23  | Le lendemain : connecté `jean-rene@example.com` → `/fr/dashboard/payouts` → le payout du jour apparaît (réel Stripe, pas une heuristique)                                         | [ ]  | [ ]  |
| 24  | Détail du payout : la ligne du booking A.a est de type **gift** — brut **60.00** / commission **6.00** / net **54.00** — corrélée via `transfer.metadata.bookingId` — **capture** | [ ]  | [ ]  |
| 25  | Aucun `logWarn` d'écart dans les logs Vercel (Functions → filtrer `payout`)                                                                                                       | [ ]  | [ ]  |
| 26  | Relevé PDF : `https://encave-dev.vercel.app/api/dashboard/statements/2026-MM` (connecté cave 1, mois courant format `YYYY-MM`) → PDF cohérent avec les lignes du dashboard        | [ ]  | [ ]  |

---

## Bloc B — Matrice refunds (12 cas, ~2 h 30)

Règles d'exécution : **1 booking neuf par cas** · poser la **policy AVANT
création** (`UPDATE wineries SET "cancellationPolicy"='…' WHERE slug='domaine-germanier';`)
· tous 2 pers. × 30 CHF (payé 6500) sauf mention · annulation côté client
(compte ou token) · conclure chaque cas sur **Q1 + Stripe + email #4**
(triangle au centime).

| #   | Politique/slot   | %   | Financement            | Refund carte                                         | Bon restauré | Reversal cave                          | PASS | FAIL |
| --- | ---------------- | --- | ---------------------- | ---------------------------------------------------- | ------------ | -------------------------------------- | ---- | ---- |
| B1  | STANDARD · J+2   | 100 | carte pure 6500        | **6500**                                             | —            | reverse 5400 + app fee 1100            | [ ]  | [ ]  |
| B2  | STRICT · J+10    | 100 | carte pure             | **6500** (prouve palier 168 h)                       | —            | idem B1                                | [ ]  | [ ]  |
| B3  | STRICT · J+3     | 50  | carte pure             | **3250**                                             | —            | 2700 + 550                             | [ ]  | [ ]  |
| B4  | STANDARD · <24 h | 0   | carte pure             | **0** (annulé quand même)                            | —            | 0                                      | [ ]  | [ ]  |
| B5  | FLEXIBLE · J+1   | 100 | carte pure             | **6500**                                             | —            | 5400 + 1100                            | [ ]  | [ ]  |
| B6  | FLEXIBLE · <2 h  | 0   | carte pure             | **0**                                                | —            | 0                                      | [ ]  | [ ]  |
| B7  | STANDARD · J+2   | 100 | gift partiel 1500/5000 | **1500** (SANS reverse_transfer)                     | **+5000**    | `trr_` **5400** (`gift_reversal_{id}`) | [ ]  | [ ]  |
| B8  | STRICT · J+3     | 50  | gift partiel           | **1500** (carte d'abord, plafonnée)                  | **+1750**    | **2700**                               | [ ]  | [ ]  |
| B9  | STRICT · <48 h   | 0   | gift partiel           | **0 — rien ne bouge**                                | **0**        | 0                                      | [ ]  | [ ]  |
| B10 | STANDARD · J+2   | 100 | gift total 6500        | **0** (pas de PI)                                    | **+6500**    | **5400**                               | [ ]  | [ ]  |
| B11 | STRICT · J+3     | 50  | gift total             | **0**                                                | **+3250**    | **2700**                               | [ ]  | [ ]  |
| B12 | —                | —   | gift partiel           | **Admin refund manuel → CONFLICT** (message runbook) | —            | —                                      | [ ]  | [ ]  |

Protocole par cas :

1. Poser la policy (SQL) → créer le booking sur le bon slot d'EXP-A → payer
   (carte pure : 4242 ; gift : appliquer un bon acheté pour le cas — bon
   50.00 pour B7–B9, bon ≥ 65.00 pour B10–B11).
2. Annuler côté client (compte `/fr/dashboard/my-bookings` ou lien billet
   tokenisé). L'UI doit annoncer le montant **avant** confirmation.
3. Vérifier : **Q1** (`refundAmount` = carte + bon restauré, `refundError`
   null, `giftTransferReversalId` sur B7/B8/B10/B11) · **Q2/Q3** pour les cas
   gift · **Stripe** : `re_…` du bon montant — cas gift : refund **sans**
   `reverse_transfer` ; cas carte pure : refund **avec** reverse_transfer +
   app fee proportionnels · **email #4** au centime.
4. Captures Stripe : B1 (refund + reversal), B7 (refund plateforme +
   `trr_`), B10 (reversal sans refund).

Transverses obligatoires :

| #   | Vérification                                                                                                                                                                         | PASS | FAIL |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ---- |
| T1  | B1 prouve que le 100 % inclut le fee 2.50 × 2 (6500, pas 6000)                                                                                                                       | [ ]  | [ ]  |
| T2  | Idempotence : rejouer l'annulation de B7 (re-cliquer/recharger) → aucun second `re_` ni `trr_` dans Stripe                                                                           | [ ]  | [ ]  |
| T3  | Cas d'échec recommandé : refaire un B7 avec available plateforme insuffisant → échec **propre** (refundError explicite, booking cohérent), remédiation via runbook incident-paiement | [ ]  | [ ]  |
| T4  | Q3 vide après TOUT le bloc                                                                                                                                                           | [ ]  | [ ]  |

---

## Bloc C — No-show (6 cas, EXP-B ON_SITE, fee cave 1 = 15 CHF/pers.)

| #   | Cas / attendu                                                                                                                                                                                           | PASS | FAIL |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| C1  | **Imprint** : booking EXP-B 2 pers. (carte 4242) → SetupIntent `succeeded`, **0 paiement** (aucun PI de débit), Q5 rempli (`seti_…`, `pm_…`, `noShowPolicyAcceptedAt`, snapshot 1500)                   | [ ]  | [ ]  |
| C2  | **Charge nominale** : marquer no-show → prélever → PI off-session **30.00**, `application_fee_amount` **300** (10 %), destination cave 1 ; email #13 cite la politique acceptée horodatée — **capture** | [ ]  | [ ]  |
| C3  | **Decline déterministe** : booking EXP-B avec carte **`4000 0000 0000 0341`** (attache OK) → no-show → prélever → `noShowFeeChargeStatus='FAILED'`, retry disponible, **0 débit** Stripe                | [ ]  | [ ]  |
| C4  | **SCA off-session** : booking EXP-B avec carte **`4000 0027 6000 3184`** → no-show → prélever → FAILED via `requires_action` (l'authentification ne peut pas aboutir off-session), 0 débit              | [ ]  | [ ]  |
| C5  | **Revert < 72 h** (sur C2) : revert no-show → `CONFIRMED` + refund **30.00** (reverse*transfer + app fee) ; Q5 : `noShowFeeRefundId=re*…`, `noShowFeeRefundedCents=3000` ; re-tenter le revert → noop   | [ ]  | [ ]  |
| C6  | **Double-tap** : sur un nouveau no-show, déclencher le prélèvement 2× le plus vite possible (2 onglets sur le détail) → **UN SEUL** PI (CAS `CHARGE_IN_PROGRESS`) — croiser Stripe (1 seul pi\_) et Q5  | [ ]  | [ ]  |

---

## Bloc D — Commission (3 réglages successifs de la cave 1 — EN DERNIER, change le taux)

Booking neuf 2 pers. × 30 CHF (carte pure, fee ON) après CHAQUE réglage.
Lire dans Stripe : Paiements → PI → section Connect (app fee + transfert) ;
croiser Q1 `platformFee`.

| #   | Réglage (SQL avant création)                                                                                                     | App fee attendue    | Transfert cave | PASS | FAIL |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------- | -------------- | ---- | ---- |
| D1  | Founders 0 % : `UPDATE wineries SET "commissionRate" = 0 WHERE slug='domaine-germanier';`                                        | **500** (fee seule) | **6000**       | [ ]  | [ ]  |
| D2  | Launch 10 % : `… SET "commissionRate" = 0.10 …`                                                                                  | **1100**            | **5400**       | [ ]  | [ ]  |
| D3  | Fallback env : `… SET "commissionRate" = NULL …` (env 0.12)                                                                      | **1220**            | **5280**       | [ ]  | [ ]  |
| D4  | Bonus : 0 % + `BOOKING_FEE` OFF → l'`application_fee_amount` est **omise** du PI (Stripe refuse 0) — vérifier l'absence du champ | omise               | 6000           | [ ]  | [ ]  |

Remettre ensuite la configuration launch : commission **0.10**, `BOOKING_FEE`
selon la phase de la campagne UAT en cours.

---

## Bloc E — Ops chronométrés

### E.1 — Kill-switch < 1 min

| #   | Action / attendu                                                                                                                         | PASS | FAIL |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 1   | Chrono : toggle `GIFT_CARDS` OFF sur `/fr/admin` → `/fr/cadeaux` répond **404** en navigation privée. Temps : `____` s (**gate < 60 s**) | [ ]  | [ ]  |
| 2   | Secours SQL vérifié : `UPDATE feature_flags SET enabled = true WHERE key = 'GIFT_CARDS';` → la page revit ≤ 60 s (TTL cache)             | [ ]  | [ ]  |

### E.2 — Incident simulé < 5 min (runbook `docs/runbooks/incident-paiement.md`)

**Prérequis à vérifier AVANT** : un monitor externe pinge
`/api/health?deep=1` (décision ops P-16 §7 encore ouverte — **sans lui, le
< 5 min n'est pas démontrable** ; le consigner au rapport si absent).

| #   | Action / attendu                                                                                                                                                                                                                                                                            | PASS | FAIL |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 3   | « L'injecteur » (script préparé à l'avance, lancé à un moment non choisi par l'exécutant) : `UPDATE stripe_events SET status='FAILED' WHERE "stripeEventId"='evt_<event PROCESSED récent>';` et `UPDATE scheduled_jobs SET status='FAILED', "lastError"='uat-drill' WHERE id='<job DONE>';` | [ ]  | [ ]  |
| 4   | Sam déroule **en aveugle**, chrono lancé à l'alerte : alerte → Sentry/Q4 → identifier l'event → `stripe events resend evt_…` → event `PROCESSED` → re-passer le job à PENDING → `curl …/api/health?deep=1` → **200**. Temps total : `____` min (**gate < 5 min**)                           | [ ]  | [ ]  |

### E.3 — G-1 MFA (sur **preview**)

Exécution détaillée : fiche [UAT-S12](./sessions/UAT-S12-admin-nlpd-mfa.md)
partie F (étapes 19–23). Ici, cocher le gate :

| #   | Attendu                                                                                                                              | PASS | FAIL |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ---- | ---- |
| 5   | Login **Google** admin → session révoquée + redirect `/fr/login/2fa` + challenge TOTP exigé ; idem **email-OTP** ; TOTP faux → refus | [ ]  | [ ]  |

### E.4 — Crons Vercel

| #   | Attendu                                                                                                                                                       | PASS | FAIL |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 6   | Vercel Dashboard → Settings → Cron Jobs : **18 entrées** actives + plan **≥ Pro** (Hobby = 2 crons → deploy launch rejeté = **blocker**, upgrade avant L-189) | [ ]  | [ ]  |
| 7   | Preuve d'exécution 24 h dans les logs (Functions)                                                                                                             | [ ]  | [ ]  |

### E.5 — LHCI staging

| #   | Attendu                                                                                                                                                                                                    | PASS | FAIL |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 8   | `gh workflow run "Weekly Gates" --ref dev` → job `lhci-staging` : score **≥ 95** (médiane 3 runs). Vérifier la variable repo `LHCI_FICHE_PATH` (Settings → Variables). Ignorer les scores locaux (Lantern) | [ ]  | [ ]  |

---

## Bloc F — Cartes de test & pièges

| Carte                 | Comportement                                                         |
| --------------------- | -------------------------------------------------------------------- |
| `4242 4242 4242 4242` | Succès (fonds _pending_)                                             |
| `4000 0000 0000 0077` | Succès, fonds **available** immédiatement (levier buffer A.0/A.d)    |
| `4000 0025 0000 3155` | 3DS on-session (checkout : authentifier puis payer)                  |
| `4000 0000 0000 9995` | Decline `insufficient_funds` (le hold reste PENDING, retry possible) |
| `4000 0000 0000 0341` | Attache OK / **débit échoue** (cas no-show C3)                       |
| `4000 0027 6000 3184` | Authentification requise **off-session** (cas no-show C4)            |

**TWINT** : activable en mode test — Dashboard Stripe → Settings → Payment
methods. Si actif : le checkout le propose en premier ; utiliser le simulateur
Authorize/Fail et tester **les 2 chemins webhook** (`checkout.session.completed`
payé direct vs `async_payment_succeeded`). Si non activable : vérifier le
**fallback card-only** (le code retente sans TWINT/Link automatiquement) et
reporter TWINT à la checklist Stripe live (L-189).

Pièges connus :

- **Delayed notification** : la page succès ne prouve rien — TOUJOURS
  conclure sur Q4 (StripeEvent PROCESSED) + Q1.
- **Test clocks** Stripe : inapplicables aux Checkout Sessions — utiliser
  `stripe checkout sessions expire cs_…`.
- **Idempotence Stripe = 24 h** : au-delà, ce sont les gardes colonnes DB
  (`giftTransferId`, `giftTransferReversalId`, `noShowFeeChargePaymentIntentId`)
  qui protègent — c'est exactement ce que prouve A.d.

---

## Séquencement

```
J0 : Phase 0 -> A.0 / A.a / A.f -> A.b / A.c -> A.d -> Bloc B (2 h 30) -> Bloc C
     -> Bloc D (EN DERNIER : il change le taux)
J1 : A.e (payout) -> E.1 / E.2 / E.3 -> E.4 / E.5 / TWINT
```

Re-seed uniquement **entre** blocs (efface le ledger), jamais en cours de
bloc.

## Critère de sortie du Volet D

- [ ] Bloc A (a)→(f) : 100 % PASS, **captures Stripe archivées** (A.a ×2,
      A.b, A.d, A.e, B1, B7, B10, C2)
- [ ] Bloc B : 12/12 · Bloc C : 6/6 · Bloc D : 3/3 (+D4) · Bloc E : 5/5 dans
      les cibles chronométrées
- [ ] Q3 vide, Q4 vide en fin de campagne
- [ ] Verdict reporté dans [UAT-EXIT-REPORT.md](./UAT-EXIT-REPORT.md) ; tout
      FAIL non corrigé = fusible planning 23.11, **jamais de bypass
      silencieux**
