# ENC-103b — UI "marquer no-show" sur page détail événement

## Objectif métier

Exposer côté UI la fonctionnalité de marquage no-show, dont la logique back existe déjà (`booking-dashboard.ts:265`). Pour l'encaveur, c'est l'outil qui clôt la session : ceux qui ne sont pas venus passent en `NO_SHOW` proprement, ce qui débloque les rapports financiers (commissionnable) et alimente la qualité de service (suivi clients récidivistes post-MVP).

## Acteurs

- **WINEMAKER** (acteur unique) : clique sur "Marquer absent" en face d'un booking `CONFIRMED` après la session.
- **CLIENT** : sujet passif. Reçoit potentiellement un email post-event different (hors scope cette US).

## Préconditions & déclencheurs

- Encaveur authentifié, propriétaire de la winery.
- Logique back existante : `booking-dashboard.ts:265` (à brancher).
- Page détail événement ENC-096 chargée, session passée ou en cours.
- Booking en statut `CONFIRMED` (un client présent qui a déjà été check-in → ne peut pas être marqué no-show).

## User stories

- En tant qu'**encaveur**, je veux pouvoir marquer un client absent (no-show) après une session, afin de clôturer la session proprement.
- En tant qu'**encaveur**, je veux pouvoir annuler un no-show par erreur, afin de corriger sans appeler le support.

## Critères d'acceptation (Gherkin)

```gherkin
Scénario : marquer no-show un booking CONFIRMED après la fin de session
  Étant donné que la session s'est terminée il y a 30 minutes
  Et qu'un booking est resté CONFIRMED (jamais check-in)
  Quand je clique sur "Marquer absent" en face de ce booking
  Alors une modale de confirmation apparaît
  Et après confirmation, le booking passe à NO_SHOW (via action existante)
  Et la ligne affiche un badge "Absent (no-show)"
  Et un toast neutre "{firstName} marqué absent" apparaît
```

```gherkin
Scénario : annuler un no-show par erreur
  Étant donné un booking NO_SHOW
  Quand je clique sur "Annuler le no-show"
  Alors une modale de confirmation apparaît
  Et après confirmation, le booking repasse à CONFIRMED
  Et le bouton "Marquer présent" redevient disponible si la session est encore dans la fenêtre
```

```gherkin
Scénario : tentative de no-show avant la fin de session
  Étant donné une session prévue dans 1 heure (pas encore commencée)
  Quand je consulte la ligne d'un CONFIRMED
  Alors le bouton "Marquer absent" est désactivé avec tooltip "Disponible à la fin de la session"
```

```gherkin
Scénario : tentative de no-show sur un COMPLETED
  Étant donné un booking COMPLETED
  Quand je consulte la ligne
  Alors aucun bouton "Marquer absent" n'est affiché
  (l'encaveur doit d'abord "Annuler le check-in" pour pouvoir marquer no-show)
```

```gherkin
Scénario : marquer no-show en masse (post-MVP, mentionné hors-scope)
  N/A — hors périmètre
```

## Règles métier

- **Bouton "Marquer absent" visible si** : `booking.status === CONFIRMED` ET `now() >= session.startsAt` (la session a au moins commencé). Idéalement on attend `endsAt` mais on autorise dès `startsAt` pour les retardataires manifestes.
- **Bouton "Annuler le no-show" visible si** : `booking.status === NO_SHOW`. Pas de fenêtre temporelle.
- **Confirmation modale obligatoire** : geste engageant côté commercial (un no-show injuste irrite le client). Pas de popover inline.
- **Action serveur** : appel à l'action existante (référence backlog : `booking-dashboard.ts:265`). À vérifier par Jonas / Nora qu'elle gère bien :
  - auth + ownership ;
  - transition `CONFIRMED → NO_SHOW` ;
  - `revalidateTag` cache détail événement.
- **Action sœur `undoNoShow`** : à créer si pas déjà présente. Transition `NO_SHOW → CONFIRMED`. Voir questions ouvertes.
- **Pas d'impact financier direct** dans cette US : le no-show ne déclenche **aucun** refund (cf. règle "<24h avant start → no refund" : si le client n'est pas venu, il est de toute façon hors fenêtre refund).
- **Optimistic UI** : ligne mise à jour immédiatement, rollback si erreur.
- **Log** : `logInfo({ action: 'no_show_mark' | 'no_show_undo', bookingRef, encaveurId })`.

## Copy FR définitive

