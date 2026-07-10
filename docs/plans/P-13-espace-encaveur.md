# P-13 — Espace encaveur V3 (Aujourd'hui, scan offline, payouts réels, relevés, emails #17/#18)

> **Statut** : en cours · **Branche** : `claude/p-13-espace-encaveur` (fallback session) · **PR** : #
> **Sources** : `docs/ENCAVE-V3-DELIVERY-PLAN.md` §P-13 · items L-130, L-140→L-143 (Must) · spec `docs/v3/ENCAVE-V3-PAGES-EMAILS.md` §6/§8 (emails #17, #18) · `docs/specs/ENC-114.md` (payouts, copy FR)
> **Type** : non-💰 (review `high`, pas de `/security-review`, pas de flag — dégradation gracieuse Stripe). Dépend de P-05 ✅ (+ réutilise P-07 : alertes, EmailLog, helpers Zurich).

## 1. Objectif

L'encaveur atterrit sur une page « Aujourd'hui » honnête (résas du jour, couverts 7 j, CA brut du mois, **remplissage 30 j réel** sur occurrences, prochains créneaux avec jauges, alertes actionnables, bouton scan) ; le scan fonctionne en réseau dégradé (liste préchargée + sync) ; « prochain virement » et l'historique deviennent des **données Stripe réelles** (fin de l'heuristique J+5) ; relevé PDF **mensuel** ; emails #17 (récap hebdo + virement + lien relevé) et #18 (action requise Stripe).

## 2. Constat de départ (audit code 2026-07-10)

- `/dashboard` **redirige** vers bookings — pas de landing. Le KPI « taux d'occupation » placebo a été retiré en P-01 (L-011) ; `getBookingSummary` fournit déjà `todayCount/weekGuests/monthCount` — ⚠️ en fuseau **serveur** (`localDateToUTC`) vs Zurich côté occurrences.
- **Aucun agrégat winery-wide** sur les occurrences : `getBookableOccurrences` (sièges, 1 exp, OPEN futur) et `getOccurrenceCalendar` (`countsTowardSeats` = COMPLETED‖NO_SHOW‖actif — le bon prédicat passé) sont les templates.
- **Scan** : 1 server action réseau par scan, aucune liste préchargée, aucun service worker (manifest seul). `Booking.accessTokenHash`/`checkedInAt` existent ; `expectedSessionId` requis.
- **Earnings** : heuristiques à supprimer — `calculateEstimatedPayoutDate` (J+5 ouvrés, earnings.queries.ts:91), `getTransactionStatus` (statuts par dates, :116), `nextPayoutDate` (:245). **Aucun appel `payouts.list`/`balanceTransactions.list`** dans le code. `metadata.bookingReference` est posé sur chaque session Stripe (checkout.ts:840) → corrélation possible.
- **Webhook Connect** : `account.updated` traité, **idempotence StripeEvent déjà en place** (le « Known Debt » de CLAUDE.md est périmé → corrigé au ⑦). Aucun email envoyé.
- **PDF** : `statement.service.tsx` (annuel, anglais en dur) via action→base64. **Weekly summary** : cron lundi + gating `notificationPreferences.weeklySummary` — sans virement ni lien relevé.
- **Dette P-05** consignée : `window.prompt` motif (CancelSessionButton:29), attendees sans `visitorEmail`/`checkedInAt`, actions occurrence **sans gate ARCHIVED serveur** (UI seule), grilles calendrier dupliquées (sémantiques différentes).
- Specs internes : **ENC-114** (page payouts — suivie en MVP), ENC-032b (kycStatus) et ENC-035 (relance J+1) **hors scope**.

## 3. Décisions produit (Sam, 2026-07-10)

- **D1 — Fusibles appliqués** : L-133/L-134 (wizard + onboarding) et L-144 (push web) coupés — formulaire et onboarding actuels conservés, les emails couvrent la notification. Package = Must (~13.5 h) + dette P-05.
- **D2 — Scan offline app-level, sans service worker** : page ouverte en ligne → liste du jour préchargée → scan local en mode avion → queue localStorage → sync auto au retour réseau. Limite assumée et documentée : recharger la page hors ligne exige du réseau.
- **D3 — KPI « CA du mois » = brut** (Σ `totalPrice` des résas actives du mois). Net et commission restent sur Revenus/Reversements.
- **D4 — Payouts = ENC-114 MVP** : `/dashboard/payouts` (table, statuts traduits, brut/commission (montant + 12 %)/net, nb résas, détail par payout, prochain virement réel, bouton « Ouvrir dans Stripe »). Filtres période + export CSV → dette consignée.

## 4. Décisions d'architecture

