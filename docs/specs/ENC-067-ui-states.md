# ENC-067 — UI states page confirmation booking

> Spec design des 3 états visuels de la page `/[locale]/booking/[id]/confirmation?session_id=...` après la mise en place du fallback synchrone côté Server Component. Réfère à `docs/specs/ENC-067.md` pour la logique produit.

## Principes design

- **Sobriété confiante** — pas de confettis, pas d'animation bling. Le client a payé, on lui rend service en étant clair et rapide.
- **Mobile-first** — un encaveur ouvre cette page sur son tel à la cave pour valider qu'un client est bien venu. Le client lui-même vient quasi-toujours du checkout Stripe sur mobile.
- **Trois branches, pas plus** — Finalisation / Confirmé / Échec instantané. L'utilisateur ne doit jamais douter de l'état dans lequel il se trouve.

---

## État 1 — Finalisation en cours

### Description

C'est le frame transitoire affiché pendant le `<Suspense>` natural du Server Component pendant que `reconcileBookingPayment` (qui wrap `stripe.checkout.sessions.retrieve`) résout côté serveur. Durée typique 200ms – 2s. **Pas de polling client**, pas de spinner JS, pas d'auto-refresh — c'est juste le fallback de Suspense rendu par le streaming RSC.

Visuellement : une seule `Card` centrée avec un Skeleton minimaliste qui mime la structure de l'état 2 (header succès + bloc récap), accompagnée d'un message rassurant court. L'illusion de "ça arrive dans une seconde" est plus rassurante qu'un spinner nu.

### Mock ASCII

```
                      ┌─────────────────────────────────────────┐
                      │                                         │
                      │           ◯ (skeleton circle)           │
                      │                                         │
                      │     ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓        │  ← h1 skeleton
                      │     ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                   │
                      │                                         │
                      │     On finalise votre paiement,         │
                      │     ça prend quelques secondes…         │
                      │                                         │
                      │  ─────────────────────────────────────  │
                      │                                         │
                      │     ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓        │  ← skeleton lignes
                      │     ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                  │
                      │     ▓▓▓▓▓▓▓▓▓▓▓▓▓▓                      │
                      │                                         │
                      └─────────────────────────────────────────┘
```

### Composants shadcn / shared

- `Card` + `CardContent` (`@/components/ui/card`)
- `Skeleton` + `SkeletonContainer` (`@/components/shared/Skeleton`) — déjà câblés en `aria-busy` + `aria-live="polite"`
- Pas d'icône Lucide ici (le skeleton circle suffit, pas de prétendre un succès qui n'est pas acquis)

### Tailwind clés (pour Nora)

- Container : `mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-12 sm:px-6`
- Card : `w-full rounded-2xl border bg-card p-6 shadow-sm sm:p-8`
- Message rassurant : `mt-6 text-center text-sm text-muted-foreground sm:text-base`
- Skeleton circle : `h-16 w-16 rounded-full`
- Skeleton lignes : alterner `h-6 w-3/4`, `h-4 w-1/2`, `h-4 w-2/3`

### a11y

