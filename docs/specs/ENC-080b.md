# ENC-080b — Pagination + filtres UI sur page "Mes réservations"

## Objectif métier
La page `/account/bookings` liste aujourd'hui toutes les réservations d'un client sans pagination ni filtres. Pour un client fidèle (et pour les Fondateurs eux-mêmes qui testent intensivement), la liste devient illisible dès 10-15 réservations. On veut une page scannable, qui distingue clairement ce qui est **à venir** de ce qui est **passé** ou **annulé**, et qui scale sans dégrader les perfs serveur.

## Acteurs
- **CLIENT** (rôle `CLIENT`) : seul accès. Vue de ses propres réservations uniquement, jamais celles d'autrui.

## Préconditions & déclencheurs
- Le client est authentifié (session Better Auth valide) et navigue sur `/account/bookings`.
- Au moins une réservation existe en DB pour `userId = session.user.id`. Sinon → état empty.
- Aucune mutation : page 100% lecture, server component avec query cachée par `userId`.

## User stories
- En tant que **client**, je veux voir mes prochaines réservations en haut de page, sans avoir à scroller à travers l'historique.
- En tant que **client**, je veux filtrer par statut (à venir, passées, annulées) pour retrouver rapidement une réservation précise.
- En tant que **client** avec beaucoup de réservations, je veux naviguer par page de 10 sans charger l'historique complet d'un coup.
- En tant que **client** qui n'a encore jamais réservé, je veux un état vide motivant qui me pousse vers la découverte.

## Critères d'acceptation (Gherkin)

```gherkin
Scénario : pagination par défaut
  Étant donné un client avec 27 réservations toutes statuts confondus
  Quand il ouvre /account/bookings
  Alors 10 réservations s'affichent
  Et un sélecteur de page indique "1 / 3"
  Et le tri par défaut est : date d'événement décroissante (la plus proche d'abord pour "à venir", la plus récente d'abord pour "passées")

Scénario : filtre par statut "À venir"
  Étant donné un client avec 5 réservations CONFIRMED dont la date est dans le futur
  Et 3 réservations COMPLETED dont la date est passée
  Quand il sélectionne le filtre "À venir"
  Alors seules les 5 CONFIRMED futures sont listées
  Et l'URL contient ?status=upcoming
  Et le compteur indique "5 réservations"

Scénario : filtre par statut "Passées"
  Quand le client sélectionne "Passées"
  Alors seules les bookings COMPLETED et NO_SHOW s'affichent
  Et l'URL contient ?status=past

Scénario : filtre par statut "Annulées"
  Quand le client sélectionne "Annulées"
  Alors seules les bookings CANCELLED_BY_CLIENT et CANCELLED_BY_WINERY s'affichent
  Et l'URL contient ?status=cancelled

Scénario : filtre par période
  Étant donné un client qui sélectionne "Cette année"
  Alors seules les bookings dont eventDate est entre le 1er janvier et le 31 décembre de l'année courante sont listées
  Et l'URL contient ?period=this-year

Scénario : combinaison filtres + pagination
  Étant donné qu'un filtre "Passées" retourne 23 résultats
  Quand le client est en page 1
  Alors il voit 10 résultats
  Et la pagination passe à "1 / 3"
  Et changer de page conserve les filtres dans l'URL

Scénario : aucun résultat sur un filtre
  Étant donné qu'un client a des réservations mais aucune ne correspond au filtre actif
  Alors un message "Aucune réservation dans cette catégorie" s'affiche
  Et un lien "Voir toutes mes réservations" remet ?status=all

Scénario : aucune réservation du tout
  Étant donné un client qui n'a jamais réservé
  Alors un EmptyState s'affiche avec un titre, une illustration et un CTA "Trouver une expérience"
  Et le CTA mène vers /experiences

Scénario : isolation par utilisateur
  Étant donné deux clients A et B avec des réservations
  Quand A consulte /account/bookings
  Alors aucune réservation de B n'est listée, quelle que soit la manipulation d'URL
```

