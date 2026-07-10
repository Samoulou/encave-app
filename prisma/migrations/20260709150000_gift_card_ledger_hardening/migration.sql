-- ============================================================
-- Gift card ledger hardening (P-02 code-review follow-up).
-- Closes two proven gaps in the money invariants and promotes
-- GiftCard.experienceId to a real foreign key.
-- ============================================================

-- Row-level triggers do not fire on TRUNCATE: without this guard the
-- append-only journal could be zeroed in one statement by any code
-- running under the table owner role.
CREATE OR REPLACE FUNCTION forbid_gift_card_transaction_truncate()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'gift_card_transactions is append-only (TRUNCATE forbidden)';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gift_card_transactions_no_truncate
  BEFORE TRUNCATE ON "gift_card_transactions"
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_gift_card_transaction_truncate();

-- Sign/type coherence: a redemption is always negative, purchases and
-- refunds always positive, adjustments never zero. Guarantees
-- SUM(ledger) == balance cannot drift silently through a wrong sign.
ALTER TABLE "gift_card_transactions"
  ADD CONSTRAINT "gift_card_transactions_amount_sign" CHECK (
    ("type" = 'REDEMPTION' AND "amount" < 0)
    OR ("type" IN ('PURCHASE', 'REFUND') AND "amount" > 0)
    OR ("type" = 'ADJUSTMENT' AND "amount" <> 0)
  );

-- CreateIndex
CREATE INDEX "gift_cards_experienceId_idx" ON "gift_cards"("experienceId");

-- AddForeignKey — the card survives the experience's deletion.
ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "experiences"("id") ON DELETE SET NULL ON UPDATE CASCADE;
