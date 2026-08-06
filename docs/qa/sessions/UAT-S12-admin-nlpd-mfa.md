# UAT-S12 — Admin : gouvernance, nLPD, MFA (desktop)

> **Parcours** : 23, 24, 25, 27, 29, 30, 12 · **Ancres** : US-210 (24),
> US-250 (28→S11), P-14 (30), P-16 nLPD (12, 25), runbook kill-switch (29)
> **Flags** : état courant (pas de changement requis, sauf étape 18)
> **Durée** : ~90 min · **Device** : desktop
> **Comptes** : `admin@encave.ch` (+ TOTP) · `sam.copp8+client-fr@`
>
> ⚠ **Prérequis dur** : le gap **G-1 MFA** doit être validé sur un
> **preview** AVANT cette session (partie F exécutée sur la preview, le
> reste sur staging).

## Objectif

Le poste de pilotage : validation/refus/suspension de domaines, refund
support (avec le REFUS gift-funded — contournable = Blocker), anonymisation
nLPD avec intégrité comptable, suppression de compte client + export, santé
webhooks, toggle flags ≤ 60 s, et la MFA admin complète (G-1).

## Étapes

### A. Gouvernance domaines (parcours 23)

| #   | Action / attendu                                                                                                                                                                                              | PASS | FAIL |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 1   | `https://encave-dev.vercel.app/fr/admin/wineries` : liste + statuts. Ouvrir une cave VERIFIED secondaire (ex. Cave La Romaine) → **Suspendre** (motif)                                                        | [ ]  | [ ]  |
| 2   | Effets de la suspension : fiche publique inaccessible/dépubliée, expériences retirées du catalogue, la cave ne peut plus rien vendre                                                                          | [ ]  | [ ]  |
| 3   | Ré-activer la cave → tout revient                                                                                                                                                                             | [ ]  | [ ]  |
| 4   | SQL : `SELECT action, reason, "adminId" FROM verification_logs ORDER BY "createdAt" DESC LIMIT 5;` + `SELECT action, "targetType", reason FROM admin_actions ORDER BY "createdAt" DESC LIMIT 5;` → journalisé | [ ]  | [ ]  |

### B. Refund support (parcours 24)

| #   | Action / attendu                                                                                                                                                   | PASS | FAIL |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ---- |
| 5   | `/fr/admin/bookings` : rechercher un booking **carte pure** CONFIRMED (S2) par référence → remboursement **partiel** (ex. 20.00) avec motif obligatoire            | [ ]  | [ ]  |
| 6   | Stripe : refund partiel `re_…` 20.00 avec reverse_transfer + application fee proportionnels · SQL Q1 : `refundAmount=2000`, `refundIssued=true`                    | [ ]  | [ ]  |
| 7   | Email de notification du refund manuel (client + cave — Resend/email_logs `manualRefund*`)                                                                         | [ ]  | [ ]  |
| 8   | **Gift-funded** : rechercher le booking gift-funded de S8-E (ou en créer un) → tenter le refund manuel → **REFUS** avec le message renvoyant au runbook (CONFLICT) | [ ]  | [ ]  |
| 9   | Chercher un contournement (montant 0.01, re-tentatives, booking card=0 de S8-D) → toujours refusé. **Un contournement qui aboutit = Blocker immédiat**             | [ ]  | [ ]  |

### C. Utilisateurs & nLPD (parcours 25, 12)

| #   | Action / attendu                                                                                                                                                                            | PASS | FAIL |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 10  | `/fr/admin/utilisateurs` : rechercher un compte jetable (ex. `+encaveur-refus@` de S5) → **anonymisation nLPD**                                                                             | [ ]  | [ ]  |
| 11  | Intégrité post-anonymisation : SQL ci-dessous — l'identité est effacée (`anonymizedAt` posé, PII purgées) mais les **faits comptables** des bookings survivent (montants, statuts, refunds) | [ ]  | [ ]  |
| 12  | Changement de rôle sur un compte de test → journalisé dans `admin_actions`                                                                                                                  | [ ]  | [ ]  |
| 13  | **Export nLPD** (compte client `+client-fr`) : depuis le profil client (`/fr/dashboard/profile`), demander l'export → fichier reçu/téléchargé contenant bookings + données personnelles     | [ ]  | [ ]  |
| 14  | **Suppression de compte client** (double confirmation) sur un compte jetable → confirmation email, login refusé ensuite                                                                     | [ ]  | [ ]  |