- `SkeletonContainer` fournit déjà `role="status"` + `aria-busy="true"` + `aria-live="polite"` + label sr-only. Réutiliser tel quel.
- Le label sr-only doit pointer vers la clé `BookingConfirmation.finalizing.srLabel` ("Finalisation de votre paiement en cours") — surcharger le default "Chargement en cours…".
- Pas de focus à gérer (rien d'interactif).

---

## État 2 — Confirmé

### Description

Le booking est en `CONFIRMED` côté DB. Soit le webhook est passé avant l'arrivée sur la page, soit le fallback synchrone vient de le faire flipper.

C'est l'état le plus dense — c'est ici qu'on rassure pleinement et qu'on donne au client tout ce qu'il faut. Structure existante du code à conserver dans les grandes lignes (`ConfirmationSuccess`, `BookingDetailsSection`, `WineryInfoCard`, `ConfirmationActions`) — Nora **n'a pas besoin de tout réécrire**, on cible uniquement l'en-tête succès et les CTA pour les rendre cohérents avec la nouvelle palette d'états.

Pas de confetti, pas d'`AnimatedCheckmark` exubérant — on garde l'icône `CheckCircle2` Lucide en vert sobre. Le `AnimatedCheckmark` actuel peut être conservé s'il reste discret ; sinon le remplacer.

### Mock ASCII

```
                      ┌─────────────────────────────────────────┐
                      │                                         │
                      │              ✓ (vert sobre)             │
                      │                                         │
                      │         Réservation confirmée           │  ← h1
                      │                                         │
                      │   Un mail de confirmation arrive sur    │  ← p muted
                      │   votre adresse.                        │
                      │                                         │
                      └─────────────────────────────────────────┘

                      ┌─────────────────────────────────────────┐
                      │  Référence  ENC-XXXXXX                  │  ← header card
                      ├─────────────────────────────────────────┤
                      │                                         │
                      │  ▢ Expérience                           │
                      │     Dégustation Pinot Noir              │
                      │     Cave de la Tour                     │
                      │                                         │
                      │  ▢ Quand                                │
                      │     Sam. 14 juin 2026 · 14:00 – 16:00  │
                      │                                         │
                      │  ▢ Lieu                                 │
                      │     Rue du Bourg 12, 1920 Martigny      │
                      │                                         │
                      │  ▢ Invités          ▢ Total            │
                      │     2 personnes        CHF 90.00        │
                      │                                         │
                      └─────────────────────────────────────────┘

                      [ Voir ma réservation ]  ← Button primary
                      [ Retour à l'accueil  ]  ← Button outline
```

### Composants shadcn / shared / features

- `Card` + `CardContent` + (header custom existant `BookingReferenceHeader`)
- `Button` variant `default` (primary) et `outline` (secondary)
- Icône `CheckCircle2` de `lucide-react`, taille `h-12 w-12`, classe `text-emerald-600`
- Composants features existants : `BookingDetailsSection`, `WineryInfoCard`, `ConfirmationActions`, `ExperienceVisual`, `ModifyBookingCard` (à garder, ne pas casser)

### Tailwind clés

- Header succès container : `mx-auto flex max-w-2xl flex-col items-center gap-3 px-4 pt-10 pb-6 text-center sm:gap-4 sm:pt-12 sm:pb-8`
- Icône wrap : `flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-100`
- H1 : `font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl`
- Sous-titre : `max-w-md text-sm text-muted-foreground sm:text-base`
- Bloc CTAs : `mt-8 flex w-full flex-col gap-3 sm:mt-10 sm:flex-row sm:justify-center`
- CTA primary : `w-full sm:w-auto` (Button variant default size lg)
- Sticky bar mobile (optionnel, si la page devient longue) : à éviter pour la v1 — le scroll naturel suffit

### a11y

- `<h1>` unique pour "Réservation confirmée" (hiérarchie respectée, le reste descend en h2/h3).
- Icône `CheckCircle2` purement décorative : `aria-hidden="true"`. L'information de succès est portée par le h1.
- CTAs : libellés textuels complets, pas d'icône-seule.
- Focus management : au mount, **ne pas voler le focus**. Si le client arrive depuis Stripe, le focus naturel est sur le body. Lui imposer un focus est plus déstabilisant qu'utile.
- Contraste : `text-emerald-600` sur fond clair = WCAG AA OK pour une icône décorative. Le succès n'est pas porté par la couleur seule.

---

## État 3 — Échec paiement instantané

### Description

Stripe a renvoyé `payment_status === 'unpaid'` sur une session carte. Carte refusée, 3DS abandonné, fraud check, fonds insuffisants. Le booking reste en `PENDING_PAYMENT` côté DB et sera expiré par le cron 30 min — **on ne le dit pas au client**, ça crée plus d'anxiété que ça n'aide.

L'état doit être ferme mais non culpabilisant. On utilise `Alert` variant `destructive` shadcn — qui en EnCave est déjà adouci par le thème (pas un rouge agressif). Pas de mention "votre carte a été refusée" : on reste vague parce que la cause exacte côté Stripe n'est pas toujours diffusable au client (fraud check notamment).

CTA principal : **nouvelle réservation**, on renvoie vers la page expérience. Pas de retry inline (cf. décision Sam).

### Mock ASCII

```
                      ┌─────────────────────────────────────────┐
                      │  ⚠  Paiement non finalisé              │  ← Alert destructive
                      │                                         │
                      │  Votre carte n'a pas été débitée. Vous │
                      │  pouvez relancer une réservation quand │
                      │  vous voulez.                           │
                      └─────────────────────────────────────────┘

                      [ Refaire une réservation     ]  ← primary
                      [ Voir mes réservations        ]  ← ghost

                      ─────────────────────────────────
                      Besoin d'aide ? Écrivez-nous à
                      contact@encave.ch
```

### Composants shadcn / shared

- `Alert` + `AlertTitle` + `AlertDescription` (variant `destructive`)
- `Button` variant `default` (CTA principal) + `ghost` ou `outline` (secondaire)
- Icône `AlertCircle` de `lucide-react` (passée comme enfant SVG dans `Alert`, qui a déjà le positionnement absolute prévu pour `[&>svg]`)
- Lien email support : `<a href="mailto:contact@encave.ch">` simple, sans bouton

### Tailwind clés

- Container : `mx-auto flex max-w-xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-14`
- Alert : laisser la variante destructive shadcn, juste s'assurer du `<AlertCircle className="h-5 w-5" />` en premier enfant
- AlertTitle : `text-base font-semibold` (override pour grossir un peu vs default `font-medium leading-none`)
- AlertDescription : `mt-2 text-sm leading-relaxed`
- Bloc CTAs : `flex flex-col gap-3 sm:flex-row`
- CTA primary : `w-full sm:flex-1`, **lien vers** `/[locale]/experiences/[winerySlug]/[experienceSlug]` (pas vers `/experiences` générique — on ramène le client à l'expérience qu'il voulait réserver)
- Bloc support : `mt-4 border-t border-border pt-4 text-center text-sm text-muted-foreground`

### a11y

- `Alert` shadcn applique déjà `role="alert"`. Le screen reader annonce le contenu à la navigation.
- Icône `AlertCircle` décorative — l'info "paiement non finalisé" est dans le `AlertTitle`.
- Le CTA "Refaire une réservation" doit pointer vers une URL canonique (lien `Link` de `@/i18n/navigation`), pas un bouton qui déclenche une server action. C'est de la navigation pure.
- Pas de focus management imposé. L'`Alert` est dans le flow naturel du DOM, c'est suffisant.
- Le link mailto est texte plein lisible, pas une icône.

---

## Composants à créer

À placer dans `src/components/features/booking/confirmation/` (en suivant le pattern existant — `index.ts` à mettre à jour).

### 1. `ConfirmationFinalizing.tsx` (Server Component)

Rendu par `<Suspense fallback={...}>` de la page. Server-only, pas de `'use client'`.

```tsx
// Props : aucune (état pur visuel)
// - SkeletonContainer label override via t('BookingConfirmation.finalizing.srLabel')
// - h1 visible avec t('BookingConfirmation.finalizing.title')
// - p muted avec t('BookingConfirmation.finalizing.subtitle')
```

### 2. `ConfirmationPaymentFailed.tsx` (Server Component)

Rendu quand `reconcileBookingPayment` renvoie `{ status: 'failed' }`.

```tsx
interface ConfirmationPaymentFailedProps {
  winerySlug: string;
  experienceSlug: string;
  locale: string;
}
// - Alert destructive avec AlertCircle
// - Button primary -> Link vers `/${locale}/experiences/${winerySlug}/${experienceSlug}`
// - Button ghost -> Link vers `/${locale}/dashboard/my-bookings`
// - Bloc mailto support
```

### 3. `ConfirmationHeader.tsx` (Server Component, refacto léger)

Remplace l'usage actuel de `ConfirmationSuccess` (qui dépend de `visitorEmail` et anime un checkmark via `AnimatedCheckmark`). On crée un header succès sobre, sans email visible (l'email est dans le récap, pas dans le titre) :

