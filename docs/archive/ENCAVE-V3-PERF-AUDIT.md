# Audit Performance & NFR — EnCave (branche `dev`)

> **Date** : 9 juillet 2026 · **Base** : `dev` @ `8368daf` · **Cible** : NFR du PRD V3 §8 (`docs/v3/ENCAVE-V3-PRD.md`)
> **Méthode** : 4 audits statiques parallèles (rendu/caching, bundle client, DB/Prisma, réseau/tiers/vitals) + **mesures réelles** : build de production, serveur `next start` local (Postgres 16 seedé), Lighthouse 12 (émulation mobile 4G throttlée + desktop).
> **Limite de méthode** : Lighthouse tourne sur localhost — la latence serveur (Neon, cold starts Vercel) n'est PAS incluse ; les scores sont donc **optimistes** côté TTFB. Le throttling client (réseau 4G + CPU ×4) est représentatif.

## 1. Mesures réelles

### Lighthouse (production build, seed réaliste)

| Page                      | Perf   | FCP   | LCP       | TBT    | CLS | Cible NFR              |
| ------------------------- | ------ | ----- | --------- | ------ | --- | ---------------------- |
| Home — mobile             | **48** | 2.0 s | **9.8 s** | 950 ms | 0   | Perf ≥ 95, LCP < 1.5 s |
| /experiences — mobile     | **56** | 1.4 s | **9.1 s** | 790 ms | 0   | idem                   |
| Fiche expérience — mobile | **71** | 1.2 s | 5.9 s     | 330 ms | 0   | idem                   |
| Home — desktop            | **73** | 0.4 s | 5.0 s     | 150 ms | 0   | idem                   |

