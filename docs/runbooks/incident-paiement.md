# Runbook — Incident paiement

> Cible : < 5 min entre l'alerte et le début du diagnostic. Testé à froid
> sur staging avant la bascule (P-16 / DoD 6).

## Signaux d'entrée

- Alerte Sentry `area:stripe-webhook` (un `markStripeEventFailed` a tourné).
- `/api/health?deep=1` passe à 503 `degraded` (`stripeEvents`) — StripeEvent
  bloqué en PROCESSING > 15 min ou FAILED sur la dernière heure.
- Client/cave signale « payé mais pas confirmé ».

## Diagnostic (dans l'ordre)

1. **Sentry** : l'issue contient `stripeEventId` + le message d'erreur.
2. **Table `stripe_events`** (Neon, lecture) :
   ```sql
   SELECT "stripeEventId", type, status, "errorMessage", "updatedAt"
   FROM stripe_events
   WHERE status IN ('FAILED', 'PROCESSING')
   ORDER BY "updatedAt" DESC LIMIT 20;
   ```
3. **Dashboard Stripe** → Développeurs → Webhooks : livraisons échouées,
   payload de l'événement, nombre de retentatives restantes.
4. Croiser avec le booking : `metadata.bookingId` du payload → table
   `bookings` (status, `stripePaymentIntentId`, `giftTransferId`,
   `refundError`).

## Remédiations

### Rejouer un événement webhook

- **Stripe CLI** : `stripe events resend evt_XXX` (compte plateforme ;
  ajouter `--stripe-account acct_XXX` pour un événement Connect).
- Ou Dashboard → Webhooks → livraison → « Renvoyer ».
- Le claim `StripeEvent` accepte le retry d'un event FAILED (le statut
  repasse PROCESSING) ; un event PROCESSED est ignoré — le rejeu est sûr.

### Event bloqué en PROCESSING (> 15 min, crash à mi-course)

1. Vérifier l'effet métier (le booking est-il CONFIRMED ?).
2. Si le traitement n'a PAS abouti : repasser l'event à FAILED puis rejouer :
   ```sql
   UPDATE stripe_events SET status = 'FAILED'
   WHERE "stripeEventId" = 'evt_XXX' AND status = 'PROCESSING';
   ```

### Transfert bon cadeau manquant (cave non payée)

- Le cron `reconcile-gift-transfers` (04:00 UTC) rattrape automatiquement
  tout booking CONFIRMED avec `giftAppliedCents > 0` et `giftTransferId`
  null. Pour forcer : `GET /api/cron/reconcile-gift-transfers` avec
  `Authorization: Bearer $CRON_SECRET`.

### Reversal manuel d'un transfert bon (annulation, ADR-0003)

Si `Booking.refundError` contient `GIFT_REVERSAL_FAILED` :

1. Récupérer `giftTransferId` sur le booking.
2. Dashboard Stripe (compte plateforme) → Transferts → `tr_XXX` →
   « Reverse transfer », montant = part remboursée du payout
   (`wineryPayout × % remboursé` — voir ADR-0003).
3. Reporter l'id du reversal sur le booking :
   ```sql
   UPDATE bookings SET "giftTransferReversalId" = 'trr_XXX',
     "refundError" = NULL WHERE id = '...';
   ```

### Restauration bon manquée (`GIFT_RESTORE_FAILED`)

Écrire le mouvement REFUND manquant (ledger append-only) — via Prisma
Studio ou SQL, montant = part bon du remboursement, `note =
'cancellation_refund_manual'`, puis incrémenter `gift_cards.balance` du
même montant. Toujours dans une transaction.

## Vérification de sortie

- `/api/health?deep=1` → 200.
- L'event est PROCESSED, le booking dans l'état attendu, l'e-mail parti
  (`email_logs`).
- Poster un résumé dans le canal d'astreinte (voir `astreinte.md`).
