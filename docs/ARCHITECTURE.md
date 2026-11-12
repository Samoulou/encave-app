# ARCHITECTURE — EnCave (état réel)

> **Rôle** : décrit l'application **telle qu'elle tourne** sur `main` après P-01→P-16 et les correctifs de l'audit pré-launch du 12.11.2026.
> Source de vérité **technique** de l'état courant. Le **produit/cible** vit dans [`v3/`](./v3/),
> le **pilotage** dans [`ENCAVE-V3-DELIVERY-PLAN.md`](./ENCAVE-V3-DELIVERY-PLAN.md), les **décisions** dans [`adr/`](./adr/).
> Dernière révision : 2026-11-12 (audit pré-launch — routing/middleware, API/crons, flags, emails, sections « dormant » et « à construire » remises à plat ; rapport : [`audits/2026-11-12-audit-pre-launch.md`](./audits/2026-11-12-audit-pre-launch.md)). Vérifié contre le code, pas contre les docs.

## Vue d'ensemble

Next.js 14.2 App Router, TypeScript strict, Prisma/PostgreSQL (Neon), better-auth, Stripe Connect, next-intl (fr/de/en), Tailwind + shadcn/ui, déployé sur Vercel. Convergence vers EnCave V3 (Slot/Stay/Request/Shop) : le socle V2 est opérationnel et les piliers du launch (bons cadeaux, sur-mesure, anti no-show, fiche dégustation, événements collectifs) sont livrés, chacun derrière son feature flag. Restent Shop (V3.1) et Stay (V3.2).

## Routing & régimes de rendu

Arbre `src/app/[locale]/` (fr défaut, de, en ; `localePrefix: always`) + deux zones hors-locale : `/coming-soon` et `/api`. Groupes : `(public)`, `(auth)`, `(protected)`, `admin`. **Trois régimes de rendu réels** :

1. **ISR `revalidate = 300`** (P-06) — 6 pages, prérendues, invalidées par **tags `experiences`/`wineries` uniquement** (jamais `revalidatePath` sur le public) :
   - `/` (home), `/experiences` (catalogue — ne lit **plus** `searchParams` : filtres 100 % client, D2), `/experiences/[slug]`, `/wineries`, `/wineries/[slug]` (les deux fiches : `generateStaticParams` + `dynamicParams: true`), `/sur-mesure`.
   - `not-found` des fiches est un **client component** (un `getTranslations` serveur co-localisé démoterait la route ISR en dynamique).
   - Un îlot client qui lit l'URL (nuqs) sur une page ISR a son **propre `<Suspense>`** avec une grille rendue serveur en fallback (`ExperiencesStaticFallback`, `WineriesStaticFallback`) — sans lui, toute la page bascule en rendu client et le HTML prérendu est vide (audit 12.11).
   - Un flag lu pendant le prérendu (`/sur-mesure` fait `notFound()` flag OFF) est purgé par le toggle admin (tag `feature-flags`) ; un flip SQL direct attend le TTL de la page.
2. **SSG pur ×3 locales** (via `generateStaticParams` du layout `[locale]`) : `about`, 2 landings SEO (`degustation-vin-valais`, `cepages-valaisans`), `legal/{terms,privacy,cancellation}`, `mentions-legales`, `contact`, `maintenance` ; plus `/coming-soon` (hors `[locale]`, FR, `noindex`).
3. **Dynamique par requête** : tout `(auth)` (layout appelle `auth()`), tout `(protected)` et `admin` (`auth()` + rôle), et les pages transactionnelles pilotées par token/searchParams : checkout (trio hold), `/booking/[id]` (token), `confirmation` (`session_id`), `commande` (token + flag `TASTING_SHEET`), `reservation/erreur`, `unsubscribe`, `cadeaux` (lit `searchParams`, `notFound()` flag OFF), `bon/[code]` (bon cadeau), `sur-mesure/offre/[token]`, `invitation/[token]`.

**Middleware** (`src/middleware.ts`, Edge, **aucun accès DB**) — dans l'ordre :

