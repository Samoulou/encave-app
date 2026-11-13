# Le modèle économique

> Condensé du modèle validé en juillet 2026. Les montants sont des hypothèses de scénario, à recaler sur le réel chaque trimestre.

> ⚠️ **Deux versions de l'offre coexistent au 13.11.2026.** Ce document décrit celle de juillet 2026, qui est aussi celle que le code applique. La page publique d'`encave.ch` en annonce une autre (voir « L'écart à trancher » plus bas). Tant que Sam n'a pas choisi, aucun agent ne présente de prix à une cave.

## La thèse

Aucun modèle seul ne suffit, c'est la séquence qui rend rentable. Les frais et commissions amorcent la machine et paient l'acquisition des caves. L'abonnement, vendu grâce aux chiffres que cette première phase produit, construit la valeur.

L'argument commercial : **« Aucun frais caché. Tu paies ton abonnement, le reste est à toi. »**

## Les prix

### Phase 1 — amorçage (16.11.2026 → 31.03.2027)

| Qui                               | Paie                                                                               |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| Client                            | **2.50 CHF de frais de réservation par billet**, sur une ligne séparée au paiement |
| Cave « Fondateur » (20 premières) | 0 % de commission jusqu'au 31.03.2027                                              |
| Autres caves                      | 10 % de commission                                                                 |

Le but de cette phase n'est pas le revenu. On achète l'offre, la preuve d'usage et la donnée qui vendra l'abonnement : chaque tableau de bord accumule « EnCave vous a apporté X CHF ».

### Phase 2 — la grille (dès avril 2027)

|                         | Découverte         | Pro                                       | Domaine                                       |
| ----------------------- | ------------------ | ----------------------------------------- | --------------------------------------------- |
| Abonnement              | 0 CHF              | 79 CHF par mois                           | 149 CHF par mois                              |
| Commission expériences  | 12 %               | 0 %                                       | 0 %                                           |
| Commission boutique vin | 8 %                | 8 %                                       | 0 %                                           |
| Pour qui                | Tester sans risque | La cave active (dès ~10 billets par mois) | La cave qui vend aussi son vin et ses nuitées |

Les frais de réservation client (2.50 CHF) et la refacturation des frais de paiement au coût s'appliquent à tous les paliers.

### Ce qui fait tenir la grille

1. **Le passage à Pro se vend seul.** Le tableau de bord Découverte affiche chaque mois ce que la commission a coûté. Le seuil d'indifférence est vers 660 CHF de ventes par mois (79 ÷ 12 %).
2. **Le contournement ne rapporte rien.** Une cave Pro est à 0 % : faire réserver « en direct » lui coûte l'outil sans rien lui faire gagner.
3. **La transparence est vérifiable** ligne par ligne sur le relevé mensuel.

## L'écart à trancher

|                             | Modèle de juillet 2026 (ce document, et le code)               | Page publique d'`encave.ch` (`ComingSoonPricing.tsx`)                                                                |
| --------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Entrée                      | Découverte : 0 CHF par mois + 12 % de commission               | Essai gratuit de 30 jours, puis abonnement                                                                           |
| Pro                         | 79 CHF par mois, 0 %                                           | 79 CHF par mois (39.50 pour les fondateurs)                                                                          |
| Domaine                     | 149 CHF par mois                                               | 199 CHF par mois (99.50 pour les fondateurs)                                                                         |
| Offre Fondateurs            | Les 20 premières caves à 0 % de commission jusqu'au 31.03.2027 | −50 % à vie pour les 10 premières caves                                                                              |
| Promesses du palier Domaine | Widget, mise en avant, plusieurs utilisateurs                  | Synchronisation avec valais.ch, GetYourGuide, Winaliste et Swiss Wine Tour ; widget ; chambres d'hôte ; club premium |

Trois conséquences tant que l'écart existe : la page publique promet des fonctions qui ne sont pas construites ; une cave qui s'inscrit attend un prix que le produit ne facture pas ; l'abonnement lui-même n'est pas encaissable (aucun paiement récurrent n'existe dans l'application).

## Ce que rapporte une vente (hypothèses de juillet 2026)

Panier moyen supposé : 45 CHF. Coût de paiement supposé : environ 1.35 CHF par billet.

| Vente                                                        | Marge pour EnCave                                                     |
| ------------------------------------------------------------ | --------------------------------------------------------------------- |
| Billet, cave à 10–12 %                                       | environ 5.70 à 6.60 CHF                                               |
| Billet, cave Pro ou Fondateur                                | environ 1.15 CHF                                                      |
| Demande sur mesure (panier 400 à 1 500 CHF), cave Découverte | 50 à 180 CHF — **la vente la plus rentable**                          |
| Cave Pro                                                     | 79 CHF par mois, plus les frais de réservation de son volume          |
| Bon cadeau                                                   | 2.50 CHF à l'achat, puis la commission du palier quand il est utilisé |

## Les leviers de croissance, par ordre de rendement

L'ambition « n°1 de l'événement vin » remet les trois premiers au sommet de la pile.

| Levier                                                                                             | Pourquoi                                                                               | État au 13.11.2026                                                                                      |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Billetterie des grands événements** (Caves Ouvertes du Valais, marchés vignerons, Saint-Vincent) | Acquisition massive à coût quasi nul, légitimité institutionnelle                      | Événements collectifs livrés (flag `COLLECTIVE_EVENTS`) ; aucun partenariat signé                       |
| **Entreprises et groupes** (demandes sur mesure)                                                   | La vente la plus rentable, démarchable en morte-saison                                 | Parcours livré (flag `REQUESTS`)                                                                        |
| **Bons cadeaux**                                                                                   | Pic de Noël, trésorerie entre l'achat et l'utilisation                                 | Livré (flag `GIFT_CARDS`)                                                                               |
| **Demande alémanique**                                                                             | Le site est déjà traduit en allemand : on ouvre un marché sans signer une cave de plus | Traduction prête, aucune action marketing                                                               |
| **Canaux de distribution** (GetYourGuide, Valais/Wallis Promotion)                                 | Volume apporté par des tiers                                                           | Étude en cours, voir [chantiers/channel-manager-discovery.md](./chantiers/channel-manager-discovery.md) |
| **Boutique vin** et boucle dégustation → achat                                                     | Revenu récurrent par client                                                            | Fiche dégustation livrée ; boutique à construire                                                        |
| **Séjours à la cave**                                                                              | Paniers de 180 à 400 CHF                                                               | À construire                                                                                            |
| **Widget de réservation** sur le site des caves                                                    | EnCave devient l'infrastructure, même hors de la place de marché                       | À construire                                                                                            |

## Les coûts

- **Variables** : frais de paiement Stripe, refacturés au coût.
- **Fixes** : hébergement et services (Vercel, Neon, Upstash, Resend, Sentry), quelques centaines de francs par mois. Montant réel à relever par Finance.
- **Le vrai coût est le temps.** C'est la raison d'être de cette organisation : le temps de Sam ne doit plus être le facteur limitant.

## Les risques du modèle

| Risque                                                      | Parade                                                                                    |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Les caves font réserver en direct pour éviter la commission | La migration vers Pro à 0 %                                                               |
| 79 CHF trop cher pour une petite cave                       | Le palier Découverte à 0 CHF                                                              |
| Creux de saison (janvier, février, novembre)                | Bons cadeaux, entreprises, séjours                                                        |
| TVA au-delà de 100 000 CHF de chiffre d'affaires            | Prix affichés TTC ; aucune TVA n'est calculée aujourd'hui — à anticiper avec un comptable |
| Dépendance à Stripe                                         | Frais refacturés au coût, donc neutres ; pas de plan B opérationnel à ce jour             |
