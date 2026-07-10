# P-06 — Performance structurelle (ISR, header découplé, i18n subset, index DB, invalidation tags-only)

> **Statut** : 🟨 en cours · branche `claude/p-06-performance` · baseline mesurée avant tout commit de code (§Baseline)

## Contexte

NFR PRD V3 : Lighthouse ≥ 95 mobile, LCP ≤ 1.5 s. Mesuré (audit `docs/ENCAVE-V3-PERF-AUDIT.md`) : home mobile 48 → **84 après les quick wins P-01** (hero next/image, PostHog lazy, framer-motion supprimé, maplibre gated `DesktopOnly` sur home+catalogue). P-06 = le structurel restant : **aucune page découverte n'est statique** (seul forceur commun : `Header→auth()→headers()`, + `force-dynamic` sur la fiche, + `searchParams` lu au niveau page sur catalogue/wineries), ~116 kB de messages i18n sérialisés dans chaque HTML, recherche `ILIKE %…%` sans index, invalidation par `revalidatePath` ×4 locales (thrash garanti dès l'ISR). Package **piloté par la mesure** : chaque opti a son avant/après (Lighthouse local + preview Vercel, EXPLAIN db-gated) — une opti sans mesure ne compte pas dans la DoD.

**Périmètre** : L-201 (reliquat maplibre fiches), L-202 (ISR + header), L-203 (i18n subset), L-207 (index DB), L-212 (invalidation/middleware) + dette P-05 (tri « prochaine dispo » non borné, préfiltre date, **agrégat capacité restante** — créneaux complets exclus, index occurrences à vérifier) + morceau de L-208 strictement nécessaire au payload (select ciblé `searchExperiences`). OUT : L-208 earnings/take, L-210, L-211, L-213 (Should → S16), a11y L-214.

## Baseline (mesurée AVANT tout commit — 2026-07-10, build prod local `next start`, Postgres 15 Docker seedé 40 exp/10 caves, Lighthouse 12.8.2 mobile, médiane de 3 runs, machine Sam)

| Page | Perf | FCP | LCP | TBT | HTML |
|---|---|---|---|---|---|
| Home `/fr` | **79** | 1.4 s | 5.7 s | 9 ms | **297 kB** (de 296, en 285) |
| Catalogue `/fr/experiences` | **76** | 2.3 s | 6.0 s | 20 ms | 570 kB |
| Fiche expérience | **74** | 1.4 s | 9.5 s | 46 ms | — |
| Liste caves `/fr/wineries` | **79** | 2.1 s | 5.2 s | 10 ms | — |
| Fiche cave | **72** | 2.7 s | 6.8 s | 76 ms | — |

