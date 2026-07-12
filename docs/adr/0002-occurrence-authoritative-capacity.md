# ADR 0002 — Capacité occurrence-authoritative avec comptage inchangé et kill-switch flag

- **Statut** : Accepté
- **Date** : 2026-07-09
- **Décideurs** : Margot, Jonas, Sam
- **Package** : P-05 (Créneaux & recherche par date) — items L-024, L-110/111, L-131/132

## Contexte

`ExperienceOccurrence` + `Booking.occurrenceId` existent depuis P-02 (migration
`20260709112533_v3_foundations` : unique `(experienceId, date, startTime)`,
CHECK `capacityOverride >= 1`, enum `OccurrenceStatus{OPEN,CLOSED,CANCELLED}`,
`source` String libre) mais **aucun code applicatif ne les référence**. La
disponibilité et la capacité tournent sur `AvailabilitySlot` (hebdo) et un
agrégat `Booking` par `(experienceId, date, timeSlot)`, capacité toujours égale
à `experience.maxCapacity`, via l'unique source de vérité
`activeCapacityBookingWhere()` (`src/lib/business-rules/capacity.ts`). `BlockedDate`
existe mais **n'est pas lu par la dispo publique**. Les « sessions » de la page
event-detail sont dérivées des bookings, sans modèle persisté.

P-05 doit rendre l'occurrence autoritaire (fermer un créneau, override de
capacité, voir les inscrits, recherche par date, mode ponctuel) **sans régresser
le cœur booking/hold durci en P-04** (hold pré-formulaire, claim atomique par
token, release logique des holds expirés, transaction Serializable + retry
P2034 `withSerializableRetry`, webhook Stripe idempotent).

## Décision

**L'occurrence est autoritaire pour la CAPACITÉ (nombre) et la RÉSERVABILITÉ
(statut), mais le COMPTAGE des sièges reste par `(experienceId, date, timeSlot)`,
inchangé depuis P-04.**

1. **Comptage inchangé.** `activeCapacityBookingWhere()` et l'agrégat
   `(experienceId, date, timeSlot)` de P-04 ne bougent pas. La contrainte unique
   `(experienceId, date, startTime)` rend `occurrenceId` et `(date, timeSlot)`
   bijectifs : le compte est identique, mais compter par `(date, timeSlot)`
   capte aussi tout booking à `occurrenceId` NULL (kill-switch OFF, straggler,
   fenêtre de déploiement) — donc **pas de survente**. Compter par `occurrenceId`
   est rejeté (cf. Alternatives).

2. **L'occurrence n'ajoute que deux choses.** Capacité effective =
   `occurrence.capacityOverride ?? experience.maxCapacity` ; réservable ssi
   `status = OPEN` **ET** aucune `BlockedDate(experienceId, date)`.

3. **Résolution hors transaction, comptage dans la transaction.**
   - `resolveOccurrence(experienceId, date, startTime)` s'exécute **hors** de la
     transaction Serializable, en **Read Committed** : `findUnique` ; sinon,
     après validation de légitimité (`AvailabilitySlot` actif dans l'horizon, ou
     occurrence `PUNCTUAL` ; refus `DATE_BLOCKED`/`INVALID_SLOT`),
     `createMany({ skipDuplicates:true })` (compile en `INSERT ... ON CONFLICT DO
NOTHING` : en course, le perdant ne lève rien) puis `findUniqueOrThrow`.
     **Jamais de P2002, jamais de write-conflict sur la ligne partagée.**
   - La transaction **Serializable** (identique P-04 : timeout 10 s +
     `withSerializableRetry`) fait : re-lecture de l'occurrence par PK (gate
     `status = OPEN`), agrégat `(date, timeSlot)` inchangé, `capacity = override
?? max`, `create` booking avec `occurrenceId` stampé. La re-lecture par PK
     ne conflicte pas hold-vs-hold (lectures pures) mais conflicte close-vs-create
     (rw-dependency désirée) → fermer devient autoritaire.
   - Le **claim** au submit (`createBookingAndCheckout`) reste inchangé et **ne
     re-valide pas** l'occurrence : le siège est déjà réservé ; fermer une
     occurrence est **forward-only** (bloque les nouveaux holds, épargne les
     holds vivants), même doctrine que « baisser la capacité ne rembourse pas les
     billets vendus ».

4. **Blackout orthogonal au statut.** `BlockedDate` reste l'autorité du blocage
   au niveau date et **n'est jamais recopié dans `status`**. `status = CLOSED`
   signifie uniquement la fermeture manuelle d'occurrence (L-132). Bloquer une
   date à bookings existants ne détruit rien : les occurrences et bookings
   survivent, la date devient non-réservable via la présence de `BlockedDate` ;
   débloquer restaure la réservabilité sans rouvrir par erreur une occurrence
   fermée à la main. Corrige au passage le bug « dispo publique ignore
   BlockedDate ».

5. **Génération eager + cron + backstop, additive.** Occurrences générées à la
   publication, à l'édition de dispo, au déblocage, et par un cron quotidien
   (`/api/cron/generate-occurrences`, `CRON_SECRET`), toujours via
   `createMany(skipDuplicates)` idempotent, **jamais de delete**. Horizon glissant
   configurable (`OCCURRENCE_HORIZON_DAYS`, défaut 8 semaines — chiffre final
   décision produit). L'expansion des dates est une lib pure testable hors DB ;
   la conversion wall-clock → instant est isolée dans `zonedWallClockToUTC`
   (Europe/Zurich, DST géré).

