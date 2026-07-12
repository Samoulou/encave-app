# ENC-092b — Enrichir section "Cette semaine" (détail jour par jour avec actions rapides)

## Objectif métier

Le dashboard encaveur actuel montre un compteur agrégé "X événements cette semaine". L'encaveur a besoin d'une vision jour par jour pour préparer ses sessions (prévenir l'équipe, anticiper les arrivées, préparer les bouteilles). On enrichit la section avec une vue 7 jours, le détail par jour (événements + inscrits), et des actions rapides (voir détail, scanner les QR codes à l'arrivée). C'est la "to-do list de la semaine" de l'encaveur.

## Acteurs

- **WINEMAKER** : sur son dashboard.

## Préconditions & déclencheurs

- Encaveur authentifié, winery `VERIFIED`.
- Route : `/[locale]/dashboard` (page d'accueil encaveur).
- Données fetched côté serveur via `getThisWeekAgenda(wineryId)`.
- "Cette semaine" = **7 jours glissants à partir d'aujourd'hui 00h00** (locale `Europe/Zurich`).

## User stories

- En tant qu'**encaveur**, je veux voir tous mes créneaux des 7 prochains jours, jour par jour, en un coup d'œil.
- En tant qu'**encaveur**, je veux voir pour chaque jour combien de personnes sont attendues au total.
- En tant qu'**encaveur**, je veux accéder en 1 tap au détail d'un événement pour préparer ma session.
- En tant qu'**encaveur**, je veux pouvoir scanner les QR de check-in sans passer par 3 menus.
- En tant qu'**encaveur**, je veux voir clairement les jours vides pour planifier des créneaux supplémentaires si besoin.

## Critères d'acceptation (Gherkin)

```gherkin
Scénario : semaine avec événements répartis
  Étant donné un encaveur avec 3 créneaux sur lundi, 1 sur jeudi, 0 sur les autres jours
  Quand il charge son dashboard
  Alors la section "Cette semaine" affiche les 7 jours avec date + jour de la semaine
  Et lundi montre 3 événements avec total inscrits agrégé
  Et jeudi montre 1 événement avec total inscrits
  Et les autres jours montrent "Calme — rien de prévu"

Scénario : action rapide voir détail
  Étant donné un jour avec au moins 1 créneau
  Quand l'encaveur tape sur la carte du jour
  Alors la liste des créneaux du jour se déplie (accordion)
  Et chaque créneau affiche : heure, titre événement, X/Y inscrits, badge complet si X=Y

Scénario : action rapide scan QR
  Étant donné un créneau qui démarre dans moins de 2 heures
  Quand l'encaveur déplie le jour
  Alors un bouton "Scanner les arrivées" est visible sur ce créneau
  Et tape le bouton ouvre la page check-in (route existante)

Scénario : jour passé dans la semaine glissante
  Étant donné on est mercredi et la fenêtre glissante inclut mercredi → mardi prochain
  Quand l'encaveur consulte
  Alors le jour courant est marqué "Aujourd'hui" et stylé
  Et les jours futurs sont navigables, pas de jour passé inclus

Scénario : semaine totalement vide
  Étant donné un encaveur sans aucun créneau futur dans les 7 jours
  Quand il charge son dashboard
  Alors la section affiche un état empty global
  Et le texte est "Calme cette semaine. C'est le moment idéal pour planifier de nouveaux créneaux."
  Et un CTA "Créer un événement" est proposé

Scénario : événement complet
  Étant donné un créneau dont la capacity est atteinte
  Quand l'encaveur déplie le jour
  Alors le créneau affiche un badge "Complet"
```

## Règles métier

- Fenêtre : **du jour J 00h00 à J+6 23h59** en timezone `Europe/Zurich` (locale `fr-CH`).
- Source : `SessionSlot` avec `startsAt` dans la fenêtre, joint sur `Experience` de la winery courante. Filtrer `status = PUBLISHED` ET expérience non `ARCHIVED`.
- Inscrits comptés = `Booking.status IN ('CONFIRMED', 'COMPLETED')`. Les `PENDING_PAYMENT` ne comptent pas dans l'agrégat affiché à l'encaveur (sinon faux espoirs).
- Tri créneaux du jour : par `startsAt` croissant.
- Carte "Aujourd'hui" mise en évidence (couleur primary, badge "Aujourd'hui").
- Bouton "Scanner les arrivées" : visible uniquement si `startsAt - now ≤ 2h` ET `endsAt > now` (créneau en cours ou imminent).
- Affichage compact mobile (cartes empilées) / horizontal desktop (7 colonnes ou scroll horizontal selon largeur).
- Format heure : `HH:mm` via `formatDate(date, 'time')` (formatter existant).
- Format date jour : "lun. 12 mai" via formatter i18n.
- Données fetchées en Server Component, query cachée avec tag `winery:${id}:agenda` invalidée par `invalidateExperienceCaches`.

## Copy FR définitive

| Élément                       | Clé i18n suggérée                    | Texte FR                                                   |
| ----------------------------- | ------------------------------------ | ---------------------------------------------------------- |
| Titre section                 | `Dashboard.thisWeek.title`           | Cette semaine                                              |
| Sous-titre                    | `Dashboard.thisWeek.subtitle`        | Les 7 prochains jours                                      |
| Badge aujourd'hui             | `Dashboard.thisWeek.today`           | Aujourd'hui                                                |
| Jour calme                    | `Dashboard.thisWeek.dayEmpty`        | Calme — rien de prévu                                      |
| Compte événements             | `Dashboard.thisWeek.eventsCount`     | {count, plural, =1 {1 événement} other {# événements}}     |
| Compte inscrits               | `Dashboard.thisWeek.guestsCount`     | {count, plural, =1 {1 inscrit} other {# inscrits}}         |
| Action voir détail            | `Dashboard.thisWeek.actions.view`    | Voir le détail                                             |
| Action scan QR                | `Dashboard.thisWeek.actions.scan`    | Scanner les arrivées                                       |
| Badge complet                 | `Dashboard.thisWeek.fullBadge`       | Complet                                                    |
| Empty section globale (titre) | `Dashboard.thisWeek.emptyTitle`      | Calme cette semaine                                        |
| Empty section globale (texte) | `Dashboard.thisWeek.emptyBody`       | C'est le moment idéal pour planifier de nouveaux créneaux. |
| Empty CTA                     | `Dashboard.thisWeek.emptyCta`        | Créer un événement                                         |
| Tooltip "X / Y inscrits"      | `Dashboard.thisWeek.capacityTooltip` | {booked} inscrit(s) sur {capacity} places                  |

## États UI

- **Loading** : skeleton de 7 cartes jour (Server Component → `loading.tsx` du dashboard, déjà existant).
- **Empty** : carte globale "Calme cette semaine" + CTA "Créer un événement".
- **Empty par jour** : libellé inline "Calme — rien de prévu" (gris doux).
- **Error** : carte d'erreur générique "Impossible de charger l'agenda. Réessaie." avec bouton retry (revalidation).
- **Populated** : 7 cartes ou liste verticale (mobile-first), chacune avec compteur + accordion détail.

Interaction :

- Tap sur carte jour → expand inline (pas de navigation).
- Tap sur créneau dans l'accordion → navigation `/dashboard/experiences/{slug}/slots/{slotId}`.
- Tap sur "Scanner" → navigation page check-in du créneau.

## Cas limites

- Encaveur avec 50 créneaux sur la semaine (cas extrême Pâques/Vendanges) : afficher d'abord les 3 premiers créneaux par jour avec "voir les N de plus".
- Créneau qui chevauche minuit (rare mais possible) : rattaché au jour de `startsAt`.
- Décalage timezone : toujours afficher l'heure dans la TZ de la winery (par défaut `Europe/Zurich`), pas celle du navigateur.
- Expérience archivée pendant la semaine mais dont les créneaux ont des bookings confirmés : on affiche le créneau quand même (l'encaveur doit honorer ses bookings).
- DST switch (mars/octobre) : utiliser `date-fns-tz` ou rester sur `localDateToUTC` du projet.

## Dépendances

- Query : nouvelle `getThisWeekAgenda(wineryId)` dans `src/server/queries/dashboard.queries.ts`.
- Composant : `src/components/features/dashboard/ThisWeekSection.tsx` (Server Component) + sous-composant client `ThisWeekDay.tsx` pour l'accordion.
- Réutilise : `formatDate` (formatters i18n), route check-in existante (cf. backlog QR check-in).
- Cache : `unstable_cache` avec tag `winery:${id}:agenda`, invalidé sur création/édition/annulation booking.

## Hors-périmètre explicite

- Pas de vue calendrier mensuelle (séparé, autre US).
- Pas d'export ICS de la semaine (peut s'ajouter).
- Pas de notifications push J-1 / H-2 (séparé).
- Pas d'édition inline depuis la section (l'encaveur passe par la page détail créneau).
- Pas de gestion multi-winery (1 dashboard = 1 winery).

## Métriques de succès

- Temps moyen pour accéder à un créneau du jour : < 5s (vs ~15s avant).
- Taux d'utilisation du bouton "Scanner les arrivées" depuis cette section vs depuis la page expérience.

## ❓ Questions ouvertes pour Sam

- **Tutoiement encaveur** : copy actuelle en "tu" ("Crée un événement", "C'est le moment idéal pour…"). Ma reco : vouvoyer (cf. récap général).
- Inclure ou pas les `PENDING_PAYMENT` dans le compteur d'inscrits ? Ma reco : non (pour ne pas créer de faux espoirs), mais à confirmer.
- Affichage week-end visuellement différencié (samedi/dimanche teinté) ?
