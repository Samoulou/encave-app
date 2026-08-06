# EnCave V3 — Business Model & Scaling

> **Version** : 1.0 — 3 juillet 2026
> **Statut** : validé (grille Pro 0% actée, remplace la grille du PRD v3.1 §9)
> **Nature des chiffres** : hypothèses de scénario central, à recaler chaque trimestre sur le réel. Les mécanismes sont fermes, les montants sont des ordres de grandeur.

---

## 1. Thèse économique

**Aucun modèle pur ne fonctionne seul ; c'est la séquence qui rend rentable.** Le transactionnel (fees + commissions) amorce la machine et finance l'acquisition de supply ; le MRR d'abonnements — vendu par la donnée que la phase transactionnelle a produite — construit la valeur. Le pitch commercial central : **« Aucun frais caché. Tu paies ton abonnement, le reste est à toi. »**

### Pourquoi les trois modèles purs sont rejetés

| Modèle                   | Pourquoi il échoue seul                                                                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Abonnement dès le jour 1 | Demander 79 CHF/mois avant d'avoir prouvé la valeur tue l'acquisition — or la supply est le risque n°1. Plafond bas (30 caves × 49 = 1'470 CHF/mois).                                                         |
| Commission pure          | Trauma Booking (15-18%) chez les encaveurs + **leakage** structurel : sur une marketplace où l'offreur rencontre physiquement le client, « appelez-moi en direct la prochaine fois » est le cancer du modèle. |
| Frais clients seuls      | 2.50 × 100 billets = 250 CHF/mois : couvre Stripe, pas le fondateur.                                                                                                                                          |

---

## 2. Phase 1 — Amorçage (16 nov 2026 → 31 mars 2027)

- **Encaveur : 0 CHF.** Programme Fondateurs (20 premières caves) : 0% de commission jusqu'au 31.03.2027. Caves suivantes : 10% (tarif de lancement).
- **Client : booking fee 2.50 CHF/billet**, affichée en ligne claire au checkout — jamais fondue dans le prix. Argument commercial côté cave : « le service de réservation, c'est le client qui le paie, pas vous ».
- **Objectif de la phase : pas le revenu.** On achète (1) la supply, (2) la preuve d'usage, (3) **la donnée qui vendra l'abonnement** : chaque dashboard accumule « EnCave vous a apporté X CHF ».
- KPIs de phase : caves actives, GMV, billets/mois, NPS encaveur. Le CA est un sous-produit.

## 3. Phase 2 — La grille (avril 2027)

|                                                            | **Découverte**                                                | **Pro**                             | **Domaine**                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------- |
| Prix                                                       | **0 CHF/mois**                                                | **79 CHF/mois**                     | **149 CHF/mois**                                                             |
| Commission expériences (Slot, Stay, Request, no-show fees) | 12%                                                           | **0%**                              | **0%**                                                                       |
| Commission Shop (vin)                                      | 8%                                                            | 8%                                  | **0%**                                                                       |
| Frais de paiement                                          | refacturés au coût réel (~2%) — on ne marge jamais sur Stripe | idem                                | idem                                                                         |
| Inclus                                                     | Tout le produit de base                                       | + relevés enrichis, stats avancées  | + widget site propre, mise en avant, multi-utilisateurs, support prioritaire |
| Pour qui                                                   | Tester sans risque, micro-caves                               | La cave active (≥ ~10 billets/mois) | La cave qui vend aussi son vin et ses nuitées                                |

**Fee client 2.50 CHF : constante sur tous les paliers.** Elle couvre les coûts variables quel que soit le plan de la cave.

### Les trois mécanismes qui font tenir la grille

1. **La bascule se vend seule.** Le dashboard Découverte affiche chaque mois : « La commission vous a coûté 133 CHF. Avec Pro, vous auriez gardé 54 CHF de plus. » Upgrade self-serve en 2 taps. Le seuil d'indifférence est à ~660 CHF de GMV/mois (79 ÷ 12%) — toute cave sérieuse le dépasse.
2. **Anti-leakage structurel.** L'encaveur Pro est à 0% : contourner EnCave ne lui rapporte rien et lui coûte l'outil (billets, rappels, encaissement, fiche dégustation). Il pousse lui-même ses clients vers la plateforme. Le leakage ne se combat pas par la police, il se dissout par l'alignement.
3. **Transparence totale = le pitch.** « Aucun frais caché » est vérifiable ligne par ligne sur le relevé mensuel : abonnement + frais de paiement au coût, point.

## 4. Unit economics (scénario central)

Hypothèses : panier Slot 45 CHF, frais de paiement blended ~2.2% + 0.30 (cartes/TWINT via Stripe).

| Flux                                   | Revenu EnCave                                         | Coût variable | Marge contributive                              |
| -------------------------------------- | ----------------------------------------------------- | ------------- | ----------------------------------------------- |
| Billet Slot, cave à 10-12%             | 2.50 + ~4.50-5.40                                     | ~1.35         | **~5.7-6.6 CHF/billet**                         |
| Billet Slot, cave Pro/Fondateur        | 2.50                                                  | ~1.35         | ~1.15 CHF/billet                                |
| Request (panier 400-1'500), Découverte | 2.50 + 48-180                                         | ~9-33         | **le flux le plus rentable/transaction**        |
| Cave Pro                               | 79 MRR + fees de son volume                           | ~0            | ~79 + 1.15 × billets                            |
| Bon cadeau                             | 2.50 à l'achat ; commission du palier à la rédemption | ~1.35         | + float de trésorerie entre achat et rédemption |

**Coûts fixes** : infra ~200-250 CHF/mois au launch (Vercel, Supabase, Trigger.dev, Upstash, Resend, Mapbox, Sentry — Axiom/PostHog en free tier), ~400-500 en scale. **Le point mort infra = 3 caves Pro.** Le vrai coût est le temps du fondateur — le CAC d'une cave ≈ 2-3 h de Sam.

### Scénario central fin 2027 _(50 caves actives, 500 billets/mois, mix 27 Découverte / 20 Pro / 3 Domaine)_

Abonnements ~2'000 + fees clients ~1'250 + commissions Découverte ~1'100 + Shop/Stay naissants ~300 ≈ **~4'650 CHF/mois brut → ~3'600 net** après paiements et infra. Un side-business rentable, pas encore un salaire : la marche suivante vient de la profondeur (§6.1).

## 5. Le Cercle (2027 S2 — levier premium)

Club d'accès, pas d'abonnement bouteilles : 100-150 membres × ~490 CHF/an = **49-73k CHF/an de cotisations**, + marge 15-20% sur les allocations trimestrielles curées (sommelier partenaire), + billetterie des événements privés. Effet système : canal de recrutement des domaines prestigieux + crédibilité. Gate déjà acté : 2-3 domaines haut de gamme + 1 sommelier identifiés avant toute ligne de code.

---

## 6. Scaling — la séquence

### Levier 0 — Linguistique avant géographique (2028 S1)

Les Alémaniques descendent déjà en Valais. **Activer le DE** (structurellement prêt : next-intl depuis le jour 1, coût = traduction seule) débloque la demande zurichoise/bâloise sur l'offre existante, **sans signer une cave de plus**. Le scale le moins cher de toute la roadmap. IT ensuite (Tessin + touristes).

### Axe 1 — Profondeur avant largeur (ARPU par cave)

La machine n'est pas « plus de caves », c'est plus de valeur par cave, dans l'ordre : **Stay** (paniers 180-400 CHF, vend l'abo Domaine tout seul, pitch anti-Booking) → **Shop + boucle dégustation→vin** (revenu récurrent par client final) → **Le Cercle** → **CRM, campagnes, benchmark** (« vous êtes dans le top 20% des caves de Sierre »). EnCave devient **l'OS de la cave** : couper l'abonnement devient impensable — c'est la rétention qui rend le MRR composable. Cible : **120-150 CHF/mois/cave active** toutes sources confondues.

### Axe 2 — Densité avant étendue (territoire)

Dominer le Valais d'abord : **100-150 caves sur ~600** — la densité crée l'effet réseau local (choix côté client, FOMO côté cave) qui rend chaque région suivante moins chère à ouvrir. Puis réplication du playbook : **Lavaux/Vaud 2028** (2ᵉ terroir emblématique, UNESCO), **Suisse alémanique côté offre 2029** (Zurich wineland, Grisons). L'expansion suisse ne demande **zéro changement produit** (TWINT, CHF, nLPD identiques) : pur go-to-market. **L'international attend la saturation suisse** — il casserait le moat local pour un CAC multiplié.

### Axe 3 — Canaux de demande qui scalent sans le fondateur

- **Billetterie officielle des grands événements** (Caves Ouvertes VS = 40'000+ visiteurs, marchés vignerons, Saint-Vincent) : acquisition massive à coût ~0 + légitimité institutionnelle.
- **B2B via Request** : sorties d'équipe et événements d'entreprise — le flux le plus rentable par transaction, démarchable en morte-saison.
- **Widget embarquable** : chaque cave qui l'installe fait d'EnCave l'infrastructure de réservation même hors marketplace — position à la Shopify, pas à la Booking.
- **White-label offices de tourisme** régionaux : option SaaS pure, marge 100%.

### Paliers (scénario central)

| Horizon  | Supply                                    | Volume                 | Revenu                       | Jalon                             |
| -------- | ----------------------------------------- | ---------------------- | ---------------------------- | --------------------------------- |
| Fin 2027 | ~100 caves Valais                         | 800-1'000 billets/mois | ~8-10k CHF/mois              | Valais dominé, grille prouvée     |
| Fin 2028 | ~250 caves (VS + Vaud), demande DE active | ~2'500 billets/mois    | ~30k CHF/mois (~350k ARR)    | Playbook répliqué 1×              |
| Fin 2029 | 400-500 caves, national                   | —                      | **500-800k ARR, marge 85%+** | Solo + Claude, l'OS du vin suisse |

## 7. La bifurcation (à ~500k ARR)

Deux chemins, tous deux légitimes : **(a) lifestyle business** ultra-rentable pilotable en ~10 h/semaine, dont le cash-flow finance les autres ventures — la lecture cohérente avec la stratégie barbell ; **(b) levée** pour l'arc alpin (Alsace, Autriche, Tyrol du Sud) — à ne déclencher **que si** un concurrent financé attaque la Suisse. Décision à cette date, pas avant ; rien dans l'architecture ne ferme l'une ou l'autre voie.

## 8. Risques du modèle & garde-fous

| Risque                                   | Garde-fou                                                                                                   |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Leakage résiduel (Découverte)            | Mesure proxy : ratio visiteurs scannés → réservations répétées ; la vraie réponse est la migration vers Pro |
| Pro à 79 trop cher pour micro-caves      | C'est le rôle de Découverte 0 CHF — une cave à 3 billets/mois y est _bien_ et coûte ~0                      |
| Churn abonnements                        | La profondeur produit (Axe 1) est la stratégie de rétention ; alerte si churn mensuel Pro > 2%              |
| Saisonnalité (creux jan-fév, nov)        | Bons cadeaux (Noël), Request B2B (année entière), Stay (étale la saison), Cercle (annuel)                   |
| TVA : assujettissement au seuil 100k CHF | Anticipé : prix affichés TTC, structure comptable prête dès l'entité créée                                  |
| Dépendance Stripe (coûts, TWINT)         | Frais refacturés au coût = neutre ; plan B Datatrans documenté (ADR)                                        |

## 9. KPIs business

**North star business : MRR + marge contributive mensuelle.** Suivi mensuel : GMV, take rate blended (cible 8-11% en phase 2), % caves Pro+ (cible 40% des actives à fin 2027), ARPU cave, billets/cave/mois, churn Pro, CA bons cadeaux (déc), part Request dans la GMV, passif bons cadeaux (comptable).
