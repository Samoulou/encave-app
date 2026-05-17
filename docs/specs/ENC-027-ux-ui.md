# ENC-027 — Design UX/UI : Logique de visibilité publique d'une cave

> **Auteur** : Léa
> **Source produit** : `docs/specs/ENC-027.md` (Sam, 2026-05-13)
> **Stack** : Next.js 14 App Router, Tailwind v3, shadcn/ui, next-intl (fr/de/en)
> **Statut** : Spec design, prête pour implémentation par Nora

---

## 0. Notes d'alignement avec l'existant

Avant d'attaquer, deux observations sur la base de code à confirmer avec Margot :

1. **Route publique cave** : alignement acté (décision Sam 2026-05-13) sur la route **existante** `/wineries/[slug]` (cf. `src/app/[locale]/(public)/wineries/[slug]/page.tsx`). Terminologie métier "cave" conservée en FR, routes en anglais. Spec produit corrigée.
2. **Page "dashboard home"** : `src/app/[locale]/(protected)/dashboard/page.tsx` redirige immédiatement vers `/dashboard/bookings` (WINEMAKER) ou `/dashboard/my-bookings` (CLIENT). Il n'y a pas d'écran "accueil dashboard" canonique. **Le bandeau visibilité doit donc s'afficher sur `/dashboard/bookings`** — premier écran que l'encaveur voit après login. Justification : c'est aussi l'écran où il vient quotidiennement et où l'absence de réservations corrèle directement avec "cave invisible".
3. **Banner Stripe existant** (`StripeWarningBanner.tsx`) : pattern visuel à réutiliser comme référence — bordure ambre, icône `AlertTriangle`, CTA secondaire. On élève le concept pour couvrir les 6 critères, pas seulement KYC.

---

## 1. Bandeau dashboard "Votre cave n'est pas encore visible"

### Emplacement précis

