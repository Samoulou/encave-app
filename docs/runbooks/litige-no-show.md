# Runbook — Litige no-show

Un client conteste des frais de non-présentation prélevés par une cave
(P-08 : empreinte SetupIntent, prélèvement manuel par la cave, 0–50 CHF
par personne).

## Réunir la preuve du consentement

1. **Booking** : `bookings` → `noShowFeeCentsSnapshot` (montant par
   personne accepté à la réservation), `noShowPolicyAcceptedAt` /
   `noShowPolicyVersion` (snapshot du consentement), `noShowFeeChargedCents`,
   `noShowFeeChargePaymentIntentId`, statut `NO_SHOW` + horodatage.
2. **CGV** : la section « Frais de non-présentation » des CGV en vigueur à
   la date de réservation (acceptation horodatée : `termsAcceptedAt`).
3. **E-mail de notification** : le prélèvement a déclenché un e-mail au
   client citant la politique acceptée (`email_logs`).
4. **Scan/présence** : aucune entrée de check-in pour ce booking
   (`checkedInAt` null) — c'est le fait générateur.

## Arbitrage

- Prélèvement conforme (montant ≤ montant accepté, statut NO_SHOW posé par
  la cave, client absent) → litige à décliner, transmettre la preuve.
- Erreur avérée (client présent, scan raté ; montant supérieur au
  consenti) → rembourser.

## Rembourser les frais no-show

- La cave peut annuler son marquage NO_SHOW dans les 72 h
  (`revertBookingNoShow`) — ce revert déclenche le remboursement
  automatique des frais (voir `noShowFeeRefundId`).
- Au-delà, côté admin, il y a **deux remboursements distincts** — ne pas
  les confondre :
  - **Le prix de la réservation** (paiement initial du client) : `/admin` →
    **Réservations** (`/admin/bookings`) → bouton de remboursement de la
    ligne (`AdminRefundControls` → action `refundBookingManually`) : montant
    partiel ou total, motif obligatoire (≥ 10 caractères), journalisé dans
    `admin_actions`, e-mails client (dans la langue de la réservation) et
    cave envoyés automatiquement.
  - **Les frais de no-show** (prélèvement séparé, off-session, sur
    l'empreinte) : ils ne passent **pas** par ce bouton. Passer par le
    Dashboard Stripe : Paiements → le PaymentIntent des frais
    (`noShowFeeChargePaymentIntentId`) → Refund (total). Puis consigner :
    ```sql
    UPDATE bookings SET "noShowFeeRefundedCents" = <montant>,
      "noShowFeeRefundId" = 're_XXX' WHERE id = '...';
    ```

## Chargeback (contestation bancaire)

Répondre dans Stripe → Litiges avec le dossier de preuve du §1 (CGV +
booking + e-mail). Ne jamais rembourser en parallèle d'un chargeback
ouvert (double débit plateforme).