A11y automatisée (subset Lighthouse) : 100 sur la home — mais voir §5 (l'automatique ne couvre pas focus/ARIA custom).

### Build de production

- **First Load JS partagé : 202 kB** (gzip) sur toutes les pages — cible saine < 130 kB.
- Routes lourdes : fiche expérience **393 kB**, checkout **359 kB**, catalogue **308 kB**. Middleware : **96.8 kB**.
- **Chunk de 439 kB (mapbox-gl)** téléchargé sur la home et le catalogue **mobile** — pour une carte desktop cachée en CSS. « Unused JavaScript » Lighthouse : ~435 KiB sur chaque page mobile.
- Poids total : home mobile **1.2 MB**, home desktop **6.4 MB** (dont hero brut 4 702 KB).
- HTML de la home : **208 kB** (dont ~90 kB de messages i18n sérialisés).

### Rendu réel (prerender-manifest + TTFB à chaud)

- **Seules 3 routes sont réellement prérendues** : `/coming-soon`, `/cepages-valaisans`, `/degustation-vin-valais` (+ locales). Home, catalogue, fiches, wineries = **rendu dynamique à chaque requête** (TTFB local 50-80 ms — en prod : + latence Neon + cold start).
- CLS = 0 partout : les conteneurs d'images réservent l'espace, la bannière consent est `fixed` — bon travail existant.

## 2. Scorecard NFR (PRD §8)

| Exigence                                          | État                                                                                                                            | Verdict       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| LCP < 1.5 s p75 mobile 4G (découverte)            | 9.1–9.8 s mesurés                                                                                                               | ❌ ×6         |
| Lighthouse ≥ 95                                   | 48–73                                                                                                                           | ❌            |
| TTFB < 200 ms edge                                | Pages dynamiques par requête, aucune route ISR/CDN sur le chemin découverte                                                     | ❌ structurel |
| API < 300 ms p95                                  | Recherche ILIKE sans index trigram, N+1 earnings, agrégats JS — risque à l'échelle                                              | ⚠️            |
| 99.9 % dispo                                      | Pas d'alerting, health check stub, fetch Nominatim sans timeout                                                                 | ❌            |
| Zéro survente (invariants)                        | Transaction Serializable ✅ mais **pas de retry P2034** ni k6                                                                   | ⚠️            |
| Webhooks idempotents + alerte lag > 5 min         | Checkout ✅, Connect ❌, alerte ❌                                                                                              | ⚠️            |
| WCAG 2.1 AA (booking, cadeaux)                    | Base saine (alt, Radix) mais pills sans `aria-pressed`, lightbox sans focus trap, contrastes gold/cream douteux, zéro outillage | ⚠️            |
| Mesure : Speed Insights ✅, Sentry tracing 0.2 ✅ | Lighthouse CI ❌, k6 ❌, web-vitals RUM attribué ❌                                                                             | ⚠️            |

## 3. Les 10 causes principales (quantifiées, par impact)

1. **Hero desktop = JPG brut de 4.8 MB en CSS `background-image`** (`HomeDesktopEditorial.tsx:106`) — contourne next/image (pas d'AVIF, pas de resize, pas de preload). Le desktop télécharge EN PLUS la version optimisée du hero mobile caché (422 kB + 67 kB) : les deux arbres éditoriaux (mobile + desktop) sont rendus dans le DOM et cachés en CSS (`page.tsx:67-74`), leurs `priority` préchargent des images invisibles.
2. **Mapbox GL (~439 kB) chargé sur mobile pour une carte invisible** : `display:none` ne démonte pas React — le `DynamicMap` du tree desktop monte et télécharge le chunk + tuiles sur mobile (home, catalogue). Aucun gate IntersectionObserver/interaction nulle part.
3. **Aucune page découverte n'est statique/ISR** : le `<Header>` async appelle `auth()` → `headers()` (`Header.tsx:12`), ce qui force le rendu dynamique de toutes les pages publiques ; `experiences/[slug]` ajoute un `force-dynamic` inutile (`:35`) ; **zéro `export const revalidate` dans tout le repo** ; pas de `generateStaticParams` sur les fiches (les slugs cachés existent déjà pour le sitemap).
4. **~90 kB de messages i18n sérialisés dans chaque page** : `NextIntlClientProvider messages={getMessages()}` (layout) embarque les 35 namespaces (admin, dashboard, scan…) dans le HTML de chaque page publique.
5. **posthog-js importé statiquement dans le bundle partagé** (`PostHogProvider.tsx:4`) : le code (~60 kB gz) part chez 100 % des visiteurs, consentement ou pas ; **Sentry Session Replay** toujours embarqué (~50-60 kB gz, 10 % de sessions enregistrées).
6. **Galerie de la fiche en `unoptimized`** (`ExperienceDetailGallery.tsx:130-140` et suivants) : le hero LCP de la fiche télécharge l'original plein format sans AVIF/resize.
7. **Recherche `contains insensitive` sans index trigram** (title/description/nom/commune) = seq scan ; **`Booking.visitorEmail` non indexé** (my-bookings, historique client, export nLPD) ; composites manquants `[wineryId,status,date]` et `[status,date]` (crons).
8. **Transaction Serializable sans retry P2034** (`checkout.ts:162-214`) : sous concurrence, l'aborted txn devient une erreur utilisateur au lieu d'un retry — et les verrous de prédicat peuvent sérialiser des créneaux différents ; **pas de `connection_limit`** sur l'URL poolée (risque d'épuisement pgbouncer en fan-out serverless).
9. **N+1 et agrégats JS** : `getMonthlyEarnings` = 6 requêtes séquentielles ; earnings = ~9 scans complets par affichage ; digests cron = 2 requêtes × N caves ; `searchExperiences` sans `select` embarque `description @db.Text` dans chaque carte (RSC payload).
10. **Hygiène réseau** : zéro `preconnect`/`dns-prefetch` ; fetch Nominatim sans timeout ni `Cache-Control` (cache en mémoire par instance) ; polling checkout toutes les 60 s sans pause `visibilityState` ; 13 fichiers de police chargés partout (Fraunces 5 poids × 2 styles + Manrope 5 + Mono 3) ; double loader de navigation dont un listener `click` global capture-phase (`NavigationLoader`) ; fallback carte sans token bloqué par la CSP (`tile.openstreetmap.org` absent de `connect-src`).

## 4. Détail par domaine

### 4.1 Rendu & caching

- Couche requêtes **bien cachée** : 13 queries `unstable_cache` avec tags + `React.cache`, revalidate 120-3600 s ; Suspense/streaming sur les listes et les expériences similaires ✅.
- Mais le rendu de page reste par requête (§3.3) — le cache requête borne la DB, pas le TTFB.
- Home : **aucun streaming** — bloque sur `searchExperiences` avant le premier octet.
- `revalidatePath` sur-large dans `winery-helpers.ts:16-36`/`experience-helpers.ts` : home + listes × 4 locales évincées à chaque mutation — thrash garanti dès qu'on activera l'ISR ; les tags suffisent.
- Middleware : léger sur les chemins publics ✅ ; sur `/admin/*`, `getSessionRole()` fait un fetch Edge→Node vers `/api/auth/get-session` **puis** le layout refait `auth()` + `isCurrentUserSuspended()` (3 résolutions de session par navigation admin).
- `searchExperiences` reconstruit son wrapper `unstable_cache` à chaque appel (anti-pattern documenté, `experience.queries.ts:140`).

### 4.2 Bundle client

- **Bien fait** : recharts et html5-qrcode correctement lazy (dashboard uniquement) ; @react-pdf server-only ; lucide-react en imports nommés ; Analytics/SpeedInsights différés ; template.tsx neutre ; tailwind propre.
- **À corriger** : posthog-js statique (§3.5) ; mapbox monté eagerly sur 4+ pages publiques (§3.2) ; framer-motion (~45 kB) pour 2 animations CSS-ables (progress bar + checkmark onboarding) ; `ImageWithFallback` en `'use client'` autour de quasi toutes les images (hydratation inutile des grilles) ; hero du catalogue en JPG 512 kB (v2 de 154 kB inutilisée) ; hero de la liste wineries servi depuis **Unsplash** en prod (latence non maîtrisée).
- Fonts : `display:swap` ✅ mais 13 fichiers ; supprimer l'italique Fraunces et 1-2 graisses par famille.

### 4.3 Base de données

- **Bien fait** : capacité `[experienceId,date,timeSlot,status]` indexée ✅ ; `accessTokenHash` indexé ✅ ; Stripe hors transaction ✅ ; sitemap sur queries cachées `select {slug}` ✅ ; expire-pending borné `take:100` ✅ ; pas de $queryRaw runtime.
- **À corriger** (voir §3.7-9) + listes non bornées (`getWineryBookings`, `getTransactions`, historiques client — pas de `take`) ; géocodage Nominatim **synchrone dans l'action** de création/édition de cave (jusqu'à 2 appels séquentiels, politique 1 req/s) ; singleton Prisma non mémoïsé en prod (OK par design serverless, mais sans `connection_limit`).