- **A1 — Landing** : `dashboard/page.tsx` devient la page « Aujourd'hui » WINEMAKER (CLIENT garde son redirect). Streams : KPIs ×4 (Fraunces) → alertes (réutilise `VisibilityBanner`, `TastingSheetAlertBanner` P-07, + `StripeKycBanner` extrait de earnings via `getPaymentStatusType`) → prochains créneaux → FAB scan mobile. Bookings inchangée ; le lien sidebar `dashboard` a déjà `exact:true`.
- **A2 — Remplissage 30 j** : `getWineryFillRate30d(userId)` — occurrences passées 30 j (≠ CANCELLED) : offert = Σ `resolveOccurrenceCapacity` ; vendu = groupBy bookings (expId,date,timeSlot) matché aux occurrences, prédicat passé de `getOccurrenceCalendar`. Stragglers exclus (pas de dénominateur). `{ soldSeats, offeredSeats, ratePct|null }`, React.cache, 2 requêtes.
- **A3 — Prochains créneaux** : `getUpcomingWinerySessions(userId, days=7, limit=6)` — occurrences OPEN non-blackout futures de la cave + `soldCount/capacity` (généralisation winery-wide de `getBookableOccurrences`), lien vers le calendrier sessions. Jauge du `OccurrenceDetailSheet` réutilisée en mini.
- **A4 — Harmonisation tz** : `getBookingSummary` passe sur `zurichTodayAsUTCDate` (même « aujourd'hui » que le moteur d'occurrences).
- **A5 — Scan offline** : query `getScanDayList(userId)` (sessions du jour Zurich, bookings actifs avec `accessTokenHash` — hashes au propriétaire, jamais les tokens) ; module pur `lib/scan/scan-queue.ts` (enqueue/dedupe/persist/flush, testé unit) ; `ScanClient` : hash SubtleCrypto → match local → feedback immédiat + compteur scannés/attendus + badge réseau, flush via `checkInBooking` (idempotent, `ALREADY_CHECKED_IN` = synced) ; `expectedSessionId` optionnel → mode « journée » (serveur : date = today Zurich + ownership). FAB → `/dashboard/scan`.
- **A6 — Payouts** : `payouts.queries.ts` — `listWineryPayouts` (payouts.list, 20/page), `getPayoutDetail` (balanceTransactions.list expand source → brut/commission/net + bookings par `bookingReference`), `getNextPayout` (balance pending + payout in_transit/pending). `unstable_cache` 5 min tag `payouts:${wineryId}` (DTO epochs sérialisables). Page `/dashboard/payouts` (empty states + copy FR ENC-114, détail en Sheet, login link `getStripeLoginLink`) + entrée sidebar. Earnings : carte « prochain virement » réelle ; **suppression** des 3 heuristiques ; statut transaction simplifié dérivé du booking seul. Stripe down/absent → bannière retry, jamais d'heuristique de secours.
- **A7 — Relevé mensuel** : `monthly-statement.service.tsx` (i18n locale encaveur, dict local ; Brut / Commission EnCave / Frais de service client (mention informative — argent plateforme) / **No-show : 0** (P-08 à venir) / Remboursements / **Net = Σ wineryPayout** + table des résas) ; route `GET /api/dashboard/statements/[month]` (isMonthKey → auth → ownership → PDF) ; section « Relevés mensuels » (12 mois) sur earnings ; le lien de l'email #17 pointe cette route (session requise, sessions encaveur longues — assumé).
- **A8 — Email #17** : cron weekly-summary enrichi — payouts.list des 7 derniers jours → « Virement envoyé : X CHF (n) » + lien relevé du mois précédent. Pas de webhook `payout.paid` (cache TTL suffit, ENC-114).
- **A9 — Email #18** : migration additive `Winery.stripeActionEmailAt` + `stripeActionDueHash`. `handleAccountUpdated` : `currently_due` non vide ET (hash trié ≠ stocké OU > 7 j) → `StripeActionRequiredEmail` (libellés humains des codes Stripe courants, fallback code brut, CTA profil) + update colonnes. Fail-safe : au moindre doute, log sans envoyer. `EmailLogType += 'stripe_action_required'`.
- **A10 — Dette P-05** : (a) dialog motif (AlertDialog + Textarea ≥ 10 car.) ; (b) attendees + `visitorEmail`/`checkedInAt` (mailto + badge « scanné à HH:mm ») ; (c) gate ARCHIVED serveur sur les 4 actions occurrence (`CONFLICT`) ; (d) grilles : **pas de consolidation** (occurrence-sièges vs liste-résas), décision documentée ici.

## 5. Scope