## Règles métier
- **Pagination** : 10 résultats par page. Paramètre URL `?page=N` (1-indexed). `nuqs` pour la sync state ↔ URL.
- **Filtres disponibles** :
  - **Statut** : `all` (défaut), `upcoming`, `past`, `cancelled`.
    - `upcoming` = `CONFIRMED` ET `eventDate >= now`.
    - `past` = `COMPLETED` OU `NO_SHOW` OU (`CONFIRMED` ET `eventDate < now`).
    - `cancelled` = `CANCELLED_BY_CLIENT` OU `CANCELLED_BY_WINERY`.
    - Les bookings `PENDING_PAYMENT` ne sont **jamais** affichées sur cette page (le client est encore en checkout, elles vivent dans le flux paiement).
  - **Période** : `all` (défaut), `this-month`, `this-year`, `last-year`. Optionnel pour MVP — voir question Sam.
- **Tri par défaut** : `eventDate DESC` pour `past` et `cancelled`, `eventDate ASC` pour `upcoming` (la prochaine en haut). Pas de tri manuel par le client en MVP.
- **Persistance des filtres** : via URL search params uniquement (`nuqs`). Pas de localStorage.
- **Sécurité** : la query filtre **systématiquement** par `userId = session.user.id` côté serveur. Aucun paramètre client ne peut élargir le scope.
- **Performance** : `LIMIT 10 OFFSET (page-1)*10` côté SQL. Compter le total via `prisma.booking.count()` avec les mêmes `where`. Cache `unstable_cache` clé par `userId+filters+page`, tag `bookings:user:{userId}`.
- **Header de page** : compteur "X réservation(s)" reflète le **total filtré**, pas la page courante.

## Copy FR définitive

| Élément | Clé i18n suggérée | Texte FR |
|---|---|---|
| Titre page | `Account.myBookings.title` | Mes réservations |
| Sous-titre | `Account.myBookings.subtitle` | Retrouvez ici toutes vos expériences réservées chez nos encaveurs. |
| Compteur (singulier) | `Account.myBookings.count.one` | 1 réservation |
| Compteur (pluriel) | `Account.myBookings.count.other` | {count} réservations |
| Label filtre statut | `Account.myBookings.filters.status.label` | Statut |
| Option "Toutes" | `Account.myBookings.filters.status.all` | Toutes |
| Option "À venir" | `Account.myBookings.filters.status.upcoming` | À venir |
| Option "Passées" | `Account.myBookings.filters.status.past` | Passées |
| Option "Annulées" | `Account.myBookings.filters.status.cancelled` | Annulées |
| Label filtre période | `Account.myBookings.filters.period.label` | Période |
| Option "Toutes périodes" | `Account.myBookings.filters.period.all` | Toutes périodes |
| Option "Ce mois-ci" | `Account.myBookings.filters.period.thisMonth` | Ce mois-ci |
| Option "Cette année" | `Account.myBookings.filters.period.thisYear` | Cette année |
| Option "L'an dernier" | `Account.myBookings.filters.period.lastYear` | L'an dernier |
| Bouton "Réinitialiser" | `Account.myBookings.filters.reset` | Réinitialiser les filtres |
| Pagination — précédent | `Account.myBookings.pagination.previous` | Précédent |
| Pagination — suivant | `Account.myBookings.pagination.next` | Suivant |
| Pagination — position | `Account.myBookings.pagination.page` | Page {current} sur {total} |
| Empty — aucun résultat filtre | `Account.myBookings.empty.filtered.title` | Aucune réservation dans cette catégorie |
| Empty — aucun résultat filtre (sous-titre) | `Account.myBookings.empty.filtered.subtitle` | Essayez un autre filtre ou consultez l'ensemble de vos réservations. |
| Empty — lien reset | `Account.myBookings.empty.filtered.cta` | Voir toutes mes réservations |
| Empty — aucune réservation (titre) | `Account.myBookings.empty.none.title` | Pas encore de réservation |
| Empty — aucune réservation (sous-titre) | `Account.myBookings.empty.none.subtitle` | Découvrez les expériences proposées par nos encaveurs valaisans et romands. |
| Empty — CTA principal | `Account.myBookings.empty.none.cta` | Trouver une expérience |

