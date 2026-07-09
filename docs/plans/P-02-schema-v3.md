# P-02 — Fondations schéma V3 & invariants

> **Statut** : en cours · **Branche** : `claude/encave-v3-business-model-8bv7bd` (fallback session, cf. P-01) · **PR** : #
> **Sources** : `docs/ENCAVE-V3-DELIVERY-PLAN.md` §P-02 · items L-020→L-030 · specs `docs/v3/ENCAVE-V3-PRD.md` US-101/210/220/230/240/250

## 1. Objectif

Toutes les tables et invariants dont les packages P-03→P-11 ont besoin existent en base, testés, sans aucune UI ni changement de comportement. Gate **G-R0'**.

## 2. Scope

**IN** : modèles `Wine`, `BookingWine`, `GiftCard` + `GiftCardTransaction` (ledger append-only, solde jamais négatif), `Request` + `RequestOffer`, `ScheduledJob`, `ExperienceOccurrence` (+ `Booking.occurrenceId` nullable), `EventParticipant` + `Experience.isCollective`, politiques cave (`cancellationPolicy`, `noShowFeeEnabled`, `noShowFeeCents`), plan cave (`plan`, `commissionRate`), `Experience.languages`, enum `ExperienceType` + `MEAL`/`EVENT` ; contraintes CHECK + triggers d'invariants en SQL ; garde de transitions Request (lib pure) ; seed V3 ; tests d'invariants sur base réelle.
**OUT** : toute UI/action/query produit (P-03+), génération automatique des occurrences par cron et bascule du checkout sur `occurrenceId` (P-05), politiques appliquées au remboursement (P-03).

## 3. Definition of Done (gate G-R0')

- [x] Migration(s) 100 % additives, `prisma migrate deploy` vert sur une base vierge rejouant tout l'historique (rejoué aussi avec les 3 index de drift pré-existants — scénario staging `db push`)
- [x] Invariants DB testés sur base réelle, chaque violation = test dédié : solde gift card < 0 **rejeté par la DB** ; UPDATE/DELETE **et TRUNCATE** sur le ledger **rejetés** (triggers row + statement) ; signe incohérent avec le type **rejeté** (CHECK) ; occurrence dupliquée (exp+date+heure) **rejetée** ; `capacityOverride < 1` et `noShowFeeCents` hors 0–5000 **rejetés** — 12 tests, matchers sur les noms de contraintes
- [x] Machine à états Request : garde de transitions en lib pure, transitions interdites = tests rouges
- [x] Zéro régression : suite vitest complète verte (805), build prod OK, `db push` sur la base dev locale sans perte
- [x] Seed V3 : 10 caves (plans/politiques variés), 40 expériences (types/langues variés dont collectif), 60 vins, requests, gift cards — vert 2× d'affilée sur base migrée (triggers actifs)
- [x] Socle transverse vert (lint, format, i18n non concerné — pas de chaîne UI)

_Écart documenté_ : la « matrice d'isolation rôle×ressource » des nouveaux modèles sera testée dans les packages qui exposent leurs premières actions (P-03/P-07/P-09/P-10) — P-02 ne crée aucune surface d'accès ; il n'y a rien à isoler tant qu'aucune action ne lit ces tables.

## 3bis. Revue de code (verdict initial : NOGO → corrigé)

Findings de la revue et corrections appliquées avant PR :

- **B1** Seed destructif sans garde-fou → `assertSeedTargetIsSafe()` : hosts locaux OK, host distant exige `SEED_ALLOW_DESTRUCTIVE=1`, `VERCEL_ENV=production` refusé inconditionnellement (vérifié : abort exit 1 sur host distant).
- **M1** Connection string persistée dans les inputs de dispatch → le workflow lit d'abord le secret repo `ADHOC_DATABASE_URL` (à créer dans Settings → Secrets), l'input devient un fallback optionnel pour les one-shots.
- **M2** TRUNCATE contournait le trigger append-only (prouvé) → trigger `BEFORE TRUNCATE FOR EACH STATEMENT` dans la migration `20260709150000_gift_card_ledger_hardening` ; le seed désactive/réactive les triggers explicitement et bruyamment.
- **M3** Aucune contrainte de signe sur le ledger (prouvé) → CHECK `gift_card_transactions_amount_sign` (REDEMPTION < 0, PURCHASE/REFUND > 0, ADJUSTMENT ≠ 0) dans la même migration.
- **M4** Index de rattrapage de drift sans `IF NOT EXISTS` (risque P3018 sur staging) → les 3 statements passent en `CREATE INDEX IF NOT EXISTS` (migration pas encore déployée sur staging ; déjà appliquée à l'identique sur preview, où les index venaient d'être créés par elle).
- Minors corrigés : assertions `!` du seed → `required()` ; commission par cave dans le seed (Founders à 0 %) ; FK réelle + index sur `GiftCard.experienceId` (SetNull) ; heredoc `GITHUB_ENV` ; matchers de tests sur noms de contraintes ; choix « pas de FK sur `bookingId` du ledger » documenté dans le schéma.
- Minors assumés (non corrigés, trackés) : les bases `db push` locales n'ont pas les invariants SQL (documenté en tête de test) ; labels EN hardcodés préexistants de `ExperienceHero` (dette L-201/E15) ; le validator accepte MEAL/EVENT avant toute UI de création (mentionné dans la PR).

## 4. Découpage technique

1. **Schéma Prisma** (nouvelles enums + 8 modèles + champs additifs sur Winery/Experience/Booking). Conventions existantes : cuid, cents en `Int`, `@@map` snake_case, index sur les shapes de requête connues.
2. **Migration** générée sur base vierge (`migrate dev --create-only`), enrichie en SQL brut : `CHECK (balance_cents >= 0)`, `CHECK (capacity_override IS NULL OR capacity_override >= 1)`, `CHECK (no_show_fee_cents BETWEEN 0 AND 5000)`, trigger `forbid_gift_card_transaction_mutation` (append-only).
3. **Lib** : `src/lib/business-rules/request-transitions.ts` (map des transitions autorisées + garde pure).
4. **Tests** : `tests/db/invariants.test.ts` sur base réelle (activés si `INVARIANTS_DATABASE_URL` défini — la CI actuelle n'a pas de Postgres ; exécution locale documentée) + tests unitaires transitions.
5. **Seed** : extension de `prisma/seed.ts` (agent dédié une fois le schéma figé).

## 5. Tests & mesures

- `npm run test:db:invariants` (nouveau script) : violations rejetées par la DB.
- Suite complète `test:run` + `tsc` + build.
- Scénario manuel Sam : aucun (pas de surface visible) — vérifier seulement que l'app tourne comme avant sur staging après merge.

## 6. Risques & rollback

- `Booking.occurrenceId` nullable + `onDelete: SetNull` : aucune écriture existante ne change ; le checkout continue sur (date, timeSlot).
- Enums étendues (`ExperienceType`) : ajout de valeurs = additif Postgres ; aucun code ne produit encore MEAL/EVENT.
- Rollback : revert PR ; les tables nouvelles sont vides tant que P-03+ ne les alimente pas.

## 7. Décisions ouvertes

- Aucune bloquante. Choix d'architecture documentés : solde gift card **matérialisé** sur `GiftCard.balanceCents` (verrouillable ligne à ligne, CHECK DB) + ledger comme journal ; occurrences **persistées** avec `@@unique(experienceId, date, startTime)` compatibles avec le `timeSlot` existant des bookings.