1. **`/api/*`** : laissé passer tel quel. Seule exception, `MAINTENANCE_MODE=true` : les appels **mutants** (≠ GET/HEAD/OPTIONS) reçoivent 503 + `Retry-After`, sauf `/api/webhooks/**`, `/api/cron/**` et `/api/health` (Stripe désactive un endpoint qui échoue en série). Le matcher inclut `/api/:path*` uniquement pour cela.
2. Fichiers statiques (`/_next`, chemins avec extension) : ignorés.
3. **`MAINTENANCE_MODE=true`** (gel des écritures, runbook [`restauration-db.md`](./runbooks/restauration-db.md)) : toute page est réécrite vers `/[locale]/maintenance` en 503 ; une server action (POST sur une URL de page) reçoit 503 JSON.
4. **Gate Coming Soon** : variable d'env `COMING_SOON` — toute valeur ≠ `false` garde `encave.ch`/`www.encave.ch` sur `/coming-soon` (fail-closed ; exceptions : les 2 landings SEO et `/invitation/*`). Le gate est **par nom d'hôte** : staging, previews et le domaine `*.vercel.app` de production ne sont pas gatés. Bascule = env Vercel + redeploy.
5. Routing next-intl.
6. Présence du cookie better-auth sur `/dashboard|/onboarding|/admin` → sinon redirect `/login?callbackUrl`.

Le **rôle ADMIN** n'est pas dans le middleware : `admin/layout.tsx` et chaque page admin (`requireAdminPage()`) / action admin (`requireAdmin()` : rôle + non suspendu + TOTP + âge de session). `next.config.js` redirige `www.encave.ch` → apex en 308 (les webhooks doivent donc viser l'apex).

**Header découplé** (P-06/D1) : `Header` synchrone sans `auth()` ; la session vit dans des îlots client (`HeaderAuthSlot` → `dynamic(ssr:false)` après idle, skeleton sans flash ; `HeaderRoleLink` pour les liens rôle) → l'arbre serveur public reste statique.

## API

