# P-15 — Admin V3 & emails restants

> **Statut** : plan · **Branche** (à la build) : `claude/p-15-admin-emails` (fallback sans Linear) · **PR** : # → `dev`
> **Sources** : `docs/ENCAVE-V3-DELIVERY-PLAN.md` §P-15 · items `L-160→L-164` (backlog E13) · specs `docs/v3/ENCAVE-V3-PAGES-EMAILS.md` §7 (admin) + §8 (emails #1/#2/#5/#22)
> **Destination réelle du plan à la build** : recopier dans `docs/plans/P-15-admin-emails.md` (depuis `docs/plans/TEMPLATE.md`).

## Contexte (pourquoi ce package)

Toutes les features launch sont mergées (P-01→P-14). Il reste deux packages : P-15 (ce plan) et P-16 (hardening). P-15 ferme les trous **ops & emails** qui empêchent une exploitation quotidienne saine :

- L'admin n'a **aucune vue « aujourd'hui »** (CA/dégustations du jour), **aucune santé des webhooks** (lag Stripe), **aucun tableau des échecs** (emails/jobs) — les modèles `StripeEvent`, `EmailLog`, `ScheduledJob` sont **écrits mais jamais lus** par une surface admin.
- Il n'existe **qu'une liste des caves `PENDING`** ; pas de liste tous statuts, et l'historique de validation (`VerificationLog` + `AdminAction`) n'est **affiché nulle part** (audit write-only).
- **Pas de page `/admin/utilisateurs`** : l'anonymisation nLPD n'est que self-service (et non journalisée), et il n'existe **aucune action de changement de rôle**.
- L'email de **confirmation part dans la locale du vigneron** (bug client réel), **sans PDF billet ni .ics** ; l'email d'**annulation par la cave** n'a **aucune alternative proche** ; le **rappel J-1** part à 07:00 UTC (pas « la veille à 18h ») et **ignore `Booking.locale`** ; l'admin **n'est pas notifié** à l'inscription d'un nouveau domaine (email #22 inexistant).

**Résultat visé** : un admin pilote sa journée en un écran, gère caves + utilisateurs avec audit visible, et les 4 emails launch sont conformes à l'inventaire §8.

## Faits structurants (dé-risquent le package)

- **AUCUNE migration Prisma.** Tout existe : `AdminAction.action`/`EmailLog.type`/`ScheduledJob.type` sont des `String` libres (`USER_ROLE_CHANGED`, `admin_new_winery` ne touchent pas le schéma) ; `Booking.locale` est déjà `Locale @default(FR)` et déjà chargé sur chaque `findUnique({ include })` ; `User.anonymizedAt`/`suspendedAt`, `AdminAction`, `VerificationLog`, `Winery.latitude/longitude` existent.
- **AUCUN nouveau feature flag.** Rien dans P-15 ne déplace d'argent (emails, dashboards en lecture, ops admin) → la règle « flag money-touching » ne s'applique pas.
- **Le layout admin est le seul gate** (`src/app/[locale]/admin/layout.tsx` : auth → rôle ADMIN → lecture fraîche `suspendedAt`+`twoFactorEnabled` → enforcement TOTP P-14 → **full messages** `admin.*`). Les nouvelles pages RSC appellent les queries en direct ; seules les **actions** appellent `requireAdmin()`.
- **Les routes admin sont déjà bilingues** (`bons-cadeaux` FR à côté de `bookings`/`wineries`/`events` EN) — précédent qui tranche le nommage ci-dessous.

## Décisions produit (tranchées avec Sam, 2026-07-15)

- **Destinataire emails admin** → **adresse unique** via env `ADMIN_NOTIFICATIONS_EMAIL` (fallback `CONTACT_INBOX = samuel@encave.ch`). Pas de fan-out `role=ADMIN`.
- **Anonymisation admin** → **case à cocher « notifier l'utilisateur »** dans le dialogue de confirmation (param `notifyUser` passé au service ; défaut self-service inchangé = notifie).
- **Changement de rôle** → **sûr : `CLIENT ↔ WINEMAKER` uniquement**. `ADMIN` jamais attribuable via l'UI (reste manuel/DB) ; refuser de rétrograder un `WINEMAKER` qui possède une cave (évite d'orpheliner `winery.userId`).
- **KPI du jour** → **les deux, étiquetés** : « CA réservé aujourd'hui » (`createdAt` du jour) + « Dégustations du jour » (`date` du jour, nb + convives).
- **Route liste caves (L-161)** → **`/admin/wineries` (index EN)**, on garde `/admin/wineries/pending`. Franciser tout le sous-arbre = épisode dédié (règle CLAUDE.md), hors scope.
- **Visibilité audit (L-162)** → **historique inline par entité** (composant `AdminActionHistory` réutilisé sur cave + utilisateur), pas de page `/admin/journal` globale.
- **Rappel #2** → **cron dédié re-timé** à 18:00 Zurich (2 crons UTC + garde d'heure Zurich, patron `tasting-sheet-reminder`), PAS de migration vers `JOB_REGISTRY` (le runner ne draine que toutes les 3h → 1-2h de retard).
- **Seuils webhook** → bloqué = `PROCESSING` + `createdAt < now − 15 min` ; fenêtre incidents = 24h.

## 1. Objectif

Après merge : `/admin` affiche **CA/dégustations du jour + santé webhooks + derniers échecs** ; une liste **caves tous statuts** avec **historique de validation visible** ; **`/admin/utilisateurs`** (recherche, anonymisation nLPD journalisée, changement de rôle journalisé) ; l'email **#1** joint **PDF + .ics** et part dans **`Booking.locale`** ; l'email **#5** propose **3 alternatives proches** ; le **rappel J-1** part **la veille à 18h** (locale correcte) ; l'**admin est notifié (#22)** à chaque inscription de domaine.

## 2. Scope

**IN** (L-160→L-164) :

- L-160 `/admin` : `getTodayAdminKpis` (extension `admin-metrics.queries.ts`) + `admin-ops.queries.ts` (`getWebhookHealth`, `getRecentIncidents`) + 3 cartes présentation.
- L-161 `/admin/wineries` (index tous statuts, recherche) + `getWineryHistory` + `AdminActionHistory` + section historique sur `/admin/wineries/[id]`.
- L-162 `/admin/utilisateurs` (recherche, filtre rôle) + actions `changeUserRole` + `anonymizeUserAsAdmin` + contrôles UI (réutilise `AdminSuspensionControls` + `AdminActionHistory`).
- L-163 email #22 (composant + sender + hook `createWinery` + env recipient).
- L-164 email #1 (PDF+.ics+locale), email #5 (3 alternatives+locale), rappel #2 (18h Zurich+locale).
- i18n fr/de/en (`admin.*` dans `messages/*.json` + blocs `translations.ts`) ; états loading/empty/error ; tests.

**OUT (explicitement)** :

- Toute **migration de schéma** (rien à ajouter) ; tout **nouveau flag**.
- **Franciser** `/admin/wineries/*` (épisode dédié avec redirects).
- Page **`/admin/journal`** globale (audit reste inline).
- **Fan-out** email admin à tous les `role=ADMIN`.
- Refonte du **rappel 2h** (cadence pré-existante) — on le garde ancré à 18h Zurich et on lui passe juste `Booking.locale`.
- Nettoyage optionnel (`approve/rejectWinery`/`refundBookingManually` en check inline au lieu de `requireAdmin` ; helper `logAdminAction` pour la duplication ×7) — **noté, hors P-15**.

## 3. Definition of Done (gate)

- [ ] `/admin` : **CA réservé + dégustations du jour** (Zurich), **santé webhooks** (dernier event, lag, stuck ≥15 min, failed), **derniers échecs** emails+jobs — en un écran, données fraîches (pas de cache 300s sur l'ops)
- [ ] **`/admin/wineries`** : liste tous statuts + recherche ; **historique validation** (VerificationLog + AdminAction fusionnés, triés) visible sur le détail
- [ ] **`/admin/utilisateurs`** : recherche clients+encaveurs ; **anonymisation nLPD** (confirm + case notifier) et **changement de rôle** (`CLIENT↔WINEMAKER`) — **journalisés (`AdminAction`) ET visibles** inline
- [ ] Email **#1** : QR (déjà OK) **+ PDF billet + .ics** joints, corps en **`Booking.locale`** ; génération PDF/.ics en try/catch (n'échoue jamais l'envoi)
- [ ] Email **#5** : **3 alternatives proches** (fallback `/experiences` si pas de coords), corps en `Booking.locale`
- [ ] Rappel **#2** : **veille 18:00 Zurich** (2 crons UTC + garde), corps en `Booking.locale`
- [ ] Email **#22** à `ADMIN_NOTIFICATIONS_EMAIL` sur chaque `createWinery` (voie fondateur VERIFIED exclue)
- [ ] Socle : `lint` / `format:check` / `i18n:check` / `test:run` / `test:e2e` verts ; **diff manuel FR/DE/EN de `translations.ts`** (non couvert par i18n:check) ; zéro `console.log`/`as any`/`!`

## 4. Découpage technique (ordonné — chaque étape compile vert avant la suivante)

Emails d'abord (autonomes, un bug client live), puis les 3 surfaces admin (L-161 crée `AdminActionHistory` que L-162 réutilise).

**1 — L-164a : bug locale confirmation (~15 min, ship en premier).** `src/server/services/checkout-confirmation.service.ts` → `sendBookingConfirmationNotifications` : passer **`booking.locale`** (déjà chargé) au lieu de `booking.winery.user.preferredLocale` à `sendBookingConfirmationEmail`. Laisser la notif **vigneron** sur `winery.user.preferredLocale`.

**2 — L-164b : PDF + .ics sur email #1.** Étendre l'`include` (address/commune) + `BookingConfirmationData` (`wineryAddress`, `wineryCommune`, `timeSlot`). Dans `sendBookingConfirmationEmail` (`email.service.ts`), après le bloc QR, pousser **2 attachments chacun dans son try/catch** (patron QR — ne jamais faire échouer l'email) : PDF via `generateBookingReceiptPDF()` (`booking-receipt.service.tsx`, `→ Buffer`) ; .ics via `createBookingCalendarEvent()` → `generateICalEvent()` (`src/lib/utils/calendar.ts`, pur, server-safe) en `contentType:'text/calendar'`. Mettre à jour tous les callers (TS strict flaggera les manquants). Réutilise : `booking-receipt.service.tsx`, `calendar.ts`, patron `attachments`.

**3 — L-164c : email #5 + 3 alternatives + locale.** Nouveau `src/server/queries/winery-alternatives.queries.ts` → `getNearbyWineryAlternatives(wineryId,{limit:3})` : coords nulles → `[]` ; sinon caves `VERIFIED`, `id≠`, coords non nulles, ≥1 expérience `PUBLISHED`, `sortByDistance` (`src/lib/geo-utils.ts`), top 3, DTO `{name,commune,url,distanceLabel}` (`formatDistance`) — indexation gardée (`noUncheckedIndexedAccess`). Étendre `BookingCancelledByWineryData` + `BookingCancelledByWineryEmail.tsx` (liste + fallback). Caller `src/server/actions/event-detail.ts` (~L694) : charger alternatives + passer **`booking.locale`**. Blocs FR/DE/EN dans `translations.ts` (imiter les blocs accentués). Réutilise : `geo-utils.ts`.

**4 — L-164d : rappel #2 veille 18h Zurich + locale.** `vercel.json` : remplacer l'entrée unique `/api/cron/reminders` `0 7 * * *` par **deux entrées quotidiennes** `0 16 * * *` (CEST) et `0 17 * * *` (CET). `src/app/api/cron/reminders/route.ts` : garde `if (heureZurich(now) !== 18) return skipped` ; remplacer la fenêtre 23-25h par **égalité de jour Zurich** (`date === addDays(zurichTodayAsUTCDate(now),1)`, `CONFIRMED`, `reminder24hSentAt:null`) ; `sendBookingReminderEmail(..., booking.locale)` ; stamp `reminder24hSentAt`. Bloc 2h conservé (ancré 18h) mais aussi `booking.locale`. Réutilise : `zurichTodayAsUTCDate`, l'helper heure Zurich, route `tasting-sheet-reminder` comme gabarit.

**5 — L-163 : email #22.** Nouveau `src/emails/templates/AdminNewWineryToValidateEmail.tsx` + `sendAdminNewWineryToValidateEmail()` (`email.service.ts`) + subject/blocs `translations.ts` (FR défaut, interne). Recipient **`ADMIN_NOTIFICATIONS_EMAIL`** (ajouter à `src/lib/env.ts`, optionnel, fallback `CONTACT_INBOX`). Hook : `createWinery` (`src/server/actions/winery.ts`) post-transaction, parallèle au `void sendWelcomeEmailToWinemaker`, fire-and-forget `.catch(logError)`. Voie fondateur (`invitation.ts`, VERIFIED) exclue car ne passe pas par `createWinery`. Log `EmailLog` type `'admin_new_winery'`.

**6 — L-160 : additions landing.** Étendre `admin-metrics.queries.ts` → `getTodayAdminKpis()` (Zurich via `zurichTodayAsUTCDate` + bornes `Date.UTC` gte/lt ; **les deux axes** : `_sum.totalPrice` sur `createdAt∈[today,tomorrow[` REVENUE_STATUSES, et count+`_sum.guestCount` sur `date===todayUTC` `[CONFIRMED,COMPLETED]`). Nouveau `src/server/queries/admin-ops.queries.ts` : `getWebhookHealth()` (`stripeEvent.findMany take:100 desc` → calc JS : `lastEventAt`, `failedCount`, `stuckCount` PROCESSING & `createdAt<now−15min`, `maxLag/avgLag = updatedAt−createdAt` sur PROCESSED) ; `getRecentIncidents()` (`emailLog status:'failed' take:10` + count 24h ; `scheduledJob status:'FAILED' take:10`). **Cache : `cache()` per-request seul, PAS `unstable_cache`, PAS le tag 300s** (une vue incident périmée est pire qu'une requête fraîche). Composants `AdminTodayKpis`/`AdminWebhookHealth`/`AdminIncidents` (`src/components/features/admin/`) ; wire dans `Promise.all` de `admin/page.tsx`. Strings `admin.*` ×3.

**7 — L-161 : caves tous statuts + historique.** Nouveau `src/server/queries/admin-wineries.queries.ts` : `getWineriesForAdmin({q,status})` (patron bookings : `where` OR name/commune/user.email insensitive + `status?`, `take:100`, include user.email) ; `getWineryHistory(wineryId)` (`Promise.all([verificationLog, adminAction where targetType:'Winery',targetId])` → DTO unifié `{kind,action,adminId,reason,at,metadata}`, tri `at desc`). Nouvelle page `src/app/[locale]/admin/wineries/page.tsx` (gabarit `bookings/page.tsx`). Nouveau composant présentation `src/components/features/admin/AdminActionHistory.tsx` (tolère reason/metadata null + action inconnue, `metadata Json?` narrow sans `as any`). Section historique sur `wineries/[id]/page.tsx`. Strings ×3.

**8 — L-162 : `/admin/utilisateurs`.** Validateurs `src/lib/validators/admin-users.ts` : `ChangeUserRoleSchema` (**enum `CLIENT|WINEMAKER`** — ADMIN non représentable), `AnonymizeUserSchema` (`targetId`, `reason`, `notifyUser:boolean`). Actions dans `src/server/actions/admin.ts` :

- `changeUserRole` : `requireAdmin` → safeParse → gardes `targetId≠adminId`, **cible non-ADMIN**, **pas de rétrogradation d'un WINEMAKER propriétaire de cave** (`USER_OWNS_WINERY`) → `$transaction([user.update, adminAction.create({action:'USER_ROLE_CHANGED',targetType:'User',targetId,metadata:{from,to}})])`.
- `anonymizeUserAsAdmin` : `requireAdmin` → garde `targetId≠adminId` → safeParse → **try/catch autour de** `anonymizeUser(targetId,{actorId:adminId,reason,notifyUser})` (le service **throw** `USER_NOT_FOUND`/`FUTURE_WINERY_BOOKINGS:<n>` → mapper en `ActionResult`, ne jamais throw). ⚠️ Ajout additif au service : param **`notifyUser?:boolean` (défaut true)** gardant l'appel `sendAccountDeletedEmail` (self-service inchangé).

Page `src/app/[locale]/admin/utilisateurs/page.tsx` (gabarit bookings : `searchParams {q,role}`, `user.findMany` OR email/name + `role?`, `take:100`, colonnes identité/rôle/statut `suspendedAt`·`anonymizedAt`/actions). Contrôles client `AdminRoleControls.tsx` + `AdminAnonymizeControls.tsx` (confirm + **case notifier**) ; **réutiliser** `AdminSuspensionControls` + `AdminActionHistory` (targetType `User`). Strings ×3.

Après 6-8 : `i18n:check` + **diff manuel `translations.ts`**.

## 5. Tests & mesures

- **Intégration** (`tests/integration/actions/`) — cœur : `admin-users.test.ts` (nouveau) : `changeUserRole` happy `CLIENT↔WINEMAKER` écrit `USER_ROLE_CHANGED` ; refus self / cible ADMIN / rôle ADMIN (schéma) / `USER_OWNS_WINERY` ; `anonymizeUserAsAdmin` délègue + écrit `USER_ANONYMIZED`, mappe `FUTURE_WINERY_BOOKINGS`/`USER_NOT_FOUND`/déjà-anonymisé en `ActionResult` (jamais throw), `notifyUser=false` ⇒ pas d'email ; non-admin → FORBIDDEN. (`privacy.test.ts` couvre déjà le cœur d'`anonymizeUser`.)
- **Queries** (`tests/integration`/`tests/db`) : today-KPIs (bookings à cheval sur la limite jour Zurich + une date DST ; axes `createdAt` vs `date`) ; admin-ops (StripeEvent PROCESSED/PROCESSING-vieux/FAILED, EmailLog failed, ScheduledJob FAILED → counts, borne 15 min, lag) ; admin-wineries (recherche + filtre statut ; `getWineryHistory` fusion+tri) ; winery-alternatives (top-3, exclut self/non-publié/coords nulles ; vide si origine sans coords).
- **Service/unit** (mock render+resend) : confirmation appelée avec `booking.locale` ; attachments = png+pdf+ics ; échec PDF/.ics ⇒ email quand même envoyé ; annulation #5 avec alternatives + `booking.locale` ; #22 tiré sur `createWinery` self-signup, PAS sur voie fondateur.
- **Cron** : reminders — garde n'agit qu'à 18h Zurich (2 fenêtres UTC, DST), sélectionne demain, passe `booking.locale`, dédup `reminder24hSentAt`.
- **E2E** (Playwright, minimal — pas de POM admin existant) : petit POM admin + 1 smoke/surface : (1) landing rend today/webhooks/incidents sans crash ; (2) `/admin/utilisateurs` recherche→rôle→anonymisation (confirm gardé, journal visible) ; (3) `/admin/wineries` filtre statut + historique visible.
- **Mesures** : `lint`/`format:check`/`tsc`/`i18n:check`/`test:run`/`test:e2e` verts.

## 6. Risques & pitfalls (spécifiques P-15)

- **Limite de jour Zurich** (today-KPIs) : `Booking.date` est `@db.Date` (minuit) — comparer à `new Date()` brut perd « aujourd'hui ». Utiliser `zurichTodayAsUTCDate` + bornes `Date.UTC`.
- **`anonymizeUser` throw + destructif + irréversible + email** : envelopper en `ActionResult`, confirm UI obligatoire, `notifyUser` respecté.
- **Latence/échec PDF** : `renderToBuffer` (react-pdf) lourd, peut throw → try/catch par attachment (email #1 ne casse jamais).
- **Re-timing rappel qui casse silencieusement le 2h** : décision explicite (gardé, ancré 18h, locale) — ne pas le perdre par accident.
- **Orphelinage cave + escalade ADMIN** dans `changeUserRole` : enum sans ADMIN, bloquer cible ADMIN et rétrogradation d'un propriétaire.
- **next-intl MISSING_MESSAGE** : chaque clé `admin.*` dans les 3 fichiers ; `translations.ts` **non** couvert par i18n:check → diff manuel.
- **TS strict** : `noUncheckedIndexedAccess` (`alternatives[0]`), `AdminAction.metadata Json?` de forme variable → narrow, pas de `as any`/`!`.
- **Cache** : garder ops/incidents **hors** `ADMIN_METRICS_CACHE_TAG` (300s jamais revalidé = vue périmée).
- **Rollback** : socle additif, aucun schéma. Dérive ⇒ revert PR. `ADMIN_NOTIFICATIONS_EMAIL` optionnel (fallback) ⇒ pas de casse env.

## 7. Vérification (bout-en-bout, à la build)

1. **Email #1 (DoD)** : réservation test payée → email reçu avec **QR inline + PDF `billet-…` + `.ics`**, corps dans **la locale du client** (tester une résa `EN`/`DE`).
2. **Email #5** : annuler une résa côté cave → email client avec **3 caves proches** (ou fallback si cave sans coords), locale client.
3. **Rappel #2** : cron `reminders` à 16:00/17:00 UTC → n'envoie qu'à 18h Zurich, sélectionne les sessions de **demain**, locale client, pas de double envoi.
4. **Email #22** : `createWinery` (signup encaveur) → `ADMIN_NOTIFICATIONS_EMAIL` reçoit « nouveau domaine à valider » ; une voie fondateur (invitation) **n'envoie pas**.
5. **Landing (L-160)** : `/admin` montre **CA réservé + dégustations du jour**, **santé webhooks** (lag/stuck/failed), **derniers échecs** emails+jobs ; données fraîches (recharger après un event/échec).
6. **Caves (L-161)** : `/admin/wineries` filtre par statut + recherche ; `/admin/wineries/[id]` affiche l'**historique** (validations + actions admin) trié.
7. **Utilisateurs (L-162)** : `/admin/utilisateurs` recherche ; **changement de rôle** `CLIENT↔WINEMAKER` (refus ADMIN + propriétaire de cave) journalisé et visible inline ; **anonymisation** (confirm + case notifier) journalisée, email conditionnel.
8. **Socle** : `lint` · `format:check` · `i18n:check` · diff `translations.ts` · `test:run` · `test:e2e` verts.

> **Note budget** : ~8 h. **Zéro migration, zéro flag** allègent le risque. Postes les plus lourds : L-162 (2 actions + page + audit inline) et L-164b (attachments PDF/.ics + mise à jour des callers). Réutilisation maximale (generators PDF/.ics/geo, `anonymizeUser`, `AdminSuspensionControls`, patrons queries/bookings) — pas de nouvelle abstraction.
