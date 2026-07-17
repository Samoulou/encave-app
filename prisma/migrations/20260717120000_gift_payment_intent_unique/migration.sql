-- Idempotency guard against a double mint from two paid Stripe events for the
-- same payment (checkout.session.completed + async_payment_succeeded). One gift
-- card per Stripe PaymentIntent. NULLs are exempt (Postgres allows many NULLs
-- under a UNIQUE index), so unpaid/legacy cards are unaffected.
--
-- NOTE: this fails if duplicate NON-NULL stripePaymentIntentId rows already
-- exist (e.g. cards double-minted before this fix on a shared dev/preview DB).
-- Prod is pre-launch clean; dedupe such rows before deploying to shared DBs.
CREATE UNIQUE INDEX "gift_cards_stripePaymentIntentId_key" ON "gift_cards"("stripePaymentIntentId");
