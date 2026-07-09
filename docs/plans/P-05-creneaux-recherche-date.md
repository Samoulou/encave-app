# P-05 — Créneaux & recherche par date

> **Statut** : en cours · **Branche** : `claude/encave-v3-business-model-8bv7bd` (fallback session, cf. P-01) · **PR** : #
> **Sources** : `docs/ENCAVE-V3-DELIVERY-PLAN.md` §P-05 · items L-024 (moteur), L-110, L-111, L-131, L-132 · spec `docs/v3/ENCAVE-V3-PRD.md` US-101 · `docs/v3/ENCAVE-V3-PAGES-EMAILS.md` §0.1/§2/§6
> **Type** : non-💰 (review `high`, pas de `/code-review max`). Mais **touche le cœur capacité durci en P-04** → kill-switch env + rigueur de tests P-04.

## 1. Objectif

Matérialiser les créneaux : l'`ExperienceOccurrence` (posée en P-02, aujourd'hui **branchée à rien**) devient la brique de disponibilité. Une expérience Slot génère des occurrences (récurrence hebdo **ou** dates ponctuelles + blackouts), l'encaveur les gère à l'occurrence près (fermer, ajuster la capacité, voir les inscrits), et le client cherche **par date** avec un tri « prochaine dispo ». **Zéro régression** : occurrence OPEN sans override = comportement d'aujourd'hui.

## 2. Constat de départ (audit code)

- `ExperienceOccurrence` + `Booking.occurrenceId` = schéma + migration + CHECK `capacityOverride >= 1`, **zéro lecteur/écrivain** (grep `ExperienceOccurrence|occurrenceId` sur `src/` = vide). Commentaire explicite `schema.prisma:380` : capacité sur `(experienceId, date, timeSlot)` « until P-05 switches over ».
- Disponibilité actuelle = `AvailabilitySlot` (hebdo, `dayOfWeek`) ; `getTimeSlotsForDate`/`checkAvailability` comptent par `(date, timeSlot)`, capacité **toujours `maxCapacity`** (jamais `capacityOverride`), **ignorent `BlockedDate`**.
- `event-detail` (`getEventDetail`/`buildSessions`) modélise déjà « session = date+heure+capacité+inscrits » groupée today/upcoming/past/cancelled, mais **dérivée des bookings** (`types/event-detail.ts` : « there is no ExperienceSession model »). → repointer sur les occurrences, ne PAS dupliquer.
- `BlockedDate` : modèle + actions complètes + affiché dans le calendrier bookings, mais **pas consommé par les lectures de dispo publiques**. → réconcilier avec la génération d'occurrences, pas une 3ᵉ mécanique.
- Recherche : pas de param date, pas de tri « prochaine dispo » ; parsers de type omettent MEAL/EVENT (dérive à aligner). Hero home = « Où » + « Pour » (pas de « Quand »).

## 3. Décisions d'architecture (reco — à valider par Jonas + Sam)

