# UAT-S15 — Clôture : BOOKING_FEE ON + smoke « tout ON »

> **Parcours** : croisements fee × gift · **US** : US-201, US-210
> **Flags** : active `BOOKING_FEE` — configuration cible du launch (tout ON)
> **Durée** : ~90 min · **Device** : desktop
> **Comptes** : `sam.copp8+client-fr@` · `jean-rene@example.com` · admin

## Objectif

Dernière bascule : le booking fee 2.50 CHF/billet (ligne séparée, jamais
fondue), le refund recalculé sur billets **+ fee**, le croisement fee × gift,
puis un **smoke final de 30 min dans la configuration exacte du launch** —
celle qui sera consignée dans la matrice flags du rapport de sortie.

## Prérequis

- [ ] S1–S14 terminées, Volet D vert.
- [ ] Matrice OFF de `BOOKING_FEE` vérifiée 5 min avant : ligne « Frais de
      service » à 0.00 au checkout.
- [ ] Cave 1 en configuration launch : commission **10 %**
      (`UPDATE wineries SET "commissionRate" = 0.10 WHERE slug = 'domaine-germanier';`)
      · policy STANDARD. (Le Volet D Bloc D a pu la laisser sur un autre
      réglage — la reposer.)
- [ ] Activer `BOOKING_FEE` (`/fr/admin`). Chronométrer la propagation
      (≤ 60 s) : `____` s.

Montants canoniques (expérience 30 CHF × 2 pers., cave 1 à 10 %) :

```
Billets 60.00 + Frais de service 5.00 (2 × 2.50)  ->  dû 65.00 (6500)
platformFee 600 · serviceFeeCents 500 · application_fee 1100 · wineryPayout 5400
```

## Étapes

### A. Checkout avec fee : décomposition

| #   | Action / attendu                                                                                                                                              | PASS | FAIL |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 1   | Booking 2 pers. × 30 CHF (J+2, STANDARD) : le checkout affiche « Frais de service **5.00** » en **ligne séparée**, total **65.00**                            | [ ]  | [ ]  |
| 2   | Page Stripe : 2 lignes — billets 60.00 (2 × 30.00) + frais 5.00 — total 65.00. Payer                                                                          | [ ]  | [ ]  |
| 3   | Email #1 + PDF billet : décomposition visible, total 65.00 au centime                                                                                         | [ ]  | [ ]  |
| 4   | SQL : `totalPrice=6000`, `serviceFeeCents=500`, `platformFee=600`, `wineryPayout=5400` ; Stripe → PI 65.00, `application_fee_amount=1100`, destination cave 1 | [ ]  | [ ]  |

```sql
SELECT reference, "totalPrice", "serviceFeeCents", "platformFee",
       "wineryPayout", "giftAppliedCents"
FROM bookings ORDER BY "createdAt" DESC LIMIT 1;
```

### B. Refund recalculé (billets + fee)

| #   | Action / attendu                                                                                                                                | PASS | FAIL |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 5   | Annuler le booking A (STANDARD, J+2 → 100 %) : l'UI annonce **65.00** (le fee est remboursé aussi — D2 : pas de marge sur un booking remboursé) | [ ]  | [ ]  |
| 6   | Stripe : refund 65.00 · email #4 : 65.00 · Q1 : `refundAmount=6500`                                                                             | [ ]  | [ ]  |

### C. Croisement fee × gift

| #   | Action / attendu                                                                                                                                 | PASS | FAIL |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ---- |
| 7   | Acheter un bon **50.00** (`4242`) — la page Stripe montre 50.00 + 2.50 de frais d'achat (52.50)                                                  | [ ]  | [ ]  |
| 8   | Booking 2 pers. × 30 CHF avec ce bon : dû 65.00 − bon 50.00 → **carte 15.00** exactement (le bon s'impute aussi sur le fee)                      | [ ]  | [ ]  |
| 9   | SQL : `giftAppliedCents=5000`, `serviceFeeCents=500` ; ledger `REDEMPTION −5000` ; transfert cave `tr_…` = **54.00** (montants Volet D Bloc A.a) | [ ]  | [ ]  |
| 10  | Annuler (STANDARD J+2, 100 %) : carte **15.00** remboursée + bon **+50.00** restauré + reversal 54.00 — triangle UI = Stripe = email #4          | [ ]  | [ ]  |

### D. Smoke final « tout ON » (30 min chrono)

Configuration cible du launch — la consigner ensuite dans
[UAT-EXIT-REPORT.md](../UAT-EXIT-REPORT.md) :

```sql
SELECT key, enabled, "updatedAt" FROM feature_flags ORDER BY key;
-- attendu launch : BOOKING_FEE, GIFT_CARDS, NO_SHOW_FEES, REQUESTS,
--                  TASTING_SHEET, COLLECTIVE_EVENTS, OCCURRENCE_CAPACITY = true
```

| #   | Action / attendu (enchaîner, 30 min max)                                                                                                  | PASS | FAIL |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 11  | Booking invité complet (fee visible) + email #1 + lien billet tokenisé                                                                    | [ ]  | [ ]  |
| 12  | Achat bon 20.00 + rédemption immédiate sur un booking                                                                                     | [ ]  | [ ]  |
| 13  | Demande sur-mesure → offre → paiement (all-in, PAS de fee sur l'offre)                                                                    | [ ]  | [ ]  |
| 14  | Booking ON_SITE avec empreinte (0 débit)                                                                                                  | [ ]  | [ ]  |
| 15  | Scan d'un billet du jour + fiche dégustation 2 vins                                                                                       | [ ]  | [ ]  |
| 16  | `curl "https://encave-dev.vercel.app/api/health?deep=1"` → 200 · Q4 (stripe_events FAILED/PROCESSING) → vide · Q3 (invariant bons) → vide | [ ]  | [ ]  |
| 17  | `/fr/admin` : santé verte, flags conformes à la matrice launch                                                                            | [ ]  | [ ]  |

## Vigilances

- Le fee ne s'applique **jamais** aux offres sur-mesure (all-in) ni ne
  s'ajoute au montant d'un bon (le fee d'achat de bon est une ligne à part,
  constante 2.50 par achat — pas par billet).
- Les bookings créés AVANT l'activation gardent `serviceFeeCents=0` — aucun
  impact rétroactif.
- Après cette fiche, ne plus toucher aux flags : c'est l'état photographié
  par le rapport de sortie.

## Résultat

| Verdict global | PASS [ ] · FAIL [ ] | Date/heure : `____` |
| -------------- | ------------------- | ------------------- |

Chrono propagation BOOKING_FEE : `____` s · Durée smoke : `____` min

Anomalies ouvertes (`UAT-S15-yy`) : `____`

## Artefacts créés

```
Booking fee A : ENC-__________  pi_____________  re_____________
Bon C : ENCV-____-____ · Booking fee×gift : ENC-__________  tr_____________  trr_____________
Smoke : booking ENC-__________ · bon ENCV-____-____ · request REQ-__________
```
