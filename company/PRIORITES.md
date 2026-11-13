# Les priorités

> Tenu par le CEO, relu à chaque session. Dernière mise à jour : 13.11.2026.

## Maintenant — réussir le lancement du 16.11.2026

| #   | Quoi                                                                                                                            | Qui                           | État                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------ |
| 1   | Fusionner la branche d'audit `claude/audit-qualite-performance-dk8p8z` (corrections de sécurité, de paiement et de performance) | CEO → `ingenierie`, `qualite` | Poussée, à relire et fusionner |
| 2   | Valider les parcours de paiement sur Stripe en mode test — scénarios dans `docs/audits/2026-11-12-audit-pre-launch.md` §4.1     | `qualite`, `finance`          | Non fait — **bloquant**        |
| 3   | Valider la connexion (Google, code par email, administrateur avec double facteur) après la montée de version                    | `qualite`                     | Non fait — **bloquant**        |
| 4   | Renseigner l'identité légale : mentions légales, conditions générales, confidentialité                                          | Sam, préparé par `finance`    | **Bloquant, à Sam**            |
| 5   | Régler les variables de production, les événements Stripe, la surveillance externe                                              | Sam, liste dans l'audit §5    | **Bloquant, à Sam**            |
| 6   | Bascule : `COMING_SOON=false`, puis les contrôles de l'audit §7                                                                 | CEO → `ingenierie`            | Après 1 à 5                    |

Si l'un des points bloquants glisse, le lancement passe au 23.11.2026.

## Décisions ouvertes pour Sam

| #   | Décision                                                                                                                                                                       | Pourquoi maintenant                                                                                                                                                  | Recommandation du CEO                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Quelle offre vend-on aux caves ?** La page publique et le modèle écrit se contredisent ([MODELE.md](./MODELE.md), « L'écart à trancher »)                                    | La page est en ligne et recrute déjà                                                                                                                                 | Aligner la page sur ce que le produit facture réellement au lancement ; ne promettre la synchronisation des canaux qu'une fois l'étude conclue |
| D2  | **Que veut dire « n°1 » ?** ([CAP.md](./CAP.md))                                                                                                                               | Sans mesure, aucune priorité ne se justifie                                                                                                                          | Les trois critères proposés, mesurés chaque trimestre                                                                                          |
| D3  | **Le budget mensuel délégué** ([AUTONOMIE.md](./AUTONOMIE.md)) — 0 CHF aujourd'hui                                                                                             | Publicité, outils et prestataires en dépendent                                                                                                                       | Commencer bas, relever après quatre semaines d'essai                                                                                           |
| D4  | **La demande de fusion n°135** (« channel manager persistence layer ») ajoute du code de synchronisation des canaux                                                            | L'étude [channel-manager-discovery](./chantiers/channel-manager-discovery.md) exige une décision avant tout développement, et aucun de ses entretiens n'est consigné | La laisser en attente jusqu'à la conclusion de l'étude                                                                                         |
| D5  | **Le flux Git** : la documentation décrivait une branche `dev` de préproduction et un `main` protégé ; au 13.11.2026 il n'y a pas de branche `dev` et `main` n'est pas protégé | L'autonomie de fusion en dépend                                                                                                                                      | Protéger `main` (fusion par demande, vérifications automatiques obligatoires), préproduction sur les aperçus Vercel                            |

## Ensuite — les 30 jours après le lancement

1. **Remplacer les objectifs de scénario par des objectifs réels** à 90 jours, à partir des chiffres des deux premières semaines — `data`.
2. **Noël : les bons cadeaux.** Une campagne, une page d'atterrissage, les entreprises (cadeaux de fin d'année) — `marketing`, `entreprises`.
3. **Mesurer le marché suisse de l'événement vin** : qui vend quoi, à quel volume, sur quels mots-clés — `data`, `evenements`.
4. **Approcher l'organisation des Caves Ouvertes du Valais** pour l'édition 2027 — `evenements`, avec Sam pour la relation.
5. **Faire vendre chaque cave inscrite** : première expérience publiée, premier billet — `caves`.

## Plus tard

- Conclure l'étude sur les canaux de distribution, puis décider.
- Boutique vin, séjours, avis, widget ([PRODUIT.md](./PRODUIT.md)).
- Dette technique laissée ouverte par l'audit (§6) : passage à Next 15, politique de sécurité du contenu, refonte de la page d'accueil.

## Journal

Une ligne par décision ou par fait marquant, la plus récente en haut.

| Date       | Quoi                                                                                                                                                                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 13.11.2026 | Le CEO s'installe dans un projet Claude Code plutôt que dans Claude Duet (préversion réservée aux États-Unis). Constat : un fil de projet ne charge pas `.claude/agents/` ; les mandats citent donc la fiche de poste à lire.                                             |
| 13.11.2026 | Sam fixe le cap : n°1 suisse de l'événement vin, entreprise rentable. Autonomie totale à l'essai. Refonte de l'organisation : un CEO, dix spécialistes, ce dossier. Anciens agents, plans et spécifications supprimés (récupérables dans Git avant le commit de refonte). |
| 13.11.2026 | Constat : la page publique annonce une offre différente du modèle écrit et du code (décision D1).                                                                                                                                                                         |
| 13.11.2026 | Constat : pas de branche `dev`, `main` non protégé (décision D5).                                                                                                                                                                                                         |
| 12.11.2026 | Audit complet avant lancement, 14 commits de corrections. Lighthouse : 100 en accessibilité, bonnes pratiques et référencement ; performance mobile 79 à 97.                                                                                                              |
