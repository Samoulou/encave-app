# P-07 — Boucle vin (fiche dégustation → email J+2)

> **Statut** : en cours · **Branche** : `claude/p-07-boucle-vin` (fallback session, cf. P-01/P-05) · **PR** : #
> **Sources** : `docs/ENCAVE-V3-DELIVERY-PLAN.md` §P-07 · items L-060→L-064 · spec `docs/v3/ENCAVE-V3-PRD.md` US-230 · `docs/v3/ENCAVE-V3-PAGES-EMAILS.md` §5/§6/§8 (emails #3, #21)
> **Type** : non-💰 (review `high`, pas de `/security-review`). **Feature-flaggé** : `TASTING_SHEET` (déjà au registre `src/lib/flags.ts`, OFF par défaut). Jalon **G-R1 (13.09)** = fin P-07.

## 1. Objectif

L'encaveur gère son catalogue de vins (`/dashboard/wines`, visible sur sa fiche publique) et coche en ≤ 30 s les vins servis d'une session ; à J+2 chaque client de la session reçoit « vos coups de cœur chez [Cave] » (vins + prix + CTA de demande de commande) ; la cave reçoit la demande avec les coordonnées. Rappel 21 h à l'encaveur si la fiche du soir est vide. Open/click tracés par cave. Flag OFF = aucune fiche, aucun email, zéro changement de comportement.

## 2. Constat de départ (audit code 2026-07-10)

- `Wine` (schema:501-517) et `BookingWine` (519-531, `@@unique([bookingId,wineId])`) posés en P-02, **zéro lecteur/écrivain** dans `src/`.
- `ScheduledJob` (682-697 : `type/runAt/status/payload/dedupeKey @unique/attempts/lastError`) : **aucun producteur ni consommateur runtime** (seed uniquement). P-07 livre le premier moteur — réutilisable par P-09 (gift cards) et P-10 (request reminders).
- **Pas de statut COMPLETED automatique** : la fin de session se calcule `date + timeSlot + experience.duration` (pattern `follow-ups/route.ts:22-27,69-71`).
- **`Booking` n'a pas de locale client** — l'email de confirmation utilise `winery.user.preferredLocale` (la locale de l'encaveur !). Précédents propres : `Request.locale`, `GiftCard.locale`. Le validator checkout accepte déjà `locale` (checkout.ts:167) sans la persister.
- **Aucun tracking open/click** (pas de webhook Resend, pas de tags dans `resend.emails.send`, message id jeté). `EmailLog` existe (audit d'envoi).
- **Aucun opt-out client** : `NotificationPreferences` est winery-only (route `GET /api/unsubscribe/[token]` existante à imiter).
- Il existe déjà un **follow-up générique J+1** (`cron/follow-ups`, gate `status=COMPLETED && followUpSentAt=null`) → risque de doublon d'emails avec le récap J+2.
- Points d'accrochage UI nets : `OccurrenceDetailSheet` (P-05, attendees par session), sidebar `DashboardSidebar.tsx`, section Gallery de `(public)/wineries/[slug]/page.tsx`, `VisibilityBanner` de `dashboard/bookings/page.tsx`.

## 3. Décisions produit (tranchées par Sam, 2026-07-10)

- **D1 — Fiche par session, fan-out.** Un seul écran de toggles par créneau (dans `OccurrenceDetailSheet`) ; les vins cochés s'appliquent à toutes les réservations actives de la session (`BookingWine` persisté par booking — la DoD « persistée par réservation » est respectée). « Envoyer le récap » = enregistrer + armer (pas d'envoi manuel immédiat au launch).
- **D2 — Envoi à `max(fin session + 48 h, remplissage)`.** Gate au run : fiche remplie + pas d'opt-out. Fiche remplie après J+2 → l'email part au prochain run du cron.
- **D3 — CTA « Commander ces vins » = page tokenisée**, pré-cochée (vins/quantités ajustables) → 1 tap « Envoyer la demande » → email à la cave avec vins + coordonnées. **Jamais de mutation au GET** (les scanners anti-spam « cliquent » les liens des emails).
- **D4 — Le follow-up générique J+1 est sauté si un récap est armé** pour ce booking ; sinon inchangé. Flag OFF = comportement actuel strict.

## 4. Décisions d'architecture

- **A1 — Producteur = `saveTastingSheet`** (pas de cron-scan : un job sans fiche ne partirait jamais). 1 job **par booking**, `dedupeKey = TASTING_RECAP:{bookingId}` (dédup native). Fiche vidée → `BookingWine` purgés + jobs `PENDING` → `CANCELLED` ; re-remplie → réarmés. Jamais toucher `PROCESSING/DONE/FAILED`. **L'existence du job = critère « armé » de D4.**
- **A2 — Consommateur générique** `/api/cron/process-scheduled-jobs` (`0 * * * *`), registre type→handler. Types actifs filtrés par flag (`TASTING_RECAP` ssi `TASTING_SHEET` ON) → flag OFF = jobs jamais claimés, 0 attempt, réactivables. Claim atomique par `updateMany({where:{id,status:PENDING}, data:{status:PROCESSING, attempts:{increment:1}}})` (count===1 = propriété — 2 runs concurrents ne traitent jamais le même job). Succès→`DONE` ; skip métier→`CANCELLED`+`lastError` ; erreur→`PENDING` si attempts<5 sinon `FAILED`.
- **A3 — Tracking = webhook Resend entrant** (svix, `RESEND_WEBHOOK_SECRET`) → `EmailLog.openedAt/clickedAt` matchés par `resendMessageId` (capturé à l'envoi, tags `winery_id/email_type/booking_id`). Fallback first-party : PostHog serveur `wine_order_page_viewed`/`wine_order_requested`. Prérequis ops (Sam) : tracking activé sur le domaine Resend + webhook créé + secret en env Vercel.
- **A4 — Opt-out client** (LCD, contenu commercial) : table `ClientEmailPreference { email @unique (lower-case), marketingOptOut, unsubscribeToken @unique }` + `GET /api/unsubscribe/client/[token]`. Lien dans le footer du récap. Servira `/compte/profil` (P-13).
- **A5 — « Fiche remplie » = rows `BookingWine`** (pas de table marqueur). Clé session = `(experienceId, date, timeSlot)` (couvre les bookings legacy sans `occurrenceId`). Bookings actifs = `CONFIRMED` + `COMPLETED`. 0 vin volontaire = rien à récapituler = pas d'email.
- **A6 — Demande de commande persistée** : `WineOrderRequest` (`bookingId @unique` → idempotence 1 tap, doublon = `CONFLICT` « déjà envoyée ») + `WineOrderRequestItem` (snapshot nom/cépage/millésime/`priceAtRequest`). Délivrée par email au launch ; la table = inbox future du Shop 3.1.
- **A7 — Token page commande** : le plaintext d'`accessToken` est irrécupérable à J+2 (hash seul stocké) → colonne additive `Booking.recapTokenHash` mintée au run du job ; la page valide `recapTokenHash` OU `accessTokenHash` (le lien billet marche aussi). Pas de rotation = zéro lien cassé. _(Déviation assumée de la lettre de D3 — même esprit.)_
- **A8 — Skip J+1** dans `follow-ups/route.ts` : 1 lecture de flag par run ; OFF → aucun code nouveau ne s'exécute. ON → préchargement des `dedupeKey IN (…)` non-`CANCELLED` en 1 requête → booking armé = `continue` **sans poser `followUpSentAt`** (la fenêtre 22-26 h évite le re-match).

## 5. Scope

**IN** : L-060 (CRUD vins `/dashboard/wines` + note « Bientôt : vendez en ligne »), L-061 (fiche dégustation par session, toggles ≥ 48 px), L-062 (email #3 J+2 via ScheduledJob + cron + tracking par cave), L-063 (email #21 rappel 21 h + alerte dashboard), L-064 (section « Nos vins » fiche domaine publique). Plus : moteur `ScheduledJob` générique, `Booking.locale`, opt-out client, page commande tokenisée, email demande de commande à la cave (3ᵉ template — découle de D3, non listé au backlog).

**OUT** (explicitement) : achat direct des vins / panier (Shop 3.1), inbox UI des demandes de commande côté cave (la table est prête ; l'email suffit au launch), opt-out appliqué au follow-up J+1 générique (la table le permet, hors scope), page `/compte/profil` préférences (P-13), alerte « demandes sans réponse » (P-10), migration des 12 vieux blocs `translations.ts` non accentués (dette préexistante).

## 6. Definition of Done (gate — copiée du delivery plan §P-07)

- [ ] CRUD vins ≤ 2 min pour 5 vins (mobile) ; vins visibles sur la fiche domaine publique
- [ ] Fiche dégustation remplie en ≤ 30 s sur mobile (toggles ≥ 48 px), persistée par réservation
- [ ] Email J+2 « vos coups de cœur » : vins + prix + CTA commande 1 clic → la cave reçoit la demande avec coordonnées (cron testé, dédup)
- [ ] Rappel 21 h si fiche vide + alerte dashboard ; open/click tracés par cave
- [ ] Flag OFF = aucune fiche, aucun email
- [ ] Socle transverse (§3 du delivery plan) vert

## 7. Découpage technique

1. **Migration additive unique** : `Booking.locale Locale @default(FR)` + `recapTokenHash String?` (+index) + `tastingRecapSentAt DateTime?` ; `EmailLog.resendMessageId @unique` + `wineryId` + `openedAt/clickedAt` (+index `[wineryId,type]`) ; tables `ClientEmailPreference`, `WineOrderRequest`, `WineOrderRequestItem` (FK wine `Restrict`). `env.ts` : `RESEND_WEBHOOK_SECRET` optional. Dépendance `svix`.
2. **Checkout** : persister `locale` au create du booking (validator l'accepte déjà).
3. **Validators** `src/lib/validators/wine.ts` : `createWineSchema`/`updateWineSchema`/`deleteWineSchema`, `saveTastingSheetSchema`, `submitWineOrderRequestSchema`.
4. **Actions** `src/server/actions/wine.ts` (CRUD, pattern occurrence.ts, delete → `CONFLICT` si `BookingWine` référence) et `src/server/actions/tasting-sheet.ts` (`saveTastingSheet` fan-out + jobs ; `submitWineOrderRequest` public rate-limité, token, P2002→`CONFLICT`).
5. **Queries** `src/server/queries/wine.queries.ts` (React.cache, DTO, tenant gate) : `getOwnerWines`, `getTastingEmailStats`, `getEmptySheetSessionsToday`, query read-only page commande ; extension `getWineryBySlug` (wines disponibles) et `OccurrenceCalendarEntryDTO.servedWineIds`.
6. **Services** : `scheduled-jobs.service.ts` (runner testable), `tasting-recap.service.ts` (handler J+2, gates, mint token), extensions `email.service.ts` (tags + messageId) et `email-log.service.ts` (3 types + resendMessageId/wineryId).
7. **Crons/routes** : `process-scheduled-jobs` (0 \* \* \* \*), `tasting-sheet-reminder` (0 19 + 0 20 UTC, garde 21 h Europe/Zurich, groupé par cave, dédup EmailLog/jour), `POST /api/webhooks/resend` (svix), `GET /api/unsubscribe/client/[token]`, modification `follow-ups` (A8), `vercel.json`.
8. **Emails** ×3 (`translations.ts` blocs accentués, modèle manualRefund) : `TastingRecapEmail` (#3, locale `booking.locale`), `TastingSheetReminderEmail` (#21, locale encaveur), `WineOrderRequestEmail` (cave + copie client).
9. **UI** : `/dashboard/wines` (quick-add focus conservé, toggle dispo ligne entière, stats emails, flag OFF → notFound) + sidebar conditionnelle ; `TastingSheetSection` dans `OccurrenceDetailSheet` (lignes ≥ 48 px, état « récap armé ») ; section publique « Nos vins » ; `TastingSheetAlertBanner` ; page `(public)/booking/[id]/commande` (+ `WineOrderForm`). i18n ×3 : `nav.wines`, `Dashboard.wines.*`, `Dashboard.tastingSheet.*`, `winery.winesSection.*`, `wineOrder.*`.

## 8. Tests & mesures

- **Unit** : wine.ts + tasting-sheet.ts × unauthorized/validation/happy + flag OFF `FORBIDDEN` + delete `CONFLICT` + token invalide + doublon `CONFLICT` ; `scheduled-jobs.service` (dispatch, claim perdu, PENDING→FAILED à 5, type inactif jamais claimé) ; garde 21 h Zurich CET/CEST.
- **DB-gated** `tests/db/tasting-loop.test.ts` (`describe.skipIf(!INVARIANTS_DATABASE_URL)`, Postgres local uniquement) : fan-out (actifs oui, CANCELLED/NO_SHOW/holds non) ; dédup (save ×2 → 1 job/booking ; runner ×2 → 1 envoi) ; `runAt≈now` si fiche > 48 h après la session ; flag OFF (action `FORBIDDEN` + runner laisse `PENDING` à 0 attempt) ; opt-out → `CANCELLED` ; skip J+1 (armé/non armé/flag OFF) ; unicité `WineOrderRequest.bookingId` sous concurrence.
- **Scénario manuel Sam** : activer `TASTING_SHEET` (admin, < 1 min) → créer 5 vins ≤ 2 min sur mobile → cocher 3 vins d'une session passée ≤ 30 s → forcer `process-scheduled-jobs` (Bearer `CRON_SECRET`) → recevoir « vos coups de cœur » → « Commander ces vins » → ajuster quantités → la cave reçoit la demande avec coordonnées → stats open/click sur `/dashboard/wines`.

## 9. Risques & rollback

- **Kill-switch total** par flag : UI cachée, actions `FORBIDDEN`, runner ne claim pas le type, page commande 404, section publique masquée, rappel no-op, skip J+1 conditionné. Toggle admin < 1 min sans deploy ; jobs `PENDING` restants inoffensifs et réactivables.
- **Tracking dépendant d'ops Resend** → dégradation gracieuse (stats à 0 ; PostHog first-party couvre le clic CTA). À vérifier en staging avant G-R1.
- **Emails en double** (J+1 + J+2) → D4/A8. **Envoi en double** → triple garde : dedupeKey unique, claim atomique, `tastingRecapSentAt`.
- **Bookings legacy sans locale** → récap en FR (défaut — acceptable Valais).
- Rollback : flag OFF (< 1 min) ; migrations 100 % additives → revert PR possible sans perte de données.

## 10. Décisions (tranchées)

Toutes tranchées avant BUILD : D1–D4 (Sam, AskUserQuestion 2026-07-10) + A1–A8 (revue d'architecture, ce plan). Aucune décision ouverte. Point à valider en review de PR : A7 (`recapTokenHash`, déviation de la lettre de D3).
