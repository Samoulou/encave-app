# UAT-S13 — Balayage emails & crons (checklist)

> **Parcours** : transverse · **Flags** : état de fin de vague 2 (tous ON
> sauf `BOOKING_FEE`) · **Durée** : ~90 min · **Device** : desktop
> **Référence** : [UAT-EMAIL-CHECKLIST.md](../UAT-EMAIL-CHECKLIST.md) — c'est
> elle qu'on remplit pendant cette session.

## Objectif

Clôturer la colonne « statut » des **22 emails** (triple source : Gmail →
Resend → `email_logs`), déclencher les agrégats (`daily-digest`,
`weekly-summary`), trancher la dette unsubscribe, vérifier la règle de locale
(`Booking.locale`), et consigner l'état des crons Vercel.

## Prérequis

- [ ] Les sessions S1–S11 ont produit la matière (bookings, bons, requests,
      no-show, boucle vin) — la plupart des 22 emails sont déjà partis.
- [ ] Accès au dashboard Resend + console Neon.

## Étapes

### A. Passage en revue des 22 emails

| #   | Action / attendu                                                                                                                               | PASS | FAIL |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 1   | Dérouler [UAT-EMAIL-CHECKLIST.md](../UAT-EMAIL-CHECKLIST.md) email par email : chaque ligne passe à `OK` / `KO` / `N/T` avec la session source | [ ]  | [ ]  |
| 2   | Spot-check rendu Gmail (mobile + desktop) sur 5 emails clés : #1, #3, #7, #9, #13 — header/charte, un seul CTA, pas en spam                    | [ ]  | [ ]  |
| 3   | SQL global : aucun `failed` inexpliqué (requêtes ci-dessous)                                                                                   | [ ]  | [ ]  |

```sql
SELECT type, status, COUNT(*) FROM email_logs
GROUP BY type, status ORDER BY type;
SELECT type, "errorMessage", "createdAt" FROM email_logs
WHERE status = 'failed' ORDER BY "createdAt" DESC;
```

### B. Agrégats : daily-digest & weekly-summary (#17)

| #   | Action / attendu                                                                                                                                                                             | PASS | FAIL |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 4   | `curl -H "Authorization: Bearer $CRON_SECRET" https://encave-dev.vercel.app/api/cron/daily-digest` → 200 ; digest envoyé aux caves avec activité (email_logs `daily_digest`)                 | [ ]  | [ ]  |
| 5   | `curl -H "Authorization: Bearer $CRON_SECRET" https://encave-dev.vercel.app/api/cron/weekly-summary` → 200 ; récap hebdo #17 (`weekly_summary`) — contenu : stats de la semaine, lien relevé | [ ]  | [ ]  |
| 6   | Relancer chacun une 2e fois → pas de doublon le même jour (dédup) ou comportement documenté — consigner                                                                                      | [ ]  | [ ]  |
| 7   | Rappels : `curl …/api/cron/reminders` hors 18 h Zurich → le bloc J-1 ne part pas (garde), le bloc 2 h tourne — un booking à ~2 h reçoit son rappel                                           | [ ]  | [ ]  |

### C. Dette unsubscribe (décision à acter)

Constat connu (CLAUDE.md §Known Debt) : les 3 emails d'agrégat (DailyDigest,
WeeklySummary, PostExperienceFollowUp) n'ont **pas** d'`unsubscribeUrl`
tokenisé — fallback sur la page statique `/unsubscribe` (la route tokenisée
`/api/unsubscribe/[token]` existe mais n'a pas de producteur).

| #   | Action / attendu                                                                                                                            | PASS | FAIL |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 8   | Vérifier le lien unsubscribe des emails #17/digest reçus → confirme le fallback statique                                                    | [ ]  | [ ]  |
| 9   | **Décision Sam** (consigner ici + rapport de sortie) : ☐ P1 à corriger avant launch · ☐ dette acceptée (avec échéance) — signature : `____` | [ ]  | [ ]  |
| 10  | Le lien de désinscription du #3 (récap dégustation, `client_email_preferences`) fonctionne, lui, en tokenisé (vérifié S10-E)                | [ ]  | [ ]  |

### D. Locale des emails client (`Booking.locale`)

| #   | Action / attendu                                                                                                                       | PASS | FAIL |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 11  | Faire un booking **en `/de/`** (invité, `sam.copp8+client-de@gmail.com`) chez une cave « fr » → email #1 en **allemand** (dates de-CH) | [ ]  | [ ]  |
| 12  | `SELECT locale FROM bookings WHERE reference='ENC-…';` → `DE` ; les emails suivants du cycle (rappel, annulation) partiraient en DE    | [ ]  | [ ]  |
| 13  | L'email cave (#14) pour ce même booking part dans la locale de la cave/du compte encaveur (pas celle du client)                        | [ ]  | [ ]  |

### E. Crons Vercel : plan & preuve d'exécution

| #   | Action / attendu                                                                                                                                                                                                              | PASS | FAIL |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 14  | Vercel Dashboard → projet staging → **Settings → Cron Jobs** : les **18 entrées** de `vercel.json` sont actives (8× `process-scheduled-jobs?slot=`, 2× `reminders?window=`, 2× `tasting-sheet-reminder?window=`, 6 restantes) | [ ]  | [ ]  |
| 15  | **Plan Vercel** : Hobby = 2 crons max → les 18 entrées exigent ≥ Pro. Consigner le plan constaté : `____` (si Hobby → **blocker launch**, cf. Volet D E.4)                                                                    | [ ]  | [ ]  |
| 16  | Preuve d'exécution 24 h : logs Vercel (Functions) montrent les runs planifiés de la veille (ou consigner que staging vit en déclenchement manuel)                                                                             | [ ]  | [ ]  |

## Vigilances

- `status='skipped'` dans `email_logs` n'est pas un échec : gardes 18 h/21 h
  Zurich, opt-out, dédup quotidienne — vérifier la cause avant de compter KO.
- L'email #12 « vos billets » n'existe pas comme template distinct : le lien
  magique invité est porté par le #1 (écart §11.2 — la ligne #12 de la
  checklist se conclut « couvert par #1 »).
- `openedAt`/`clickedAt` ne se remplissent que si `RESEND_WEBHOOK_SECRET` et
  le tracking domaine sont configurés sur staging — sinon consigner N/T.

## Résultat

| Verdict global | PASS [ ] · FAIL [ ] | Date/heure : `____` |
| -------------- | ------------------- | ------------------- |

Anomalies ouvertes (`UAT-S13-yy`) : `____`

## Artefacts créés

```
Booking DE : ENC-__________ (locale DE)
Décision unsubscribe : ____________________
Plan Vercel constaté : ____________  ·  Nb crons actifs : ____
```
