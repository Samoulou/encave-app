# P-05 — Créneaux & recherche par date

> **Statut** : livré · **Branche** : `claude/encave-v3-business-model-8bv7bd` (fallback session, cf. P-01) · **PR** : [#101](https://github.com/Samoulou/encave-app/pull/101)
> **Sources** : `docs/ENCAVE-V3-DELIVERY-PLAN.md` §P-05 · items L-024 (moteur), L-110, L-111, L-131, L-132 · spec `docs/v3/ENCAVE-V3-PRD.md` US-101 · `docs/v3/ENCAVE-V3-PAGES-EMAILS.md` §0.1/§2/§6
> **Type** : non-💰 (review `high`, pas de `/code-review max`). Mais **touche le cœur capacité durci en P-04** → kill-switch flag `OCCURRENCE_CAPACITY` + rigueur de tests P-04. **ADR : `docs/adr/0002-occurrence-authoritative-capacity.md`.**

## 1. Objectif

Matérialiser les créneaux : l'`ExperienceOccurrence` (posée en P-02, aujourd'hui **branchée à rien**) devient la brique de disponibilité. Une expérience Slot génère des occurrences (récurrence hebdo **ou** dates ponctuelles + blackouts), l'encaveur les gère à l'occurrence près (fermer, ajuster la capacité, voir les inscrits), et le client cherche **par date** avec un tri « prochaine dispo ». **Zéro régression** : occurrence OPEN sans override = comportement d'aujourd'hui.

## 2. Constat de départ (audit code)

- `ExperienceOccurrence` + `Booking.occurrenceId` = schéma + migration + CHECK `capacityOverride >= 1`, **zéro lecteur/écrivain** (grep `ExperienceOccurrence|occurrenceId` sur `src/` = vide). Commentaire explicite `schema.prisma:380` : capacité sur `(experienceId, date, timeSlot)` « until P-05 switches over ».
- Disponibilité actuelle = `AvailabilitySlot` (hebdo, `dayOfWeek`) ; `getTimeSlotsForDate`/`checkAvailability` comptent par `(date, timeSlot)`, capacité **toujours `maxCapacity`** (jamais `capacityOverride`), **ignorent `BlockedDate`**.
- `event-detail` (`getEventDetail`/`buildSessions`) modélise déjà « session = date+heure+capacité+inscrits » groupée today/upcoming/past/cancelled, mais **dérivée des bookings** (`types/event-detail.ts` : « there is no ExperienceSession model »). → repointer sur les occurrences, ne PAS dupliquer.
- `BlockedDate` : modèle + actions complètes + affiché dans le calendrier bookings, mais **pas consommé par les lectures de dispo publiques**. → réconcilier avec la génération d'occurrences, pas une 3ᵉ mécanique.
- Recherche : pas de param date, pas de tri « prochaine dispo » ; parsers de type omettent MEAL/EVENT (dérive à aligner). Hero home = « Où » + « Pour » (pas de « Quand »).

## 3. Décisions d'architecture (validées par Jonas — ADR-0002, amendées après sa revue)

