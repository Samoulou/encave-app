# UAT-S11 — Événement collectif (2 devices)

> **Parcours** : 22, 28 · **US** : US-250 · **Flags** : active
> `COLLECTIVE_EVENTS` · **Durée** : ~60 min · **Device** : desktop +
> **2 téléphones/devices** pour le scan simultané
> **Comptes** : `jean-rene@example.com` (organisateur = cave 1) ·
> `robert@example.com` (cave participante) · `admin@encave.ch`

## Objectif

Un événement Slot `isCollective` : bandeau + grille des caves participantes +
programme sur la fiche publique ; UN organisateur payé (la cave de
l'expérience), billetterie centrale ; vue lecture participant **gated** ;
scan **multi-points** sans collision (2 scanners simultanés).

## Prérequis

- [ ] Matrice OFF vérifiée : bandeau/grille masqués sur la fiche de
      l'événement seedé, ajout de participants bloqué.
- [ ] Activer `COLLECTIVE_EVENTS` (`/fr/admin`).
- [ ] Le seed contient 1 événement collectif — le retrouver :

```sql
SELECT e.id, e.title, e.slug, w.slug AS organisateur
FROM experiences e JOIN wineries w ON w.id = e."wineryId"
WHERE e."isCollective" = true;
```

- [ ] Si l'organisateur seedé n'est PAS la cave 1, créer un événement
      collectif « UAT Jardin des Vins » sur la cave 1 (billetterie = argent
      réel → Connect obligatoire) avec une occurrence **aujourd'hui**.

## Étapes

### A. Composition & fiche publique (parcours 22, 28)

| #   | Action / attendu                                                                                                                                      | PASS | FAIL |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 1   | Côté organisateur (ou admin → `/fr/admin/events`) : ajouter **2 caves participantes** (dont Domaine des Muses) avec descriptif, ordre, logo optionnel | [ ]  | [ ]  |
| 2   | Fiche publique `…/fr/experiences/{slug}` : bandeau organisateur + grille participantes (logo ou photo de la cave en fallback) + programme             | [ ]  | [ ]  |
| 3   | Tenter d'ajouter une cave **non VERIFIED** (ex. « UAT Cave Refus » de S5) → refus (gate d'éligibilité)                                                | [ ]  | [ ]  |
| 4   | Billetterie : réserver + payer 2 billets (invité) → l'argent va à **l'organisateur seul** (PI destination = compte Connect cave 1, aucun split)       | [ ]  | [ ]  |

### B. Vue participant gated (parcours 22)

| #   | Action / attendu                                                                                                                                            | PASS | FAIL |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 5   | Connecté `robert@example.com` (cave participante) → `/fr/dashboard/evenements-participes` : l'événement apparaît avec stats (billets) + roster (nom, email) | [ ]  | [ ]  |
| 6   | Connecté `nicolas@example.com` (cave NON participante) → même page : l'événement n'apparaît **pas**                                                         | [ ]  | [ ]  |
| 7   | Suspendre la cave participante (admin → `/fr/admin/wineries/{id}` → suspendre) → sa vue participant se vide ; la dé-suspendre ensuite                       | [ ]  | [ ]  |

### C. Scan multi-points sans collision (parcours 22)

| #   | Action / attendu                                                                                                                                                | PASS | FAIL |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 8   | Ouvrir `/fr/dashboard/scan` **sur 2 devices** connectés au compte organisateur (cave 1)                                                                         | [ ]  | [ ]  |
| 9   | Billets A et B (étape 4 + 1 booking supplémentaire) : scanner A sur device 1 et B sur device 2 **simultanément** → 2 ✓ verts distincts                          | [ ]  | [ ]  |
| 10  | Créer un billet C, l'afficher sur un 3e écran, le scanner **en même temps sur les 2 devices** → **exactement un** ✓ et un ✗ « déjà scanné » (CAS check-in)      | [ ]  | [ ]  |
| 11  | SQL : `SELECT reference, status, "checkedInAt" FROM bookings WHERE reference IN ('ENC-A','ENC-B','ENC-C');` → 3 × `COMPLETED`, un seul `checkedInAt` par billet | [ ]  | [ ]  |

## Vigilances

- Le roster participant expose nom + email des inscrits → dette nLPD R-7
  couverte par les CGV (P-12/P-16) — vérifier que la vue n'expose **rien de
  plus** (pas de téléphone, pas de montants).
- Aucun split de paiement au launch : tout transite par l'organisateur —
  toute trace de transfert vers une cave participante = anomalie.

## Résultat

| Verdict global | PASS [ ] · FAIL [ ] | Date/heure : `____` |
| -------------- | ------------------- | ------------------- |

Anomalies ouvertes (`UAT-S11-yy`) : `____`

## Artefacts créés

```
Événement : experienceId ____________  slug ____________
Participantes : ____________ / ____________
Billets : A ENC-__________ · B ENC-__________ · C ENC-__________
```
