# UAT-S04 — Annulations & refunds (3 barèmes)

> **Parcours** : 6 · **US** : US-201 · **Flags** : tous OFF
> **Durée** : ~90 min · **Device** : desktop
> **Comptes** : `sam.copp8+client-fr@gmail.com` (annulation compte),
> `sam.copp8+guest@gmail.com` (annulation par token), `jean-rene@example.com`
> (annulation cave)

## Objectif

Prouver le **triangle au centime** : montant annoncé dans l'UI **avant**
confirmation = refund réel Stripe = montant dans l'email #4/#5. Toute
divergence = **Blocker**. Couvre les 3 barèmes (policy snapshotée à la
création) + le cas 50 % + l'annulation par la cave (remboursement intégral).

> La matrice complète 12 cas (y compris gift-funded) est le **Volet D Bloc B**
> ([MONEY-ROUTING-PROTOCOL.md](../MONEY-ROUTING-PROTOCOL.md)) — S4 est le
> complément UI/email, flags OFF.

## Rappel barèmes (vérifié `src/lib/business-rules/cancellation-policy.ts`)

| Politique | 100 %         | 50 %   | 0 %    |
| --------- | ------------- | ------ | ------ |
| FLEXIBLE  | ≥ 2 h avant   | —      | < 2 h  |
| STANDARD  | ≥ 24 h        | —      | < 24 h |
| STRICT    | ≥ 168 h (7 j) | ≥ 48 h | < 48 h |

Le pourcentage s'applique au **total payé** (billets + frais de service — ici
frais = 0, flag OFF). La policy utilisée est le **snapshot à la création**
(`bookings."cancellationPolicy"`), jamais la policy courante de la cave.

## Prérequis

- [ ] Expérience 30 CHF sur cave 1 (l'EXP-A du Volet D, ou en créer une :
      « UAT Dégustation 30 » à 30.00 CHF) avec des occurrences à **J+10, J+3,
      J+2, J+1 et aujourd'hui +1 h 30** (créables via
      `/fr/dashboard/experiences/[id]/sessions`).
- [ ] **1 booking neuf par cas, jamais de réutilisation.** Poser la policy de
      la cave AVANT chaque création :

```sql
UPDATE wineries SET "cancellationPolicy" = 'STANDARD'  -- ou FLEXIBLE / STRICT
WHERE slug = 'domaine-germanier';
```

Montants attendus (30 CHF × 2 pers., fee OFF → payé **6000**) :

| Cas | Policy   | Slot    | %   | Refund attendu                         |
| --- | -------- | ------- | --- | -------------------------------------- |
| C1  | STANDARD | J+2     | 100 | **60.00** (6000)                       |
| C2  | STRICT   | J+3     | 50  | **30.00** (3000)                       |
| C3  | FLEXIBLE | +1 h 30 | 0   | **0.00** (annulé quand même)           |
| C4  | STANDARD | J+2     | 100 | **60.00** — annulation par la **cave** |

## Étapes

### C1 — Client connecté, STANDARD J+2, 100 % (triangle complet)