6. **Kill-switch via FeatureFlag, pas env.** Nouvelle clé `OCCURRENCE_CAPACITY`
   au `FLAG_REGISTRY`, **`defaultEnabled: true`** (seul flag à défaut ON —
   sémantique inversée documentée). OFF ⇒ retombe sur `maxCapacity` sans gate
   `status` (comportement P-04), tout en continuant de stamper `occurrenceId`.
   Le comptage `(date, timeSlot)` étant identique dans les deux états, le flip
   ON↔OFF ne peut pas survendre. Toggle admin/SQL effectif en ≤ 60 s **sans
   redéploiement** (un env Vercel aurait exigé un deploy — promesse non tenable).

7. **Migration douce, additive, en deux temps.** (a) migration de schéma :
   `source` String → enum `OccurrenceSource{RECURRING,PUNCTUAL}` (0 ligne → cast
   trivial). (b) migration de **données séparée** (DML pure, rejouable) : insertion
   d'occurrences OPEN pour les créneaux **futurs** portant un booking vivant
   (`ON CONFLICT DO NOTHING`) puis rattachement `occurrenceId` (`WHERE occurrenceId
IS NULL`). Bookings passés laissés NULL. Comme le comptage reste par
   `(date, timeSlot)`, le backfill est une commodité calendrier, **pas** une
   dépendance de correction capacité.

## Conséquences

- ✅ Le prédicat de comptage du cœur argent P-04 est **inchangé** : profil de
  conflit/retry identique, test de concurrence db-gated transposé sans réécriture,
  parité ON/OFF garantie quand tout est OPEN/no-override.
- ✅ Aucune survente possible au flip du kill-switch ni sur straggler NULL.
- ✅ Fermeture d'occurrence autoritaire par rw-conflict SSI, sans contention
  hold-vs-hold ajoutée.
- ✅ Faille pré-existante fermée : les créneaux arbitraires (non adossés à un
  `AvailabilitySlot`) ne sont plus réservables ni matérialisables par un anonyme.
- ✅ Rollback réel en < 1 min sans deploy (flag DB).
- ⚠️ `resolveOccurrence` fait un `findUnique` (+ éventuel insert) **hors** tx puis
  la tx re-lit l'occurrence : deux allers-retours DB de plus par hold. Coût
  négligeable, indexé par PK/clé unique.
- ⚠️ Le kill-switch `OCCURRENCE_CAPACITY` est le seul flag à défaut ON : le
  registre et le commentaire doivent le signaler pour ne pas dérouter.
- ⚠️ Pendant la fenêtre de cache flag (≤ 60 s) après un flip, override et
  maxCapacity peuvent coexister ; borne haute = maxCapacité réelle, jamais de
  survente. Acceptable pour un switch d'urgence.
- ⚠️ Recherche par date : le calcul « capacité restante par occurrence » doit
  être indexé (renvoi L-207/P-06), sous peine d'agrégats N+1 dans le tri-JS.
- 🔄 Réversibilité : cheap. Flag OFF restaure P-04 ; occurrences et `occurrenceId`
  restent inertes ; les migrations sont additives (revert PR possible).

## Alternatives écartées

- **Alt A — Compter la capacité par `occurrenceId`.** Manque les bookings à
  `occurrenceId` NULL (kill-switch OFF, stragglers, backfill partiel) → survente ;
  modifie le prédicat du cœur P-04 (nouveau profil de conflit à re-valider) ;
  n'apporte rien vu la bijection avec `(date, timeSlot)`. Rejeté.
- **Alt B — Upsert de l'occurrence dans la transaction Serializable.** `INSERT ON
CONFLICT DO UPDATE` sous SERIALIZABLE lève 40001 ; un upsert Prisma sur clé
  composée peut retomber en SELECT-puis-INSERT et lever 23505/P2002 non retryé ;
  le UPDATE partagé fabrique des conflits write-write hold-vs-hold. Rejeté au
  profit de résoudre hors tx en Read Committed avec `DO NOTHING`.
- **Alt C — Kill-switch en variable d'environnement.** Un changement d'env Vercel
  exige un redéploiement : incompatible avec « désactivable en < 1 min sans
  deploy ». Rejeté au profit du FeatureFlag.
- **Alt D — Blackout recopié dans `occurrence.status = CLOSED`.** Conflate
  blocage-date et fermeture manuelle ; le déblocage rouvre par erreur une
  occurrence fermée à la main. Rejeté au profit de `BlockedDate` autoritaire
  dérivé à la lecture.
- **Alt E — Couche additive pure (occurrences en simple miroir lu, capacité
  restant `maxCapacity` global).** Exclue par la DoD de L-132 : « fermer une
  occurrence » et « ajuster sa capacité » doivent **affecter la réservation
  réelle** (« l'effet réservation prouvé : fermer/baisser bloque bien »). Un
  miroir non autoritaire ne peut ni fermer ni plafonner un créneau — il faut donc
  que l'override et le statut entrent dans le chemin de capacité transactionnel,
  ce qui n'est plus « additif pur ». Rejeté.

## Références

- Plan : `docs/archive/plans/P-05-creneaux-recherche-date.md`
- ADR lié : `docs/adr/0001-booking-backward-status-transitions.md`
- Cœur durci : `docs/archive/plans/P-04-checkout-v3.md`,
  `src/server/actions/checkout.ts`, `src/lib/business-rules/capacity.ts`,
  `src/server/services/serializable-retry.service.ts`
- Source unique de vérité produit : `docs/v3/ENCAVE-V3-PRD.md` US-101 ;
  exécution : `docs/ENCAVE-V3-DELIVERY-PLAN.md` §P-05 (L-024, L-110/111, L-131/132)