- **D1 — L'occurrence fait autorité quand elle existe.** Le chemin de réservation (hold + submit + `checkAvailability` + `getTimeSlotsForDate`) résout l'occurrence `(experienceId, date, startTime)`, compte les bookings **par `occurrenceId`**, capacité = `occurrence.capacityOverride ?? experience.maxCapacity`, réservable ssi `status = OPEN`. **Sûreté par construction** : toutes les occurrences générées sont OPEN sans override → capacité identique à aujourd'hui ; les pouvoirs nouveaux (fermer, override) ne changent le comportement que si l'encaveur les utilise (même doctrine que « flag OFF = comportement actuel » du P-03).
- **D2 — Génération eager + défensive.** À la publication et à l'édition de dispo : générer les occurrences OPEN sur un **horizon glissant de 12 semaines** depuis les `AvailabilitySlot` actifs, en sautant les `BlockedDate`. Mode **ponctuel** : chips date+heure → occurrences `source=PUNCTUAL` directes. Le chemin de réservation **upsert défensivement** l'occurrence sur la clé unique `(experienceId, date, startTime)` (idempotent) au cas où un créneau ne serait pas encore matérialisé — la capacité est donc toujours occurrence-backed. Cron quotidien : roule l'horizon (génère la semaine nouvellement dans la fenêtre), idempotent via upsert.
- **D3 — Blackouts = statut d'occurrence.** `BlockedDate` reste la primitive encaveur ; bloquer une date ⇒ occurrences de cette date `CLOSED` (ou non générées) ; débloquer ⇒ régénère OPEN. Une seule source, deux vues.
- **D4 — Migration douce des bookings existants.** Migration additive de données : upsert d'une occurrence OPEN pour chaque `(experienceId, date, timeSlot)` distinct des bookings **futurs** existants (CONFIRMED + PENDING vivants), puis `occurrenceId` renseigné. Bookings passés laissés `null` (aucun impact capacité). Aucune destruction, aucune colonne retirée.
- **D5 — Recherche par date.** `?quand=YYYY-MM-DD` (+ raccourci « ce week-end » = plage) filtre les expériences ayant une occurrence OPEN avec capacité restante ce jour ; tri par défaut **« prochaine dispo »** = `MIN(occurrence.date >= today, status OPEN, cap restante)`. Join occurrence dans `searchExperiences`. Chips hero : « Ce week-end » (date), « Dégustations » (type TASTING), « Avec repas » (type MEAL) → aligne MEAL/EVENT dans les parsers.
- **D6 — Kill-switch.** Bien que P-05 ne soit pas 💰, la lecture occurrence-backed touche le chemin argent : env `OCCURRENCE_CAPACITY_ENABLED` (défaut ON) permet de retomber sur `(date,timeSlot)+maxCapacity` sans deploy. Génération/calendrier/recherche restent des lectures additives, toujours actives.

## 4. Scope

**IN** :

- **L-024 (moteur, non livré en P-02)** : service de génération d'occurrences (récurrent hebdo + ponctuel + blackouts), horizon glissant, upsert idempotent ; migration douce des bookings futurs ; cron de roulement.
- **Bascule capacité (D1)** : `getTimeSlotsForDate`, `checkAvailability`, `createBookingHold`, `createBookingAndCheckout` occurrence-aware (résolution + upsert défensif + `occurrenceId` sur create + `capacityOverride` + `status`). `activeCapacityBookingWhere` étendu ou dupliqué proprement par occurrence (source unique, cf. P-04).
- **L-131** : UI création — mode ponctuel (chips dates + heures) ET récurrent avec blackouts au tap ; aperçu live des 8 prochaines occurrences.
- **L-132** : calendrier mensuel par expérience — fermer une occurrence, ajuster sa capacité, voir les inscrits. Repointe l'UI `event-detail` (SessionCard/grouping) sur les occurrences.
- **L-110** : champ « Quand » home + filtre Date catalogue + tri « prochaine dispo » par défaut.
- **L-111** : chips raccourcis hero fonctionnelles.

**OUT** : événements collectifs (P-11, dépend de P-05), no-show (P-08), langues `languages` (L-025, hors DoD P-05), page « Aujourd'hui » encaveur (L-130 → P-13).

## 5. Definition of Done (= US-101)