| Élément                         | Clé i18n suggérée                                 | Texte FR                                                                                                          |
| ------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Bouton marquer absent           | `Dashboard.eventDetail.noShow.markAbsent`         | Marquer absent                                                                                                    |
| Bouton annuler no-show          | `Dashboard.eventDetail.noShow.undo`               | Annuler le no-show                                                                                                |
| Modale mark titre               | `Dashboard.eventDetail.noShow.confirm.title`      | Marquer {firstName} comme absent ?                                                                                |
| Modale mark body                | `Dashboard.eventDetail.noShow.confirm.body`       | Ce client n'est pas venu à la session. Aucun remboursement n'est dû. Vous pourrez annuler cette action si besoin. |
| Modale mark CTA                 | `Dashboard.eventDetail.noShow.confirm.cta`        | Marquer absent                                                                                                    |
| Modale mark cancel              | `Dashboard.eventDetail.noShow.confirm.cancel`     | Annuler                                                                                                           |
| Modale undo titre               | `Dashboard.eventDetail.noShow.undoConfirm.title`  | Annuler le no-show ?                                                                                              |
| Modale undo body                | `Dashboard.eventDetail.noShow.undoConfirm.body`   | {firstName} repassera en "Confirmée".                                                                             |
| Modale undo CTA                 | `Dashboard.eventDetail.noShow.undoConfirm.cta`    | Annuler le no-show                                                                                                |
| Modale undo cancel              | `Dashboard.eventDetail.noShow.undoConfirm.cancel` | Garder le no-show                                                                                                 |
| Toast succès mark               | `Dashboard.eventDetail.noShow.toast.marked`       | {firstName} marqué absent.                                                                                        |
| Toast succès undo               | `Dashboard.eventDetail.noShow.toast.undone`       | No-show annulé.                                                                                                   |
| Toast erreur réseau             | `Dashboard.eventDetail.noShow.toast.networkError` | Action impossible. Réessayez.                                                                                     |
| Toast forbidden                 | `Dashboard.eventDetail.noShow.toast.forbidden`    | Vous n'avez pas le droit d'effectuer cette action.                                                                |
| Tooltip désactivé (avant start) | `Dashboard.eventDetail.noShow.disabledTooltip`    | Disponible à la fin de la session                                                                                 |

## États UI

- **Loading (action en cours)** : spinner inline sur la ligne uniquement.
- **Empty** : pas pertinent ici (la liste vit dans ENC-096).
- **Error** : toast rouge + rollback.
- **Populated** : bouton "Marquer absent" en variant `outline` ou `ghost` (action secondaire, le primaire reste "Marquer présent" ENC-102).

## Cas limites

- **Encaveur marque tout le monde no-show puis se rend compte que la liste s'est trompée** : il peut annuler chaque no-show un par un. Pas de "annuler tout" en MVP.
- **Booking déjà annulé** : pas concerné (`CANCELLED_*` → pas de bouton no-show).
- **Conflit deux onglets** : optimistic UI synchronise au retour serveur.
- **Action lancée pendant un scan QR parallèle qui check-in le même booking** : transaction serveur sérialise. Si scan arrive d'abord, le booking est `COMPLETED`, l'action no-show retourne erreur "État incompatible".
- **Encaveur veut marquer no-show un mois après** : autorisé (pas de fenêtre haute, on accepte les corrections tardives).

## Dépendances

- **Autres US** :
  - ENC-096 (page hôte)
  - ENC-101 / ENC-102 (cohabitation des actions sur la même ligne)
  - Action existante `booking-dashboard.ts:265` (à câbler côté UI)
- **Données Prisma** :
  - `Booking.status` (transition CONFIRMED ↔ NO_SHOW)
  - Pas de nouveau champ requis. (Pas de `noShowAt`, voir question ouverte.)
- **Services externes** : aucun.

## Hors-périmètre explicite

- Email automatique au client après marquage no-show.
- Action "Marquer tout le monde no-show" en masse.
- Tableau de bord "clients no-show récurrents" (post-MVP).
- Pénalité financière supplémentaire au client (post-MVP, décision produit).
- Webhook ou notification temps réel.

## Métriques de succès

- 100 % des sessions ont leur statut "fermé" (tous les bookings en COMPLETED ou NO_SHOW) dans les 24h post-session en bêta Fondateurs.

## ❓ Questions ouvertes pour Sam

1. **Champ `noShowAt: DateTime?`** : on l'ajoute pour audit ? Proposition par défaut : **non en MVP** (l'`updatedAt` Prisma + le log Pino suffisent). À ajouter si tu veux un reporting fin no-show plus tard.
2. **Email "désolé qu'on vous ait raté"** au client marqué no-show : tu veux qu'on en envoie un ? Proposition par défaut : **non en MVP** (risque d'irriter si erreur encaveur). À discuter avec Léa pour le ton, à intégrer dans le cycle post-event séparé.
3. **Quand on peut marquer no-show** : dès `session.startsAt` ou seulement après `session.endsAt` ? Proposition par défaut : **dès `startsAt`** (l'encaveur sait qui n'est pas là à l'ouverture). Alternative : attendre `endsAt` pour éviter les marquages prématurés.
4. **L'action back de `booking-dashboard.ts:265`** : Nora doit vérifier qu'elle existe bien sous une forme exploitable et qu'elle est idempotente. Si elle ne couvre que CONFIRMED → NO_SHOW (et pas l'undo), il faut créer `undoNoShow`. À aligner avec Jonas dans la phase tech.
