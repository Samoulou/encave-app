# P-XX — <Nom du package>

> **Statut** : plan / en cours / livré · **Branche** : `samuel/enc-XX-<slug>` (fallback sans Linear : `claude/p-XX-<slug>`) · **PR** : #
> **Sources** : `docs/ENCAVE-V3-DELIVERY-PLAN.md` §P-XX · items `L-xxx` du backlog · specs `docs/v3/…`

## 1. Objectif (2 lignes max)

Ce que l'utilisateur (client / encaveur / admin) peut faire après le merge, qu'il ne pouvait pas faire avant.

## 2. Scope

**IN** : (items L-xxx couverts, écrans, emails, modèles touchés)
**OUT** (explicitement) : (ce qu'on ne fait PAS dans ce package, et où c'est prévu)

## 3. Definition of Done (gate — copiée du delivery plan, complétée si besoin)

- [ ] …critères du delivery plan, ligne par ligne…
- [ ] …critères additionnels découverts au plan…
- [ ] Socle transverse (§3 du delivery plan) vert

## 4. Découpage technique

1. Migration / modèles (si applicable) — additive, invariants, tests de violation
2. Server actions / services / queries — avec tests unauthorized/validation/happy
3. UI — états loading/empty/error, i18n ×3, mobile-first
4. Emails / crons (si applicable)
5. Feature flag + vérification flag OFF

## 5. Tests & mesures

- Tests automatisés ajoutés : (liste)
- Mesures manuelles : (Lighthouse / concurrence / mode avion / scan réel…)
- Scénario de test manuel pour Sam (3-5 étapes reproductibles)

## 6. Risques & rollback

- Risque principal → mitigation
- Rollback : flag OFF en < 1 min / revert PR — vérifier que le rollback ne casse pas les données créées

## 7. Décisions ouvertes (à trancher AVANT ③ BUILD)

- [ ] … (sinon écrire « aucune »)