- [ ] Créer « Dégustation 25 CHF, sam 10h/16h, cap. 8 » génère **12 occurrences publiques en < 60 s** ; création ≤ 4 min chrono ; validations bloquantes (prix > 0, cap 1-50, durée 30-480)
- [ ] Mode ponctuel (dates + heures chips) ET récurrent avec blackouts au tap ; **aperçu live des 8 prochaines occurrences**
- [ ] Calendrier mensuel : **fermer** une occurrence, **ajuster sa capacité**, **voir les inscrits** — chacun testé (et l'effet réservation prouvé : fermer/baisser capacité bloque bien)
- [ ] Home « Où + Quand » → catalogue filtré par **date réelle** ; tri par défaut = prochaine dispo ; chips raccourcis fonctionnelles
- [ ] **Zéro régression / zéro survente** : occurrence OPEN sans override = capacité d'aujourd'hui ; test de concurrence P-04 rejoué occurrence-backed (2 clients/3 places → 1 succès + 1 refus) ; bookings existants rattachés (migration testée)
- [ ] Kill-switch `OCCURRENCE_CAPACITY_ENABLED=false` → retombe sur le comportement (date,timeSlot) sans casse
- [ ] Socle transverse vert (lint, format, i18n ×3, suite complète + db-gated, build prod)

## 6. Découpage technique

1. **`OccurrenceStatus`/`source` en enum** : `source` est aujourd'hui un String libre — migration additive vers un enum `OccurrenceSource { RECURRING PUNCTUAL }` (ou garder String + validation Zod ; tranché avec Jonas).
2. **`occurrence.service.ts`** : `generateOccurrences(experienceId, { horizonWeeks })`, `regenerateForBlackout`, `resolveOccurrence(experienceId, date, startTime)` (upsert défensif), `getUpcomingOccurrences(experienceId, n)`. Lib pure pour l'expansion de dates (récurrence → dates) testable hors DB.
3. **`capacity.ts`** étendu : `activeCapacityByOccurrenceWhere(occurrenceId)` + résolution capacité `capacityOverride ?? maxCapacity`. Un seul endroit (cf. leçon P-04 : filtre dupliqué 4×).
4. **Bascule des 4 sites capacité** (booking.ts ×2, checkout.ts ×2) derrière D6, `occurrenceId` renseigné à la création (hold + submit + claim), migration douce.
5. **Cron** `generate-occurrences` (roulement horizon) dans `vercel.json` + route `CRON_SECRET`.
6. **UI création** (`AvailabilitySection`/`AvailabilityScheduleBuilder`) : onglet Ponctuel/Récurrent, chips, blackouts au tap, aperçu 8 prochaines (server action `getUpcomingOccurrences`).
7. **UI calendrier** (`event-detail` repointé) : mois, fermer/capacité/inscrits par occurrence, actions serveur `closeOccurrence`/`setOccurrenceCapacity`.
8. **Recherche** : `SearchParams.quand`, join occurrence dans `searchExperiences`, tri `next_availability`, champ « Quand » + chips hero, alignement MEAL/EVENT dans les parsers.

## 7. Tests & mesures

- Lib pure d'expansion de dates (récurrence hebdo × horizon − blackouts = dates attendues ; DST Europe/Zurich).
- db-gated : génération 12 occurrences, upsert idempotent (2 générations = pas de doublon, unique respecté), résolution défensive, migration douce (booking futur existant → occurrence rattachée).
- db-gated **concurrence occurrence-backed** : 2 holds sur une occurrence cap. 3 → 1 succès + 1 NO_CAPACITY (rejoue P-04 sur `occurrenceId`).
- Fermeture/override affectent bien la réservation (integration).
- Kill-switch ON/OFF : mêmes comptes de capacité (parité avec l'ancien chemin quand tout est OPEN/no-override).
- Scénario manuel Sam : créer une expérience récurrente → 12 occurrences en < 60 s ; fermer une occurrence → indisponible au public ; baisser la capacité → jauge à jour ; chercher « ce week-end » → catalogue filtré ; réserver → billet rattaché à l'occurrence.

## 8. Risques & rollback

- **Risque principal** : régression capacité/survente sur le cœur argent P-04 → sûreté par construction (OPEN/no-override = iso), kill-switch D6, rejeu du test de concurrence db-gated, parité ON/OFF testée.
- **Génération manquante** → upsert défensif au moment du hold : jamais de créneau non-réservable par absence d'occurrence.
- **Horizon** : cron en panne → l'upsert défensif matérialise à la volée ; l'aperçu/calendrier peut manquer les semaines lointaines jusqu'au prochain run (dégradation douce).
- Rollback : `OCCURRENCE_CAPACITY_ENABLED=false` (< 1 min) ; les colonnes/occurrences restent inertes ; revert PR possible (migration additive uniquement).

## 9. Décisions ouvertes (pour Jonas / Sam)

- **D-A** : `source` String → enum ? (reco : enum, cohérent avec le reste du schéma V3).
- **D-B** : horizon 12 semaines — confirmer (US-101 « sam 10h/16h → 12 occurrences » = ~6 semaines × 2/sem ; 12 sem donne ~24 pour 2/sem — l'exemple US-101 suggère peut-être un horizon plus court ou un compte sur 6 sem ; **à clarifier avec Sam** : 12 occurrences = combien de semaines d'horizon par défaut ?).
- **D-C** : migration douce des bookings passés — laisser `occurrenceId` null (reco) vs backfill complet.
