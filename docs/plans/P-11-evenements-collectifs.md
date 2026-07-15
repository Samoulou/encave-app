# P-11 — Événements collectifs (US-250 light)

> **Statut** : plan · **Branche** (à la build) : `samuel/enc-XX-evenements-collectifs` (fallback `claude/p-11-evenements-collectifs`) · **PR** : #
> **Sources** : `docs/ENCAVE-V3-DELIVERY-PLAN.md` §P-11 · items `L-100→L-102` (backlog E8, `[FLAG]`) · specs `docs/v3/ENCAVE-V3-PRD.md` §US-250, `docs/v3/ENCAVE-V3-PAGES-EMAILS.md` §2 + §7

## Contexte (pourquoi ce package)

Le launch (16.11) inclut les **événements collectifs légers** (type « Jardin des Vins ») : une cave organise un événement regroupant plusieurs caves, vend des billets, scanne à l'entrée, et les caves invitées suivent l'affluence. P-02 a déjà posé **tout le schéma** (`Experience.isCollective`, `EventParticipant`, le flag `COLLECTIVE_EVENTS`) — **mais c'est du code mort** : rien dans `src/` ne le lit ou l'écrit aujourd'hui (vérifié : les seuls hits `isCollective`/`participants`/`EventParticipant` hors `src/` sont schema/seed/tests/docs, et le seul hit `src/` est un libellé « participants » de compteur de places sans rapport). P-11 met ce socle en service : la fiche publique, la gestion des participants côté cave organisatrice, la billetterie/scan, et une vue lecture pour les participants. Résultat attendu : une cave VÉRIFIÉE crée et publie un événement collectif, encaisse la billetterie centrale, scanne sans collision, et chaque cave participante voit l'affluence en lecture — le tout activable/désactivable en < 1 min via le flag.

**Levier qui rend les ~10 h tenables** : « billetterie centrale » et « organisateur encaisse / pas de split » sont **déjà vrais par construction**. Un événement collectif reste l'`Experience` d'**une** cave : `Booking.wineryId` = l'organisateur, checkout normal, aucun code paiement à écrire. P-11 est surtout de la **lecture/affichage** + de la **gestion de participants**.

## Décisions produit (tranchées par Sam — 2026-07-15)

- **D-Scan → Organisateur seul.** L'organisateur scanne à tous les points d'entrée (son compte, plusieurs appareils : la garantie anti-collision existe déjà). **Aucun élargissement de l'auth de check-in.** Les participants sont en **lecture seule**.
- **D-Admin → Supervision seule.** La cave organisatrice crée/gère elle-même via l'éditeur d'expérience. L'admin obtient une console i18n de supervision (liste + participants + stats en lecture). **Pas de create-on-behalf** (reporté au backlog : impose impersonation, +4-6 h, surface sécurité).
- **D-Logo → Colonne dédiée.** Migration additive `EventParticipant.logo String?`, repli sur `Winery.coverPhoto` quand `null`.
- **D-Visibilité → Agrégats + liste des inscrits.** Une cave participante voit les billets vendus, les scannés, **et la liste nominative des inscrits (nom + contact + statut de scan)**, en lecture seule. ⚠️ Partage de PII inter-caves → **note nLPD** (Risque R-7).

## 1. Objectif

