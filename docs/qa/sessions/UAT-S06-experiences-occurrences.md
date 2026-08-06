# UAT-S06 — Expériences & occurrences (encaveur)

> **Parcours** : 14, 15 · **US** : US-101 (+ ADR-0002) · **Flags** : tous OFF
> **Durée** : ~60 min · **Device** : desktop
> **Compte** : `jean-rene@example.com` (cave 1)

## Objectif

Créer une expérience **ponctuelle** et une **récurrente avec blackouts**,
chronométrer « 12 occurrences visibles publiquement en < 60 s » (US-101), puis
vérifier les règles ADR-0002 : capacité jamais réduite sous le vendu,
fermeture forward-only.

## Prérequis

- [ ] Connecté `jean-rene@example.com`.
- [ ] Chronomètre prêt (téléphone).
- [ ] `OCCURRENCE_CAPACITY` ON (défaut — ne pas toucher).

## Étapes

### A. Expérience ponctuelle (parcours 14)

| #   | Action / attendu                                                                                                                                                                                       | PASS | FAIL |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ---- |
| 1   | `https://encave-dev.vercel.app/fr/dashboard/experiences/new` → créer « UAT Ponctuelle » : dégustation, 25.00 CHF, durée 90 min, capacité 8, **dates ponctuelles** : 3 dates × 2 heures (6 occurrences) | [ ]  | [ ]  |
| 2   | Validation bloquante : tenter prix 0 → refus ; capacité 0 ou 51 → refus ; durée 20 min → refus (bornes US-101 : prix > 0, capacité 1–50, durée 30–480)                                                 | [ ]  | [ ]  |
| 3   | Publier. **Démarrer le chrono.**                                                                                                                                                                       | [ ]  | [ ]  |
| 4   | Navigation privée : `…/fr/experiences/uat-ponctuelle` (slug généré) → les 6 occurrences sont réservables. **Arrêter le chrono** : `____` s (cible < 60 s)                                              | [ ]  | [ ]  |

### B. Expérience récurrente + blackouts (parcours 14)

| #   | Action / attendu                                                                                                                                                         | PASS | FAIL |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ---- |
| 5   | Créer « UAT Récurrente » : 30.00 CHF, capacité 6, récurrence **sam + dim × 10h/16h** sur les 3 prochaines semaines, avec **2 blackouts** (2 dates cochées au calendrier) | [ ]  | [ ]  |
| 6   | L'aperçu live des prochaines occurrences reflète la règle ET exclut les 2 blackouts                                                                                      | [ ]  | [ ]  |
| 7   | Publier. Chrono → fiche publique : **≥ 12 occurrences** proposées, aucune sur les dates blackoutées. Chrono : `____` s (cible < 60 s)                                    | [ ]  | [ ]  |
| 8   | SQL de recoupement (ci-dessous) : nombre d'occurrences persistées = attendu, `source = RECURRING`, aucune aux dates blackout                                             | [ ]  | [ ]  |

```sql
SELECT o.date, o."startTime", o.status, o."capacityOverride", o.source
FROM experience_occurrences o
JOIN experiences e ON e.id = o."experienceId"
WHERE e.slug = 'uat-recurrente'
ORDER BY o.date, o."startTime";
```

### C. ADR-0002 : capacité & fermeture (parcours 15)

| #   | Action / attendu                                                                                                                                                        | PASS | FAIL |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 9   | Réserver + payer **2 places** (invité) sur une occurrence de « UAT Récurrente »                                                                                         | [ ]  | [ ]  |
| 10  | `/fr/dashboard/experiences/[id]/sessions` → sur cette occurrence : tenter de baisser la capacité à **1** → **refus** (jamais sous le vendu) avec message clair          | [ ]  | [ ]  |
| 11  | Baisser la capacité à **2** (= le vendu exact) → accepté ; la fiche publique n'offre plus de place sur ce créneau                                                       | [ ]  | [ ]  |
| 12  | **Fermer** une AUTRE occurrence (sans vente) → elle disparaît de la fiche publique ; le booking existant de l'étape 9 reste intact (forward-only : fermer n'annule pas) | [ ]  | [ ]  |
| 13  | SQL : l'occurrence fermée a `status='CLOSED'` ; celle de l'étape 11 a `capacityOverride=2`                                                                              | [ ]  | [ ]  |
| 14  | Tenter de réserver l'occurrence fermée en re-sélectionnant le créneau sur la fiche → le créneau n'est pas proposé / refus propre                                        | [ ]  | [ ]  |

### D. Dupliquer

| #   | Action / attendu                                                                                                                   | PASS | FAIL |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 15  | `/fr/dashboard/experiences` → dupliquer « UAT Ponctuelle » → brouillon pré-rempli, slug distinct, non visible publiquement (DRAFT) | [ ]  | [ ]  |

## Vigilances

- Les slugs sont uniques **par cave** (contrainte composite) — deux caves
  peuvent avoir le même slug, la cave 1 non.
- Le cron `generate-occurrences` (02:00 UTC) matérialise les occurrences
  futures des récurrences ; si la fiche publique semble en retard, lancer :

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://encave-dev.vercel.app/api/cron/generate-occurrences
```

- Chronos consignés avec horodatage (exigence « vérification du plan »).

## Résultat

| Verdict global | PASS [ ] · FAIL [ ] | Date/heure : `____` |
| -------------- | ------------------- | ------------------- |

Anomalies ouvertes (`UAT-S06-yy`) : `____`

## Artefacts créés

```
UAT Ponctuelle : experienceId ____________  slug ____________  chrono ____ s
UAT Récurrente : experienceId ____________  slug ____________  chrono ____ s
Occurrence capée à 2 : id ____________ · Occurrence fermée : id ____________
Booking test capacité : ENC-__________
```
