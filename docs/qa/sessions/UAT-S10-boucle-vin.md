# UAT-S10 — Boucle vin + fiche dégustation (mobile)

> **Parcours** : 9, 21 · **US** : US-230 · **Flags** : active `TASTING_SHEET`
> **Durée** : ~60 min · **Device** : **téléphone réel** (fiche ≤ 30 s) + desktop
> **Comptes** : `jean-rene@example.com` (cave 1) · `sam.copp8+guest@gmail.com`
> (client de la boucle)

## Objectif

La boucle produit n°5 du PRD : fiche dégustation remplie en ≤ 30 s sur mobile
→ email J+2 « vos coups de cœur » (#3) → page commande tokenisée → demande de
commande reçue par la cave. Plus : idempotence au re-cron, rappel 21 h (#21),
et le follow-up générique J+1 qui s'efface quand un récap est armé.

## Prérequis

- [ ] Matrice OFF vérifiée juste avant : onglet fiche dégustation masqué,
      jobs `TASTING_RECAP` non claimés par le drain.
- [ ] Activer `TASTING_SHEET` (`/fr/admin`).
- [ ] Cave 1 a **≥ 3 vins** au catalogue (`/fr/dashboard/wines` — seedés ;
      sinon en créer : nom, cépage, millésime, prix).
- [ ] Un booking **aujourd'hui** sur cave 1, payé, **scanné/check-in**
      (réutiliser le flux S7 : occurrence aujourd'hui, booking invité
      `+guest@`, payer, check-in). Référence notée dans les artefacts.

## Étapes

### A. CRUD vins (parcours 21)

| #   | Action / attendu                                                                                                                            | PASS | FAIL |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 1   | `https://encave-dev.vercel.app/fr/dashboard/wines` : créer « UAT Petite Arvine 2024 » à 32.00 CHF, éditer son prix, le désactiver/réactiver | [ ]  | [ ]  |

### B. Fiche dégustation ≤ 30 s mobile (parcours 21)

| #   | Action / attendu                                                                                                                                                                                     | PASS | FAIL |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 2   | **Téléphone réel**, connecté cave 1 : ouvrir la session du jour (détail de l'occurrence / du booking). **Chrono** : cocher 3 vins servis + valider → **`____` s (cible ≤ 30 s)**, cibles tactiles OK | [ ]  | [ ]  |
| 3   | SQL : `SELECT COUNT(*) FROM booking_wines WHERE "bookingId" = (SELECT id FROM bookings WHERE reference='ENC-…');` → 3                                                                                | [ ]  | [ ]  |
| 4   | Un job `TASTING_RECAP` existe pour ce booking : `SELECT status, "runAt" FROM scheduled_jobs WHERE "dedupeKey" = 'TASTING_RECAP:<bookingId>';` → PENDING, `runAt` ≈ fin de session + 48 h             | [ ]  | [ ]  |

### C. Email J+2 (#3) → page commande → demande cave (parcours 9)

| #   | Action / attendu                                                                                                                                                     | PASS | FAIL |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 5   | Antidater le job (SQL ci-dessous) + drainer → email **#3** « vos coups de cœur » sur `+guest@` : les 3 vins avec prix, CTA « Commander ces vins »                    | [ ]  | [ ]  |
| 6   | Le CTA ouvre `…/fr/booking/{id}/commande?token=…` **sans login** (navigation privée) : vins pré-listés, quantités éditables                                          | [ ]  | [ ]  |
| 7   | Envoyer la demande (1 tap) → confirmation ; la cave reçoit l'email de demande de commande avec les coordonnées client (Resend/email_logs, type `wine_order_request`) | [ ]  | [ ]  |
| 8   | SQL : `SELECT status, "clientEmail" FROM wine_order_requests ORDER BY "createdAt" DESC LIMIT 1;` → `NEW`, email du client ; items avec `priceAtRequest` snapshoté    | [ ]  | [ ]  |
| 9   | Re-taper le CTA de l'email → **pas de doublon** (1 demande par booking, contrainte unique)                                                                           | [ ]  | [ ]  |
| 10  | **Idempotence cron** : re-drainer → pas de 2e email #3 ; `SELECT status FROM scheduled_jobs WHERE "dedupeKey"='TASTING_RECAP:<bookingId>';` → `DONE`                 | [ ]  | [ ]  |

```sql
UPDATE scheduled_jobs SET "runAt" = NOW() - INTERVAL '1 hour'
WHERE "dedupeKey" = 'TASTING_RECAP:<bookingId>';
```

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://encave-dev.vercel.app/api/cron/process-scheduled-jobs
```

### D. Rappel 21 h (#21) + follow-up générique effacé

| #   | Action / attendu                                                                                                                                                                                                       | PASS | FAIL |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 11  | Créer un 2e booking aujourd'hui (check-in, **fiche NON remplie**). Lancer `curl …/api/cron/tasting-sheet-reminder` hors 21 h Zurich → `{"skipped":"not_local_reminder_hour"}` — **comportement correct** (garde DST)   | [ ]  | [ ]  |
| 12  | Si la session UAT tombe à 21 h Zurich : relancer → email **#21** à la cave (une seule fois par cave/jour). Sinon consigner « garde vérifiée, envoi non testé à l'heure »                                               | [ ]  | [ ]  |
| 13  | Follow-up J+1 générique : sur le booking à récap armé (étapes 2–4), lancer `curl …/api/cron/follow-ups` → **pas** d'email follow-up pour ce booking (le récap prime) — `email_logs` sans `follow_up` pour ce bookingId | [ ]  | [ ]  |

### E. Opt-out client

| #   | Action / attendu                                                                                                                                                                                                       | PASS | FAIL |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 14  | Lien de désinscription de l'email #3 → opt-out enregistré (`SELECT "marketingOptOut" FROM client_email_preferences WHERE email='sam.copp8+guest@gmail.com';` → true) ; un récap ultérieur pour cet email est `skipped` | [ ]  | [ ]  |

## Vigilances

- L'email #3 part dans la **locale du booking** (`bookings.locale`), jamais
  celle de l'encaveur — S14 croise avec un booking DE.
- Le lien commande utilise `recapTokenHash` (token frais minté à l'envoi du
  #3) — l'accessToken de confirmation ne donne PAS accès à la page commande.
- `EmailLog.status='skipped'` peut être un comportement correct (garde 21 h,
  opt-out) — lire la colonne `type` + contexte avant de déclarer FAIL.

## Résultat

| Verdict global | PASS [ ] · FAIL [ ] | Date/heure : `____` |
| -------------- | ------------------- | ------------------- |

Chrono fiche : `____` s (cible ≤ 30 s)

Anomalies ouvertes (`UAT-S10-yy`) : `____`

## Artefacts créés

```
Booking boucle : ENC-__________  bookingId ____________
Job TASTING_RECAP : dedupeKey TASTING_RECAP:____________
Lien commande tokenisé : ______________________________________
WineOrderRequest : id ____________
Booking fiche vide (#21) : ENC-__________
```
