# ARCHITECTURE — EnCave (état réel)

> **Rôle** : décrit l'application **telle qu'elle tourne** sur `dev` après P-01→P-07, P-13 et P-06.
> Source de vérité **technique** de l'état courant. Le **produit/cible** vit dans [`v3/`](./v3/),
> le **pilotage** dans [`ENCAVE-V3-DELIVERY-PLAN.md`](./ENCAVE-V3-DELIVERY-PLAN.md), les **décisions** dans [`adr/`](./adr/).
> Dernière révision : 2026-07-12 (package P-06.5). Vérifié contre le code, pas contre les docs.

## Vue d'ensemble

Next.js 14.2 App Router, TypeScript strict, Prisma/PostgreSQL (Neon), better-auth, Stripe Connect, next-intl (fr/de/en), Tailwind + shadcn/ui, déployé sur Vercel. Convergence vers EnCave V3 (Slot/Stay/Request/Shop) : le socle V2 est opérationnel, les fondations V3 (schéma P-02) sont posées, plusieurs surfaces V3 restent à construire.

## Routing & régimes de rendu

Arbre `src/app/[locale]/` (fr défaut, de, en ; `localePrefix: always`) + deux zones hors-locale : `/coming-soon` et `/api`. Groupes : `(public)`, `(auth)`, `(protected)`, `admin`. **Trois régimes de rendu réels** :

1. **ISR `revalidate = 300`** (P-06) — 5 pages, prérendues + `generateStaticParams` + `dynamicParams: true`, invalidées par **tags `experiences`/`wineries` uniquement** (jamais `revalidatePath` sur le public) :
   - `/` (home), `/experiences` (catalogue — ne lit **plus** `searchParams` : filtres 100 % client, D2), `/experiences/[slug]`, `/wineries`, `/wineries/[slug]`.
   - `not-found` des fiches est un **client component** (un `getTranslations` serveur co-localisé démoterait la route ISR en dynamique).
2. **SSG pur ×3 locales** (via `generateStaticParams` du layout `[locale]`) : `about`, 2 landings SEO (`degustation-vin-valais`, `cepages-valaisans`), `legal/{terms,privacy,cancellation}`, `coming-soon`.
3. **Dynamique par requête** : tout `(auth)` (layout appelle `auth()`), tout `(protected)` et `admin` (`auth()` + rôle), et les pages transactionnelles pilotées par token/searchParams : checkout (trio hold), `/booking/[id]` (token), `confirmation` (`session_id`), `commande` (token + flag `TASTING_SHEET`), `reservation/erreur`, `unsubscribe`.

**Middleware** (`src/middleware.ts`) : gate Coming Soon hardcodé sur `encave.ch` (à retirer au lancement) → routing next-intl → check de présence du cookie better-auth sur `/dashboard|/onboarding|/admin` → redirect `/login?callbackUrl`. Le **rôle ADMIN** est appliqué dans `admin/layout.tsx` (`notFound()` si non-admin), plus dans le middleware (P-06/L-212). Pas de DB dans le middleware.

**Header découplé** (P-06/D1) : `Header` synchrone sans `auth()` ; la session vit dans des îlots client (`HeaderAuthSlot` → `dynamic(ssr:false)` après idle, skeleton sans flash ; `HeaderRoleLink` pour les liens rôle) → l'arbre serveur public reste statique.

## API

