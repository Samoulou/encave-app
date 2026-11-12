-- better-auth 1.7 only accepts a password sign-in when the credential
-- account's "accountId" equals the user's id (dist/api/routes/sign-in.mjs).
-- Accounts created by better-auth itself already have that shape, but the
-- accounts created by our seed scripts stored the EMAIL there: after the
-- upgrade those users (seeded admin / demo winemakers / test users) got
-- "Invalid email or password" on a correct password.
--
-- Data fix, no schema change: re-key the legacy credential accounts on the
-- user id. A row is skipped if the user already owns a correctly keyed
-- credential account (the unique (providerId, accountId) index would
-- otherwise reject the update).
UPDATE "accounts" AS a
SET "accountId" = a."userId"
WHERE a."providerId" = 'credential'
  AND a."accountId" <> a."userId"
  AND NOT EXISTS (
    SELECT 1
    FROM "accounts" AS b
    WHERE b."providerId" = 'credential'
      AND b."accountId" = a."userId"
  );
