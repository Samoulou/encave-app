# UAT-S03 — Concurrence anti-survente (2 fenêtres)

> **Parcours** : 2 · **US** : US-201 · **Flags** : tous OFF
> **Durée** : ~45 min · **Device** : desktop, 2 contextes navigateur
> (fenêtre normale + fenêtre de navigation privée)

## Objectif

Complément humain du test de charge k6 : sur une occurrence à **3 places**,
deux clients simultanés tentent 2×2 billets → jamais plus de 3 vendus, et le
refus est **propre** (wording compréhensible, pas d'erreur technique).

## Prérequis

- [ ] Flags argent OFF.
- [ ] Préparer l'occurrence à 3 places sur une expérience **cave 1** :
      connecté `jean-rene@example.com` →
      `https://encave-dev.vercel.app/fr/dashboard/experiences` → ouvrir une
      expérience → calendrier des occurrences
      (`/fr/dashboard/experiences/[id]/sessions`) → sur une occurrence à
      J+3 : **ajuster la capacité à 3**. Noter :

```
Expérience : ______________________  slug : ______________
Occurrence : date __________  heure ______  capacité : 3
```

- Vérification SQL de départ (doit rendre 0 billet vendu) :

```sql
SELECT o.id, o."capacityOverride", COALESCE(SUM(b."guestCount"), 0) AS vendus
FROM experience_occurrences o
LEFT JOIN bookings b ON b."occurrenceId" = o.id
  AND b.status IN ('PENDING_PAYMENT', 'CONFIRMED')
WHERE o.date = 'YYYY-MM-DD' AND o."startTime" = 'HH:mm'
  AND o."experienceId" = (SELECT id FROM experiences WHERE slug = '<slug>' LIMIT 1)
GROUP BY o.id;
```

## Étapes — chorégraphie 2 fenêtres

Fenêtre A = navigateur normal (invité `sam.copp8+guest@gmail.com`) ·
Fenêtre B = navigation privée (invité, email différent, ex. `+client-en@`).

| #   | Action / attendu                                                                                                                                                                                                    | PASS | FAIL |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 1   | Ouvrir la fiche de l'expérience dans **les deux fenêtres**, sélectionner LA même occurrence, **2 personnes** chacune, s'arrêter juste avant « Continuer »                                                           | [ ]  | [ ]  |
| 2   | Cliquer « Continuer » dans A puis IMMÉDIATEMENT dans B (< 2 s d'écart) — le hold se crée au clic                                                                                                                    | [ ]  | [ ]  |
| 3   | **Exactement une** fenêtre atteint le checkout ; l'autre reçoit un refus **propre** : message compréhensible (plus assez de places), pas de stacktrace, pas de clé i18n brute — recopier le wording                 | [ ]  | [ ]  |
| 4   | Fenêtre gagnante : payer `4242…4242` → succès                                                                                                                                                                       | [ ]  | [ ]  |
| 5   | Fenêtre perdante : re-sélectionner **1 personne** (place restante) → hold OK → payer → succès (la dernière place se vend)                                                                                           | [ ]  | [ ]  |
| 6   | Retenter 1 personne de plus (n'importe quelle fenêtre) → refus : l'occurrence est pleine, l'UI la grise/barre                                                                                                       | [ ]  | [ ]  |
| 7   | SQL de comptage (ci-dessus) → `vendus = 3`, **jamais 4** — croiser avec le nombre de bookings `CONFIRMED` sur l'occurrence                                                                                          | [ ]  | [ ]  |
| 8   | Variante hold : refaire 1+2 sur une autre occurrence à 3 places mais NE PAS payer la fenêtre gagnante ; antidater son `expiresAt` (SQL S01-E) + `curl expire-pending-bookings` → la perdante peut réserver 2 places | [ ]  | [ ]  |

```
Wording du refus (étape 3) : _____________________________________________
```

## Vigilances

- Le comptage inclut `PENDING_PAYMENT` (les holds comptent) — c'est voulu :
  un hold réserve la place pendant 10 min.
- Si les deux fenêtres passent au checkout : **Blocker** (survente) — capturer
  immédiatement le SQL de comptage et les deux références.
- `OCCURRENCE_CAPACITY` doit rester ON (défaut) pendant ce test.

## Résultat

| Verdict global | PASS [ ] · FAIL [ ] | Date/heure : `____` |
| -------------- | ------------------- | ------------------- |

Anomalies ouvertes (`UAT-S03-yy`) : `____`

## Artefacts créés

```
Occurrence testée : id ______________  date ________ heure ______
Booking A : ENC-__________ (2 pers.)  ·  Booking B : ENC-__________ (1 pers.)
Variante hold : ENC-__________ (expiré) -> ENC-__________ (2 pers.)
```