- **better-auth** : catch-all `/api/auth/[...all]`.
- **Webhooks signés + idempotents** : Stripe checkout + Stripe **connect** (claim via `StripeEvent`), Resend (svix → `EmailLog`).
- **8 routes cron** (`/api/cron/*`), toutes protégées par `CRON_SECRET` (`src/lib/cron-auth.ts`) et **toutes planifiées** dans `vercel.json` (16 entrées : `process-scheduled-jobs` ×8 slots + `tasting-sheet-reminder` ×2 fenêtres — contournement du plan Vercel Hobby). Nouveau job différé = nouveau type dans le `JOB_REGISTRY` de `process-scheduled-jobs`, jamais un cron par type.
- **5 utilitaires** : `health` (probe, inerte aujourd'hui — cible L-184/P-16), `newsletter` (rate-limité), `geocode` (proxy Nominatim), export nLPD (authentifié), relevé mensuel PDF (authentifié, P-13).
- `robots.ts` : disallow `/api/ /dashboard/ /admin/ /_next/` (les pages checkout sont `noIndex` par métadonnée). `sitemap.ts` : pages statiques + slugs publiés (DB) avec hreflang ×3 + x-default.

## Couche serveur (`src/server/`)

Quatre étages stricts : **Component → Action → Query/Service → DB**. Les composants n'importent `db`/`auth` que dans des Server Components de pages protégées ; les queries n'importent que `db` (+ `getStripe` pour payouts) ; les services n'appellent jamais d'actions. Deux façades re-exportent des sous-modules (`actions/availability.ts`, `actions/experience.ts`).

- `db.ts` : singleton `PrismaClient`. `stripe.ts` : singleton Stripe (API `2025-12-15.clover`) via `getStripe()`/`isStripeConfigured`. `auth.ts` : wrapper better-auth en `React.cache` qui **RE-THROW** le bailout `DYNAMIC_SERVER_USAGE` (piège ISR P-06). `better-auth.ts` : config sans flux email reset/vérification câblé (cf. P-14).
- **Trois familles de cache** : (1) `React.cache` seul pour les données tenant/dynamiques (booking, earnings, dashboard-today, occurrence, scan, wine, user…) ; (2) `cache(unstable_cache)` taggé pour le public (`experience.queries` tag `experiences`, `feature-flags` 60 s, `admin-metrics` 300 s) ; (3) `unstable_cache` seul (`winery.queries` tag `wineries`, `payouts` tag `payouts:{stripeAccountId}` 300 s, `cachedSearch` hoisté module-level 120 s).
- Invalidation **tags-only** via `invalidateExperienceCaches`/`invalidateWineryCaches`. Note : les `revalidateTag('occurrences:*')` sont un scaffolding forward-compat volontaire (cf. commentaire `occurrence.ts`) — `getBookableOccurrences` n'est pas caché, l'invalidation réelle passe par les helpers.

## Données

Prisma/PostgreSQL (Neon pooled `DATABASE_URL`, `DIRECT_URL` pour migrations, cuid()). **30 modèles / 11 enums** : socle V2 opérationnel (User, Winery, Experience, Booking, StripeEvent, EmailLog…) + fondations V3 P-02, dont certaines **non branchées côté produit** (voir §Dormant). Invariants d'argent en SQL (CHECK + triggers). Argent en **centimes** (CHF), dates **UTC** (Zurich via helpers).

## Feature flags

`FLAG_REGISTRY` (`src/lib/flags.ts`), 7 clés, tout **OFF** par défaut sauf `OCCURRENCE_CAPACITY` (sémantique inversée). Lecture cache 60 s (`feature-flags.queries.ts`), toggle admin (`FeatureFlagsPanel`). Tout ce qui touche l'argent doit être flag-gated et désactivable en < 1 min sans deploy.

## Emails

22 templates React Email, **un seul consommateur** : `src/server/services/email.service.ts` (24 fonctions `send*`). `sendEmail` : retry ×3 backoff, `from` = `noreply@encave.ch`, tags Resend → webhook svix. Les emails client utilisent `Booking.locale` (persisté au checkout). Les templates `PasswordResetEmail`/`EmailVerificationEmail` existent mais ne sont **pas câblés** (flux auth email → P-14).

## i18n

3 locales fr (défaut)/de/en, 37 namespaces strictement alignés (garde `scripts/check-translations.ts`). Subsets par surface (P-06/L-203) : layout racine = base légère, providers imbriqués par segment ; garde statique `tests/unit/i18n/client-namespaces.test.ts` + `onError` throw hors prod. `src/emails/translations.ts` porte ses propres blocs (certains anciens non accentués).

## Composants (`src/components/`)

`ui/` (19 primitives shadcn, intouchables, toutes consommées), `shared/` (providers du root layout + îlots perf `AfterIdle`/`LazyOnVisible`/`DesktopOnly`), `features/{domaine}/` (21 domaines, chacun rattaché à une route), `layout/` (header découplé ISR). `src/hooks/` : 3 hooks dont `useNavigateWithTransition` (remplaçant obligatoire de `router.push`). `src/lib/` utilisé réellement (`cn` 91 fichiers, `logger` 65, `seo/metadata` 32, `currency` 29, `i18n/formatters` 22…).

## Code dormant (conservé — futur documenté)

Gardé volontairement, **ne pas supprimer** :

- `business-rules/request-transitions.ts` — préparé pour P-09 (sur-mesure).
- Modèles `GiftCard`(+ledger), `Request`/`RequestOffer`, `EventParticipant` — fondations P-02 non encore branchées (P-09/P-10/P-11).
- `AUTH_RATE_LIMIT` / `REGISTRATION_RATE_LIMIT` — à câbler en L-155 (P-14).
- Templates/flux email auth (reset, vérification) — P-14.
- Cluster **blocage de dates** (`blockDate` est déjà utilisé par `DayDetailPanel` ; `unblockDate`/`toggleSlotActive` sont un complément non encore branché).
- `api/health` — probe d'alerting prévue L-184 (P-16), inerte aujourd'hui.
- `refundBookingManually` (admin), `requestAccountDeletion` (déjà câblé côté client) — besoins ops/nLPD.
- Table Prisma `VerificationToken` — legacy orpheline (0 réf code) ; **non supprimée** (règle migrations additives).

## Surfaces V3 encore à construire

Pas de route `/cadeaux`, `/sur-mesure`, `/compte`, `/encaveur/*` : gift cards (P-09), request/sur-mesure (P-10), anti no-show (P-08), événements collectifs (P-11), auth V3 (P-14), admin V3 (P-15), hardening/launch (P-16) restent au delivery plan.

## Dette connue

Voir `CLAUDE.md` §Known Debt (tenu à jour) : email de confirmation sans `bookingId`/`accessToken`, gate Coming Soon hardcodé, blocs non accentués de `translations.ts`, lien de désinscription tokenisé non branché dans 3 emails d'agrégat.