Après merge, une **cave organisatrice VÉRIFIÉE** peut marquer une de ses expériences « Événement collectif », y rattacher des **caves participantes** (logo + descriptif), la **publier** → fiche publique avec **bandeau organisateur + grille des participants + programme** ; la **billetterie centrale** (l'organisateur encaisse, aucun split) et le **scan multi-points sans collision** fonctionnent ; chaque cave participante voit **en lecture** les ventes, les scans et la liste des inscrits. Tout derrière `COLLECTIVE_EVENTS` (OFF = comportement actuel strictement inchangé).

## 2. Scope

**IN** :
- Migration additive : `EventParticipant.logo String?`.
- Toggle « Événement collectif » (`isCollective`) dans l'éditeur d'expérience.
- **Panneau de gestion des participants** (composant séparé, actions propres) sur la page **édition** : ajouter/retirer/réordonner des caves VÉRIFIÉES, descriptif + logo par participant.
- **Fiche publique** (`/experiences/[slug]`, L-101) : bandeau organisateur + grille participants + programme, gatés `flag && isCollective` ; JSON-LD Event enrichi.
- **Vue lecture participant** (L-102) : query à scope *participation* + page listant les événements où ma cave participe, avec agrégats (vendus/scannés) **et liste des inscrits** en lecture.
- **Scan multi-points** (L-102) : aucun code de scan nouveau ; **test de concurrence 2-scanners** ajouté.
- **Refonte `/admin/events`** en console i18n de supervision des événements collectifs.
- i18n fr/de/en, états loading/empty/error, tests par action, flag OFF prouvé sans effet.

**OUT (explicitement, et où c'est prévu)** :
- Association / EnCave comme organisateur (nécessite un nouveau rôle/entité — **différé**, rôles actuels CLIENT/WINEMAKER/ADMIN).
- Admin create-on-behalf (**backlog** — voir D-Admin).
- Scan par les caves participantes (**différé 2027**, version « light »).
- Split/reversement automatique multi-caves (**2027** par le PRD ; la DoD exige « pas de split »).
- Modèle de « programme » horaire structuré (**hors 10 h** ; le programme = participants ordonnés + occurrences déjà chargées).

## 3. Definition of Done (gate — copiée du delivery plan + additions)

- [ ] Créer un événement avec caves participantes (**logo + descriptif**) + **UN organisateur payé** ; publier → fiche publique avec **bandeau + grille + programme**.
- [ ] **Billetterie centrale opérationnelle** ; **2 scanners différents sur le même événement sans collision** (test automatisé).
- [ ] Chaque participant voit **billets/scans en lecture** (agrégats + liste des inscrits) ; **pas de split** (organisateur encaisse).
- [ ] **Flag OFF = inchangé** : participants jamais requêtés, aucune UI collective, page participant masquée ; e2e existants verts **sans modification**.
- [ ] **Additions découvertes** : clé de cache `getExperienceBySlug` bumpée `v2→v3` ; participants d'une cave suspendue jamais affichés (double filtre) ; un événement collectif reste visible au catalogue normal.
- [ ] Socle transverse (§3 delivery plan) vert : lint / format / i18n / `test:run` / e2e ; migrations additives relues ; 3 locales ; aucun `console.log`/`as any`/`!`.

## 4. Découpage technique (ordonné)

**0 — Flag.** Réutiliser `isFlagEnabled('COLLECTIVE_EVENTS')` (`src/lib/flags.ts:26`, déjà OFF, déjà toggleable via `FeatureFlagsPanel`, label i18n déjà présent). Aucun nouveau flag.

**1 — Migration (additive unique).** `EventParticipant` (`prisma/schema.prisma:843`) → ajouter `logo String?`. `prisma migrate dev --name add_event_participant_logo` + `generate`. Tout le reste (`isCollective`, `description`, `order`, unique `[experienceId,wineryId]`, `@@index([wineryId])`) existe déjà.

**2 — Validators.**
- `src/lib/validators/experience.ts` : `isCollective: z.boolean().optional()` sur `createExperienceSchema` (`.optional()` **pas** `.default()` — même convention que `paymentMode`, garde input/output Zod symétriques pour `zodResolver`).
- **Nouveau** `src/lib/validators/eventParticipant.ts` : `addEventParticipantSchema { experienceId:cuid, wineryId:cuid, description:max500().optional(), logo:url().optional() }`, `removeEventParticipantSchema { participantId:cuid }`, `reorderEventParticipantsSchema { experienceId:cuid, items:[{ participantId:cuid, order:int().min(0) }] }`.

**3 — Server actions (owner-gated), `'use server'`.**
- **Nouveau** `src/server/actions/eventParticipant.ts`. Helper `assertOwnedCollectiveExperience(userId, experienceId)` copiant le gate de `experience-crud.ts:51-71` (`winery.userId===session.user.id` + `winery.status==='VERIFIED'` + `experience.wineryId===winery.id`). Chaque action : `auth()` → `safeParse` → gate → DB → `invalidateExperienceCaches(orgSlug, expSlug)` → `ActionResult`.
  - `addEventParticipant` : cible `VERIFIED` + `user.suspendedAt===null` + pas déjà participante + ≠ organisateur → `create` avec `order = (max order)+1`.
  - `removeEventParticipant` ; `reorderEventParticipants` (transaction d'`update` d'`order`).
- `src/server/actions/experience-crud.ts` : persister `isCollective` (destructuring + `data:`) dans `createExperience`/`updateExperience` (additif, `@default(false)` préservé).
- Réutiliser `invalidateExperienceCaches` (`src/server/actions/experience-helpers.ts:14` → `revalidateTag('experiences')`).

**4 — Queries.**
- **Nouveau** `src/server/queries/event-participant.queries.ts` :
  - `getEventParticipants(experienceId)` **[public, `cache(unstable_cache(..., { tags:['experiences'] }))`]** : `where { experienceId, winery: <gate visibilité> }`, `orderBy [{order:'asc'},{createdAt:'asc'}]`, DTO `{ id, wineryName, winerySlug, commune, description, logoUrl: logo ?? coverPhoto }`. Vide → `[]`.
  - `getManageableParticipants(experienceId, userId)` **[`React.cache`, owner-gated `winery:{userId}`]** : mêmes lignes sans filtre visibilité + drapeau `wineryVisible` (signale une cave suspendue *après* ajout).
  - `searchVerifiedWineriesForPicker(query, excludeWineryId)` : adapter le filtre VÉRIFIÉ/non-suspendu de `src/server/queries/winery.queries.ts`.
- **Nouveau** `src/server/queries/participant-events.queries.ts` — scope *participation* (voir §6).
- Étendre `getExperienceBySlug` (`src/server/queries/experience.queries.ts:604`) : `isCollective:true` au `select` + au DTO `ExperienceDetail` (~L90-140), **et bumper la clé `experience-by-slug-v2 → v3` (L661)** — sinon des payloads pré-déploiement sans le champ sont servis (précédent documenté au bump v2).

**5 — Fiche publique (L-101).** `src/app/[locale]/(public)/experiences/[slug]/page.tsx` :
- Ajouter `isFlagEnabled('COLLECTIVE_EVENTS')` au `Promise.all` (L81) ; `showCollective = flag && experience.isCollective`.
- **Bandeau** organisateur en tête quand `showCollective`.
- **Grille** : nouveau composant async `EventParticipantsSection`, wrappé `<Suspense>`, `return null` si vide — calquer le visuel de la winery-info-card (`page.tsx:289-327` : avatar rond 64 px depuis `logoUrl`, nom, commune, descriptif) ; patron async/Suspense/return-null = `RelatedExperiencesSection.tsx` + skeleton dédié.
- **Programme** : réutiliser les `bookableOccurrences` **déjà chargées** (`page.tsx:108`) pour lister dates/horaires (aucun champ nouveau).
- **JSON-LD** : brancher l'objet `eventSchema` inline (L122-177) sur `showCollective` (enrichir `organizer`, ajouter les participants). Flag OFF ⇒ inchangé.
- Flag OFF ⇒ `getEventParticipants` jamais appelée, fiche strictement identique.

**6 — Gestion (L-100, cave organisatrice).**
- `src/components/features/experience/EditExperienceForm.tsx` : toggle « Événement collectif » (`Switch` lié à `isCollective`), gaté prop `collectiveEventsEnabled` ; part du submit `updateExperience`.
- `src/app/[locale]/(protected)/dashboard/experiences/[id]/edit/page.tsx` : passer `collectiveEventsEnabled` ; **sous** le form, si `flag && experience.isCollective`, monter **`EventParticipantsPanel`** (client, **séparé** du react-hook-form, actions propres, `toast` sonner + `router.refresh()`). Patron = `AvailabilityScheduleBuilder` (composant séparé requérant un `experienceId` déjà persisté — vrai sur la page edit) + `WineryMonetizationPanel` (client→action→toast→refresh). Contenu : picker de caves VÉRIFIÉES, `Textarea` descriptif, upload logo (réutiliser `uploadExperienceImage`), reorder ↑/↓, retrait.
- `CreateExperienceForm.tsx` : toggle **seulement** (pas de sous-form participants dans l'assistant — le panneau n'apparaît qu'en édition, une fois l'expérience persistée).

**7 — Refonte admin (supervision seule, L-100).** `src/app/[locale]/admin/events/page.tsx` (aujourd'hui read-only, **anglais hardcodé**, Prisma direct) → réécrire en **i18n** (nouveau namespace `admin.events` dans les 3 locales) : filtre « collectifs uniquement » (`isCollective:true`), nb participants, stats lecture inline (vendus/scannés), liens vers `admin/wineries/[id]`. Auth déjà couverte (`admin/layout.tsx` role≠ADMIN→`notFound` + `requireAdmin()`). **Ne pas** deep-linker `/dashboard/experiences/[id]/sessions` (route owner-gated : l'admin sans winery y est redirigé — bouton déjà cassé aujourd'hui).

**8 — Multi-points + vue participant (L-102).**
- **Aucun changement** à `src/server/actions/checkInBooking.ts` ni à `dashboard/scan/page.tsx`. Le CAS `updateMany({ where:{ id, status:CONFIRMED }, data:{ status:COMPLETED, checkedInAt } })` puis `if (count!==1) → ALREADY_CHECKED_IN` (checkInBooking.ts:196-212) est **déjà** l'anti-double-scan. L'organisateur scanne sur son compte depuis ≥2 appareils (même `userId`, files offline localStorage séparées par navigateur, CAS serveur autoritaire).
- **Nouvelle page lecture participant** : `src/app/[locale]/(protected)/dashboard/evenements-participes/page.tsx` (+ `loading.tsx`/`error.tsx`) — gatée flag (empty state / redirect quand OFF), liste `getParticipantCollectiveEvents(userId)`, détail avec agrégats + **liste des inscrits** (nom, contact, guestCount, statut scan).
- Entrée `DashboardSidebar` gatée `flag && hasParticipations`.

**9 — i18n.** Clés `experience.detail.collective.*`, panneau participants, page participant, console `admin.events.*` dans `messages/{fr,de,en}.json`. Enregistrer tout nouveau namespace client dans `tests/unit/i18n/client-namespaces.test.ts`. `npm run i18n:check` vert.

## 5. Tests & mesures

**Tests d'actions** (mock `@/server/auth` + `@/server/db`, patron `tests/unit/server/actions/check-in-booking.test.ts`) :
- `addEventParticipant` : unauthorized · forbidden (pas propriétaire) · validation (cible non VÉRIFIÉE ; doublon) · happy.
- `removeEventParticipant` / `reorderEventParticipants` : unauthorized · forbidden/validation · happy.
- `updateExperience` : `isCollective` persisté.

**Tests de queries** (mock db) :
- `getEventParticipants` : exclut caves non visibles, trie par `order`, vide → `[]`.
- `getParticipantCollectiveEvents` : pas de winery → `[]` ; cave **non participante** → aucun événement tiers (anti-fuite) ; happy → agrégats + inscrits.

**Test de concurrence « 2 scanners sans collision » (cœur DoD)** — nouveau `tests/db/collective-scan-concurrency.test.ts`, **miroir** de `tests/db/booking-hold-concurrency.test.ts` (client Prisma réel sur `INVARIANTS_DATABASE_URL`, `describe.skipIf(!url)`), mocks `@/server/auth`, `rate-limit.service` (`checkRateLimit → success`), `next/cache`. Fixture : user WINEMAKER + winery VERIFIED (stripe complete) + `Experience` PUBLISHED `isCollective:true` + 1 `Booking` CONFIRMED **d'aujourd'hui** (`date = zurichTodayAsUTCDate`, `accessTokenHash = hashToken(token)`).
```
const [a, b] = await Promise.all([
  checkInBooking({ token, source: 'scan' }),
  checkInBooking({ token, source: 'scan' }),
]);
// gagnant : { success:true, data.code:'CHECKED_IN' }  → exactement 1
// perdant  : soit { success:false, error.code:'ALREADY_CHECKED_IN' } (updateMany count 0, L204)
//            soit { success:true,  data.code:'ALREADY_CHECKED_IN' } (lu après commit, L120)
expect(checkedIn).toHaveLength(1);   // JAMAIS deux CHECKED_IN
expect(already).toHaveLength(1);
// puis : booking.status === 'COMPLETED', checkedInAt non null
```
`updateMany` sur une ligne unique avec prédicat `status:CONFIRMED` est atomique → pas de Serializable ni de retry P2034 nécessaires. Assertion tolérante aux **deux** formes du perdant, mais **jamais** deux `CHECKED_IN`.

**Mesures / smoke** : lint + format + `tsc` verts ; parité i18n 3 locales ; DB tests skippés sans `INVARIANTS_DATABASE_URL`.

## 6. Query « stats participant » (scope participation)

Toutes les reads de `dashboard-today.queries.ts` gatent sur `winery:{userId}` = la cave **possédée**. Une cave participante ne **possède aucun** booking de l'événement (ils sont à l'organisateur) → nouveau scope :
1. `userId` → `winery` possédée (`findUnique`) ; `null` → `[]`.
2. `winery.id` → `EventParticipant[wineryId]` (index présent) → `experienceId` où je participe, filtrés `isCollective===true` + `status==='PUBLISHED'`.
3. Agréger les bookings **de l'organisateur** : `groupBy(['experienceId'], where:{ experienceId:{ in }, <seatCountingBookingWhere> })` (réutiliser le helper de comptage de `dashboard-today.queries.ts:34`) pour « vendus » ; second `groupBy` `status:COMPLETED` pour « scannés » ; + `findMany` des bookings pour la **liste des inscrits** (réutiliser la forme `attendees` de `occurrence.queries.ts:101-106` : `visitorName`, `visitorEmail`, `guestCount`, `checkedInAt`, `status`).

DTO (lecture) : `{ experienceId, title, slug, organizerWineryName, soldSeats, checkedInSeats, attendees[] }`. **Sécurité** : le `in` dérive de MES participations → aucun événement tiers ne fuite ; `React.cache` ; page gatée flag.

## 7. Risques & rollback

- **R-1 (bloquant) — clé de cache fiche.** Ajouter `isCollective` au select oblige `experience-by-slug-v2 → v3` (`experience.queries.ts:661`), sinon régression de payload en prod.
- **R-2 — caves non visibles dans la grille.** Double filtre : au picker (VÉRIFIÉ non suspendu) **et** au rendu (une cave peut être suspendue *après* ajout ; `getManageableParticipants.wineryVisible` le signale à l'organisateur).
- **R-3 — pas de fuite catalogue.** Un événement collectif **doit** apparaître au catalogue normal ; ne **jamais** filtrer `isCollective` dans `searchExperiences`. Seul gate = l'UI collective de la fiche.
- **R-4 — invalidation ISR.** Chaque action participant appelle `invalidateExperienceCaches` (tag `'experiences'`), sinon grille figée ≤ 300 s.
- **R-5 — bouton admin cassé.** La refonte affiche les stats **inline** ; ne deep-linke aucune route owner-gated.
- **R-6 — `isCollective` ⟂ type `EVENT`.** Ne pas coupler ; le toggle marche pour tout type.
- **R-7 (nLPD) — partage de PII inter-caves.** La vue participant expose nom + contact des clients de l'organisateur à des caves tierces (D-Visibilité). À **couvrir dans les CGV / mentions légales** (P-12 légal, P-16 CGV) ; envisager une mention d'information au checkout d'un événement collectif. À flaguer au tech-writer ; ne bloque pas P-11 mais doit être tracé.
- **Rollback** : flip `COLLECTIVE_EVENTS` OFF (immédiat, cache-tag revalidé) → fiche redevient une expérience normale, panneau/toggle/page participant masqués, données conservées (colonne `logo` nullable additive, réversible sans backfill). Sinon revert PR.

## 8. Décisions ouvertes (à trancher AVANT ③ BUILD)

Tranchées par Sam (voir en-tête) : Scan = organisateur seul · Admin = supervision seule · Logo = colonne dédiée · Visibilité = agrégats **+ liste des inscrits**.
Restantes, à confirmer au démarrage de la build (défauts proposés, non bloquants) :
- [ ] **Gate visibilité participant (grille publique)** : `VERIFIED + non suspendu` (souple, **défaut**) vs `publiclyVisibleWineryWhere` complet (exige que le participant ait sa propre expérience publiée — peut masquer un participant légitime).
- [ ] **Organisateur dans la grille** : l'afficher séparément comme « hôte » et l'exclure du picker (**défaut**) vs l'auto-inclure comme participant.
- [ ] **Contrainte logo** : réutiliser le pipeline image expérience tel quel (**défaut**) vs contrainte dédiée (carré/petit).

## 9. Vérification (bout-en-bout, à la build)

1. **Flag OFF (non-régression)** : `COLLECTIVE_EVENTS` OFF → `npm run test:e2e` (booking invité) vert sans modif ; une fiche d'expérience existante rend à l'identique (aucun bandeau/grille).
2. **Création + publication (DoD 1)** : en tant que cave VÉRIFIÉE, activer le toggle sur une expérience, ajouter 2-3 caves participantes (logo + descriptif), publier → `/experiences/[slug]` montre bandeau + grille + programme ; JSON-LD Event valide (Rich Results Test / lecture manuelle).
3. **Billetterie centrale (DoD 2)** : réserver un billet → paiement Stripe test → billet QR émis ; `Booking.wineryId` = organisateur (aucun split).
4. **2 scanners sans collision (DoD 2)** : `INVARIANTS_DATABASE_URL` défini → `npm run test:run collective-scan-concurrency` vert (1 CHECKED_IN + 1 ALREADY_CHECKED_IN) ; + smoke manuel : scanner le même QR depuis 2 onglets → le 2ᵉ affiche « déjà scanné ».
5. **Lecture participant (DoD 3)** : se connecter en tant que cave **participante** → `/dashboard/evenements-participes` montre l'événement, les agrégats (vendus/scannés) et la liste des inscrits, **sans** aucun bouton de scan ni donnée financière.
6. **Admin** : `/admin/events` (filtre collectifs) liste l'événement + participants + stats, en 3 locales.
7. **Socle** : `npm run lint` · `npm run format:check` · `npm run i18n:check` · `npm run test:run` verts.
