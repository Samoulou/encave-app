-- Backfill: mark all PRE-EXISTING users as email-verified so the new
-- emailVerified gate on the guest-booking-by-email paths (client bookings
-- read/cancel, profile update, privacy export + account deletion) does not
-- lock out accounts created before verification-on-sign-up existed.
--
-- New sign-ups AFTER this deploy start unverified (better-auth default) and
-- verify via the emailed link — that is what closes the takeover vector.
UPDATE "users" SET "emailVerified" = true WHERE "emailVerified" = false;
