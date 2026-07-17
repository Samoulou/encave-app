# UAT-S08 — Bons cadeaux A→Z

> **Parcours** : 10, 5, 6-gift, 26 · **US** : US-210 (+ ADR-0003)
> **Flags** : active `GIFT_CARDS` · **Durée** : ~90 min · **Device** : desktop
> (2 fenêtres pour la concurrence) · **Comptes** : `sam.copp8+client-fr@`,
> `sam.copp8+benef@`, `admin@encave.ch`
>
> ⚠ **GATE** : cette fiche ne peut être marquée PASS que si le **Volet D
> Bloc A (a)→(f)** ([MONEY-ROUTING-PROTOCOL.md](../MONEY-ROUTING-PROTOCOL.md))
> est vert — le routing de l'argent des bons est validé là-bas, S8 valide le
> produit.

## Objectif

Achat (bornes, envoi programmé, PDF, emails #6/#7), rédemption partielle,
rédemption **concurrente** (verrou transactionnel), booking card=0 sans page
Stripe, annulation gift-funded (ADR-0003), et le volet admin (passif =
somme ledger, désactivation d'un code).

## Prérequis

- [ ] Matrice OFF vérifiée **5 min avant** l'activation : `/fr/cadeaux` → 404,
      pas de champ code au checkout, parcours carte pure inchangé.
- [ ] Activer `GIFT_CARDS` (`/fr/admin`, panneau flags).
- [ ] Bons seedés disponibles : `ENCV-K4M2-P7RD` (100.00), `ENCV-W8XQ-4TZN`
      (90.00 restant), `ENCV-J6VB-9HSL` (50.00, envoi programmé J+10).
- [ ] Expérience 30 CHF cave 1 avec occurrences (EXP-A / « UAT Dégustation 30 »).

## Étapes

### A. Achat : bornes, envoi programmé, emails #6/#7 (parcours 10)

| #   | Action / attendu                                                                                                                                                           | PASS | FAIL |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 1   | `https://encave-dev.vercel.app/fr/cadeaux` : vitrine + configurateur. Tenter **10 CHF** → refusé (min 20) ; **510 CHF** → refusé (max 500) ; pas de montant hors pas de 10 | [ ]  | [ ]  |
| 2   | Configurer un bon **50.00 CHF** : message personnel, bénéficiaire `sam.copp8+benef@gmail.com`, **date d'envoi = demain**, aperçu live conforme                             | [ ]  | [ ]  |
| 3   | Payer (`4242…4242`) : la page Stripe montre **2 lignes** — 50.00 (bon) + **2.50 (frais)** — total 52.50                                                                    | [ ]  | [ ]  |
| 4   | Email **#6** (reçu acheteur, `+client-fr@`) : confirmation + rappel de la date d'envoi choisie. Le bénéficiaire n'a **rien reçu** (envoi programmé)                        | [ ]  | [ ]  |
| 5   | SQL : le bon existe (`status='ACTIVE'`, `balance=5000`, `deliverAt` demain, `deliveredAt` null) + ledger `PURCHASE +5000` + job `GIFT_CARD_DELIVERY` PENDING               | [ ]  | [ ]  |
| 6   | Antidater le job puis drainer (ci-dessous) → email **#7** au bénéficiaire : carte visuelle, code, message, CTA réserver · `deliveredAt` rempli · re-drain → pas de doublon | [ ]  | [ ]  |

```sql
-- 5. état du bon (noter le code affiché en confirmation)
SELECT code, status, "initialAmount", balance, "deliverAt", "deliveredAt"
FROM gift_cards ORDER BY "createdAt" DESC LIMIT 3;
SELECT type, amount, note FROM gift_card_transactions
WHERE "giftCardId" = (SELECT id FROM gift_cards WHERE code = 'ENCV-________')
ORDER BY "createdAt";
-- 6. antidatage de l'envoi programmé
UPDATE scheduled_jobs SET "runAt" = NOW() - INTERVAL '1 hour'
WHERE "dedupeKey" = 'GIFT_CARD_DELIVERY:' ||
  (SELECT id FROM gift_cards WHERE code = 'ENCV-________');
```

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://encave-dev.vercel.app/api/cron/process-scheduled-jobs
```

### B. Rédemption partielle au checkout (parcours 5)

| #   | Action / attendu                                                                                                                                                                                 | PASS | FAIL |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ---- |
| 7   | Booking 2 pers. × 30 CHF (dû **60.00**, fee OFF) : au checkout, déplier le champ code → appliquer le bon de 50.00 acheté en A → l'UI affiche **reste à payer 10.00** et le solde du bon consommé | [ ]  | [ ]  |
| 8   | La page Stripe facture **10.00** exactement → payer → confirmé                                                                                                                                   | [ ]  | [ ]  |
| 9   | SQL : booking `giftAppliedCents=5000`, ledger du bon : `REDEMPTION −5000`, `balance=0` ; **Q3 (invariant) vide**                                                                                 | [ ]  | [ ]  |

```sql
-- Q3 — invariant : balance = somme du ledger (attendu : 0 ligne)
SELECT g.code, g.balance, COALESCE(SUM(t.amount), 0) AS ledger_sum
FROM gift_cards g
LEFT JOIN gift_card_transactions t ON t."giftCardId" = g.id
GROUP BY g.id, g.code, g.balance
HAVING g.balance <> COALESCE(SUM(t.amount), 0);
```

### C. Rédemption concurrente — 2 fenêtres (parcours 5)

| #   | Action / attendu                                                                                                                                                                                   | PASS | FAIL |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 10  | Fenêtre A (normale) et fenêtre B (privée) : préparer chacune un checkout 2 pers. × 30 CHF et saisir LE MÊME code `ENCV-W8XQ-4TZN` (solde 90.00) sans valider                                       | [ ]  | [ ]  |
| 11  | Valider A puis B immédiatement (< 2 s) : le solde (90.00) ne couvre pas 2 × 60.00 — la 2e application doit être **plafonnée au solde restant (30.00)** ou refusée — jamais un solde négatif        | [ ]  | [ ]  |
| 12  | Aller au bout des deux paiements (montants carte affichés respectés) → Q3 **vide**, ledger cohérent, `balance ≥ 0`                                                                                 | [ ]  | [ ]  |
| 13  | Payer l'un, abandonner l'autre (retour depuis Stripe, puis antidater `expiresAt` + `curl expire-pending-bookings`) → le montant réservé par l'abandon est **restitué** au bon (`REFUND` au ledger) | [ ]  | [ ]  |

### D. Card = 0 : bon couvre tout, pas de page Stripe (parcours 5)

| #   | Action / attendu                                                                                                                                                                                            | PASS | FAIL |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 14  | Booking **1 pers.** × 30 CHF (dû 30.00) avec `ENCV-K4M2-P7RD` (solde 100.00) → **aucune page Stripe**, confirmation directe                                                                                 | [ ]  | [ ]  |
| 15  | SQL : `status='CONFIRMED'`, `stripePaymentIntentId` **null**, `giftAppliedCents=3000` ; ledger `REDEMPTION −3000` ; le transfert cave (`giftTransferId=tr_…`) est posé — détail montants : Volet D Bloc A.b | [ ]  | [ ]  |
| 16  | Email #1 émis normalement (billet, QR)                                                                                                                                                                      | [ ]  | [ ]  |

### E. Annulation gift-funded (parcours 6-gift, ADR-0003)

| #   | Action / attendu                                                                                                                                                                                                        | PASS | FAIL |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 17  | Policy cave = STANDARD. Booking 2 pers. J+2 payé **bon 50.00 + carte 10.00** (refaire un bon si besoin). Annuler depuis le compte : l'UI annonce la décomposition — carte **10.00** remboursée + bon **50.00** restauré | [ ]  | [ ]  |
| 18  | Stripe : refund carte 10.00 (sans reverse*transfer — charge plateforme) ; ledger : `REFUND +5000` ; reversal cave `trr*…` visible sur le transfert — détail : Bloc B cas B7                                             | [ ]  | [ ]  |
| 19  | Email #4 : montants carte/bon distincts et exacts · Q1 : `refundAmount` = carte + bon (6000), `refundError` null, `giftTransferReversalId=trr_…`                                                                        | [ ]  | [ ]  |

### F. Admin : passif & désactivation (parcours 26)

| #   | Action / attendu                                                                                                                     | PASS | FAIL |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ---- | ---- |
| 20  | `https://encave-dev.vercel.app/fr/admin/bons-cadeaux` : liste des bons, **passif total** affiché = somme SQL ci-dessous (au centime) | [ ]  | [ ]  |
| 21  | Historique ledger consultable par code (les mouvements de B/C/D/E visibles)                                                          | [ ]  | [ ]  |
| 22  | **Désactiver** un code encore soldé (fraude) → au checkout ce code est refusé proprement ; le réactiver ensuite si besoin            | [ ]  | [ ]  |

```sql
SELECT SUM(balance) AS passif_cents FROM gift_cards WHERE status = 'ACTIVE';
```

## Vigilances

- La **page succès Stripe ne conclut rien** : toujours croiser avec
  `stripe_events` (Q4, Bloc A) — delayed notification possible.
- Étape 11 : le comportement exact (plafonnement vs refus) dépend du solde au
  moment T — l'invariant non négociable est `balance ≥ 0` (CHECK en base) et
  Q3 vide. Un doublon de rédemption = **Blocker**.
- Le ledger est append-only : ne JAMAIS corriger un mouvement par UPDATE.

## Résultat

| Verdict global | PASS [ ] · FAIL [ ] · bloqué par Volet D Bloc A [ ] | Date/heure : `____` |
| -------------- | --------------------------------------------------- | ------------------- |

Anomalies ouvertes (`UAT-S08-yy`) : `____`

## Artefacts créés

```
Bon acheté A : ENCV-____-____  pi_____________  (50.00, envoi programmé)
Booking partiel B : ENC-__________  pi_____________
Concurrence C : ENC-__________ / ENC-__________  (code W8XQ)
Card=0 D : ENC-__________  tr_____________
Gift-funded annulé E : ENC-__________  re_____________  trr_____________
Code désactivé : ENCV-____-____
```
