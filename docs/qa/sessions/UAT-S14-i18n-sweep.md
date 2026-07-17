# UAT-S14 — Sweep i18n & devices (checklist)

> **Parcours** : transverse · **Flags** : état courant (tous ON sauf
> `BOOKING_FEE`) · **Durée** : ~60 min · **Device** : desktop + émulation
> mobile (devtools) · **Comptes** : `sam.copp8+client-de@gmail.com`,
> `sam.copp8+client-en@gmail.com`

## Objectif

fr est validé par S1–S13. Ici : 1 booking complet **de** + 1 **en**, sweep
des 10 pages principales dans les 2 locales (zéro clé i18n brute), formats
CHF/dates `de-CH`/`en-CH`, et un passage responsive.

## Étapes

### A. Booking complet DE

| #   | Action / attendu                                                                                                                                        | PASS | FAIL |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 1   | `https://encave-dev.vercel.app/de` → home entièrement en allemand (hero, sections, footer)                                                              | [ ]  | [ ]  |
| 2   | Parcours complet : catalogue → fiche → sheet → checkout → Stripe → succès, **tout en DE** (y compris la page checkout et les états d'erreur/validation) | [ ]  | [ ]  |
| 3   | Si S13-D déjà exécutée, réutiliser ce booking ; sinon payer ici (compte `+client-de@`) → email #1 en DE, billet DE                                      | [ ]  | [ ]  |
| 4   | Formats : prix `CHF 60.00` façon de-CH, dates au format allemand (ex. « Samstag, 21. November »), fuseau Europe/Zurich                                  | [ ]  | [ ]  |
| 5   | Annuler ce booking en DE → écran d'annulation + email #4 en DE, montants identiques au barème                                                           | [ ]  | [ ]  |

### B. Booking complet EN

| #   | Action / attendu                                                                       | PASS | FAIL |
| --- | -------------------------------------------------------------------------------------- | ---- | ---- |
| 6   | Même parcours complet sous `/en` (compte `+client-en@`) → succès + email #1 en anglais | [ ]  | [ ]  |
| 7   | Formats en-CH corrects (prix, dates)                                                   | [ ]  | [ ]  |

### C. Sweep top-10 pages × de/en (zéro clé brute)

Ouvrir chaque page dans les 2 locales ; chercher visuellement les clés brutes
(`xxx.yyy.zzz`), les textes restés en français, les débordements.

| #   | Page                                                                    | DE  | EN  |
| --- | ----------------------------------------------------------------------- | --- | --- |
| 8   | `/{loc}` (home)                                                         | [ ] | [ ] |
| 9   | `/{loc}/experiences` (+ filtres actifs, état vide via filtre absurde)   | [ ] | [ ] |
| 10  | `/{loc}/experiences/{slug}` (fiche + panneau résa)                      | [ ] | [ ] |
| 11  | `/{loc}/wineries` et `/{loc}/wineries/{slug}`                           | [ ] | [ ] |
| 12  | `/{loc}/cadeaux` (configurateur)                                        | [ ] | [ ] |
| 13  | `/{loc}/sur-mesure` (formulaire)                                        | [ ] | [ ] |
| 14  | `/{loc}/login` + `/{loc}/register` (+ messages d'erreur de validation)  | [ ] | [ ] |
| 15  | `/{loc}/dashboard/my-bookings` (+ détail, bouton annuler)               | [ ] | [ ] |
| 16  | `/{loc}/booking/{id}?token=…` (billet public)                           | [ ] | [ ] |
| 17  | `/{loc}/legal/terms`, `/{loc}/legal/privacy`, `/{loc}/mentions-legales` | [ ] | [ ] |

### D. Devices / responsive

| #   | Action / attendu                                                                                                              | PASS | FAIL |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 18  | Émulation mobile (375 px) : home, catalogue, fiche + sheet de résa, checkout — pas de débordement horizontal, CTA accessibles | [ ]  | [ ]  |
| 19  | Barre sticky mobile de la fiche (prix + « Réserver ») fonctionnelle                                                           | [ ]  | [ ]  |
| 20  | Console navigateur pendant le sweep : aucune erreur `IntlError` / `MISSING_MESSAGE`                                           | [ ]  | [ ]  |

## Vigilances

- Le sélecteur de langue doit préserver la page courante (pas de retour home).
- Dashboard encaveur et admin : **fr only** assumé (audience valaisanne) —
  ne pas ouvrir d'anomalie i18n sur ces surfaces.
- `npm run i18n:check` en CI garantit la parité des clés, pas la qualité :
  ce sweep cherche le français resté en dur et les clés brutes.

## Résultat

| Verdict global | PASS [ ] · FAIL [ ] | Date/heure : `____` |
| -------------- | ------------------- | ------------------- |

Anomalies ouvertes (`UAT-S14-yy`) : `____`

## Artefacts créés

```
Booking DE : ENC-__________ · Booking EN : ENC-__________
Pages KO (liste) : ______________________________________
```
