# ENC-044b — Valider et tester les règles d'édition d'événement quand des bookings existent (prix, capacité, créneaux)

## Objectif métier
Un encaveur qui édite une expérience déjà publiée et déjà réservée peut casser la confiance client (prix changé après paiement, créneau supprimé, capacité réduite sous le nombre d'inscrits). On formalise et on verrouille les règles d'édition pour protéger les bookings confirmés tout en laissant à l'encaveur la souplesse d'augmenter la capacité ou d'ajouter de nouveaux créneaux. Cette US ne crée pas l'écran : elle durcit les règles côté validateur Zod + action serveur et ajoute les tests.

## Acteurs
- **WINEMAKER** : édite ses expériences depuis le dashboard.
- **CLIENT** : protégé indirectement (son booking ne bouge pas sous lui).
- **ADMIN** : observateur (peut intervenir en cas de litige, hors scope ici).

## Préconditions & déclencheurs
- Expérience existante en `DRAFT`, `PUBLISHED` ou `ARCHIVED`.
- Bookings existants définis comme : `Booking.status IN ('CONFIRMED', 'COMPLETED', 'PENDING_PAYMENT')` rattachés à un `SessionSlot` de cette expérience.
- Déclencheur : soumission du formulaire d'édition (`updateExperience` action) ou d'un créneau (`updateSessionSlot`).
- La règle s'applique au **niveau créneau** pour capacité/horaires et au **niveau expérience** pour prix/contenu.

## User stories
- En tant qu'**encaveur**, je veux corriger une faute de frappe dans la description même si des gens ont déjà réservé.
- En tant qu'**encaveur**, je veux pouvoir augmenter la capacité d'un créneau qui marche bien, sans toucher aux bookings en cours.
- En tant qu'**encaveur**, je veux comprendre clairement pourquoi je ne peux pas baisser le prix d'un événement déjà réservé.
- En tant que **client confirmé**, je veux la garantie que mon créneau, mon prix et ma date ne changent pas après paiement.

## Critères d'acceptation (Gherkin)

```gherkin
Scénario : édition d'un champ libre sur expérience avec bookings
  Étant donné une expérience PUBLISHED avec 3 bookings CONFIRMED
  Quand l'encaveur modifie la description, les photos, les langues parlées ou la localisation textuelle
  Alors la modification est acceptée
  Et aucun booking n'est altéré

Scénario : tentative de modification du prix avec bookings existants
  Étant donné une expérience avec au moins 1 booking dans (CONFIRMED, COMPLETED, PENDING_PAYMENT)
  Quand l'encaveur soumet un prix différent
  Alors le validateur Zod renvoie une erreur "PRICE_LOCKED"
  Et la copie affichée est "Le prix est figé car des clients ont déjà réservé. Crée un nouvel événement pour proposer un tarif différent."

Scénario : augmentation de capacité d'un créneau
  Étant donné un SessionSlot avec capacity = 8 et 5 bookings CONFIRMED
  Quand l'encaveur passe la capacity à 10
  Alors la modification est acceptée
  Et l'historique log "capacity_increased" est tracé

Scénario : tentative de réduction de capacité sous le nombre de bookings
  Étant donné un SessionSlot avec capacity = 8 et 5 bookings CONFIRMED
  Quand l'encaveur tente de passer la capacity à 4
  Alors le validateur renvoie "CAPACITY_BELOW_BOOKED" avec le compte actuel
  Et l'UI affiche "Impossible : 5 personnes ont déjà réservé ce créneau."

Scénario : réduction de capacité au-dessus du seuil booké
  Étant donné un SessionSlot avec capacity = 10 et 5 bookings CONFIRMED
  Quand l'encaveur passe la capacity à 6
  Alors la modification est acceptée avec un warning UI
  Et la copie warning est "Tu réduis la capacité disponible. Aucun client déjà inscrit n'est impacté."

Scénario : tentative de modification de l'horaire d'un créneau réservé
  Étant donné un SessionSlot avec au moins 1 booking CONFIRMED
  Quand l'encaveur modifie startsAt ou endsAt
  Alors le validateur renvoie "SLOT_TIME_LOCKED"
  Et la copie affichée propose : "Le créneau est figé. Annule et crée un nouveau créneau si tu dois changer l'horaire."

Scénario : ajout d'un nouveau créneau
  Étant donné une expérience avec des bookings existants sur d'autres créneaux
  Quand l'encaveur ajoute un nouveau SessionSlot
  Alors la création est acceptée sans restriction

Scénario : suppression d'un créneau réservé
  Étant donné un SessionSlot avec au moins 1 booking actif
  Quand l'encaveur tente de le supprimer
  Alors le validateur renvoie "SLOT_HAS_BOOKINGS"
  Et la suppression est refusée tant que les bookings ne sont pas annulés/terminés

Scénario : suppression d'un créneau vide
  Étant donné un SessionSlot sans booking actif
  Quand l'encaveur le supprime
  Alors le créneau est supprimé (soft delete recommandé pour historique)
```

## Règles métier

### Matrice d'édition

| Champ | Sans booking | Avec booking actif |
|---|---|---|
| `title`, `description`, `shortDescription` | Libre | Libre |
| `images`, `coverImage` | Libre | Libre |
| `languages`, `meetingPoint`, `tags` | Libre | Libre |
| `duration` (minutes) | Libre | **Verrouillé** |
| `price` (cents) | Libre | **Verrouillé** |
| `experienceType` | Libre | **Verrouillé** |
| `status` (DRAFT/PUBLISHED/ARCHIVED) | Libre | PUBLISHED → ARCHIVED autorisé ; retour DRAFT interdit |
| `slug` | Libre tant qu'unique par winery | **Verrouillé** (URL partagées) |
| `SessionSlot.startsAt` / `endsAt` | Libre | **Verrouillé** |
| `SessionSlot.capacity` augmentation | Libre | Autorisée |
| `SessionSlot.capacity` réduction | Libre | Autorisée si ≥ bookings actifs |
| `SessionSlot` création | Libre | Autorisée |
| `SessionSlot` suppression | Libre | Refusée si bookings actifs |

- "Booking actif" = `status IN ('PENDING_PAYMENT', 'CONFIRMED')`. Les `COMPLETED` figent le créneau pour historique mais n'empêchent pas l'ajout de nouveaux créneaux.
- Toutes les vérifs côté **serveur** (Zod + check DB en transaction). Le client UI peut désactiver les inputs mais ne fait pas autorité.
- Erreurs renvoyées via `ActionResult` avec un `code` machine et un `messageKey` i18n.
- Logger chaque tentative refusée avec `logWarn` (winerySlug, experienceId, field).

## Copy FR définitive

| Élément | Clé i18n suggérée | Texte FR |
|---|---|---|
| Erreur prix verrouillé | `Experience.edit.errors.priceLocked` | Le prix est figé car des clients ont déjà réservé. Crée un nouvel événement pour proposer un tarif différent. |
| Erreur durée verrouillée | `Experience.edit.errors.durationLocked` | La durée ne peut plus être modifiée : des réservations sont en cours. |
| Erreur capacité sous booké | `Experience.edit.errors.capacityBelowBooked` | Impossible : {count} personne(s) ont déjà réservé ce créneau. La capacité minimale est de {count}. |
| Warning capacité réduite | `Experience.edit.warnings.capacityReduced` | Tu réduis la capacité disponible. Aucun client déjà inscrit n'est impacté. |
| Erreur horaire verrouillé | `Experience.edit.errors.slotTimeLocked` | Le créneau est figé : des clients y sont inscrits. Annule et crée un nouveau créneau si tu dois changer l'horaire. |
| Erreur suppression créneau | `Experience.edit.errors.slotHasBookings` | Ce créneau a des réservations actives. Annule-les avant de le supprimer. |
| Erreur slug verrouillé | `Experience.edit.errors.slugLocked` | L'URL de cet événement est figée pour ne pas casser les liens déjà partagés. |
| Toast succès édition | `Experience.edit.success` | Modifications enregistrées. |
| Badge "verrouillé" sur champ | `Experience.edit.lockedBadge` | Verrouillé — réservations en cours |
| Tooltip explicatif | `Experience.edit.lockedTooltip` | Ce champ est figé pour protéger les clients déjà inscrits. |

> Note ton : on tutoie l'encaveur sur le dashboard (à confirmer Sam, cf. questions ouvertes).

## États UI
- **Loading** : bouton "Enregistrer" en `isPending`, inputs disabled.
- **Empty** : N/A (page d'édition d'une ressource existante).
- **Error** : bannière haute du formulaire + erreur inline sur le champ fautif. Compteur de bookings affiché quand pertinent.
- **Populated** : formulaire pré-rempli, champs verrouillés grisés avec badge "Verrouillé" et tooltip.

## Cas limites
- Booking `PENDING_PAYMENT` créé il y a 29 min : compte comme actif. Le cron ENC-067 le purgera s'il n'est pas payé, débloquant l'édition au run suivant.
- Course condition : un booking est créé pile pendant que l'encaveur enregistre une réduction de capacité. La transaction Prisma doit re-vérifier le count avant `update`.
- Encaveur tente de passer en DRAFT une expérience PUBLISHED avec bookings : refusé (cohérence avec lifecycle CLAUDE.md).
- Archivage d'une expérience avec bookings CONFIRMED futurs : autorisé (n'annule pas les bookings, retire seulement de la liste publique).
- Modification de `meetingPoint` (point de rendez-vous) avec bookings confirmés : autorisé MAIS doit déclencher un email "Mise à jour du point de rendez-vous" aux inscrits (flag pour ENC ultérieur, hors scope ici).