- **better-auth** : catch-all `/api/auth/[...all]` (+ `/api/auth/session-expired`). Rate limit en base (`rate_limits`).
- **Webhooks signés + idempotents** : Stripe checkout + Stripe **connect** (claim via `StripeEvent`, reprise d'un `PROCESSING` périmé), Resend (svix → `EmailLog`).
- **Routes cron** (`/api/cron/*`) : authentifiées par `Authorization: Bearer $CRON_SECRET` **uniquement** (`src/lib/cron-auth.ts`, fail-closed si la variable manque). Les horaires vivent dans `vercel.json` (source de vérité) et sont **miroités** dans `CRON_SCHEDULES` (`src/lib/cron-monitor.ts`, moniteurs Sentry « missed check-in ») — `tests/unit/lib/cron-monitor.test.ts` casse à la moindre dérive. Les handlers décident à l'**horloge** (gardes Europe/Zurich) ; les `?slot=N` / `?window=` ne servent qu'à déclarer plusieurs entrées quotidiennes d'une même route :
  - `reminders` : horaire de 04:00 à 19:00 UTC (16 entrées) — J-1 à 18 h Zurich avec rattrapage le soir même, rappel 2 h pour les sessions débutant dans (1 h, 2 h 30] ; marqueur posé **avant** l'envoi (jamais deux emails), libéré si l'envoi échoue.
  - `process-scheduled-jobs` : toutes les 3 h (8 entrées) — runner générique de la table `ScheduledJob`. Nouveau job différé = nouveau type dans son `JOB_REGISTRY`, jamais un cron par type.
  - `tasting-sheet-reminder` (2 entrées, garde 21 h Zurich), `daily-digest`, `weekly-summary`, `follow-ups`, `expire-pending-bookings`, `generate-occurrences`, `reconcile-gift-transfers`.
- **`/api/health`** (P-16) : sonde publique rate-limitée — DB + Redis (2 s) ; `?deep=1` ajoute Stripe, les `StripeEvent` bloqués/échoués et les `ScheduledJob` FAILED. 200 = rien à faire, 503 = `down`/`degraded` → c'est la cible du moniteur d'uptime externe.
- **Désinscription** : `/api/unsubscribe/[token]` (cave) et `/api/unsubscribe/client/[token]` (client) — GET (lien du pied d'email) et POST (one-click RFC 8058), cf. §Emails.
- **Utilitaires** : `newsletter` (rate-limité), `geocode` (proxy Nominatim, timeout 3 s), export nLPD (authentifié), relevé mensuel PDF (authentifié, P-13), `/api/test/booking-hold` (404 hors `E2E_TEST`).
- `robots.ts` : disallow `/api/`, `/_next/`, `/coming-soon` et, **par locale**, `/{locale}/dashboard`, `/{locale}/admin`, `/{locale}/onboarding`, `/{locale}/invitation/` (les pages publiques à ne pas indexer portent un `noindex`, qu'un crawler doit pouvoir lire). `sitemap.ts` : pages publiques + slugs publiés (DB) avec hreflang ×3 + x-default ; `/cadeaux` et `/sur-mesure` seulement si leur flag est ON ; pas de `/login` ni `/register`.

## Couche serveur (`src/server/`)

Quatre étages stricts : **Component → Action → Query/Service → DB**. Les composants n'importent `db`/`auth` que dans des Server Components de pages protégées ; les queries n'importent que `db` (+ `getStripe` pour payouts) ; les services n'appellent jamais d'actions. Deux façades re-exportent des sous-modules (`actions/availability.ts`, `actions/experience.ts`).

- `db.ts` : singleton `PrismaClient`. `stripe.ts` : singleton Stripe (API `2025-12-15.clover`, timeout 20 s, 2 retries réseau) via `getStripe()`/`isStripeConfigured`. `auth.ts` : wrapper better-auth en `React.cache` qui **RE-THROW** le bailout `DYNAMIC_SERVER_USAGE` (piège ISR P-06). `better-auth.ts` : email/mot de passe, OTP email (login + reset), TOTP admin, Google, vérification d'email à l'inscription, durcissements `auth-hardening.ts` (P-14/P-16).
- **Trois familles de cache** : (1) `React.cache` seul pour les données tenant/dynamiques (booking, earnings, dashboard-today, occurrence, scan, wine, user…) ; (2) `cache(unstable_cache)` taggé pour le public (`experience.queries` tag `experiences`, `feature-flags` 60 s, `admin-metrics` 300 s) ; (3) `unstable_cache` seul (`winery.queries` tag `wineries`, `payouts` tag `payouts:{stripeAccountId}` 300 s, `cachedSearch` hoisté module-level 120 s).
- Invalidation **tags-only** via `invalidateExperienceCaches`/`invalidateWineryCaches`. Note : les `revalidateTag('occurrences:*')` sont un scaffolding forward-compat volontaire (cf. commentaire `occurrence.ts`) — `getBookableOccurrences` n'est pas caché, l'invalidation réelle passe par les helpers.

## Données

Prisma/PostgreSQL (Neon pooled `DATABASE_URL`, `DIRECT_URL` pour migrations, cuid()). **34 modèles / 17 enums** : socle V2 (User, Winery, Experience, Booking, StripeEvent, EmailLog…) + modèles V3 branchés (GiftCard + ledger, Request/RequestOffer, ExperienceOccurrence, EventParticipant, Wine/BookingWine, ScheduledJob, FeatureFlag, ClientEmailPreference…). Invariants d'argent en SQL (CHECK + triggers). Argent en **centimes** (CHF), dates **UTC** (Zurich via helpers).

## Feature flags

`FLAG_REGISTRY` (`src/lib/flags.ts`), 7 clés, tout **OFF** par défaut sauf `OCCURRENCE_CAPACITY` (sémantique inversée). État en base (`feature_flags`), lecture cache 60 s (`feature-flags.queries.ts`), toggle admin sur **`/admin`** (`FeatureFlagsPanel`) — runbook [`kill-switch-flags.md`](./runbooks/kill-switch-flags.md). Tout ce qui touche l'argent est flag-gated et désactivable en < 1 min sans deploy.

Deux interrupteurs sont des **variables d'env** parce que le middleware Edge ne lit pas la base (flip = env Vercel + redeploy) : `COMING_SOON` (gate de lancement) et `MAINTENANCE_MODE` (gel des écritures). `E2E_TEST` (simulation Stripe, rate limits coupés) se lit uniquement via `isE2ETest()` et est refusé en production.

## Emails

35 fichiers de templates React Email, **un seul consommateur** : `src/server/services/email.service.ts` (fonctions `send*`). `sendEmail` : retry ×3 backoff, `from` = `noreply@encave.ch`, **`Reply-To` = `EMAIL_REPLY_TO`** (boîte lue, défaut `support@encave.ch` — `noreply@` n'a pas de boîte), **partie texte brut** dérivée du HTML, tags Resend → webhook svix. Renvoie `false` (jamais un succès) si `RESEND_API_KEY` manque en production. Les emails client utilisent `Booking.locale` (persisté au checkout) et impriment les heures en Europe/Zurich (`src/emails/utils/formatters.ts`).

**Désinscription** — un seul producteur/consommateur de liens : `src/server/services/email-preferences.service.ts`.

| Email                            | Destinataire | Préférence                              | Lien                                                         |
| -------------------------------- | ------------ | --------------------------------------- | ------------------------------------------------------------ |
| Digest quotidien, récap hebdo    | cave         | `NotificationPreferences` (par domaine) | `/api/unsubscribe/[token]?type=daily_digest\|weekly_summary` |
| Suivi J+1, « coups de cœur » J+2 | client       | `ClientEmailPreference` (par email)     | `/api/unsubscribe/client/[token]`                            |

La même URL alimente le lien du pied d'email et les en-têtes `List-Unsubscribe` + `List-Unsubscribe-Post` (one-click). Les emails transactionnels (confirmation, rappels, remboursements, sécurité) ne passent pas d'`unsubscribeUrl` et n'affichent aucun lien de désinscription.

## i18n

3 locales fr (défaut)/de/en, 37 namespaces strictement alignés (garde `scripts/check-translations.ts`). Subsets par surface (P-06/L-203) : layout racine = base légère, providers imbriqués par segment ; garde statique `tests/unit/i18n/client-namespaces.test.ts` + `onError` throw hors prod. `src/emails/translations.ts` porte ses propres blocs FR/DE/EN (diacritiques gardés par `tests/unit/emails/translations.test.ts` ; allemand suisse : `ss`, jamais `ß`).

## Composants (`src/components/`)

`ui/` (19 primitives shadcn, intouchables, toutes consommées), `shared/` (providers du root layout + îlots perf `AfterIdle`/`LazyOnVisible`/`DesktopOnly`), `features/{domaine}/` (21 domaines, chacun rattaché à une route), `layout/` (header découplé ISR). `src/hooks/` : 3 hooks dont `useNavigateWithTransition` (remplaçant obligatoire de `router.push`). `src/lib/` utilisé réellement (`cn` 91 fichiers, `logger` 65, `seo/metadata` 32, `currency` 29, `i18n/formatters` 22…).

## Code dormant (conservé — futur documenté)

Gardé volontairement, **ne pas supprimer** :

- Cluster **blocage de dates** (`blockDate` est utilisé par `DayDetailPanel` ; `unblockDate`/`toggleSlotActive` sont un complément non encore branché).
- Templates `PasswordResetEmail` / flux reset par lien : le reset passe par OTP (P-14) ; le template reste pour un éventuel retour au lien.
- Table Prisma `VerificationToken` — legacy orpheline (0 réf code) ; **non supprimée** (règle migrations additives).
- Variables d'env déclarées mais non lues par l'app : `NEXT_PUBLIC_MAPBOX_TOKEN` (la carte tourne sur MapLibre + fond OSM), `STRIPE_PUBLISHABLE_KEY` (Checkout hébergé), `NEXT_PUBLIC_VERCEL_ANALYTICS_ID`.

## Surfaces V3 encore à construire

Les surfaces du launch existent : `/cadeaux` + `/bon/[code]` + `/dashboard/bons-cadeaux` + `/admin/bons-cadeaux` (P-09), `/sur-mesure` + `/sur-mesure/offre/[token]` + `/dashboard/demandes` (P-10), empreinte et frais no-show (P-08), `/dashboard/evenements-participes` (P-11), `/admin/utilisateurs` (P-15), `/mentions-legales`, `/contact`, `/maintenance` (P-12).

Restent au planning : **Shop** (V3.1, janv. 2027), **Stay** (V3.2, févr. 2027), avis/widget (V3.3). Les routes `/compte` et `/encaveur/*` de l'inventaire V3 ne sont pas créées : l'espace client et l'espace encaveur vivent sous `/dashboard` (renommage = epic dédié avec redirections).

## Dette connue

Voir `CLAUDE.md` §Known Debt (re-vérifié le 12.11.2026) et le rapport d'audit [`audits/2026-11-12-audit-pre-launch.md`](./audits/2026-11-12-audit-pre-launch.md) §5–6. Ouvert à cette date : identité légale (placeholders des mentions légales, « EnCave SA » et adresse fictive sur les pages légales), version de Node non épinglée (`engines`), `/login` et `/register` indexables.