### 4.4 Réseau, tiers & disponibilité

- Emails : retry backoff ✅ ; Stripe checkout timeout 10 s ✅ ; crons `maxDuration 60` ✅ mais envois **séquentiels** (N × backoff jusqu'à 7 s = risque de troncature du digest).
- `/api/geocode/search` : pas d'`AbortSignal.timeout`, pas de `Cache-Control`, cache par instance → SPOF si Nominatim dégrade.
- `HealthStatus.tsx` : composant mort qui pollerait /api/health toutes les 30 s s'il était monté — à supprimer.
- images config : pas de `minimumCacheTTL` (défaut 60 s → réoptimisation fréquente des images distantes), `deviceSizes` par défaut.

### 4.5 Accessibilité (WCAG AA — NFR)

Base saine (alt obligatoires, icônes `aria-hidden`, Radix pour les sheets). Systémique à corriger : lightbox maison sans focus trap/restore (`ExperienceDetailGallery.tsx:205`) ; état sélectionné des pills/chips par couleur seule sans `aria-pressed` (tri, créneaux) ; stepper personnes sans `aria-live` ; contrastes gold-400/500 sur cream et labels 10-11 px à vérifier ; aucun outillage (pas de jsx-a11y complet, pas d'axe, pas de gate CI).

## 5. Trajectoire de correction (→ backlog E15, `docs/ENCAVE-V3-LAUNCH-BACKLOG.md`)

**Ordre de gain estimé (mobile, page découverte)** : hero + double éditorial (§3.1) et Mapbox mobile (§3.2) ≈ −70 % du poids ; ISR + header découplé (§3.3) ≈ TTFB CDN ; i18n subset (§3.4) ≈ −80 kB HTML ; posthog/Replay lazy (§3.5) ≈ −110 kB JS. Ces cinq chantiers, à eux seuls, ramènent la home mobile dans la zone 90+ ; le reste (index DB, retry P2034, timeouts, a11y) sécurise l'API p95, le zéro-survente et la conformité.

Chaque finding est repris comme item `L-200`→`L-217` dans le backlog launch (epic **E15 — Performance & Web Vitals**), avec placement calendrier : quick wins en S1-S2, chantiers structurels (ISR/header, i18n, Mapbox) en S5-S6, le solde en S16 (D1) avec les budgets Lighthouse CI (L-182) comme gate de non-régression.
