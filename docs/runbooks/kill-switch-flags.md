# Runbook — Kill-switches (feature flags)

Règle delivery plan : **toute feature qui touche l'argent est coupable en
moins d'une minute, sans déploiement**.

## Couper / réactiver un flag

1. Admin → **`/admin`** (accueil admin, panneau « Feature flags » en bas
   de page — `FeatureFlagsPanel`, pas `/admin/compliance`) — toggle : effet
   immédiat (le `setFeatureFlag` revalide le tag de cache, qui purge aussi
   les pages ISR ayant lu le flag).
2. Secours (admin indisponible, ou site en `MAINTENANCE_MODE` : `/admin`
   affiche alors la page de maintenance) — SQL direct sur Neon. Les
   actions serveur lisent le flag avec un cache de 60 s ; une page publique
   ISR qui l'a consommé (ex. `/cadeaux`) peut mettre jusqu'à ~5 min de plus
   à changer d'état — le toggle admin reste la voie rapide :
   ```sql
   UPDATE feature_flags SET enabled = false WHERE key = 'GIFT_CARDS';
   ```
   (Une ligne absente = défaut du registre, c'est-à-dire OFF — sauf
   `OCCURRENCE_CAPACITY`.)

## Table flags × impact quand OFF

| Flag                  | Coupe                              | Effet client quand OFF                                         | Attention                                                                                                                                      |
| --------------------- | ---------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `BOOKING_FEE`         | Frais 2.50 CHF/billet              | Ligne « Frais de service » à 0                                 | Aucun impact sur bookings passés                                                                                                               |
| `GIFT_CARDS`          | Achat + saisie de bons, `/cadeaux` | Page cadeaux 404, champ code masqué                            | Les bons déjà vendus restent des engagements : le cron `reconcile-gift-transfers` skip quand OFF — le réactiver pour solder les transferts dus |
| `NO_SHOW_FEES`        | Empreinte carte + prélèvement      | Réservation gratuite classique                                 | Les empreintes déjà posées restent vaultées, aucun prélèvement possible                                                                        |
| `REQUESTS`            | `/sur-mesure` + offres             | Formulaire 404                                                 | Offres en cours : liens de paiement refusés tant que OFF                                                                                       |
| `TASTING_SHEET`       | Fiche dégustation + e-mail J+2     | Onglet masqué, jobs TASTING_RECAP skippés                      | Les jobs restent PENDING, rattrapés à la réactivation                                                                                          |
| `COLLECTIVE_EVENTS`   | Fiches événements collectifs       | Bandeau/grille masqués, ajout participants bloqué              | La billetterie de l'expérience porteuse reste active                                                                                           |
| `OCCURRENCE_CAPACITY` | ⚠️ INVERSÉ — default ON            | OFF = fallback capacité P-04 (`maxCapacity`, sans gate statut) | Le comptage des places est identique dans les deux états — jamais d'oversell ; ne couper qu'en urgence avérée                                  |

Flags env hors registre (lus par le middleware Edge, qui n'a pas accès à
la base) — flip = env Vercel + redeploy (~2 min), ce ne sont PAS des
kill-switches minute :

- `COMING_SOON` : gate de lancement (voir `src/lib/flags.ts`, plan P-16
  WS-I).
- `MAINTENANCE_MODE` : gel des écritures + page de maintenance (voir
  `restauration-db.md` § « Gel des écritures »).

## Après la coupure

1. Annoncer dans le canal d'astreinte (quoi, pourquoi, depuis quand).
2. Ouvrir l'incident (cause racine) — le flag ne revient ON qu'avec un fix
   identifié ou une fausse alerte démontrée.
3. Vérifier les engagements en cours du tableau ci-dessus (bons vendus,
   offres ouvertes, jobs PENDING).
