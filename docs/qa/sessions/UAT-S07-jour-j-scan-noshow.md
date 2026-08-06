# UAT-S07 — Jour J : dashboard, scan PWA, no-show

> **Parcours** : 16, 17, 18 · **US** : US-301, US-220 (+ ADR-0001)
> **Flags** : active `NO_SHOW_FEES` (1re activation de la campagne)
> **Durée** : ~90 min · **Device** : **téléphone réel** (scan) + desktop
> **Comptes** : `jean-rene@example.com` (cave 1) · bookings de S2-C

## Objectif

La journée type de l'encaveur : dashboard « Aujourd'hui », scan PWA
offline-tolerant, double-scan détecté, reverts ADR-0001, et le prélèvement
no-show manuel (nominal, carte refusée, rejet sur non-NO_SHOW). Contient le
**premier kill-switch chronométré** de la campagne (gate NFR < 1 min).

## Prérequis

- [ ] Matrice OFF de `NO_SHOW_FEES` vérifiée (UAT-CAMPAIGN §5.3) juste avant.
- [ ] 2 bookings **aujourd'hui** sur cave 1 : créer une occurrence aujourd'hui
      (+2 h et +3 h) sur une expérience cave 1, puis réserver/payer en invité
      (2 pers. chacun). Références notées dans les artefacts.