**IN** : L-130 (page Aujourd'hui — sans l'alerte « requests > 24 h », P-10 pas livré), L-140 (scan offline app-level), L-141 (payouts réels + historique ENC-114 MVP), L-142 (relevé mensuel + #17), L-143 (#18), dette P-05 (a-c) + harmonisation tz + corrections Known Debt (idempotence Connect périmée, heuristique payout).

**OUT** (explicitement) : L-133/L-134 wizard & onboarding (fusible — formulaire actuel), L-144 push web (fusible — emails), service worker/PWA (D2), filtres période + export CSV payouts (dette, spec prête), kycStatus ENC-032b (P-15 admin), relance KYC J+1 ENC-035, alerte requests (P-10), consolidation des grilles calendrier (A10d), webhook payout.paid.

## 6. Definition of Done (gate — copiée du delivery plan §P-13)

- [ ] `/dashboard` (encaveur) atterrit sur « Aujourd'hui » : résas du jour, couverts 7 j, CA du mois, **remplissage 30 j réel** (occurrences), prochains créneaux avec jauges, alertes actionnables, bouton scan
- [ ] Scan : mode avion → liste du jour préchargée, scan possible, sync au retour réseau, compteur scannés/attendus (test réseau coupé)
- [ ] « Prochain virement » = donnée Stripe réelle ; relevé PDF **mensuel** (brut, commission, fees, no-show, net)
- [ ] Emails #17 (récap hebdo + lien relevé) et #18 (action requise Stripe sur webhook KYC) envoyés (tests)
- [ ] Dette P-05 : dialog motif, attendees enrichis, gate ARCHIVED serveur (tests)
- [ ] Socle transverse (§3 du delivery plan) vert

## 7. Découpage technique

1. **Dette P-05** : `CancelSessionButton` (AlertDialog+Textarea), `occurrence.queries.ts` (DTO attendees +2 champs), `OccurrenceDetailSheet` (mailto, badge scanné), `occurrence.ts` (select `experience.status`, refus ARCHIVED ×4) + tests.
2. **Migration additive** : `Winery.stripeActionEmailAt DateTime?`, `stripeActionDueHash String?`. Harmonisation tz `getBookingSummary`.
3. **Queries** `dashboard-today.queries.ts` : `getWineryFillRate30d`, `getUpcomingWinerySessions`, `getMonthGrossRevenue` + tests unit/db.
4. **Page Aujourd'hui** : `dashboard/page.tsx` + `features/dashboard/today/*` (TodayKpis, UpcomingSessionsCard, ScanFab, StripeKycBanner partagé) + loading/error + `Dashboard.today.*` ×3.
5. **Payouts** : `payouts.queries.ts` + page `/dashboard/payouts` (+loading/error/empty ENC-114) + PayoutDetailSheet + sidebar + bascule earnings (suppression heuristiques) + `Payouts.*` ×3 + tests (Stripe mocké).
6. **Relevé mensuel** : service PDF i18n + route auth + section earnings + tests agrégat.
7. **Email #17** : cron + template + translations + tests.
8. **Email #18** : webhook + template + anti-spam + tests.
9. **Scan offline** : `scan.queries.ts` + `scan-queue.ts` + `ScanClient` refactor + `checkInBooking` mode journée + FAB + tests.

## 8. Tests & mesures

- **Unit** : queries Aujourd'hui (mocks) ; mapping payouts + corrélation bookings ; agrégat relevé ; anti-spam #18 (hash =/≠, > 7 j) ; `checkInBooking` journée (hier refusé, ownership) ; `scan-queue` (dedupe, persist, flush avec échec réseau, ALREADY_CHECKED_IN=synced) ; gate ARCHIVED ×4 ; dialog motif.
- **DB-gated** `tests/db/dashboard-today.test.ts` : remplissage 30 j (override compté, COMPLETED+NO_SHOW vendus, occurrence vide au dénominateur, CANCELLED exclue) ; `getScanDayList` (actifs seulement, hashes présents).
- **Manuel Sam** : Aujourd'hui sur mobile (KPIs vs Revenus) ; **scan avion** : ouvrir → avion → 2 scans ✓ verts + compteur → réseau ON → sync → `checkedInAt` posés ; payouts vs dashboard Stripe test ; relevé PDF ; weekly-summary forcé (Bearer) ; `stripe trigger account.updated` (compte incomplet) → #18 une seule fois.

## 9. Risques & rollback

- **Stripe down/compte absent** : fallback UI partout (bannière retry ENC-114), la page Aujourd'hui vit sans payouts. Pas de flag : bascule de lecture pure, revert PR possible (migrations additives only).
- **Scan** : dedupe local + idempotence serveur ; queue persistée ; rechargement offline = limite D2 documentée à l'écran.
- **#18** : anti-spam testé ; fail-safe log-only.
- **Coût API Stripe** : cache 5 min/compte, pages propriétaire uniquement.

## 10. Décisions (tranchées)

D1–D4 (Sam, AskUserQuestion 2026-07-10) + A1–A10 (ce plan). ENC-114 questions ouvertes tranchées : commission affichée montant + « (12 %) », bouton « Ouvrir dans Stripe » inclus (login link existant), export CSV → dette. Aucune décision ouverte.