Prerender-manifest baseline : seuls les 2 articles SEO (+ coming-soon) — **aucune page découverte statique**. Gates DoD : home ≥ 85, catalogue ≥ 85, HTML home < 120 kB (écart : −177 kB à trouver, l'i18n subset en porte ~110-120). Note : la baseline diffère des chiffres de l'audit du 09.07 (machine/seed/évolution du code depuis P-05/P-07/P-13) — c'est CETTE baseline, même machine même méthode, qui sert de référence avant/après.

## Décisions produit (Sam, 2026-07-10)

- **D1 — Header ISR accepté** : îlot client `useSession`, skeleton neutre pendant `isPending` (jamais de flash « Se connecter »), liens rôle-conditionnels dans un second îlot. ~150-400 ms de skeleton pour les utilisateurs loggés.
- **D2 — Catalogue statique par défaut** : `/experiences` (et `/wineries`) ne lisent plus `searchParams` ; vue par défaut en CDN, filtres 100 % client via server action de lecture (façade Zod sur `searchExperiences`, qui reste `unstable_cache`). Deep-links filtrés : défauts ~0.5-1 s puis résultats filtrés. Vues filtrées non SSR (jamais été cible SEO).
- **D3 — Créneaux complets exclus** de la recherche par date (capacité restante calculée dans le préfiltre — plus de « complet » découvert sur la fiche).
- (Technique, assumé sans arbitrage : `/admin` pour un non-admin loggé → `notFound()` dans le layout pour préserver le 404 actuel après retrait du fetch middleware.)

## Architecture (décisions techniques clés)

- **A1 — Header découplé** : `Header.tsx` devient server component synchrone (sans `auth()`). Nouveau `HeaderAuthSlot.tsx` ('use client') : `useSession()` de `src/lib/auth-client.ts:10` — skeleton pills pendant `isPending`, puis `UserMenu` ou boutons login. `HeaderRoleLink` (client) pour les liens admin/dashboard/my-bookings (null pendant pending, pop-in fin de nav = zéro CLS). `MobileNav` consomme `useSession()` en interne (nanostore partagé → 1 seul GET get-session par chargement). Attention : le `catch` DYNAMIC_SERVER_USAGE de `auth()` ne suffit PAS — `headers()` marque le rendu dynamique avant de throw.
- **A2 — ISR pages** : fiche expérience : retirer `force-dynamic` (`experiences/[slug]/page.tsx:38`), + `revalidate = 300`, `dynamicParams = true`, `generateStaticParams` depuis `getAllPublishedExperienceSlugs()` (déjà caché). Fiche cave : idem via `getPubliclyVisibleWinerySlugs()`. Home : `revalidate = 300` (filet). `getBookableOccurrences` (non caché volontairement) fige les hints de jours ≤300 s — assumé, `/book` + checkout restent la vérité capacité. Consent 100 % client ✓, locale detection au middleware avant cache ✓, grep de contrôle `cookies()/headers()` sur l'arbre public.
- **A3 — Catalogue/wineries statiques (D2)** : pages sans `searchParams` ; `ExperiencesPageClient` (nuqs `shallow: true`) appelle `searchExperiencesAction` (nouveau `src/server/actions/experience-search.ts`, lecture seule, safeParse) au mount si l'URL porte des filtres et à chaque changement, `useTransition` + skeleton grid. `/wineries` : filtre commune côté client (liste déjà complète en mémoire, sinon même patron).
- **A4 — i18n subset deux étages** (requis par le gate HTML < 120 kB) : `src/lib/i18n/client-messages.ts` (pick maison typé). Layout racine = base ~13 kB (nav, common, locale, errors, footer, search, auth, legal.cookies). Providers **imbriqués** (remplacent le contexte, toujours fournir BASE+EXTRA) : `(public)/experiences/layout.tsx` (+experience, gallery, booking, cancellation, wineries), checkout (+checkout, stripe, bookingError), `(public)/wineries/layout.tsx` (+winery, wineries, experience), `(public)/booking/layout.tsx` (+confirmation, booking, wineOrder), `(protected)` et `admin` = `getMessages()` complet. `getTranslations` serveur lit toujours le fichier complet → MISSING_MESSAGE n'est possible qu'en client. **Gardes ×3** : test unitaire statique (grep `useTranslations('…')` par groupe de routes ⊆ provider), `onError` throw hors production dans `src/i18n/request.ts`, listener console Playwright. Nettoyage : namespace orphelin `healthStatus` ×3.
- **A5 — Index DB (migration additive, `postgresqlExtensions` + `extensions = [pg_trgm]`)** : GIN trigram sur `experiences.title/description`, `wineries.name/commune`, **`bookings.visitorEmail`** (choix trigram : Prisma `equals+insensitive` émet ILIKE, qu'un index `lower()` ne sert PAS ; zéro changement des écritures) ; composites Booking `[wineryId,status,date]` + `[status,date]`. Occurrence `[date,status]` existe déjà (vérifié) — couvert par les tests EXPLAIN. `migrate dev --create-only` + relecture du SQL (socle §3) ; Neon (prod+previews) et Docker `postgres:16` supportent pg_trgm ; la preview feature fait entrer l'extension dans `db push` (dev Docker) aussi.
- **A6 — Refonte `searchExperiences`** (`experience.queries.ts:160-467`) : (a) hoist du wrapper `unstable_cache` au niveau module, params en argument (fin de l'anti-pattern reconstruction/appel) ; (b) helper commun « prochaine occurrence réservable » multi-expériences — occurrences OPEN fenêtre (index `[date,status]`) + blockedDates + `booking.groupBy` sièges (réutilise **verbatim** `activeCapacityBookingWhere`/`resolveOccurrenceCapacity` de `src/lib/business-rules/capacity.ts`) + maxCapacity → map `experienceId → première occurrence réservable` ; (c) préfiltre date = ids avec ≥1 occurrence **réservable** (D3) ; (d) tri `next_availability` : helper (b) sur [aujourd'hui, +3 mois] → tri des ids en JS → slice sur les **ids** → fetch de la page seule (plus jamais toutes les lignes) ; (e) `select` ciblé remplaçant l'`include` : couper `description @db.Text`/address/etc. du payload RSC, **garder** `winery.latitude/longitude` (carte desktop catalogue) ; JSON-LD ItemList perd `description` (optionnel schema.org). DTO dédié dans `src/types/`.
- **A7 — Invalidation tags-only** : `winery-helpers.ts` → `revalidateTag('wineries') + revalidateTag('experiences')` seuls ; `experience-helpers.ts` → `revalidateTag('experiences')` seul (asymétrie /en disparaît). Les 2 tags couvrent 100 % des pages publiques (mapping vérifié ; fiche cave consomme les deux). **Hypothèse porteuse** : en Next 14.2, les tags `unstable_cache` consommés au rendu sont persistés avec l'entrée du Full Route Cache → `revalidateTag` purge aussi la page ISR. **Vérification bloquante avant merge** (build+start local : mutation titre → curl reflète ; flip flag `BOOKING_FEE` → fiche ISR purgée, règle kill-switch <1 min). **Fallback prêt** si échec : `revalidatePath('/[locale]/experiences/[slug]', 'page')` (forme route dynamique, 3 appels, pas d'énumération ×4). CLAUDE.md §Caching mis à jour.
- **A8 — Middleware + auth dédup** : retrait de `getSessionRole` (fetch Edge→Node, `middleware.ts:45-70,146`) — le check cookie reste, `admin/layout.tsx` reste le gate (avec `notFound()` pour le 404) ; `auth()` wrappé `React.cache` (3→1 résolutions session par navigation admin).
- **A9 — Maplibre reliquat (L-201)** : wrapper `LazyOnVisible` (IntersectionObserver, patron `DesktopOnly`) autour de `DynamicMap` dans `LocationSection.tsx:58` (fiche expérience) et `WineryLocationMap.tsx:35` (fiche cave) — les 2 seules fuites mobiles restantes.

## Fichiers principaux

Modifiés : `src/components/layout/Header.tsx`, `MobileNav.tsx` ; `src/app/[locale]/layout.tsx` ; `src/app/[locale]/page.tsx` ; `(public)/experiences/page.tsx` + `[slug]/page.tsx` + `ExperiencesPageClient.tsx` ; `(public)/wineries/page.tsx` + `[slug]/page.tsx` ; `src/server/queries/experience.queries.ts` ; `src/server/actions/winery-helpers.ts`, `experience-helpers.ts` ; `src/middleware.ts` ; `src/server/auth.ts` ; `src/i18n/request.ts` ; `LocationSection.tsx`, `WineryLocationMap.tsx` ; `prisma/schema.prisma` ; `CLAUDE.md` §Caching ; messages ×3 (retrait healthStatus).
Créés : `HeaderAuthSlot.tsx`, `HeaderRoleLink.tsx`, `src/lib/i18n/client-messages.ts`, layouts de segments i18n ((public)/experiences, /wineries, /booking, checkout), `src/server/actions/experience-search.ts`, `src/components/shared/LazyOnVisible.tsx`, migration `p06_search_indexes`, `tests/db/query-plans.test.ts`, `tests/unit/i18n/client-namespaces.test.ts`, `tests/e2e/perf-budget.spec.ts`, `docs/plans/P-06-performance.md`.

## Mesures (protocole — chaque opti a son avant/après, consigné au plan doc)

1. **Lighthouse local** (référence DoD) : build prod + `next start` (Docker DB seedée), `npx lighthouse … --form-factor=mobile`, 3 runs médiane, sur `/fr`, `/fr/experiences`, fiche, `/fr/wineries`, fiche cave. Gates : home ≥85 ET catalogue ≥85. Baseline AVANT le premier commit.
2. **Prerender-manifest** : home + catalogue + wineries + fiches présents après build (`.next/prerender-manifest.json` + marqueurs ● du build).
3. **HTML home** : `curl -so /dev/null -w '%{size_download}'` < 120 000 (×3 locales).
4. **Maplibre mobile** : `perf-budget.spec.ts` viewport 375 — aucun chunk contenant la signature maplibre sur home/catalogue/fiches ; contre-test desktop : la carte charge après scroll.
5. **EXPLAIN db-gated** (`query-plans.test.ts`, Postgres local + `INVARIANTS_DATABASE_URL`, base montée par `migrate deploy`, `ANALYZE` + `SET enable_seqscan=off` contre les faux négatifs petite table) : trigram sur recherche title/description/name/commune, trgm sur `visitorEmail` (forme my-bookings), composite `[wineryId,status,date]`, occurrences `[date,status]`. Assert : aucun Seq Scan + nom d'index attendu.
6. **Preview Vercel** : Lighthouse une passe sur le déploiement preview de la branche (indicatif, variance notée) + `x-vercel-cache: PRERENDER/HIT` sur `/fr` ; test de purge tag rejoué sur staging après merge.

## Ordre des commits (branche `claude/p-06-performance` depuis dev)

0. Étape 0 : `docs/plans/P-06-performance.md` (ce plan, niveau P-05) + §5 🟨 + **baseline Lighthouse/HTML mesurée et consignée**
1. auth React.cache + middleware sans fetch (+ `notFound()` admin layout)
2. Header découplé (îlots session/rôle, MobileNav)
3. i18n subset deux étages + gardes MISSING_MESSAGE + retrait healthStatus
4. Invalidation tags-only + ISR home & fiches (+ **vérification purge bloquante** ; CLAUDE.md)
5. Catalogue & wineries statiques par défaut (D2) + action de lecture
6. Maplibre LazyOnVisible (fiches)
7. Migration index pg_trgm/composites + tests EXPLAIN
8. searchExperiences : hoist cache, DTO select, next_availability borné, préfiltre capacité (D3) + tests
9. Mesures finales avant/après + perf-budget.spec + bilan
→ ④VERIFY (socle §3 : lint/format/i18n/tests/build, db-gated local, e2e) → ⑤ `/code-review high` + correctifs → ⑥ PR « P-06: Performance structurelle » vers dev, CI verte, merge autonome DoD verte → ⑦ §5 ✅ + PR#, CLAUDE.md (§Caching + Known Debt perf), bilan.

## Risques & rollback

- **Purge tag→Full Route Cache** (pari central) : vérif bloquante commit 4 ; fallback `revalidatePath(route dynamique, 'page')` prêt. `revalidate = 300` partout = filet.
- **MISSING_MESSAGE** : triple garde (test statique, onError dev/CI, console Playwright) ; seuls les client components sont exposés.
- **Flash header / CLS** : skeleton dimensionné, cluster droit en fin de flex (CLS≈0) ; hint-cookie optimiste en réserve (hors P-06).
- **Kill-switch flags <1 min** : test explicite flip `BOOKING_FEE` → purge fiche ISR (sinon fallback path sur l'action de flip uniquement).
- **pg_trgm** : additif ; Neon previews + Docker OK ; relecture du SQL généré.
- **Deep-links filtrés (D2)** : flash défauts→filtrés assumé ; revert PR possible (aucune migration destructive).
- **Régression carte desktop catalogue** : DTO garde lat/lng + contre-test Playwright.

## DoD (gate — copiée du delivery plan §P-06)

- [ ] Home, catalogue et fiches présents dans `prerender-manifest` (ISR, revalidation par tags)
- [ ] Lighthouse mobile local : home ≥ 85, catalogue ≥ 85 ; HTML home < 120 kB
- [ ] Chunk maplibre absent du chargement initial mobile (network trace)
- [ ] `EXPLAIN` de la recherche et de my-bookings = index scan (trigram + visitorEmail)
- [ ] Une mutation cave n'évince plus la home ×4 locales (tags seuls)
- [ ] Dette P-05 : tri prochaine-dispo borné, créneaux complets exclus de la recherche par date (D3), index occurrences vérifiés à l'EXPLAIN