- [ ] Booking ON_SITE avec **empreinte** de S2-C (sinon l'exécuter maintenant,
      étapes S02 10–14, après l'activation du flag ci-dessous).
- [ ] 2e booking ON_SITE avec la carte **`4000 0000 0000 0341`** (l'empreinte
      s'attache, le débit échouera) — même parcours que S2-C.

## Étapes

### A. Activation `NO_SHOW_FEES` + kill-switch chronométré (parcours 29)

| #   | Action / attendu                                                                                                                                                                                          | PASS | FAIL |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 1   | `https://encave-dev.vercel.app/fr/admin` → panneau feature flags → activer `NO_SHOW_FEES`. **Chrono A** : jusqu'à ce qu'un checkout ON_SITE (navigation privée) affiche l'empreinte → `____` s (≤ 60 s)   | [ ]  | [ ]  |
| 2   | **Kill-switch chronométré** : re-désactiver depuis `/fr/admin`. **Chrono B** : jusqu'à ce que le checkout ON_SITE (nouvel onglet privé) redevienne une réservation sans empreinte → `____` s (**< 60 s**) | [ ]  | [ ]  |
| 3   | Ré-activer `NO_SHOW_FEES` (reste ON pour la suite). Secours SQL au besoin : `UPDATE feature_flags SET enabled = true WHERE key = 'NO_SHOW_FEES';`                                                         | [ ]  | [ ]  |

### B. Dashboard « Aujourd'hui » (parcours 16)

| #   | Action / attendu                                                                                                                                                           | PASS | FAIL |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 4   | Connecté cave 1, `https://encave-dev.vercel.app/fr/dashboard` : KPIs réels (réservations du jour ≥ 2, taux de remplissage 30 j non placebo), prochains créneaux avec jauge | [ ]  | [ ]  |
| 5   | Le bouton scan est accessible ; les alertes actionnables s'affichent le cas échéant (demande > 24 h, KYC incomplet…)                                                       | [ ]  | [ ]  |

### C. Scan PWA + offline + double-scan (parcours 17)

| #   | Action / attendu                                                                                                                                          | PASS | FAIL |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 6   | **Téléphone réel**, connecté cave 1 : `https://encave-dev.vercel.app/fr/dashboard/scan` → caméra OK, liste du jour préchargée (compteur scannés/attendus) | [ ]  | [ ]  |
| 7   | Scanner le QR du booking 1 (depuis l'email #1 affiché sur le desktop) → ✓ vert, nom + nb pers.                                                            | [ ]  | [ ]  |
| 8   | **Re-scanner le même QR** → ✗ « déjà scanné »                                                                                                             | [ ]  | [ ]  |
| 9   | **Mode avion.** Scanner le booking 2 → feedback OK local (file d'attente offline)                                                                         | [ ]  | [ ]  |
| 10  | Retour réseau → la file se synchronise ; SQL : les 2 bookings sont `COMPLETED`, `checkedInAt` non nul, **une seule fois** (pas de doublon)                | [ ]  | [ ]  |
| 11  | Scanner un QR d'un booking d'une **autre date** (ex. booking J+2 de S1) → ✗ « mauvaise date »                                                             | [ ]  | [ ]  |

```sql
SELECT reference, status, "checkedInAt" FROM bookings
WHERE reference IN ('ENC-XXXXXXXX', 'ENC-YYYYYYYY');
```

### D. Reverts ADR-0001 (parcours 17)

| #   | Action / attendu                                                                                                                             | PASS | FAIL |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 12  | Desktop, `/fr/dashboard/bookings` → détail du booking 1 (`COMPLETED`) → **revert check-in** → repasse `CONFIRMED` (fenêtre 72 h, owner only) | [ ]  | [ ]  |
| 13  | Re-scanner le booking 1 → ✓ accepté à nouveau (cycle propre)                                                                                 | [ ]  | [ ]  |

### E. No-show : nominal, carte refusée, rejet non-NO_SHOW (parcours 18)

Montants cave 1 : `noShowFeeCentsSnapshot = 1500` /pers. × 2 pers. =
**30.00 CHF**, prélevés en destination charge off-session (commission de la
cave appliquée en `application_fee_amount`).

| #   | Action / attendu                                                                                                                                                                                                          | PASS | FAIL |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 14  | Détail du booking ON_SITE imprint (S2-C) → **marquer no-show** → statut `NO_SHOW`                                                                                                                                         | [ ]  | [ ]  |
| 15  | « Prélever les frais » (1 tap) → succès. Stripe → Paiements : PI off-session **30.00 CHF**, destination cave 1 ; email **#13** au client : montant + politique acceptée **horodatée**                                     | [ ]  | [ ]  |
| 16  | SQL Q5 (ci-dessous) : `noShowFeeChargeStatus='CHARGED'`, `noShowFeeChargedCents=3000`, `noShowFeeChargePaymentIntentId=pi_…`                                                                                              | [ ]  | [ ]  |
| 17  | **Double-tap** : retenter le prélèvement (2e clic rapide / recharger et re-cliquer) → refus `CHARGE_IN_PROGRESS` ou « déjà prélevé » — **un seul PI** dans Stripe                                                         | [ ]  | [ ]  |
| 18  | Booking ON_SITE carte `…0341` : marquer no-show → prélever → **échec propre** (carte refusée), `noShowFeeChargeStatus='FAILED'`, bouton retry disponible, **0 débit** Stripe                                              | [ ]  | [ ]  |
| 19  | Sur un booking **CONFIRMED** (non no-show) : le bouton prélever est absent/refusé                                                                                                                                         | [ ]  | [ ]  |
| 20  | **Revert no-show** (ADR-0001, < 72 h) sur le booking de l'étape 15 → repasse `CONFIRMED` **et** les frais prélevés sont remboursés : Q5 → `noShowFeeRefundId=re_…`, `noShowFeeRefundedCents=3000` ; Stripe : refund 30.00 | [ ]  | [ ]  |

```sql
SELECT reference, status, "noShowFeeCentsSnapshot", "noShowFeeChargeStatus",
       "noShowFeeChargedCents", "noShowFeeChargePaymentIntentId",
       "noShowFeeRefundId", "noShowFeeRefundedCents", "noShowPolicyAcceptedAt"
FROM bookings WHERE reference = 'ENC-XXXXXXXX';
```

## Vigilances

- Le prélèvement est **toujours manuel** (jamais automatique) et utilise le
  **snapshot** du montant accepté, pas le réglage courant de la cave.
- La clé d'idempotence Stripe du prélèvement est fraîche à chaque tentative
  (retry possible après FAILED) — la protection anti-double-débit est le CAS
  en base (`CHARGE_IN_PROGRESS`), c'est lui que teste l'étape 17.
- File offline : scopée par utilisateur, rejeu borné 48 h ; un scan online
  passe toujours par le serveur.

## Résultat

| Verdict global | PASS [ ] · FAIL [ ] | Date/heure : `____` |
| -------------- | ------------------- | ------------------- |

Chronos : propagation ON `____` s · kill-switch `____` s (les deux ≤ 60 s)

Anomalies ouvertes (`UAT-S07-yy`) : `____`

## Artefacts créés

```
Booking scan 1 : ENC-__________ · Booking scan offline : ENC-__________
No-show nominal : ENC-__________  PI frais : pi_____________  refund revert : re_____________
No-show carte 0341 : ENC-__________ (FAILED, 0 débit)
```