```tsx
interface ConfirmationHeaderProps {
  title: string; // "Réservation confirmée"
  subtitle: string; // "Un mail de confirmation arrive…"
}
// - CheckCircle2 vert dans bulle emerald-50
// - h1 + p
```

`ConfirmationSuccess.tsx` et `AnimatedCheckmark.tsx` peuvent être **supprimés** dans la foulée s'ils ne sont plus référencés ailleurs — à vérifier avec un grep avant suppression (cf. règle "Modifying an existing component" du CLAUDE.md).

### Restent intacts

- `BookingReferenceHeader.tsx`
- `BookingDetailsSection.tsx`
- `WineryInfoCard.tsx`
- `ModifyBookingCard.tsx`
- `ConfirmationActions.tsx` — à passer en revue pour cohérence avec les nouveaux CTA "Voir ma réservation" / "Retour à l'accueil" si la copy a évolué
- `ExperienceVisual.tsx` / `QRCodeCard.tsx`

### loading.tsx et error.tsx

- `src/app/[locale]/(public)/booking/[id]/confirmation/loading.tsx` — réutiliser `ConfirmationFinalizing` (DRY).
- `src/app/[locale]/(public)/booking/[id]/confirmation/error.tsx` — état d'erreur générique avec CTA "Réessayer" + "Retour à l'accueil". Pas spec'é ici car standard.

---

## Récap responsive

| Breakpoint     | Comportement                                                                 |
| -------------- | ---------------------------------------------------------------------------- |
| Mobile <640px  | Stack vertical pur, CTAs full-width, padding x-4, fonts h1 `text-2xl`        |
| Tablet 640-1024| CTAs en row, padding x-6, fonts h1 `text-3xl`, max-w-2xl pour confirmé       |
| Desktop >1024  | Layout 2 colonnes pour l'état 2 (existant), max-w-5xl, padding x-10          |

États 1 et 3 restent en single-column quel que soit le breakpoint — pas besoin d'élargir, le contenu est court.
