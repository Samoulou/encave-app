# ENC-027 — Architecture technique : visibilité publique d'une cave

> Document d'architecture rédigé par Jonas, à partir de la spec produit `docs/specs/ENC-027.md` (Théo) et de l'état du code au commit `99dab3f` (branche `dev`).
>
> Branche d'implémentation : `samuel/enc-027-public-winery-visibility` (à créer depuis `dev`).

---

## 0. Constats préalables (à lire avant tout)

Avant de produire les contrats, j'ai audité le code existant pour caler le doc sur la réalité. Trois points qui décalent la spec produit du code :

1. **Routes : `/wineries` et `/experiences`, pas `/caves`.**
   La spec utilise le vocabulaire FR `/caves/{slug}/{experienceSlug}`. Mais les routes effectives sont :
   - `src/app/[locale]/(public)/wineries/page.tsx` (listing caves)
   - `src/app/[locale]/(public)/wineries/[slug]/page.tsx` (détail cave)
   - `src/app/[locale]/(public)/experiences/page.tsx` (listing expériences)
   - `src/app/[locale]/(public)/experiences/[slug]/page.tsx` (détail expérience — **flat, pas nesté sous la cave**)
   - `src/app/[locale]/page.tsx` (home avec featured)

   Pas de route imbriquée `/wineries/[slug]/[experienceSlug]/page.tsx`. La règle "404 sur la page expérience si la cave n'est pas visible" se traduit donc par "404 sur `/experiences/[slug]` si la cave parente n'est pas visible". Pas de migration de route.

2. **Pas de champ `chargesEnabled` ni de relation `StripeAccount` sur le modèle `Winery`.**
   Cf `prisma/schema.prisma` lignes 76-109. Les champs Stripe sur `Winery` sont :
   - `stripeAccountId String? @unique`
   - `stripeOnboardingComplete Boolean @default(false)`
   - `stripeDetailsSubmitted Boolean @default(false)`

   Le webhook `src/app/api/webhooks/stripe/connect/route.ts` (lignes 102-108) mappe `account.charges_enabled` directement sur `winery.stripeOnboardingComplete`. **C'est notre proxy KYC persistant.** Pas d'appel Stripe à la volée requis, pas de fail-closed réseau à prévoir.

   Décision : on lit `winery.stripeOnboardingComplete` dans ENC-027. ENC-032b renommera ce champ en `kycStatus === 'VERIFIED'` plus tard — refacto isolé qui ne touche que le critère 2 de la fonction.

3. **Helpers de cache existants :**
   - `invalidateExperienceCaches(winerySlug?, experienceSlug?)` existe dans `src/server/actions/experience-helpers.ts`. Utilise `revalidateTag('experiences')` + `revalidatePath` par locale.
   - **Pas d'équivalent `invalidateWineryCaches`.** À créer dans cette US.
   - Tags posés en queries : `'wineries'`, `'experiences'`. Granularité coarse (pas de tag par slug). On reste sur cette granularité — ENC-027 n'a pas vocation à introduire un changement de pattern de tags (sinon ADR séparée).

Aucune migration Prisma n'est nécessaire pour ENC-027. Tous les champs requis existent.

---

## 1. Fonction de calcul `isWineryPubliclyVisible`

### Emplacement