> Revue Jonas 2026-07-09 : D1/D3/D6 initiaux corrigés (comptage par occurrenceId = risque de survente sur stragglers NULL ; blackout→status = perte d'intention ; env var ≠ « sans deploy »). Détail complet et alternatives rejetées : `docs/adr/0002-occurrence-authoritative-capacity.md`.

- **D1 — L'occurrence est autoritaire pour la capacité (nombre) et la réservabilité (statut), mais le COMPTAGE des sièges reste par `(experienceId, date, timeSlot)` — le prédicat P-04 `activeCapacityBookingWhere()` ne bouge pas.** La clé unique `(experienceId, date, startTime)` rend occurrenceId et (date,timeSlot) bijectifs : compter par (date,timeSlot) capte AUSSI tout booking à `occurrenceId` NULL (flag OFF, straggler, fenêtre de déploiement) → pas de survente possible, même profil de conflit SSI qu'en P-04, test de concurrence transposé tel quel. L'occurrence n'ajoute que : capacité effective = `capacityOverride ?? maxCapacity`, et gate réservable ssi `status = OPEN` **ET** pas de `BlockedDate` sur la date. **Sûreté par construction** : occurrences toutes OPEN sans override = comportement d'aujourd'hui.
- **D2 — Génération eager + résolution défensive HORS transaction.** À la publication, à l'édition de dispo, au déblocage et par cron quotidien : `createMany({skipDuplicates:true})` (= `ON CONFLICT DO NOTHING`, idempotent, jamais de delete) sur un **horizon glissant de 6 semaines (42 j, `OCCURRENCE_HORIZON_DAYS`)** depuis les `AvailabilitySlot` actifs, en sautant les `BlockedDate`. Horizon = l'exemple d'acceptation US-101 (2/sem × 6 sem = 12). Mode **ponctuel** : chips date+heure → occurrences `source=PUNCTUAL`. **Le chemin de réservation résout l'occurrence AVANT la transaction Serializable** (`resolveOccurrence`, Read Committed : findUnique → sinon check de légitimité (AvailabilitySlot actif dans l'horizon OU occurrence PUNCTUAL ; refus `DATE_BLOCKED`/`INVALID_SLOT` — ferme une faille préexistante : créneaux arbitraires réservables) → createMany skipDuplicates → findUniqueOrThrow ; **jamais de P2002, jamais de write-conflict fabriqué entre holds**). La tx Serializable re-lit l'occurrence par PK (gate status ; close-vs-create conflicte volontairement), agrégat (date,timeSlot) inchangé, create avec `occurrenceId` stampé. Le **claim** au submit ne revalide PAS l'occurrence (fermer = forward-only, n'affecte pas un hold vivant en paiement).
- **D3 — Blackout orthogonal au statut.** `BlockedDate` reste LA source du blocage-date et n'est **jamais** recopié dans `status` (sinon débloquer rouvrirait une occurrence fermée à la main). `status = CLOSED` ⇔ fermeture manuelle L-132 uniquement. Réservable ⇔ OPEN ET pas de BlockedDate — vérifié à la résolution ET dans les lectures publiques (corrige le bug préexistant « la dispo publique ignore BlockedDate »). Bloquer une date à bookings existants ne détruit rien : les sessions restent visibles au calendrier avec leurs inscrits, la date devient non-réservable pour de nouveaux clients.
- **D4 — Migration douce des bookings existants.** Migration additive de données : upsert d'une occurrence OPEN pour chaque `(experienceId, date, timeSlot)` distinct des bookings **futurs** existants (CONFIRMED + PENDING vivants), puis `occurrenceId` renseigné. Bookings passés laissés `null` (aucun impact capacité). Aucune destruction, aucune colonne retirée.
- **D5 — Recherche par date.** `?quand=YYYY-MM-DD` (+ raccourci « ce week-end » = plage) filtre les expériences ayant une occurrence OPEN avec capacité restante ce jour ; tri par défaut **« prochaine dispo »** = `MIN(occurrence.date >= today, status OPEN, cap restante)`. Join occurrence dans `searchExperiences`. Chips hero : « Ce week-end » (date), « Dégustations » (type TASTING), « Avec repas » (type MEAL) → aligne MEAL/EVENT dans les parsers.
- **D6 — Kill-switch = FeatureFlag `OCCURRENCE_CAPACITY` (défaut ON), pas une env var.** Une env Vercel exige un redéploiement — la promesse « < 1 min sans deploy » n'est tenable qu'avec le système de flags existant (cache 60 s, toggle admin). Seul flag du registre à défaut ON (sémantique inversée, documentée dans `FLAG_REGISTRY`). OFF ⇒ capacité `maxCapacity` sans gate status (comportement P-04), `occurrenceId` stampé quand même (best-effort). Le comptage étant identique ON/OFF, **le flip ne peut pas survendre**. Aucun ajout à `src/lib/env.ts`.

## 4. Scope

**IN** :

- **L-024 (moteur, non livré en P-02)** : service de génération d'occurrences (récurrent hebdo + ponctuel + blackouts), horizon glissant, upsert idempotent ; migration douce des bookings futurs ; cron de roulement.
- **Bascule capacité (D1 amendé)** : `getTimeSlotsForDate`, `checkAvailability`, `createBookingHold`, `createBookingAndCheckout` occurrence-aware — résolution hors tx, gate status + capacité effective dans la tx, `occurrenceId` stampé, **comptage `(date,timeSlot)` inchangé** (`activeCapacityBookingWhere` intact).
- **L-131** : UI création — mode ponctuel (chips dates + heures) ET récurrent avec blackouts au tap ; aperçu live des 8 prochaines occurrences.
- **L-132** : calendrier mensuel par expérience — fermer une occurrence, ajuster sa capacité, voir les inscrits. Repointe l'UI `event-detail` (SessionCard/grouping) sur les occurrences.
- **L-110** : champ « Quand » home + filtre Date catalogue + tri « prochaine dispo » par défaut.
- **L-111** : chips raccourcis hero fonctionnelles.

**OUT** : événements collectifs (P-11, dépend de P-05), no-show (P-08), langues `languages` (L-025, hors DoD P-05), page « Aujourd'hui » encaveur (L-130 → P-13).

## 5. Definition of Done (= US-101)

- [x] Créer « Dégustation 25 CHF, sam 10h/16h, cap. 8 » génère **12 occurrences publiques en < 60 s** (génération synchrone à la publication, test db-gated) ; validations bloquantes (prix > 0, cap 1-50, durée 30-480) — _création ≤ 4 min chrono : à confirmer au pass manuel Sam_
- [x] Mode ponctuel (dates + heures chips) ET récurrent avec blackouts au tap ; **aperçu live des 8 prochaines occurrences**
- [x] Calendrier mensuel : **fermer** une occurrence, **ajuster sa capacité**, **voir les inscrits** — chacun testé (fermer → hold refusé `OCCURRENCE_CLOSED` ; override 2 sur cap. 8 → 3ᵉ place refusée `NO_CAPACITY`)
- [x] Home « Où + Quand » → catalogue filtré par **date réelle** ; tri par défaut = prochaine dispo ; chips raccourcis fonctionnelles
- [x] **Zéro régression / zéro survente** : prédicat de comptage P-04 inchangé (D1) ; test de concurrence rejoué occurrence-backed ; bookings futurs rattachés (migration testée)
- [x] Kill-switch flag `OCCURRENCE_CAPACITY` OFF → retombe sur le comportement (date,timeSlot) sans casse (test db-gated de parité)
- [x] Socle transverse vert : lint, format, i18n ×3, 966 unit/integration + 28 db-gated, build prod

## 6. Découpage technique (contrats détaillés : ADR-0002 + rapport Jonas)

1. **Migrations additives ×2** : (a) schéma — `source` String → enum `OccurrenceSource { RECURRING PUNCTUAL }` (0 ligne → cast trivial : drop default → alter type → re-set default) ; (b) données — backfill DML pur, rejouable (`ON CONFLICT DO NOTHING` + `WHERE occurrenceId IS NULL`), occurrences OPEN pour les créneaux futurs à bookings vivants puis rattachement. `source` = métadonnée de provenance uniquement, jamais un discriminant de réservabilité.
2. **`src/lib/datetime/zurich.ts`** : extraire `zonedWallClockToUTC`/`zonedDateKey` (privés dans `event-detail.queries.ts`) — partagés par génération, recherche, calendrier. Lib pure d'expansion déjà livrée (`occurrence-expansion.ts`, 11 tests).
3. **`occurrence.service.ts`** (service interne, pas de auth) : `generateOccurrences(experienceId, {horizonDays, now})` (Read Committed, createMany skipDuplicates, jamais de delete) ; `resolveOccurrence(experienceId, date, startTime)` (hors tx, légitimité AvailabilitySlot-dans-horizon OU PUNCTUAL, refus `DATE_BLOCKED`/`INVALID_SLOT`, jamais de P2002).
4. **`capacity.ts`** : ajouter `resolveOccurrenceCapacity(override, max)` ; **`activeCapacityBookingWhere` inchangé** (comptage par (date,timeSlot), cf. D1).
5. **Bascule des sites capacité** : `createBookingHold`/fallback-create — resolve hors tx → tx Serializable {re-lecture PK + gate status + agrégat inchangé + capacité effective + create avec occurrenceId} via helper partagé `assertOccurrenceCapacity(tx, …)` ; claim inchangé (pas de revalidation). `getTimeSlotsForDate`/`checkAvailability` : lectures occurrence-driven read-only (occurrences OPEN non-blackout de la date — unifie récurrent + ponctuel, l'horizon devient la fenêtre de réservation), jamais de resolve à la lecture. Le tout gated par le flag `OCCURRENCE_CAPACITY`.
6. **Flags** : `OCCURRENCE_CAPACITY: { defaultEnabled: true }` dans `FLAG_REGISTRY` (seul défaut ON — commenter).
7. **Actions owner** `src/server/actions/occurrence.ts` : `closeOccurrence`/`reopenOccurrence`/`setOccurrenceCapacity`/`regenerateOccurrences` (auth + ownership, codes `UNAUTHORIZED/FORBIDDEN/NOT_FOUND/VALIDATION_ERROR/CONFLICT`) ; validators `src/lib/validators/occurrence.ts`. Déclencheurs `generateOccurrences` : publication, `updateAvailabilitySlots`, `unblockDate`, cron.
8. **Reads** `src/server/queries/occurrence.queries.ts` (React.cache, jamais unstable_cache — DTO à Date) : `getUpcomingOccurrences(expId, 8)`, `getOccurrenceCalendar(expId, userId, monthKey)` (owner, regroupe par COALESCE(occurrence, (date,timeSlot)) pour les stragglers/passés), `getBookableOccurrences(expId, range)` (public). Invalidation : tag `occurrences:${experienceId}` + `experiences` sur les mutations de structure ; rien sur les bookings (TTL 120 s conservée).
9. **Cron** `generate-occurrences` (`0 2 * * *`, `CRON_SECRET`, expériences PUBLISHED de wineries VERIFIED, batché) + `vercel.json`.
10. **UI création** (`AvailabilitySection`/`AvailabilityScheduleBuilder`) : onglet Ponctuel/Récurrent, chips, blackouts au tap, aperçu 8 prochaines.
11. **UI calendrier** (`event-detail` repointé) : mois, fermer/capacité/inscrits par occurrence.
12. **Recherche** : `SearchParams.quand` (date calendaire Zurich, comparaison date-only), MVP = filtre sur **existence** d'occurrence OPEN non-blackout (indexé `date,status`) — pas d'agrégat de capacité restante N+1 dans le tri-JS (un créneau complet peut apparaître et afficher « complet » ; raffinement → L-207/P-06) ; tri `next_availability` (MIN date future OPEN, nulls last) ; champ « Quand » + chips hero ; alignement MEAL/EVENT dans les parsers.

## 7. Tests & mesures

- Lib pure d'expansion de dates (récurrence hebdo × horizon − blackouts = dates attendues ; DST Europe/Zurich).
- db-gated : génération 12 occurrences, upsert idempotent (2 générations = pas de doublon, unique respecté), résolution défensive, migration douce (booking futur existant → occurrence rattachée).
- db-gated **concurrence sous occurrence** : 2 holds sur un créneau occurrence-backed cap. 3 → 1 succès + 1 NO_CAPACITY (le test P-04 se transpose tel quel — même prédicat de comptage) ; + 2 resolves concurrents d'un créneau non matérialisé → 1 seule occurrence, zéro erreur.
- Fermeture/override affectent bien la réservation (integration) ; blackout rend la date non-réservable sans muter `status` ni toucher les bookings.
- Kill-switch ON/OFF : mêmes comptes de capacité (parité avec l'ancien chemin quand tout est OPEN/no-override).
- Scénario manuel Sam : créer une expérience récurrente → 12 occurrences en < 60 s ; fermer une occurrence → indisponible au public ; baisser la capacité → jauge à jour ; chercher « ce week-end » → catalogue filtré ; réserver → billet rattaché à l'occurrence.

## 8. Risques & rollback

- **Risque principal** : régression capacité/survente sur le cœur argent P-04 → **prédicat de comptage inchangé** (D1 amendé), sûreté par construction (OPEN/no-override = iso), kill-switch flag, rejeu du test de concurrence db-gated, parité ON/OFF testée.
- **Génération manquante** → `resolveOccurrence` défensif au moment du hold : jamais de créneau légitime non-réservable par absence d'occurrence.
- **Horizon** : cron en panne → le resolve défensif matérialise à la volée ; l'aperçu/calendrier peut manquer les semaines lointaines jusqu'au prochain run (dégradation douce).
- Rollback : flag `OCCURRENCE_CAPACITY` OFF (< 60 s, sans deploy) ; les colonnes/occurrences restent inertes ; revert PR possible (migrations additives uniquement).

## 9. Décisions (tranchées)

- **D-A — TRANCHÉ (Jonas) : enum `OccurrenceSource { RECURRING PUNCTUAL }`.** Cohérence avec `OccurrenceStatus`, type-safety, cast trivial à 0 ligne — cher plus tard, gratuit maintenant.
- **D-B — TRANCHÉ : horizon 6 semaines (42 j) par défaut** (`OCCURRENCE_HORIZON_DAYS`, constante ajustable). Aligné sur l'exemple d'acceptation US-101 (12 occurrences pour un motif 2/sem). Perf non contraignante (≤ 360 k lignes même à 100 caves × 12 sem — trivial). **Amendé en review (finding 1)** : l'horizon borne la génération éphémère uniquement — la fenêtre de réservation suit le picker (3 mois), toute date future portée par un créneau hebdo actif se matérialise à la demande au hold ; les dates passées sont refusées.
- **D-C — TRANCHÉ (Jonas) : bookings passés laissés `occurrenceId` NULL.** Aucun impact capacité ; le calendrier regroupe par COALESCE pour les afficher ; backfill limité aux futurs.

## 10. Bilan (post-review, 2026-07-10)

**Review `/code-review` high** : 8 finders → ~40 candidats → **10 findings consolidés, 10/10 corrigés** (`ce09077` serveur, `88ecf24`→`f5e28ee` UI Nora, `c2336d9` annulation de session, `413f0eb` + suites : 17 tests neufs).

1. **Fenêtre 42 j vs picker 3 mois** (dead-end plein tunnel) → l'horizon ne borne plus que la génération éphémère ; matérialisation à la demande pour toute date future à créneau hebdo actif (amendement D-B).
2. **Surface opérationnelle orpheline** (régression : check-in/no-show/annulation/contact/scan injoignables après le repointage de la route sessions) → re-domiciliée dans `OccurrenceDetailSheet` (réutilisation `BookingActionsMenu`/`Sheet`, `CancelSessionButton`, `ContactGuestsButton`, lien scanner) ; stack `event-detail` legacy supprimée (0 référence), `getExperienceOperationalContext` slim en remplacement.
3. **Ponctuelles annoncées mais inachetables** (widgets = jours hebdo uniquement) → `getBookableOccurrences` branché page publique, jour sélectionnable si hebdo OU occurrence.
4. **Créneau hebdo retiré qui vendait encore 42 j** → `closeOrphanedRecurringOccurrences` (édition + toggle ; ponctuelles intouchées, résas préservées).
5. **Recherche sans blackout ni clamp** → fenêtre clampée à aujourd'hui (Zurich), corrélation exacte par date, `nextOccurrence` blackout-aware.
6. **Trou au deploy** (expériences sans booking invisibles jusqu'au cron 02:00) → backfill étendu : matérialisation 42 j pour toutes les expériences publiées (generate_series).
7. **Poll checkout éjectait un détenteur de hold** → plus de validation périodique avec `holdId` (le hold EST la place ; le claim revalide).
8. **Dates passées réservables** (occurrence OPEN d'hier) → refus `INVALID_SLOT` avant le court-circuit ligne-existante.
9. **Annulations invisibles au calendrier owner** → listées (badge, jamais comptées) ; `isActiveCapacityBooking` = jumeau JS du prédicat Prisma.
10. **Dates impossibles (2026-02-31) → INTERNAL_ERROR** → `isDateKey` en refine Zod.

**Correctif induit** : `cancelEventSession` marque l'occurrence CANCELLED (terminal, ligne synthétisée pour les sessions pré-moteur) — une session annulée/remboursée n'est plus revendable.

**Dette consignée** (hors DoD) : dialog motif d'annulation (encore `window.prompt`, → Léa), `visitorEmail`/`checkedInAt` absents des attendees de la sheet (contact groupé couvre l'essentiel), gating ARCHIVED des actions occurrence (close/capacité restent actives sur une expérience archivée), dédup grilles calendrier (`OccurrenceCalendar` vs `CalendarView`), agrégat capacité restante dans la recherche (L-207/P-06).

**Vérifs finales** : tsc · lint · format · i18n ×3 · 966 unit/integration · 28 db-gated (`encave_p05` reset + migrations rejouées, backfill inclus) · build prod (JS partagé 165 kB inchangé).
