# Le produit

> État au 13.11.2026. Le détail technique est dans `CLAUDE.md` et `docs/ARCHITECTURE.md` ; l'inventaire des écrans et des emails dans `docs/PAGES-EMAILS.md`.

## En une phrase

Côté client, réserver une expérience autour du vin aussi facilement qu'une table au restaurant. Côté cave, un seul tableau de bord pour vendre, encaisser et accueillir, en moins de dix minutes par semaine.

## Pour qui

| Qui                                                                                        | Ce qu'il veut                                                                                                      |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| **L'encaveur** — domaine familial, peu de temps, tout sur le téléphone                     | Que le client réserve et paie seul ; répondre à une demande de groupe en cinq minutes ; ne plus subir les absences |
| **Le client** — 30 à 50 ans, sortie du week-end, mobile                                    | Trouver et réserver en deux minutes ; offrir une expérience sans se tromper de date                                |
| **L'organisateur de groupe** — entreprise, anniversaire, enterrement de vie de célibataire | Une sortie pour quinze personnes avec un budget, sans deux semaines d'allers-retours                               |
| **L'organisateur d'événement** — association, commune, interprofession                     | Une billetterie propre pour un événement à plusieurs caves                                                         |

## Ce qui existe

Tout est en ligne sur `main`, derrière le portail « bientôt disponible » d'`encave.ch` jusqu'au lancement du 16.11.2026. Chaque fonction qui touche à l'argent a un interrupteur dans `/admin`.

| Fonction                | Ce qu'elle fait                                                                               | Interrupteur        |
| ----------------------- | --------------------------------------------------------------------------------------------- | ------------------- |
| Réservation de créneaux | Dégustations, visites, ateliers : choix de la date, paiement TWINT ou carte, billet avec QR   | —                   |
| Frais de réservation    | 2.50 CHF par billet, ligne séparée                                                            | `BOOKING_FEE`       |
| Bons cadeaux            | Montant libre ou expérience précise, envoi à la date choisie, utilisation partielle           | `GIFT_CARDS`        |
| Demandes sur mesure     | Formulaire → offre de la cave → lien de paiement → billets                                    | `REQUESTS`          |
| Anti-absence            | Empreinte de carte, frais prélevés par la cave en cas d'absence                               | `NO_SHOW_FEES`      |
| Fiche de dégustation    | Les vins servis, puis un email deux jours après pour les commander                            | `TASTING_SHEET`     |
| Événements collectifs   | Un événement, plusieurs caves participantes, une billetterie, un organisateur encaissé        | `COLLECTIVE_EVENTS` |
| Espace encaveur         | Journée en cours, scan des billets (fonctionne hors ligne), versements Stripe, relevé mensuel | —                   |
| Administration          | Validation des caves, remboursements, utilisateurs, interrupteurs, santé des paiements        | —                   |

Trois langues : français, allemand, anglais.

## Ce qui vient

L'ordre ci-dessous date de juillet 2026. **Il est à revoir** à la lumière de l'ambition « n°1 de l'événement » : les trois premières lignes servent directement cette ambition, les suivantes servent la profondeur par cave.

| Chantier                             | Ce que c'est                                                                                       | Sert                             |
| ------------------------------------ | -------------------------------------------------------------------------------------------------- | -------------------------------- |
| **Billetterie de grands événements** | Capacité, contrôle d'accès et encaissement pour un événement de plusieurs milliers de visiteurs    | L'ambition n°1                   |
| **Agenda national**                  | Une page par région et par période : « que faire autour du vin ce week-end »                       | L'ambition n°1, le référencement |
| **Canaux de distribution**           | Synchroniser l'offre avec GetYourGuide et les offices de tourisme — étude avant tout développement | Le volume                        |
| Boutique vin                         | Vente des vins des caves inscrites, une commande par cave                                          | Le revenu récurrent              |
| Séjours                              | Nuitées à la cave, réservation par dates                                                           | Le panier moyen                  |
| Avis et widget                       | Avis vérifiés ; module de réservation à poser sur le site d'une cave                               | La confiance, la distribution    |
| Le Cercle                            | Club d'accès à des domaines et à des événements privés                                             | Le haut de gamme                 |

## Les principes

1. **Simple.** Un écran, un travail. Une fonction qu'il faut expliquer est mal conçue.
2. **Rapide.** Une page de découverte s'affiche en moins de 1,5 seconde en 4G ; le paiement tient en trois écrans.
3. **Fiable.** Jamais deux réservations pour la même place, jamais de paiement fantôme.
4. **L'encaveur d'abord.** Tout se fait depuis le téléphone, à la cave.
5. **Suisse.** TWINT, francs, loi sur la protection des données, prix TTC.