- Route : `/[locale]/dashboard/bookings` (page d'atterrissage encaveur)
- Position dans l'arbre : **première section** du contenu, **avant** `<BookingsPageHeader />` dans `src/app/[locale]/(protected)/dashboard/bookings/page.tsx`. Pourquoi avant le header : c'est un état de cave (méta) qui contextualise tout le reste. L'encaveur doit le voir en premier coup d'œil sans scroller.
- Si la cave est complète + VERIFIED, le bandeau bascule en mode "succès vert" mais reste dans le flux — il devient une **confirmation positive**, pas une bannière qui disparaît. (Décision UX : la disparition est trompeuse — l'encaveur se demande "ai-je raté quelque chose ?". Le badge vert rassure.)

### Architecture composant

```
<VisibilityBanner wineryId={winery.id} />
  ├─ (Server Component) fetch isWineryPubliclyVisible(winery) + détail critères
  ├─ Branche selon état : Loading | Partial | Complete | Error
  └─ Render Card shadcn/ui avec variant correspondant
```

Suspense côté page : `<Suspense fallback={<VisibilityBannerSkeleton />}>`. Pas besoin d'un client wrapper — la donnée vient de la DB, statique au moment du rendu.

### États

#### 1.1 Loading (skeleton)

```
┌──────────────────────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓ (titre, w-2/3)                                │
│ ▓▓▓▓▓▓ (sous-titre, w-1/2)                               │
│                                                          │
│ ☐ ▓▓▓▓▓▓▓▓▓                                              │
│ ☐ ▓▓▓▓▓▓▓                                                │
│ ☐ ▓▓▓▓▓▓▓▓▓▓▓                                            │
│ ☐ ▓▓▓▓▓▓▓                                                │
│                                                          │
│ [▓▓▓▓▓ CTA ▓▓▓▓▓]                                        │
└──────────────────────────────────────────────────────────┘
```

- Hauteur fixe ≈ `min-h-[280px]` mobile pour éviter le layout shift.
- Utilise `<Skeleton />` de `src/components/shared/Skeleton.tsx`.
- Aria : `<SkeletonContainer label="Chargement du statut de visibilité..." />`.

#### 1.2 Partiel (orange/ambre) — 1+ critère manquant

```
┌──────────────────────────────────────────────────────────┐
│ ⚠  Votre cave n'est pas encore visible publiquement      │
│    Complétez les éléments ci-dessous pour apparaître     │
│    sur encave.ch.                                        │
│                                                          │
│ ⏳ Validation par l'équipe EnCave (en cours)             │
│ ☐  Finaliser les informations bancaires (Stripe)         │
│ ☐  Renseigner l'adresse exacte de votre cave             │
│ ☐  Rédiger une description de votre cave                 │
│ ✓  Photos                                       Fait    │
│ ☐  Publier au moins une expérience                       │
│                                                          │
│ [  Compléter mon profil  →  ]                            │
└──────────────────────────────────────────────────────────┘
```

- **Container** : `Card` shadcn avec override `border-amber-200 bg-amber-50/50` (alignement avec `StripeWarningBanner`). Override du hover translate de la Card par défaut → on retire `hover:-translate-y-1 hover:shadow-card-hover` (carte informative, pas interactive).
- **Icône titre** : `AlertCircle` (lucide-react) `h-5 w-5 text-amber-600`, `aria-hidden="true"`.
- **Titre** : `font-display text-lg sm:text-xl font-semibold text-amber-900`.
- **Sous-titre** : `mt-1 text-sm text-amber-800`.
- **Liste critères** : `<ul role="list">` avec `space-y-2.5 mt-5`. Chaque item est un `<li>` contenant :
  - Icône d'état (`Check` vert pour validé, `Circle` ambre pour à faire, `Clock` ambre pour "en cours" sur VERIFIED).
  - Label texte du critère (toujours lisible, **jamais juste l'icône** — a11y).
  - Tag invisible aux voyants mais lu par les SR : `<span className="sr-only">Critère validé :</span>` ou `Critère à compléter :`.
  - Mention textuelle "Fait" alignée à droite (`ml-auto text-xs font-medium text-emerald-700`) **uniquement** pour les critères validés. Pour les non validés, pas de mention "À faire" (redondant avec l'icône).
- **CTA** : `<Button asChild size="lg" className="mt-6 min-h-[44px] w-full sm:w-auto">` (full-width mobile pour zone tactile, auto en desktop). Variant `default` (burgundy primaire). Icône `ArrowRight` à droite.
- **Padding** : `p-5 sm:p-6` (généreux mais pas excessif).

#### 1.3 Complet (vert) — tous les critères OK

```
┌──────────────────────────────────────────────────────────┐
│ ✓  Votre cave est en ligne                               │
│    Les clients peuvent la trouver et réserver vos        │
│    expériences.                                          │
│                                                          │
│ [  Voir ma page publique  ↗ ]                            │
└──────────────────────────────────────────────────────────┘
```

- **Container** : `Card` avec `border-emerald-200 bg-emerald-50/50`.
- **Icône titre** : `CheckCircle2` (lucide) `h-5 w-5 text-emerald-600`.
- **Titre** : `font-display text-lg sm:text-xl font-semibold text-emerald-900`.
- **Sous-titre** : `mt-1 text-sm text-emerald-800`.
- **Pas de liste de critères** — l'écran reste léger, déclaratif.
- **CTA** : lien `<Link href={`/wineries/${winery.slug}`} target="_blank" rel="noopener noreferrer">` rendu via `<Button asChild variant="secondary" size="default">` avec icône `ExternalLink`. Variant secondaire car pas d'action urgente.
- Note : ce bloc peut être condensé après 7 jours (cf. "Hors-périmètre" — pas dans cette US, juste à noter pour ENC-XXX).

#### 1.4 Erreur (fail-closed)

Quand `isWineryPubliclyVisible()` throw (ex. timeout Stripe), la spec produit dit **fail-closed** : on considère le critère KYC non rempli et on logge. Côté UI :

```
┌──────────────────────────────────────────────────────────┐
│ ⚠  Impossible de vérifier le statut de votre cave         │
│    Veuillez réessayer dans un instant.                   │
│                                                          │
│ [  Réessayer  ↻ ]                                        │
└──────────────────────────────────────────────────────────┘
```

- **Container** : `Card` avec `border-red-200 bg-red-50/40`.
- **Icône** : `AlertTriangle` `text-red-600`.
- **CTA** : bouton qui déclenche un `router.refresh()` côté client (donc ce sous-bloc devra être un Client Component ; le parent `<VisibilityBanner>` reste Server, et l'erreur encapsulée dans un Error Boundary local rend `<VisibilityBannerError />` qui est client).
- Pas de message technique détaillé exposé — c'est interne.

### A11y checklist du bandeau

- [ ] `role="region"` + `aria-labelledby` sur le container, pointant vers l'id du titre.
- [ ] Tous les icônes décoratives ont `aria-hidden="true"`.
- [ ] Chaque critère est un `<li>` avec libellé complet — pas juste "✓".
- [ ] L'état (validé / à faire / en cours) est exprimé textuellement via `sr-only` ET visuellement (icône + couleur). Pas de dépendance unique à la couleur (WCAG 1.4.1).
- [ ] Contraste : `text-amber-900` sur `bg-amber-50/50` est WCAG AA (vérifié). Idem `emerald-900/50`, `red-900/40`.
- [ ] Focus ring shadcn par défaut conservé sur le CTA.
- [ ] CTA `min-h-[44px]` (zone tactile mobile WCAG 2.5.5).
- [ ] La liste est lue dans l'ordre par les SR — donc l'ordre des critères porte du sens (voir §4).

### Mobile-first

- < 640px : pile verticale stricte. CTA full-width. Pas de truncation des labels critères → `whitespace-normal` (les labels FR font jusqu'à ~45 caractères).
- 640-1024 : même structure, CTA passe en `w-auto`, padding `p-6`.
- > 1024 : aucun changement structurel — le bandeau reste pleine largeur du contenu du dashboard (déjà contraint par `max-w-...` du layout parent).

---

## 2. Page 404 cave (route publique)

### Emplacement

- **Fichier à créer** : `src/app/[locale]/(public)/wineries/[slug]/not-found.tsx`
- Déclenché par `notFound()` dans `page.tsx` quand la cave n'est pas publiquement visible (cf. spec §"Comportement quand non-visible").
- **Pas** de modification du `not-found.tsx` global — celui-ci reste pour les 404 génériques.

### Wireframe

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│                      ╭───────╮                           │
│                      │  🍇   │   (Grape icon dans bulle) │
│                      ╰───────╯                           │
│                                                          │
│         Cette cave n'est pas (encore) disponible         │
│                                                          │
│    Revenez bientôt — de nouveaux encaveurs rejoignent    │
│              EnCave chaque semaine.                      │
│                                                          │
│           [  Découvrir les autres caves  →  ]            │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Détails visuels

- **Layout** : reprend le pattern de `src/app/[locale]/not-found.tsx` mais en plus sobre. Pas de search bar, pas de "popular experiences" (on ne fait pas la promo agressive ici, le ton est "patience").
- **Container** : `<div className="flex min-h-[70vh] flex-col items-center justify-center bg-cream-50 px-4">`. Le `Header` + `Footer` du layout public restent visibles (importants pour navigation).
- **Bulle icône** : `mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-burgundy-100/70`. Icône `Grape` (lucide) `h-10 w-10 text-burgundy-600`, `aria-hidden="true"`. Choix de `Grape` plutôt que `Wine` : différenciation visuelle avec le 404 global (qui utilise `Wine`).
- **Titre** : `font-display text-3xl sm:text-4xl font-bold text-slate-900`. Pas de chiffre "404" — pas de drame.
- **Corps** : `mt-3 max-w-md text-base sm:text-lg text-slate-600`.
- **CTA unique** : `<Button asChild size="lg" className="mt-8">` avec `<Link href="/wineries">`. Variant `default` (burgundy). Icône `ArrowRight` à droite.
- **Mobile** : `min-h-[70vh]` garantit centrage vertical même sur petit écran. `px-4` padding minimum, `text-3xl` sur mobile, `text-4xl` à partir de `sm:`.

### A11y

- [ ] `<h1>` unique sur la page (le titre du 404).
- [ ] L'icône bulle a `aria-hidden="true"` — décorative.
- [ ] Pas de redirection automatique (pas de `meta refresh`), l'utilisateur garde le contrôle.
- [ ] Code HTTP 404 renvoyé par Next.js via `notFound()` — pas un 200 déguisé (SEO + neutralité).

### Métadonnées

- `<title>Cette cave n'est pas disponible | EnCave</title>` via `generateMetadata` dans `not-found.tsx`.
- `noIndex: true` — on ne veut pas indexer ces 404.

---

## 3. Copy i18n (FR figée + DE/EN à valider par Théo)

> Convention : namespace `Dashboard.visibility.*` pour le bandeau (cohérent avec namespace `Dashboard.eventDetail.*` existant). Namespace `Public.winery.notFound.*` pour le 404.
> Les clés FR sont **strictement celles figées par Théo** dans la spec produit. Les DE/EN sont mes propositions — DE en vouvoiement (Sie-form), EN sobre.

### `messages/fr.json` (extrait à insérer dans `Dashboard.*` et `Public.*`)

```json
{
  "Dashboard": {
    "visibility": {
      "banner": {
        "title": "Votre cave n'est pas encore visible publiquement",
        "subtitle": "Complétez les éléments ci-dessous pour apparaître sur encave.ch.",
        "cta": "Compléter mon profil",
        "success": {
          "title": "Votre cave est en ligne",
          "subtitle": "Les clients peuvent la trouver et réserver vos expériences.",
          "viewPublic": "Voir ma page publique"
        },
        "error": {
          "title": "Impossible de vérifier le statut de votre cave",
          "subtitle": "Veuillez réessayer dans un instant.",
          "retry": "Réessayer"
        }
      },
      "criteria": {
        "verified": "Validation par l'équipe EnCave (en cours)",
        "kyc": "Finaliser les informations bancaires (Stripe)",
        "address": "Renseigner l'adresse exacte de votre cave",
        "description": "Rédiger une description de votre cave",
        "photos": "Ajouter au moins une photo de votre cave",
        "experience": "Publier au moins une expérience",
        "done": "Fait",
        "srValidated": "Critère validé :",
        "srToComplete": "Critère à compléter :",
        "srInProgress": "Critère en cours :"
      }
    }
  },
  "Public": {
    "winery": {
      "notFound": {
        "title": "Cette cave n'est pas (encore) disponible",
        "body": "Revenez bientôt — de nouveaux encaveurs rejoignent EnCave chaque semaine.",
        "cta": "Découvrir les autres caves"
      }
    }
  }
}
```

### `messages/de.json` (Sie-form, ton sobre helvétique)

```json
{
  "Dashboard": {
    "visibility": {
      "banner": {
        "title": "Ihr Weingut ist noch nicht öffentlich sichtbar",
        "subtitle": "Vervollständigen Sie die untenstehenden Punkte, um auf encave.ch zu erscheinen.",
        "cta": "Profil vervollständigen",
        "success": {
          "title": "Ihr Weingut ist online",
          "subtitle": "Gäste können Sie finden und Ihre Erlebnisse buchen.",
          "viewPublic": "Öffentliche Seite ansehen"
        },
        "error": {
          "title": "Status Ihres Weinguts konnte nicht geprüft werden",
          "subtitle": "Bitte versuchen Sie es gleich erneut.",
          "retry": "Erneut versuchen"
        }
      },
      "criteria": {
        "verified": "Prüfung durch das EnCave-Team (läuft)",
        "kyc": "Bankverbindung abschliessen (Stripe)",
        "address": "Genaue Adresse Ihres Weinguts angeben",
        "description": "Beschreibung Ihres Weinguts verfassen",
        "photos": "Mindestens ein Foto Ihres Weinguts hinzufügen",
        "experience": "Mindestens ein Erlebnis veröffentlichen",
        "done": "Erledigt",
        "srValidated": "Erledigtes Kriterium:",
        "srToComplete": "Offenes Kriterium:",
        "srInProgress": "Laufendes Kriterium:"
      }
    }
  },
  "Public": {
    "winery": {
      "notFound": {
        "title": "Dieses Weingut ist (noch) nicht verfügbar",
        "body": "Schauen Sie bald wieder vorbei – jede Woche kommen neue Weingüter zu EnCave dazu.",
        "cta": "Andere Weingüter entdecken"
      }
    }
  }
}
```

### `messages/en.json` (sobre, neutre)

```json
{
  "Dashboard": {
    "visibility": {
      "banner": {
        "title": "Your winery isn't publicly visible yet",
        "subtitle": "Complete the items below to appear on encave.ch.",
        "cta": "Complete my profile",
        "success": {
          "title": "Your winery is live",
          "subtitle": "Guests can find you and book your experiences.",
          "viewPublic": "View public page"
        },
        "error": {
          "title": "We couldn't check your winery status",
          "subtitle": "Please try again in a moment.",
          "retry": "Retry"
        }
      },
      "criteria": {
        "verified": "Validation by the EnCave team (in progress)",
        "kyc": "Complete your banking details (Stripe)",
        "address": "Add your winery's full address",
        "description": "Write a description of your winery",
        "photos": "Add at least one photo of your winery",
        "experience": "Publish at least one experience",
        "done": "Done",
        "srValidated": "Completed criterion:",
        "srToComplete": "Pending criterion:",
        "srInProgress": "In-progress criterion:"
      }
    }
  },
  "Public": {
    "winery": {
      "notFound": {
        "title": "This winery isn't (yet) available",
        "body": "Check back soon — new winemakers join EnCave every week.",
        "cta": "Discover other wineries"
      }
    }
  }
}
```

> **Note pour Théo** : j'ai ajouté 3 clés `srValidated`, `srToComplete`, `srInProgress` qui n'étaient pas dans la spec — elles sont uniquement lues par les lecteurs d'écran (préfixent l'item de liste). Pas de relecture critique requise mais merci de valider la traduction.
> **Note pour Margot** : `npm run i18n:check` doit passer après ajout des 3 fichiers.

---

## 4. Ordre des critères dans le bandeau

### Recommandation

Quand plusieurs critères manquent, les afficher dans cet ordre :

1. **`verified`** — Validation par l'équipe EnCave (`Clock` ambre, "en cours")
2. **`kyc`** — Finaliser Stripe (`Circle` ambre)
3. **`address`** — Adresse géocodée
4. **`description`** — Description
5. **`photos`** — Au moins une photo
6. **`experience`** — Publier ≥ 1 expérience

### Justification

J'ai hésité entre deux logiques :

- **(A)** Du plus bloquant non-actionnable au plus facile à corriger (ce que je retiens).
- **(B)** Du plus rapide à compléter au plus long (logique "quick wins").

Je tranche **(A)** parce que :

1. **Transparence métier** : commencer par "Validation EnCave en cours" envoie un signal clair "ça tient à nous, pas à toi" sur le premier item non actionnable. L'encaveur comprend immédiatement qu'il n'est pas en panne — il y a une étape humaine côté plateforme. Ça désamorce la frustration des Fondateurs ("pourquoi je suis pas en ligne ?").
2. **Suivi du flow d'onboarding réel** : Stripe → adresse → description → photos → expérience est l'ordre naturel d'onboarding d'un encaveur (la donnée structurante avant le contenu créatif). On reflète ce qui se passe déjà.
3. **L'expérience PUBLISHED en dernier** : c'est l'item qui dépend des 5 autres pour avoir du sens (créer une expérience avec une cave incomplète, c'est gâcher l'effort). Le placer en bas évite que l'encaveur s'y rue prématurément.

### Cas particuliers

- Si `verified` est **DÉJÀ** validé, on le retire de la liste (pas besoin d'afficher "Fait" pour un item qui ne dépend pas de l'utilisateur — le bandeau orange reste tant que des critères techniques manquent).
- Si tous les critères "actionnables" sont OK mais `verified` est encore `PENDING`, le bandeau orange reste actif avec **uniquement** l'item `verified` listé. La copie sous-titre devient implicitement "vous avez tout fait, on traite" — mais on n'invente pas de nouvelle copie cette US (hors-périmètre).

---

## 5. Comportement du CTA "Compléter mon profil"

### Recommandation : **deep-link dynamique vers la 1re action manquante**

Le CTA pointe vers une URL différente selon le 1er critère non validé (dans l'ordre de §4) :

| 1er critère manquant | URL cible |
| --- | --- |
| `verified` | `/dashboard/winery/profile` (pas de page dédiée — on montre le profil + l'état) |
| `kyc` | `/dashboard/winery/profile#payment` (ancre vers la section StripeOnboarding existante) |
| `address` | `/dashboard/winery/profile#location` |
| `description` | `/dashboard/winery/profile#description` |
| `photos` | `/dashboard/winery/profile#media` |
| `experience` | `/dashboard/experiences/new` |

### Justification

J'ai écarté l'option statique "toujours `/dashboard/winery/profile`" :

- L'expérience à publier est sur **une page différente** (`/dashboard/experiences/new`). Un CTA générique forcerait un clic en plus pour 1/6 des cas.
- Les ancres `#payment`, `#description`, etc. demandent un coût minimal d'implémentation côté Nora (ajouter des `id` sur les `<section>` existantes de `WineryProfileForm`). C'est un investissement amorti.

### Coût pour Nora

- Ajouter des `id="payment"`, `id="location"`, `id="description"`, `id="media"` sur les sections du `WineryProfileForm` (4 attributs HTML).
- Dans `VisibilityBanner`, calculer côté server la 1re action manquante et passer l'URL au composant.

Pas besoin de scroll-into-view JS — l'ancre HTML native suffit, et le focus se positionne correctement pour les claviers / lecteurs d'écran.

---

## 6. Pour Nora — composants à créer/modifier

### À CRÉER

| Fichier | Type | Notes |
| --- | --- | --- |
| `src/components/features/dashboard/VisibilityBanner.tsx` | Server Component | Récupère `isWineryPubliclyVisible(winery)` + détail critères. Branche sur états (partial/complete). Pas de `'use client'`. |
| `src/components/features/dashboard/VisibilityBannerCriteria.tsx` | Server Component | Liste `<ul>` des 6 critères avec leur état (validated/pending/inProgress). Reçoit `criteria: Array<{ key, status }>` en props. |
| `src/components/features/dashboard/VisibilityBannerSkeleton.tsx` | Server Component | Skeleton de hauteur fixe `min-h-[280px]`. Utilise `<Skeleton />` shared. |
| `src/components/features/dashboard/VisibilityBannerError.tsx` | Client Component (`'use client'`) | Bouton "Réessayer" qui appelle `router.refresh()` via `useNavigateWithTransition` ou `useRouter` de `@/i18n/navigation`. |
| `src/app/[locale]/(public)/wineries/[slug]/not-found.tsx` | Server Component | Page 404 i18n custom décrite §2. Importe `getTranslations` de `next-intl/server`. |

### À MODIFIER

| Fichier | Modification |
| --- | --- |
| `src/app/[locale]/(protected)/dashboard/bookings/page.tsx` | Injecter `<Suspense fallback={<VisibilityBannerSkeleton />}><VisibilityBanner wineryId={winery.id} /></Suspense>` en tout premier child du wrapper `<WineryAccessGuard>` — au-dessus de `<BookingsPageHeader />`. |
| `src/components/features/winery/WineryProfileForm.tsx` | Ajouter `id="location"`, `id="description"`, `id="media"` sur les `<section>` correspondantes (pour les deep-links du §5). |
| `src/app/[locale]/(protected)/dashboard/winery/profile/page.tsx` | Ajouter `id="payment"` sur la `<div>` qui wrap la section Payment Status / StripeOnboarding. |
| `messages/fr.json`, `messages/de.json`, `messages/en.json` | Insérer les blocs JSON du §3 dans leurs namespaces respectifs (`Dashboard.visibility.*` et `Public.winery.notFound.*`). Lancer `npm run i18n:check` après. |

### À NE PAS TOUCHER

- `src/components/shared/EmptyState.tsx` : le bandeau visibilité n'est **pas** un `EmptyState` — c'est un état de cave, pas un état "aucune donnée". Le pattern visuel diffère assez pour justifier un composant dédié.
- `src/app/[locale]/not-found.tsx` : reste le 404 global de la plateforme. Notre `not-found.tsx` est **scopé** au segment `wineries/[slug]` et Next.js l'utilise automatiquement quand `notFound()` est appelé depuis ce segment.
- `src/components/ui/*` : aucun primitive shadcn à modifier. On utilise `Card`, `Button`, `Skeleton` tels quels.

### Dépendances back-end attendues

- Helper `isWineryPubliclyVisible(winery)` dans `src/lib/business-rules/winery-visibility.ts` (cf. spec produit §"Recalcul"). Doit aussi exposer un détail granulaire :

  ```ts
  type VisibilityCriteria = {
    verified: boolean;
    kyc: boolean;
    address: boolean;
    description: boolean;
    photos: boolean;
    experience: boolean;
  };

  export function getWineryVisibilityCriteria(winery: Winery): VisibilityCriteria;
  export function isWineryPubliclyVisible(winery: Winery): boolean; // dérivé du précédent
  ```
- C'est Jonas qui définit l'archi et Nora qui implémente. Côté design je consomme `VisibilityCriteria` dans le bandeau.

---

## 7. Récapitulatif checklist a11y (transverse)

- [ ] Tous les boutons ont un libellé textuel (pas d'icon-only sans `aria-label`).
- [ ] Contraste WCAG AA validé pour les variants amber/emerald/red sur `bg-X-50`.
- [ ] Focus ring shadcn par défaut conservé partout.
- [ ] Toutes les icônes décoratives ont `aria-hidden="true"`.
- [ ] La liste des critères utilise `<ul role="list">` avec items textuels complets (pas dépendant de couleur seule).
- [ ] `<h1>` unique sur la page 404 cave.
- [ ] CTA mobile ≥ 44px (zone tactile WCAG 2.5.5).
- [ ] Pas de redirection auto sur le 404 — l'utilisateur décide.
- [ ] `npm run i18n:check` passe après ajout des clés.

---

## 8. Friction identifiée à signaler à Margot

1. **Divergence route** `/caves` vs `/wineries` : tranchée le 2026-05-13 (on garde `/wineries`, spec produit alignée).
2. **Pas de dashboard home** dédié : le bandeau atterrit sur `/dashboard/bookings`. Acceptable mais à valider — alternative : créer une vraie page `/dashboard` au lieu du redirect. Hors scope cette US, à noter.
3. **Critère `verified` non actionnable** : si l'encaveur reste bloqué en `PENDING` longtemps, le bandeau peut sembler "coincé". Une notification email "votre cave est validée" (hors-périmètre explicite) compensera. À garder en tête.
