# ENC-052b — CTA sticky en `fixed bottom` sur mobile pour la page détail événement

## Objectif métier
Sur mobile, la page détail d'une expérience est longue (cover, description, créneaux, encaveur, avis, FAQ). Le CTA principal "Réserver" disparaît au scroll, ce qui tue la conversion. Un CTA sticky en bas d'écran maintient l'intention d'achat visible et accessible au pouce tout au long du parcours. Standard de l'industrie (Airbnb, GetYourGuide).

## Acteurs
- **CLIENT** : utilisateur mobile sur la page expérience publique.

## Préconditions & déclencheurs
- Route : `/[locale]/experiences/[winerySlug]/[experienceSlug]` (page publique détail).
- Affichage uniquement sur viewport `< md` (breakpoint Tailwind 768px).
- Affichage uniquement si l'expérience est `PUBLISHED` et possède au moins un créneau futur disponible.
- L'utilisateur n'a pas besoin d'être loggé (le tap du CTA déclenche le parcours de réservation standard).

## User stories
- En tant que **client mobile**, je veux que le bouton de réservation reste accessible quand je scrolle pour lire les détails.
- En tant que **client**, je veux voir le prix et la disponibilité en un coup d'œil même au milieu de la page.
- En tant que **client indécis**, je ne veux pas être harcelé par un CTA sticky AVANT d'avoir vu le hero, l'effet "pop-up agressif" tue la confiance.

## Critères d'acceptation (Gherkin)

```gherkin
Scénario : affichage du sticky CTA sur mobile
  Étant donné un client sur la page détail d'une expérience PUBLISHED avec créneaux disponibles
  Et un viewport mobile (< 768px)
  Quand le client scrolle au-delà du CTA principal en haut de page
  Alors un CTA sticky apparaît en bas, fixed bottom, full-width
  Et il affiche le prix "dès CHF X" + bouton "Réserver"

Scénario : sticky caché tant que le CTA principal est visible
  Étant donné un client en haut de page sur mobile
  Quand le CTA principal du hero est dans le viewport
  Alors le sticky CTA n'est pas affiché (évite la duplication)

Scénario : sticky absent sur desktop
  Étant donné un viewport ≥ 768px
  Quand on charge la page détail
  Alors aucun CTA sticky n'est rendu

Scénario : sticky absent si plus de créneaux disponibles
  Étant donné une expérience sans créneau futur ouvert (sold out ou archivée)
  Quand le client scrolle sur mobile
  Alors le sticky affiche "Complet — voir d'autres dates" en état désactivé/secondaire
  Ou est masqué si l'expérience est ARCHIVED

Scénario : tap sur le CTA sticky
  Quand le client tape le sticky CTA
  Alors la page scrolle smooth jusqu'à la section "Choisis ta date"
  Et le focus va sur le premier créneau disponible

Scénario : safe area iOS
  Étant donné un iPhone avec home indicator
  Quand le sticky CTA est affiché
  Alors il respecte env(safe-area-inset-bottom) et ne se cache pas sous la barre système
```

## Règles métier
- Apparition conditionnée à l'**IntersectionObserver** du CTA principal du hero. Quand ce dernier sort du viewport (`isIntersecting === false`), on affiche le sticky.
- Transition en fade + slide-up (`framer-motion`, ~200ms).
- Le sticky est **full-width** en bas, padding latéral 16px, hauteur ~64px + safe-area.
- Z-index suffisant pour passer au-dessus du contenu mais sous les modales/toasts.
- Le sticky affiche : prix "dès CHF X" à gauche, bouton "Réserver" à droite.
- Sur tap : scroll smooth vers `#booking-slots` (id à ajouter sur la section créneaux).
- Pas d'analytics dédiées dans cette US (peut s'ajouter ultérieurement : "sticky_cta_click").
- Accessibilité : le sticky ne doit pas masquer la dernière ligne de contenu — la page doit avoir un padding-bottom égal à la hauteur du sticky sur mobile.

## Copy FR définitive

| Élément | Clé i18n suggérée | Texte FR |
|---|---|---|
| Prix "dès" | `Experience.detail.stickyCta.priceFrom` | dès {price} |
| CTA principal | `Experience.detail.stickyCta.book` | Réserver |
| État complet | `Experience.detail.stickyCta.soldOut` | Complet — voir d'autres dates |
| Aria-label CTA | `Experience.detail.stickyCta.ariaLabel` | Réserver cette expérience |

Le `{price}` est formaté via `formatCHFCompact` (ex. "CHF 45.–").

## États UI
- **Loading** : N/A — le sticky se base sur des données déjà fetchées côté serveur pour la page.
- **Empty** : si aucun créneau futur → affichage état "Complet" ou masqué (cf. règles).
- **Error** : N/A à ce niveau ; le tap déclenche le parcours standard qui gère ses propres erreurs.
- **Populated** : prix + bouton "Réserver" visible quand le CTA hero sort du viewport.

Animations :
- Entrée : `opacity 0 → 1`, `translateY 16 → 0`, 200ms ease-out.
- Sortie : inverse, 150ms.

## Cas limites
- Rotation portrait → paysage : recalculer la visibilité du CTA hero (resize listener via IntersectionObserver natif suffit).
- Clavier virtuel ouvert (utilisateur dans un input) : le sticky doit rester ou se masquer ? Reco : se masquer si un input est focus, pour ne pas voler de la place. Détection via `:focus-within` sur les inputs de la page.
- Page très courte où le CTA hero ne sort jamais du viewport : sticky jamais affiché. C'est OK.
- Connexion lente : le sticky n'apparaît qu'après hydration côté client (composant `'use client'`). Pas d'apparition prématurée.
- Utilisateur avec `prefers-reduced-motion: reduce` : pas d'animation, apparition instantanée.

## Dépendances
- Composant : `src/components/features/experiences/ExperienceStickyCta.tsx` (`'use client'`).
- Intégration dans : `src/app/[locale]/experiences/[winerySlug]/[experienceSlug]/page.tsx`.
- Hook utilitaire : `useIsHeroCtaVisible(ref)` (IntersectionObserver wrapped).
- Cible le `Tailwind` breakpoint `md:hidden`.
- Réutilise `formatCHFCompact` de `src/lib/utils/currency.ts`.

## Hors-périmètre explicite
- Pas de version desktop (sidebar sticky existante ou à traiter dans une autre US).
- Pas d'A/B test ni de tracking analytics dans cette US.
- Pas de mini-récap dynamique du créneau sélectionné (peut être une évolution future).
- Pas de changement du parcours de réservation lui-même.

## Métriques de succès
- Taux de tap sur le sticky vs CTA hero (instrumentation future).
- Taux de conversion mobile détail → checkout : objectif +5 % vs baseline.

## ❓ Questions ouvertes pour Sam
- **Comportement quand clavier virtuel ouvert** : on cache le sticky ou on le laisse ? Ma reco : cacher.
- Quand "sold out", on masque le sticky ou on affiche un état désactivé/secondaire avec lien vers d'autres dates de la même winery ? Ma reco : afficher en secondaire pour garder l'engagement.
- Couleur du sticky : on garde la couleur de marque (CTA primaire) ou un fond blanc avec bouton primaire à l'intérieur ? À voir avec Léa.