```sql
SELECT id, email, name, "anonymizedAt" FROM users
WHERE email LIKE '%encaveur-refus%' OR "anonymizedAt" IS NOT NULL
ORDER BY "anonymizedAt" DESC NULLS LAST LIMIT 5;
SELECT reference, status, "totalPrice", "refundAmount", "visitorName"
FROM bookings WHERE "visitorEmail" ILIKE '%encaveur-refus%';
```

### D. Ops : santé webhooks & jobs (parcours 27)

| #   | Action / attendu                                                                                                                                                                                 | PASS | FAIL |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ---- |
| 15  | `/fr/admin` : indicateurs santé (webhooks/jobs) cohérents avec la réalité                                                                                                                        | [ ]  | [ ]  |
| 16  | `curl https://encave-dev.vercel.app/api/health` → 200 · `curl "https://encave-dev.vercel.app/api/health?deep=1"` → 200, checks `ok` (aucun `fail`)                                               | [ ]  | [ ]  |
| 17  | Q4 : `SELECT "stripeEventId", type, status FROM stripe_events WHERE status IN ('FAILED','PROCESSING') ORDER BY "updatedAt" DESC LIMIT 20;` → vide (ou justifié) · `scheduled_jobs` FAILED → vide | [ ]  | [ ]  |

### E. Toggle flags ≤ 60 s (parcours 29)

| #   | Action / attendu                                                                                                                                                                                    | PASS | FAIL |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 18  | `/fr/admin` → panneau flags : OFF→ON→OFF sur `GIFT_CARDS`, chronométrer l'effet sur `/fr/cadeaux` (navigation privée) à chaque bascule → `____` s / `____` s (≤ 60 s) — remettre l'état de la vague | [ ]  | [ ]  |

### F. MFA admin — G-1 (parcours 30) — **sur la preview dédiée**

URL preview : `____`

| #   | Action / attendu                                                                                                                                      | PASS | FAIL |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 19  | Admin enrôlé TOTP (setup forcé au 1er login : `/fr/admin-setup/2fa`) — le login mot de passe exige ensuite le code TOTP (`/fr/login/2fa`)             | [ ]  | [ ]  |
| 20  | **Login via Google** sur le compte admin → la session est révoquée + redirect `/fr/login/2fa` → challenge TOTP **exigé** avant tout accès `/fr/admin` | [ ]  | [ ]  |
| 21  | **Login via email-OTP** (code #11) sur le compte admin → même exigence de challenge TOTP                                                              | [ ]  | [ ]  |
| 22  | TOTP faux (6 chiffres au hasard) → refus, pas de session admin                                                                                        | [ ]  | [ ]  |
| 23  | Un CLIENT sans 2FA n'est PAS challengé (le forçage ne vise que les admins)                                                                            | [ ]  | [ ]  |

## Vigilances

- Étapes 8–9 : le refus gift-funded est un invariant financier (ADR-0003). Le
  message doit orienter vers le runbook `incident-paiement.md`, pas un refus
  muet.
- L'anonymisation ne doit JAMAIS toucher les montants/ledger — c'est le
  contrat « intégrité comptable » (audit trail nLPD).
- `?deep=1` coûte un appel Stripe + des counts DB — rate-limité 30/min, ne
  pas le marteler.

## Résultat

| Verdict global | PASS [ ] · FAIL [ ] | Date/heure : `____` |
| -------------- | ------------------- | ------------------- |

Anomalies ouvertes (`UAT-S12-yy`) : `____`

## Artefacts créés

```
Cave suspendue/réactivée : ____________
Refund partiel : ENC-__________  re_____________  (20.00)
Refus gift-funded : ENC-__________ (message : ____________________________)
Compte anonymisé : ____________ · Compte supprimé : ____________
Chronos flags : ______ s / ______ s · Preview G-1 : ____________
```