Nouveau dossier (n'existe pas encore) : `src/lib/business-rules/`
Fichier : `src/lib/business-rules/winery-visibility.ts`

### Types & signatures

Le type d'entrée minimum requis (DTO Prisma) doit contenir tout ce que les 6 critères évaluent. On l'expose comme un type `WineryVisibilityInput` :

```ts
import type { WineryStatus, ExperienceStatus } from '@prisma/client';

/**
 * Forme minimale d'une cave pour évaluer sa visibilité publique.
 * Toute query/action qui appelle isWineryPubliclyVisible doit fournir
 * EXACTEMENT cette forme dans son select Prisma (ni plus, ni moins).
 */
export type WineryVisibilityInput = {
  status: WineryStatus;
  stripeOnboardingComplete: boolean;
  description: string;
  latitude: number | null;
  longitude: number | null;
  galleryImages: Array<{ id: string }>;        // count >= 1 si non vide
  experiences: Array<{ status: ExperienceStatus }>; // pour le .some(PUBLISHED)
};

/**
 * Détail critère par critère — utilisé par le bandeau dashboard
 * et par les tests pour vérifier exactement quel critère manque.
 */
export type WineryVisibilityCriteria = {
  verified: boolean;     // status === 'VERIFIED'
  kyc: boolean;          // stripeOnboardingComplete === true
  hasPhotos: boolean;    // galleryImages.length >= 1
  hasDescription: boolean; // description non vide après strip + trim
  hasGeocoding: boolean; // latitude && longitude non null
  hasPublishedExperience: boolean; // experiences.some(PUBLISHED)
};

/**
 * Retourne true si TOUS les critères sont remplis.
 * Pas d'effet de bord, pas d'I/O, pure function.
 */
export function isWineryPubliclyVisible(winery: WineryVisibilityInput): boolean;

/**
 * Retourne le détail critère par critère.
 * Utilisé par le bandeau dashboard ENC-027 (UI encaveur).
 */
export function getWineryVisibilityCriteria(
  winery: WineryVisibilityInput
): WineryVisibilityCriteria;
```

### Décisions

- **Deux fonctions exportées, pas une.** `isWineryPubliclyVisible` est l'usage chaud (queries publiques, page détail) — boolean simple, optimisable. `getWineryVisibilityCriteria` est l'usage froid (bandeau dashboard) — retourne le détail. La première est implémentée en composant la seconde + un `Object.values(...).every(Boolean)`. Pas de duplication.
- **Strip tags + trim sur description :** on utilise une regex simple `description.replace(/<[^>]*>/g, '').trim().length >= 1`. Pas besoin d'une lib comme `sanitize-html` (overkill, surface de dépendance). Si la spec change un jour vers "≥ N caractères", la regex reste valide.
- **Pas de fail-closed réseau :** la spec produit (§ États UI) mentionne un cas "timeout Stripe → fail-closed". **Mais comme on lit le champ persistant `stripeOnboardingComplete`, il n'y a aucun appel réseau dans cette fonction.** Le risque n'existe pas ici — il existait dans la version "on tape Stripe à chaque check", qu'on a écartée. Je documente cette décision dans la fonction (JSDoc) pour que personne ne réintroduise un appel Stripe par mégarde.
- **Pure function, pas de `'use server'`, pas de cache.** C'est de la logique métier. Réutilisable côté serveur uniquement (jamais bundle client — elle reçoit en entrée des données DB).

---

## 2. Queries publiques à patcher

Toutes ces queries doivent restreindre leurs résultats aux caves visibles. Filtrage **majoritairement au niveau Prisma `where`**, post-filtre TS minimal et justifié.

### Inventaire des points d'exposition publique

| Query                                  | Fichier                                              | Ligne | Type             |
| -------------------------------------- | ---------------------------------------------------- | ----- | ---------------- |
| `getVerifiedWineries(commune?)`        | `src/server/queries/winery.queries.ts`               | 8     | Listing /wineries |
| `getWineryBySlug(slug)`                | `src/server/queries/winery.queries.ts`               | 34    | Page /wineries/[slug] |
| `getDistinctCommunes()`                | `src/server/queries/winery.queries.ts`               | 56    | Filtre listing   |
| `getFeaturedWineries(limit)`           | `src/server/queries/winery.queries.ts`               | 88    | Home / landings  |
| `getAllVerifiedWinerySlugs()`          | `src/server/queries/winery.queries.ts`               | 109   | Sitemap          |
| `searchExperiences(params)`            | `src/server/queries/experience.queries.ts`           | 133   | Listing /experiences |
| `getExperienceCommunes()`              | `src/server/queries/experience.queries.ts`           | 322   | Filtre listing   |
| `getExperiencePriceRange()`            | `src/server/queries/experience.queries.ts`           | 362   | Filtre listing   |
| `getExperienceBySlug(slug)`            | `src/server/queries/experience.queries.ts`           | 402   | Page /experiences/[slug] |
| `getRelatedExperiences(...)`           | `src/server/queries/experience.queries.ts`           | 467   | Bloc "voir aussi" |
| `getExperiencesByWineryId(wineryId)`   | `src/server/queries/experience.queries.ts`           | 536   | Page cave        |
| `getFeaturedExperiences(limit)`        | `src/server/queries/experience.queries.ts`           | 576   | Home             |
| `getAllPublishedExperienceSlugs()`     | `src/server/queries/experience.queries.ts`           | 610   | Sitemap          |

### Filtre Prisma à appliquer

On factorise dans un helper réutilisable dans le **même fichier** que la fonction de calcul (pour garder la source de vérité unique) :

```ts
// src/lib/business-rules/winery-visibility.ts

import type { Prisma } from '@prisma/client';

/**
 * Prédicat Prisma `where` qui filtre une cave en restreignant aux caves
 * publiquement visibles. À utiliser dans toute query publique qui retourne
 * des caves ou des entités liées à des caves.
 *
 * NOTE : ne filtre PAS sur la description vide (cf doc ci-dessous).
 */
export const publiclyVisibleWineryWhere: Prisma.WineryWhereInput = {
  status: 'VERIFIED',
  stripeOnboardingComplete: true,
  latitude: { not: null },
  longitude: { not: null },
  galleryImages: { some: {} },
  experiences: {
    some: { status: 'PUBLISHED' },
  },
};
```

### Description non vide : SQL ou TS ?

**Décision : filtrage SQL avec `description: { not: '' }` + post-filtre TS au niveau de chaque query qui retourne la cave**, parce que :

- Au niveau SQL Prisma : on peut détecter `description = ''` (chaîne vide stricte), mais on **ne peut pas** détecter `description = '   '` (whitespace), ni `description = '<p></p>'` (HTML vide), au niveau SQL sans CTE complexe — ce n'est pas raisonnable.
- Le check "strip tags + trim ≥ 1 char" est **applicatif**.
- En pratique : la grande majorité des caves "vides" auront `description = ''` (default form). Le SQL `not: ''` couvre 95% des cas. Le post-filtre TS couvre les 5% restants (whitespace, HTML vide).

Stratégie en deux temps :

1. **SQL `where`** : ajouter `description: { not: '' }` au `publiclyVisibleWineryWhere`.
2. **Post-filtre TS** : pour les queries qui retournent la cave en entier (listing, page détail), appliquer après le `findMany` un `.filter(w => isWineryPubliclyVisible(w))` qui re-checke aussi le strip-tags + trim. Coût négligeable (max ~50 caves au global MVP).

Pour les queries qui retournent juste un slug ou un count (sitemap, communes, price range), le filtre SQL seul suffit. Documenter dans la query laquelle des deux stratégies est appliquée.

### Patch query par query (résumé)

- **`getVerifiedWineries`** : remplacer le `where: { status: 'VERIFIED', ... }` par `where: { ...publiclyVisibleWineryWhere, ...(commune && { commune }) }`. Post-filtre TS pour description après. Renommer en `getPubliclyVisibleWineries` pour ne pas mentir sur ce que retourne la fonction.
- **`getWineryBySlug`** : passer de `findUnique` à `findFirst` (le `where` composite empêche le `findUnique`). Inclure `experiences: { where: { status: 'PUBLISHED' }, select: { status: true } }` + `galleryImages: { select: { id: true } }` pour pouvoir post-filtrer. Si la cave existe mais n'est pas visible → retourner `null`.
- **`getFeaturedWineries`** : idem `getVerifiedWineries`.
- **`getAllVerifiedWinerySlugs`** : SQL `where` seul (slugs only, pas besoin de post-filtre). Renommer en `getPubliclyVisibleWinerySlugs`.
- **`getDistinctCommunes`** : SQL `where` seul.
- **`searchExperiences`** : dans le `wineryWhere` interne (ligne 155-158), inliner `publiclyVisibleWineryWhere`. Le filtre `status: 'PUBLISHED'` côté `Experience` reste. **Question subtile** : `where.winery = publiclyVisibleWineryWhere` exige que la cave parente ait `experiences.some(PUBLISHED)` — c'est satisfait par construction puisqu'on filtre déjà les experiences à `PUBLISHED`. OK, pas de boucle vicieuse.
- **`getExperienceBySlug`** : remplacer `winery: { status: 'VERIFIED' }` par `winery: publiclyVisibleWineryWhere`. Si l'expérience est `PUBLISHED` mais que la cave parente n'est pas visible → retourne `null` → page 404.
- **`getRelatedExperiences`**, **`getExperiencesByWineryId`**, **`getFeaturedExperiences`**, **`getAllPublishedExperienceSlugs`**, **`getExperienceCommunes`**, **`getExperiencePriceRange`** : même pattern, remplacer `winery: { status: 'VERIFIED' }` par `winery: publiclyVisibleWineryWhere`.

---

## 3. Pages publiques — comportement 404

### Routes concernées

- `src/app/[locale]/(public)/wineries/[slug]/page.tsx` — appelle déjà `getWineryBySlug` → `notFound()` si `null`. **Aucun changement de logique nécessaire**, le 404 sera automatique dès que la query est patchée. Vérifier que les messages i18n `Public.winery.notFound.*` (spec) existent / sont à ajouter dans `messages/{fr,de,en}.json` (cf checklist Nora).
- `src/app/[locale]/(public)/experiences/[slug]/page.tsx` — appelle `getExperienceBySlug` → `notFound()` si `null`. Idem, automatique post-patch.
- **Pas de route `/wineries/[slug]/[experienceSlug]`** dans le code. La spec parle de `/caves/{slug}/{experienceSlug}` mais ça n'existe pas — l'expérience vit à `/experiences/[slug]`. Si à terme on ajoute cette route imbriquée, elle bénéficiera du même mécanisme (re-check sur la cave parente).

### Garantie de cohérence

Le 404 est obtenu **par le simple fait que la query renvoie `null`**. Pas de code dupliqué dans les pages. C'est volontaire : la logique de visibilité est centralisée dans `publiclyVisibleWineryWhere` + `isWineryPubliclyVisible`, et toutes les pages héritent du comportement gratuitement.

### `generateStaticParams` et `generateMetadata`

- `generateStaticParams` (page expérience, ligne 29-32) : appelle `getAllPublishedExperienceSlugs` → après patch, ne retournera que les slugs d'expériences dont la cave est visible. Le SSG ne pré-rendra plus les pages "fantôme".
- `generateMetadata` : déjà tolérant au `null` (retourne un title minimal). RAS.

---

## 4. Cache & invalidation

### Tags existants (à conserver)

- `'wineries'` — toutes les queries de `winery.queries.ts`
- `'experiences'` — toutes les queries de `experience.queries.ts`

### Helper à créer

`src/server/actions/winery-helpers.ts` (nouveau fichier) :

```ts
import { revalidateTag, revalidatePath } from 'next/cache';

/**
 * Invalide les caches winery + experiences (car la visibilité d'une cave
 * impacte aussi les listings d'expériences).
 */
export function invalidateWineryCaches(winerySlug?: string) {
  revalidateTag('wineries');
  revalidateTag('experiences'); // car la visibilité change l'éligibilité au listing

  revalidatePath('/wineries');
  revalidatePath('/fr/wineries');
  revalidatePath('/de/wineries');
  revalidatePath('/en/wineries');

  if (winerySlug) {
    revalidatePath(`/wineries/${winerySlug}`);
    revalidatePath(`/fr/wineries/${winerySlug}`);
    revalidatePath(`/de/wineries/${winerySlug}`);
    revalidatePath(`/en/wineries/${winerySlug}`);
  }

  // Home page (featured wineries / experiences peuvent contenir la cave)
  revalidatePath('/');
  revalidatePath('/fr');
  revalidatePath('/de');
  revalidatePath('/en');
}
```

### Actions / endpoints qui doivent appeler les invalidations

| Lieu                                                              | Appel à ajouter                                  | Pourquoi                                                                   |
| ----------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------- |
| `src/server/actions/winery.ts` — update profil cave (description, photos, adresse, géocodage) | `invalidateWineryCaches(winery.slug)`            | Peut faire basculer un critère                                            |
| `src/server/actions/experience-status.ts` — publication/dépublication d'une expérience | déjà `invalidateExperienceCaches(...)`, **ajouter** `invalidateWineryCaches(winery.slug)` | Critère 6 (≥ 1 expérience PUBLISHED) bascule                              |
| Actions admin (verify / suspend / reject)                          | `invalidateWineryCaches(winery.slug)`            | Critère 1 (status VERIFIED) bascule                                       |
| `src/app/api/webhooks/stripe/connect/route.ts` — `account.updated` | `invalidateWineryCaches(winery.slug)` après update | Critère 2 (KYC) bascule. Penser à faire un `select { slug: true }` dans le findUnique pour récupérer le slug. |
| Actions photos cave (add/delete WineryGalleryImage)                | `invalidateWineryCaches(winery.slug)`            | Critère 3 (≥ 1 photo) bascule                                             |

**Pour Nora** : ne pas remplacer `invalidateExperienceCaches` par `invalidateWineryCaches` — les deux coexistent et sont appelés tous les deux dans les actions d'expérience (publication notamment).

### Note sur `revalidatePath` vs `revalidateTag`

Le helper actuel `invalidateExperienceCaches` mélange les deux. CLAUDE.md dit "jamais les deux pour le même data". On hérite de cette tech debt — pas le scope ENC-027 de refactorer. Si on veut un jour passer en tags granulaires (`winery:{slug}`), c'est une ADR à part.

---

## 5. Schéma Prisma — vérification

Aucune migration nouvelle nécessaire pour ENC-027. Vérification des champs :

| Critère                                         | Champ Prisma                              | Existe ? |
| ----------------------------------------------- | ----------------------------------------- | -------- |
| 1. `status === VERIFIED`                        | `Winery.status: WineryStatus`             | Oui      |
| 2. `charges_enabled === true` (proxy KYC)       | `Winery.stripeOnboardingComplete: Boolean` | Oui (mappé depuis `charges_enabled` par le webhook) |
| 3. `photos.length >= 1`                         | `Winery.galleryImages: WineryGalleryImage[]` | Oui      |
| 4. `description` non vide                       | `Winery.description: String` (non null, défaut '') | Oui |
| 5. `latitude / longitude !== null`              | `Winery.latitude: Float?`, `Winery.longitude: Float?` | Oui |
| 6. `experiences.some(PUBLISHED)`                | `Winery.experiences: Experience[]` avec `status: ExperienceStatus` | Oui |

> **Note** : la spec parle de `winery.stripeAccount.charges_enabled`. Il n'y a pas de relation `StripeAccount` dans le schéma. Le proxy est `Winery.stripeOnboardingComplete`. ENC-032b renommera ce champ. Documenter clairement ce mapping dans la JSDoc de `isWineryPubliclyVisible`.

---

## 6. Tests à prévoir (briefing Nora + Hugo)

### Tests unitaires Vitest — `tests/unit/lib/business-rules/winery-visibility.test.ts`

**`isWineryPubliclyVisible`** (matrice de cas) :

- Happy path : tous critères ok → `true`
- Status PENDING / REJECTED / SUSPENDED individuellement → `false`
- `stripeOnboardingComplete = false` → `false`
- `galleryImages = []` → `false`
- `description = ''` → `false`
- `description = '   '` (whitespace) → `false`
- `description = '<p></p>'` (HTML vide) → `false`
- `description = '<p>x</p>'` (HTML avec contenu) → `true`
- `latitude = null` → `false`
- `longitude = null` → `false`
- `experiences = []` → `false`
- `experiences` tous en `DRAFT` ou `ARCHIVED` → `false`
- 2 critères manquants combinés → `false` + criteria détaille les deux

**`getWineryVisibilityCriteria`** : un test par critère individuellement, plus un test "0 critère validé" et "tous critères validés".

### Tests d'intégration queries — `tests/unit/server/queries/winery.queries.test.ts` + `experience.queries.test.ts`

- `getPubliclyVisibleWineries` ne renvoie pas une cave VERIFIED mais sans photo
- `getWineryBySlug` renvoie `null` pour une cave SUSPENDED, PENDING, sans KYC, sans description
- `searchExperiences` n'inclut pas d'expérience dont la cave est invisible
- `getExperienceBySlug` renvoie `null` pour une expérience PUBLISHED dont la cave est SUSPENDED

### Tests E2E Playwright — `tests/e2e/winery-visibility.spec.ts`

- Cave PENDING → `GET /fr/wineries/{slug}` répond 404 + titre i18n
- Cave SUSPENDED → 404
- Cave VERIFIED mais sans photo → 404 + n'apparaît pas dans le listing
- Cave complète → 200 + apparaît dans listing
- Expérience PUBLISHED d'une cave invisible → page expérience 404

### Tests dashboard encaveur (UI bandeau)

Hors scope strict ENC-027 (la spec mentionne le bandeau côté UI ; si Théo a sectionné le travail, c'est une US séparée pour Nora). Si dans scope :

- Composant `WineryVisibilityBanner` rendu avec un `WineryVisibilityCriteria` mock — un test par état (0, partiel, complet) avec snapshot des critères cochés/non-cochés.

---

## 7. ADR ?

**Décision : pas d'ADR séparée pour ENC-027.**

Justification :
- Aucune nouvelle dépendance lourde.
- Aucun changement de convention (on reste sur le pattern `unstable_cache` + tags coarse + `revalidateTag` mixé avec `revalidatePath`, comme le reste du code).
- Le choix "fonction dérivée non stockée" est documenté **dans la spec produit** elle-même (§ Règles métier > Recalcul). Pas besoin d'un ADR pour répéter ça.
- Le mapping `charges_enabled → stripeOnboardingComplete` est déjà acté par le webhook existant (pas une décision nouvelle).

Une ADR sera nécessaire **plus tard** pour :
- ENC-032b (renommage `stripeOnboardingComplete` → `kycStatus`) — typiquement ADR-0002.
- Éventuel passage des tags coarse (`'wineries'`) à des tags granulaires (`winery:{slug}`) — ADR séparée.

---

## 8. Risques / points d'attention

- **Cohérence du proxy KYC vs spec** : la spec parle de `winery.stripeAccount.charges_enabled`. Le code parle de `winery.stripeOnboardingComplete`. JSDoc explicite obligatoire pour ne pas perdre Nora ni l'humain qui fera ENC-032b.
- **Tags coarse `'wineries'`** : invalider `'wineries'` ré-évalue **toutes** les caches winery. C'est OK au volume MVP (≤ 100 caves) mais ne scale pas. Pas le scope d'ENC-027 de fix ça.
- **`searchExperiences` cache key** : utilise `JSON.stringify(params)` comme cache key. Le filtre `publiclyVisibleWineryWhere` est **constant**, donc n'impacte pas la clé. RAS.
- **Post-filtre TS sur description** : si une cave a 100% des critères SQL mais une description `'<p>   </p>'`, elle passe le `where` SQL mais sera filtrée en TS. Si on la compte dans `count()`, l'écart est sous-estimé. À documenter — au volume MVP, négligeable.
- **`generateStaticParams`** : si une cave devient invisible après build, les pages SSG persistent jusqu'à `revalidatePath`. C'est attendu — le helper `invalidateWineryCaches` couvre ça.

---

## Pour Nora — checklist d'implémentation ordonnée

1. **Créer le module business-rules** (n'existe pas encore)
   - [ ] Créer le dossier `src/lib/business-rules/`
   - [ ] Créer `src/lib/business-rules/winery-visibility.ts` avec :
     - Type `WineryVisibilityInput`
     - Type `WineryVisibilityCriteria`
     - Constante `publiclyVisibleWineryWhere: Prisma.WineryWhereInput`
     - Fonction `getWineryVisibilityCriteria(winery)`
     - Fonction `isWineryPubliclyVisible(winery)` (compose la précédente)
     - JSDoc explicite sur le mapping `stripeOnboardingComplete` = proxy `charges_enabled`

2. **Patcher les queries publiques**
   - [ ] `src/server/queries/winery.queries.ts` :
     - Renommer `getVerifiedWineries` → `getPubliclyVisibleWineries`
     - Renommer `getAllVerifiedWinerySlugs` → `getPubliclyVisibleWinerySlugs`
     - Inliner `publiclyVisibleWineryWhere` dans le `where`
     - Ajouter `description: { not: '' }` au where SQL
     - Ajouter post-filtre TS `isWineryPubliclyVisible` après `findMany`/`findFirst` pour les queries qui retournent l'entité complète
     - `getWineryBySlug` : passer `findUnique` → `findFirst`, inclure `experiences { where: PUBLISHED, select: status }` et `galleryImages { select: { id: true } }`
   - [ ] `src/server/queries/experience.queries.ts` : remplacer **partout** `winery: { status: 'VERIFIED' }` par `winery: publiclyVisibleWineryWhere`

3. **Adapter les usages (renommages)**
   - [ ] Grep `getVerifiedWineries` dans le repo (hors tests) → remplacer par `getPubliclyVisibleWineries`
   - [ ] Grep `getAllVerifiedWinerySlugs` → idem

4. **Créer le helper d'invalidation**
   - [ ] Créer `src/server/actions/winery-helpers.ts` avec `invalidateWineryCaches(winerySlug?)`

5. **Câbler les invalidations**
   - [ ] `src/server/actions/winery.ts` (update profil cave) : appeler `invalidateWineryCaches(slug)`
   - [ ] `src/server/actions/experience-status.ts` (publish/unpublish) : ajouter `invalidateWineryCaches(winerySlug)` **en plus** de `invalidateExperienceCaches`
   - [ ] Actions admin verify/suspend/reject : appeler `invalidateWineryCaches`
   - [ ] `src/app/api/webhooks/stripe/connect/route.ts` `account.updated` : récupérer le slug dans le findUnique, appeler `invalidateWineryCaches(slug)` après update
   - [ ] Actions photo cave (add/delete WineryGalleryImage) : appeler `invalidateWineryCaches`

6. **Pages publiques — vérifier le 404**
   - [ ] `src/app/[locale]/(public)/wineries/[slug]/page.tsx` : aucun changement de code, mais vérifier que `notFound()` est bien atteint en cas de cave invisible (test E2E)
   - [ ] `src/app/[locale]/(public)/experiences/[slug]/page.tsx` : idem

7. **Ajouter les clés i18n**
   - [ ] `messages/fr.json` + `messages/de.json` + `messages/en.json` : ajouter les clés `Public.winery.notFound.{title,body,cta}` et `Dashboard.visibility.*` (cf table copy FR de la spec produit)
   - [ ] `npm run i18n:check` doit passer

8. **Tests**
   - [ ] `tests/unit/lib/business-rules/winery-visibility.test.ts` — matrice complète (cf § 6)
   - [ ] Tests des queries patchées (au moins `getPubliclyVisibleWineries`, `getWineryBySlug`, `getExperienceBySlug`)
   - [ ] `tests/e2e/winery-visibility.spec.ts` — scénarios 404 + listing

9. **Bandeau dashboard encaveur** (si dans scope ENC-027 — sinon US séparée)
   - [ ] Créer `src/components/features/dashboard/WineryVisibilityBanner.tsx` qui prend `criteria: WineryVisibilityCriteria` en props
   - [ ] Câbler dans `src/app/[locale]/(protected)/dashboard/page.tsx` via un appel à `getWineryVisibilityCriteria(winery)` côté serveur

10. **Hygiène**
    - [ ] `npm run lint` passe
    - [ ] `npm run format:check` passe
    - [ ] `npm run i18n:check` passe
    - [ ] PR titre : `ENC-027: Public winery visibility logic`
    - [ ] PR description : `Fixes ENC-027`
    - [ ] PR cible `dev`