## États UI
- **Loading** : `loading.tsx` au niveau du segment. Skeleton de 3 cards + skeleton barre de filtres. Pas de spinner full-page.
- **Empty (aucune réservation du tout)** : `EmptyState` partagé, illustration sobre, titre + sous-titre + CTA primaire vers `/experiences`.
- **Empty (filtre actif sans résultat)** : variante texte uniquement (pas d'illustration), avec bouton secondaire "Voir toutes mes réservations" qui reset les filtres.
- **Error** : `error.tsx` segment avec message générique + CTA "Réessayer". L'erreur est loggée via `logError`.
- **Populated** : barre de filtres en haut (sticky sur mobile sous le header), compteur, liste de cards (composant existant à réutiliser), pagination en bas. Mobile-first.

## Cas limites
- **Client avec exactement 10 réservations** : 1 seule page, contrôles de pagination masqués (pas désactivés).
- **`?page=999` invalide** : redirect 308 vers `?page=N` où N = dernière page valide. Si total = 0, ignorer le paramètre.
- **Filtre `?status=foo` invalide** : retomber silencieusement sur `all` (Zod safeParse).
- **Réservation dont la date est aujourd'hui même** : considérée "à venir" tant qu'elle est `CONFIRMED` (peu importe l'heure exacte, simple et lisible). Une fois `COMPLETED`, elle bascule en "passées".
- **Réservation `PENDING_PAYMENT`** : invisible sur cette page (cf. règle ci-dessus). Le client la retrouve via le lien email de checkout uniquement.
- **Changement de filtre** : reset automatique de `?page` à 1.
- **Client avec accents/caractères spéciaux dans son email** : aucun impact (pas de recherche texte en MVP).
- **Reverse-tabnabbing / accès via URL forgée** : la query filtre par `userId`, aucune fuite possible.

## Dépendances
- Server query existante `getMyBookings()` à étendre avec params `{ status, period, page, limit }`. Lieu : `src/server/queries/booking.queries.ts`.
- Composant card de réservation existant (`BookingCard` ou équivalent dans `src/components/features/bookings/`) — réutilisé tel quel.
- `nuqs` pour la sync URL ↔ state des filtres.
- `EmptyState` partagé (`src/components/shared/EmptyState.tsx`).
- `loading.tsx` et `error.tsx` à ajouter dans `src/app/[locale]/(protected)/account/bookings/` s'ils n'existent pas déjà.

## Hors-périmètre explicite
- Pas de recherche texte libre (par nom d'événement, encaveur, référence) — V2.
- Pas de tri manuel par le client (autre que défaut).
- Pas d'export CSV/PDF de l'historique — V2.
- Pas de filtre multi-statuts simultanés (ex : `upcoming + cancelled`).
- Pas d'affichage des bookings `PENDING_PAYMENT`.
- Pas de notification "vous avez une réservation imminente" sur cette page (rappels gérés par emails ENC-069 et cron rappels).

## Métriques de succès
- Temps de chargement page < 800 ms p75 (server query + render).
- Taux de clic sur "Trouver une expérience" depuis l'empty state > 30 %.
- Usage des filtres > 20 % des sessions sur la page (signal qu'ils répondent à un besoin réel).

## ❓ Questions ouvertes pour Sam
- **Filtre période en MVP ou pas ?** Avantage : utile pour clients fidèles avec 20+ résas. Inconvénient : alourdit l'UI sur mobile. **Reco Théo** : oui mais en `Select` simple (pas de date picker custom), 4 options figées suffisent.
- **Bookings `NO_SHOW` : dans "Passées" ou dans une catégorie séparée ?** **Reco Théo** : dans "Passées" (vue client = "ce qui n'est plus à venir"). Le statut est visible sur la card.
- **Page size = 10 ou 20 ?** 10 est plus lisible mobile, 20 réduit la pagination. **Reco Théo** : 10 (mobile-first, on optimise scroll plutôt que densité).
