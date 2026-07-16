# ADR-0003 — Annulation d'un booking financé par bon cadeau : refund, restauration, reversal

- **Statut** : accepté (Sam, 2026-07-16 — décision P-16 « implémenter, pas seulement documenter »)
- **Contexte** : P-16 / WS-A.3, escalade Luca (b) du design P-09
- **Portée** : `cancelBooking` (token invité) et `cancelClientBooking` (compte client)

## Problème

Un booking financé (partiellement ou totalement) par bon cadeau utilise des
**charges & transferts séparés** (P-09) : la carte n'est débitée que de
`cardCents = totalPrice + serviceFee − giftAppliedCents` sur une **charge
plateforme** (sans `transfer_data` ni `application_fee`), et la cave reçoit
son payout `wineryPayout` par **un transfert dédié** (`giftTransferId`) au
moment de la confirmation.

Le flux d'annulation historique suppose une destination charge : il
remboursait `refundDueCents` (calculé sur le total payé) sur le
PaymentIntent avec `reverse_transfer: true`. Sur un booking bon cadeau ce
flux est doublement faux :

1. Rembourser plus que `cardCents` sur la charge carte est **rejeté par
   Stripe** (montant > charge), et `reverse_transfer` est invalide sur une
   charge sans transfert.
2. Même un refund carte réussi ne récupère **rien** auprès de la cave — le
   payout est parti par le transfert séparé → perte sèche plateforme.

## Décision

Le montant dû au client (`refundDueCents`, barème de la politique
d'annulation sur le total payé, D2 inchangé) est retourné en **trois
mouvements distincts**, orchestrés par
`src/server/services/booking-refund.service.ts` :

1. **Refund carte d'abord** (l'argent réel prime sur le solde bon) :
   `cardRefundCents = min(refundDueCents, cardCents − alreadyRefunded)`,
   remboursé sur la charge plateforme avec `reverse_transfer: false` et
   `refund_application_fee: false`. Échec carte = échec de l'annulation
   (sémantique existante conservée : release du claim seulement si erreur
   Stripe déterministe).
2. **Restauration du bon** pour le reliquat :
   `giftRestoreCents = min(refundDueCents − cardRefundCents, giftAppliedCents)`,
   écrit comme mouvement `REFUND` du ledger (note `cancellation_refund`)
   via la mécanique verrouillée de `releaseGiftForBooking` — idempotent
   (au plus un REFUND par booking), solde jamais négatif (CHECK DB).
3. **Reversal du transfert cave**, proportionnel au pourcentage remboursé :
   `reversalCents = min(wineryPayout, round(wineryPayout × refundPercent / 100))`
   via `stripe.transfers.createReversal(giftTransferId)`. Idempotence à
   deux niveaux : clé Stripe `gift_reversal_{bookingId}` + colonne durable
   `Booking.giftTransferReversalId` (garde au-delà des 24 h de la clé).
   Si le transfert n'a pas encore été settle (`giftTransferId` null),
   noop — et il ne partira plus jamais : `settleGiftTransfer` et le cron
   de réconciliation n'opèrent que sur des bookings `CONFIRMED`.

Les étapes 2 et 3 sont **post-annulation et non bloquantes** : un échec est
loggé (Pino) et consigné dans `Booking.refundError` pour réconciliation
manuelle (runbook incident-paiement), mais ne rend pas l'annulation à
l'utilisateur comme échouée — le refund carte, lui, a déjà eu lieu.

## Conséquences & limites assumées

- `Booking.refundAmount` reste un **fait Stripe** (refund carte uniquement).
  La part bon restaurée vit dans le ledger `gift_card_transactions`.
  L'e-mail client et le résultat de l'action annoncent le **total retourné**
  (carte + bon).
- `refundIssued` reste « un refund Stripe a eu lieu » — un booking card=0
  annulé a `refundIssued=false` mais son ledger porte le REFUND.
- Le refund manuel admin (`refundBookingManually`) sur un booking bon
  cadeau reste **hors périmètre** : il suppose une destination charge. À
  traiter si le besoin apparaît (le runbook litige le signale).
- Fenêtre de course théorique : un settle de transfert en vol pendant le
  claim d'annulation peut poser `giftTransferId` après notre lecture →
  reversal noop. Couvert par la campagne staging A.2 (d) et le runbook
  (reversal manuel) ; jugé acceptable (fenêtre de quelques secondes,
  détectable par rapprochement Stripe).
- Barème 50 % (STRICT 48 h–7 j) : le client récupère la carte d'abord puis
  le bon ; la cave subit le reversal proportionnel (50 % de son payout) —
  cohérent avec une annulation carte classique où `reverse_transfer`
  reprend la moitié du net.

## Alternatives rejetées

- **Tout rembourser sur la carte** (y compris la part bon) : transforme un
  bon cadeau en cash — contraire aux CGV (« pas de remboursement en
  espèces ») et vecteur d'abus (acheter un bon, réserver, annuler).
- **Tout restaurer sur le bon** (y compris la part carte) : le client qui a
  payé du cash réel recevrait du solde captif — inacceptable côté client.
- **Reversal toujours intégral** : sur un barème 50 %, la cave perdrait
  100 % de son payout alors que la plateforme ne rembourse que 50 % —
  enrichissement plateforme sans cause.