| #   | Action / attendu                                                                                                                                                     | PASS | FAIL |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 1   | Policy cave = STANDARD (SQL). Réserver + payer 2 pers. sur l'occurrence J+2 (compte `+client-fr`)                                                                    | [ ]  | [ ]  |
| 2   | `SELECT "cancellationPolicy" FROM bookings WHERE reference='…';` → `STANDARD` (snapshot posé)                                                                        | [ ]  | [ ]  |
| 3   | `/fr/dashboard/my-bookings` → détail → « Annuler » : l'écran affiche **avant confirmation** la politique ET le montant remboursé « 60.00 CHF » — capture d'écran     | [ ]  | [ ]  |
| 4   | Confirmer → UI : annulé, remboursement annoncé 60.00                                                                                                                 | [ ]  | [ ]  |
| 5   | Email #4 (client) : montant remboursé **60.00 CHF**, délai bancaire, CTA re-réserver · Email #16 (cave, via Resend/email_logs) : créneau libéré                      | [ ]  | [ ]  |
| 6   | Stripe Dashboard → Paiements → PI du booking → Remboursement `re_…` de **60.00**, `reverse_transfer` et remboursement de l'application fee visibles (proportionnels) | [ ]  | [ ]  |
| 7   | SQL Q1 (ci-dessous) : `status=CANCELLED_BY_CLIENT`, `refundIssued=true`, `refundAmount=6000`, `stripeRefundId=re_…`, `refundError` null                              | [ ]  | [ ]  |
| 8   | La place est revendable (l'occurrence J+2 repropose 2 places)                                                                                                        | [ ]  | [ ]  |

```sql
SELECT reference, status, "totalPrice", "serviceFeeCents", "refundIssued",
       "refundAmount", "stripeRefundId", "refundError", "cancellationPolicy",
       "cancelledAt", "cancellationReason"
FROM bookings WHERE reference = 'ENC-XXXXXXXX';
```

### C2 — Invité par token, STRICT J+3, 50 %

| #   | Action / attendu                                                                                                                            | PASS | FAIL |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 9   | Policy cave = STRICT (SQL). Booking **invité** (`+guest@`) 2 pers. sur J+3, payer                                                           | [ ]  | [ ]  |
| 10  | Ouvrir le lien billet tokenisé de l'email #1 (sans compte) → « Annuler » : montant annoncé **30.00 CHF** (50 % — J+3 est ≥ 48 h et < 168 h) | [ ]  | [ ]  |
| 11  | Confirmer → email #4 : 30.00 · Stripe : refund `re_…` de 30.00 · Q1 : `refundAmount=3000`                                                   | [ ]  | [ ]  |

### C3 — FLEXIBLE < 2 h, 0 % (annulé quand même)

| #   | Action / attendu                                                                                                                | PASS | FAIL |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 12  | Policy cave = FLEXIBLE (SQL). Booking 2 pers. sur l'occurrence d'aujourd'hui +1 h 30, payer                                     | [ ]  | [ ]  |
| 13  | Annuler (compte ou token) : l'UI annonce **0.00 CHF** remboursé, en citant la politique — l'annulation reste possible           | [ ]  | [ ]  |
| 14  | Email #4 : 0.00 · Stripe : **aucun refund** · Q1 : `status=CANCELLED_BY_CLIENT`, `refundIssued=false`, `refundAmount` null ou 0 | [ ]  | [ ]  |

### C4 — Annulation par la cave (remboursement intégral)

| #   | Action / attendu                                                                                                                                        | PASS | FAIL |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 15  | Policy cave = STANDARD. Booking `+client-fr` 2 pers. J+2, payer                                                                                         | [ ]  | [ ]  |
| 16  | Connecté `jean-rene@example.com` → `/fr/dashboard/bookings` → détail → annuler (motif obligatoire)                                                      | [ ]  | [ ]  |
| 17  | Email #5 (client) : excuses, remboursement **intégral 60.00** automatique (même < 24 h du slot, la politique ne s'applique pas à la cave), alternatives | [ ]  | [ ]  |
| 18  | Stripe : refund 60.00 · Q1 : `status=CANCELLED_BY_WINERY`, `refundAmount=6000`                                                                          | [ ]  | [ ]  |

### Transverse — idempotence

| #   | Action / attendu                                                                                                                 | PASS | FAIL |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 19  | Sur C1 : retenter l'annulation (recharger la page d'annulation / re-cliquer) → refus propre, **aucun second refund** dans Stripe | [ ]  | [ ]  |

## Vigilances

- Le triangle se vérifie **au centime** : UI (étape 3) = Stripe = email #4.
  Divergence = Blocker.
- Le snapshot policy : après C2, remettre la cave en STANDARD ne change PAS le
  barème des bookings déjà créés.
- Les heures sont calculées sur `date + timeSlot` (Europe/Zurich → UTC) : un
  booking « J+2 » créé tard le soir peut passer sous 48 h — vérifier l'heure
  du slot avant de conclure FAIL.

## Résultat

| Verdict global | PASS [ ] · FAIL [ ] | Date/heure : `____` |
| -------------- | ------------------- | ------------------- |

Anomalies ouvertes (`UAT-S04-yy`) : `____`

## Artefacts créés

```
C1 : ENC-__________  pi_____________  re_____________
C2 : ENC-__________  pi_____________  re_____________
C3 : ENC-__________  pi_____________  (aucun refund)
C4 : ENC-__________  pi_____________  re_____________
```
