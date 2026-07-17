# UAT-S05 — Onboarding encaveur, 2 voies

> **Parcours** : 13 · **Ancre** : P-14 (invitations), P-13 (emails Stripe)
> **Flags** : tous OFF · **Durée** : ~60 min · **Device** : desktop
> **Comptes** : `admin@encave.ch` (+ TOTP) ·
> `sam.copp8+encaveur-invit@gmail.com` · `sam.copp8+encaveur-self@gmail.com`

## Objectif

Les deux voies d'entrée encaveur : **invitation fondateur** (VERIFIED direct,
saute la file) et **self-service** (PENDING → email #22 à l'admin →
validation → #19 → wizard KYC Stripe). Plus l'anti-spam de l'email #18
(« action requise Stripe »).

## Prérequis

- [ ] Flags argent OFF (sans impact ici, état de référence).
- [ ] Admin connecté avec TOTP opérationnel.
- [ ] Les 2 boîtes Gmail `+encaveur-invit@` / `+encaveur-self@` accessibles.

## Étapes

### A. Voie invitation → VERIFIED direct

| #   | Action / attendu                                                                                                                                                         | PASS | FAIL |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ---- |
| 1   | Admin → `https://encave-dev.vercel.app/fr/admin/invitations` → créer une invitation pour `sam.copp8+encaveur-invit@gmail.com` (nom de domaine : « UAT Cave Invitation ») | [ ]  | [ ]  |
| 2   | Email d'invitation reçu sur `+encaveur-invit@` avec un lien `…/fr/invitation/{token}`                                                                                    | [ ]  | [ ]  |
| 3   | Ouvrir le lien (navigation privée) → créer le compte → le domaine est créé **VERIFIED** sans passage par la file d'attente                                               | [ ]  | [ ]  |
| 4   | SQL : `SELECT status, plan, "commissionRate" FROM wineries WHERE name = 'UAT Cave Invitation';` → `VERIFIED` + plan/commission fondateur                                 | [ ]  | [ ]  |
| 5   | Ré-ouvrir le même lien d'invitation → refus propre (token à usage unique) ; SQL : `SELECT "acceptedAt" FROM invitations ORDER BY "createdAt" DESC LIMIT 1;` non nul      | [ ]  | [ ]  |

### B. Voie self-service → PENDING → validation → #19

| #   | Action / attendu                                                                                                                                                                                               | PASS | FAIL |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 6   | Navigation privée : créer un compte `sam.copp8+encaveur-self@gmail.com` puis créer son domaine « UAT Cave Self » via l'onboarding (`/fr/onboarding/winery`)                                                    | [ ]  | [ ]  |
| 7   | Le domaine est en attente : l'utilisateur voit un écran de statut (pas de dashboard complet), la fiche publique n'existe pas                                                                                   | [ ]  | [ ]  |
| 8   | Email **#22** « nouveau domaine à valider » reçu côté admin (destinataire admin réel — sinon vérifier Resend/email_logs) avec CTA                                                                              | [ ]  | [ ]  |
| 9   | Admin → `/fr/admin/wineries/pending` → ouvrir « UAT Cave Self » → **Valider**                                                                                                                                  | [ ]  | [ ]  |
| 10  | SQL : `SELECT status, "verifiedAt", "verifiedBy" FROM wineries WHERE name='UAT Cave Self';` → `VERIFIED` + horodatage · `SELECT action FROM verification_logs ORDER BY "createdAt" DESC LIMIT 1;` → `APPROVED` | [ ]  | [ ]  |
| 11  | Email **#19** « domaine validé — bienvenue » reçu sur `+encaveur-self@` : CTA onboarding                                                                                                                       | [ ]  | [ ]  |
| 12  | Connecté `+encaveur-self@` → wizard : profil → **KYC Stripe** (`/fr/dashboard/stripe`) → lancer l'onboarding Express (mode test : tel `000 000 0000`, code SMS `000000`) — s'arrêter AVANT la fin              | [ ]  | [ ]  |
| 13  | Le dashboard affiche le statut Stripe « incomplet / action requise »                                                                                                                                           | [ ]  | [ ]  |

### C. Anti-spam email #18 (KYC incomplet)

Règle code (`src/lib/business-rules/stripe-action-email.ts`) : le #18 ne
repart que si le set `currently_due` **change** (hash) **ou** après un
cooldown de **7 jours** — ⚠ écart vs plan qui disait 24 h (§11.6 du plan
maître).

| #   | Action / attendu                                                                                                                                                                   | PASS | FAIL |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 14  | Après l'étape 12, un premier **#18** « action requise Stripe » est parti (boîte `+encaveur-self@` + `email_logs`)                                                                  | [ ]  | [ ]  |
| 15  | Rouvrir/toucher l'onboarding Stripe SANS compléter (déclenche des `account.updated`) → **pas de second #18** le même jour (hash inchangé + cooldown) — recompter dans `email_logs` | [ ]  | [ ]  |
| 16  | Antidater le cooldown puis re-déclencher un `account.updated` (toucher l'onboarding) → un second #18 part                                                                          | [ ]  | [ ]  |

```sql
UPDATE wineries SET "stripeActionEmailAt" = NOW() - INTERVAL '8 days'
WHERE name = 'UAT Cave Self';
```

### D. Refus (voie self-service, second domaine)

| #   | Action / attendu                                                                                                                 | PASS | FAIL |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 17  | Créer un 3e compte jetable (ex. `sam.copp8+encaveur-refus@gmail.com`) + domaine « UAT Cave Refus » → admin **Refuse** avec motif | [ ]  | [ ]  |
| 18  | Email **#20** « domaine refusé » reçu : motif visible, voie de recours · SQL `verification_logs` → `REJECTED` avec `reason`      | [ ]  | [ ]  |

## Vigilances

- La cave « UAT Cave Self » n'a pas de vrai compte Connect finalisé : ne pas
  l'utiliser pour des bookings payés (seule la cave 1 route l'argent).
- L'email #22 part vers l'admin : si l'adresse admin de staging est
  `admin@encave.ch` (invérifiable), conclure via Resend + `email_logs`.

## Résultat

| Verdict global | PASS [ ] · FAIL [ ] | Date/heure : `____` |
| -------------- | ------------------- | ------------------- |

Anomalies ouvertes (`UAT-S05-yy`) : `____`

## Artefacts créés

```
Invitation : token (8 premiers chars) ____________  cave : « UAT Cave Invitation »
Cave self-service : « UAT Cave Self »  wineryId ____________  acct_____________
Cave refusée : « UAT Cave Refus »
resendMessageId #22 ______ #19 ______ #18 (1er) ______ #18 (2e) ______ #20 ______
```