## Dépendances
- Validateurs : `src/lib/validators/experience.ts` et `src/lib/validators/sessionSlot.ts` à étendre.
- Action : `src/server/actions/experiences/updateExperience.ts`, `updateSessionSlot.ts`, `deleteSessionSlot.ts`.
- Query helper : `countActiveBookingsForSlot(slotId)` et `countActiveBookingsForExperience(experienceId)` dans `src/server/queries/bookings.queries.ts`.
- ENC-067 (expiration `PENDING_PAYMENT`) limite les faux blocages.
- Tests : `tests/unit/server/actions/experiences/updateExperience.test.ts` (unauthorized, validation, happy path, lockedField).

## Hors-périmètre explicite
- Pas de notification email aux clients en cas de modif de champ "libre" (description, photos).
- Pas d'historique versionné des éditions (audit log seulement via `logInfo`).
- Pas de workflow "demande d'édition exceptionnelle" via admin.
- Pas de gestion du changement de `meetingPoint` avec re-notification (flag séparé).

## Métriques de succès
- 0 booking impacté rétroactivement par une édition (mesure via Sentry + plaintes support).
- < 2 % des tentatives d'édition génèrent une erreur "verrouillé" (sinon UX à revoir : peut-être manque-t-il un bouton "dupliquer l'événement").

## ❓ Questions ouvertes pour Sam
- **Tutoiement encaveur** : on tutoie sur tout le dashboard ? Ma reco : **vouvoiement courtois** (artisans pros, ton respectueux), mais j'ai écrit la copy en "tu" car c'est l'usage dominant des dashboards SaaS FR. À trancher pour TOUT le produit encaveur.
- Quand l'encaveur veut vraiment baisser un prix, on lui propose un parcours "dupliquer l'événement avec nouveau prix" ? Ou simple message "crée un nouvel événement" ?
- Faut-il proposer un workflow d'annulation groupée des bookings d'un créneau pour ensuite débloquer la modification du créneau ?
