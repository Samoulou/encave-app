# UAT-S09 — Sur-mesure A→Z (2 casquettes)

> **Parcours** : 11, 19 · **US** : US-240 · **Flags** : active `REQUESTS`
> **Durée** : ~90 min · **Device** : desktop
> **Comptes** : `sam.copp8+client-fr@` (client) · `jean-rene@example.com`
> (cave 1 — la seule qui peut encaisser)

## Objectif

Le cycle complet : formulaire client → #8 (SLA 48 h) → offre encaveur
(chrono ≤ 5 min) → #9 avec lien de paiement tokenisé → paiement → billets.
Plus : relance unique avant échéance (#10), clôture automatique à expiration,
escalade SLA 48 h.

> Écart plan vs code (§11.5 du plan maître) : « laissez EnCave proposer » est
> reporté — **la cave est obligatoire** sur le formulaire au launch.

## Prérequis

- [ ] Matrice OFF vérifiée juste avant : `/fr/sur-mesure` → 404, lien de
      paiement d'une offre seedée refusé.
- [ ] Activer `REQUESTS` (`/fr/admin`).
- [ ] Chronomètre prêt (offre ≤ 5 min).

## Étapes

### A. Demande client → #8 / #15 (parcours 11)

| #   | Action / attendu                                                                                                                                                                      | PASS | FAIL |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 1   | `https://encave-dev.vercel.app/fr/sur-mesure` (connecté `+client-fr`) : remplir — cave **Domaine Germanier**, date souhaitée J+21, 8 personnes, budget 800 CHF, description ≥ 10 car. | [ ]  | [ ]  |
| 2   | Soumission → accusé immédiat avec le **délai 48 h** annoncé + référence `REQ-XXXXXXXX`                                                                                                | [ ]  | [ ]  |
| 3   | Email **#8** (client) : accusé, récap, délai 48 h · Email **#15** (cave — Resend/email_logs) : résumé + CTA répondre + rappel SLA                                                     | [ ]  | [ ]  |
| 4   | `/fr/dashboard/mes-demandes` (client) : la demande apparaît « En attente »                                                                                                            | [ ]  | [ ]  |
| 5   | SQL : `SELECT reference, status, "guestCount", budget FROM requests ORDER BY "createdAt" DESC LIMIT 3;` → `PENDING`                                                                   | [ ]  | [ ]  |

### B. Offre encaveur ≤ 5 min chrono → #9 (parcours 19)

| #   | Action / attendu                                                                                                                                                                                   | PASS | FAIL |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 6   | Connecté cave 1 → `/fr/dashboard/demandes` : badge/inbox à jour, ouvrir la demande. **Démarrer le chrono.**                                                                                        | [ ]  | [ ]  |
| 7   | Composer l'offre : message, **prix total 760.00 CHF** (all-in — pas de ligne frais de service, décision P-10), date/heure convenues, validité **3 jours** → envoyer. **Chrono : `____` (≤ 5 min)** | [ ]  | [ ]  |
| 8   | Email **#9** (client) : détail, prix 760.00, **échéance** explicite, CTA payer → lien `…/fr/sur-mesure/offre/{token}` qui s'ouvre **sans login** (navigation privée)                               | [ ]  | [ ]  |
| 9   | SQL : `SELECT status, "totalPrice", "expiresAt", "paymentToken" IS NOT NULL AS has_token FROM request_offers ORDER BY "createdAt" DESC LIMIT 1;` → `SENT`, 76000, token présent                    | [ ]  | [ ]  |

### C. Paiement de l'offre → billets (parcours 11)

| #   | Action / attendu                                                                                                                                                                                              | PASS | FAIL |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 10  | Depuis la page offre : payer (`4242…4242`) → montant Stripe **760.00** exactement (all-in, pas de fee)                                                                                                        | [ ]  | [ ]  |
| 11  | Confirmation : booking émis (référence `ENC-…`), billet + QR ; email #1 reçu ; la demande passe « Payée » côté client ET côté cave                                                                            | [ ]  | [ ]  |
| 12  | SQL : offre `PAID` + `bookingId` rempli ; request `PAID` ; booking rattaché à l'expérience cachée `sur-mesure` de la cave (`isCustom`), `totalPrice=76000`, commission de la cave appliquée sur `platformFee` | [ ]  | [ ]  |
| 13  | Re-ouvrir le lien de paiement déjà payé → état « déjà payée », pas de second paiement possible                                                                                                                | [ ]  | [ ]  |

```sql
SELECT o.status, o."bookingId", r.status AS request_status,
       b."totalPrice", b."platformFee", b."wineryPayout", e.slug, e."isCustom"
FROM request_offers o
JOIN requests r ON r.id = o."requestId"
LEFT JOIN bookings b ON b.id = o."bookingId"
LEFT JOIN experiences e ON e.id = b."experienceId"
ORDER BY o."createdAt" DESC LIMIT 1;
```

### D. Relance unique #10 + clôture auto (parcours 19)

Créer une **2e demande** + offre (validité 2 jours) SANS la payer.

| #   | Action / attendu                                                                                                                                                                                                               | PASS | FAIL |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ---- |
| 14  | Antidater le job de relance (SQL ci-dessous) + drainer → email **#10** « offre bientôt expirée » (relance **unique**) ; `reminderSentAt` rempli                                                                                | [ ]  | [ ]  |
| 15  | Re-drainer → **pas de 2e relance**                                                                                                                                                                                             | [ ]  | [ ]  |
| 16  | Faire expirer l'offre : `UPDATE request_offers SET "expiresAt" = NOW() - INTERVAL '1 hour' WHERE id='…';` + antidater le job `REQUEST_OFFER_EXPIRY` + drainer → offre `EXPIRED`, demande clôturée ; le lien de paiement refuse | [ ]  | [ ]  |

```sql
-- relance (24 h avant échéance — « J-1 » du plan)
UPDATE scheduled_jobs SET "runAt" = NOW() - INTERVAL '1 hour'
WHERE "dedupeKey" = 'REQUEST_OFFER_REMINDER:<offerId>';
-- expiration
UPDATE scheduled_jobs SET "runAt" = NOW() - INTERVAL '1 hour'
WHERE "dedupeKey" = 'REQUEST_OFFER_EXPIRY:<offerId>';
```

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://encave-dev.vercel.app/api/cron/process-scheduled-jobs
```

### E. Escalade SLA 48 h (parcours 19)

| #   | Action / attendu                                                                                                                                                                                     | PASS | FAIL |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 17  | Créer une 3e demande, ne PAS y répondre. Antidater : `UPDATE requests SET "createdAt" = NOW() - INTERVAL '49 hours' WHERE reference='REQ-…';` + antidater son job `REQUEST_SLA_ESCALATION` + drainer | [ ]  | [ ]  |
| 18  | Email d'escalade SLA émis (vers la cave et/ou Sam — vérifier Resend/email_logs, type et destinataires)                                                                                               | [ ]  | [ ]  |
| 19  | `/fr/dashboard` (cave) : la demande > 24 h sans réponse remonte en alerte                                                                                                                            | [ ]  | [ ]  |

## Vigilances

- Le token de paiement d'offre est volontairement **en clair** en base
  (capability token style payment-link) — il doit survivre entre l'email #9
  et la relance #10 (même lien).
- L'offre est **all-in** : aucun frais de service ne s'ajoute, même quand
  `BOOKING_FEE` sera ON (S15 re-vérifie).
- Jobs REQUESTS : flag OFF → jamais claimés. Si un drain ne fait rien,
  vérifier `enabledTypes` dans la réponse du curl.

## Résultat

| Verdict global | PASS [ ] · FAIL [ ] | Date/heure : `____` |
| -------------- | ------------------- | ------------------- |

Chrono offre : `____` min (cible ≤ 5)

Anomalies ouvertes (`UAT-S09-yy`) : `____`

## Artefacts créés

```
Demande A : REQ-__________ -> offre payée : booking ENC-__________  pi_____________
Demande D : REQ-__________ -> offre expirée (relance #10 : resendMessageId ______)
Demande E : REQ-__________ -> escalade SLA
```
