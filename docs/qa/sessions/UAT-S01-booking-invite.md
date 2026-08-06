# UAT-S01 — Booking invité A→Z (mobile réel)

> **Parcours** : 1, 7, 8, 31 · **US** : US-201, US-301 · **Flags** : tous OFF
> **Durée** : ~90 min · **Device** : téléphone réel (fr) + laptop (2e device)
> **Compte** : aucun (invité) — email `sam.copp8+guest@gmail.com`

## Objectif

Le parcours n°1 de la campagne : réserver en invité de bout en bout, et
prouver que l'email #1 porte un **QR scannable** et un **lien billet tokenisé
qui ouvre sans compte** (LE bug historique P-01). Couvre aussi la page
d'erreur (refus carte vs hold expiré) et la libération de place par cron.

## Prérequis

- [ ] Gates d'entrée J0 verts (UAT-CAMPAIGN §9.1) — notamment `E2E_TEST`
      absent sur staging et webhooks Stripe actifs.
- [ ] Les 6 flags argent OFF (`SELECT key, enabled FROM feature_flags;`).
- [ ] Choisir une expérience du **Domaine Germanier** (cave 1 — seule cave
      avec compte Connect : le paiement échoue sur les autres) avec une
      occurrence à J+2 ou plus. Noter :

```
Expérience choisie : ______________________  slug : ______________
Prix unitaire : ______ CHF  ·  Occurrence : date ________ heure ______
Commission cave au moment du booking (SQL ci-dessous) : ______
```

```sql
SELECT slug, "commissionRate", "cancellationPolicy"
FROM wineries WHERE slug = 'domaine-germanier';
```

## Étapes

### A. Réservation nominale (parcours 1, 31)

| #   | Action / attendu                                                                                                                                                          | PASS | FAIL |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 1   | Sur le téléphone (navigation privée), ouvrir `https://encave-dev.vercel.app/fr` → hero + recherche s'affichent, pas de clé i18n brute                                     | [ ]  | [ ]  |
| 2   | Naviguer vers `https://encave-dev.vercel.app/fr/experiences` → catalogue chargé, filtres opérants                                                                         | [ ]  | [ ]  |
| 3   | Ouvrir la fiche de l'expérience choisie → panneau de réservation : jour → heure (places restantes affichées) → 2 personnes, total live = prix × 2                         | [ ]  | [ ]  |
| 4   | CTA « Continuer » → page checkout (`/fr/experiences/[slug]/checkout`) : **compte à rebours 10:00** visible, récap exact, ligne « Frais de service » à **0.00** (flag OFF) | [ ]  | [ ]  |
| 5   | Saisir `sam.copp8+guest@gmail.com` + prénom/nom `UAT-Invite` + téléphone → payer                                                                                          | [ ]  | [ ]  |
| 6   | Page Stripe Checkout : méthodes proposées — noter si **TWINT** apparaît en premier et si **Link** est proposé (sinon fallback card-only, consigner — cf. Volet D Bloc F)  | [ ]  | [ ]  |
| 7   | Payer avec `4242 4242 4242 4242` (exp. future, CVC 123) → redirection `https://encave-dev.vercel.app/fr/booking/{id}/confirmation?session_id=…`                           | [ ]  | [ ]  |
| 8   | Page succès : billet inline avec **QR**, référence `ENC-XXXXXXXX`, boutons **PDF** et **.ics** fonctionnels, adresse de la cave                                           | [ ]  | [ ]  |

### B. Email #1 — la vérification n°1 de la campagne (parcours 8, 31)

| #   | Action / attendu                                                                                                                                                          | PASS | FAIL |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 9   | Boîte `sam.copp8+guest@gmail.com` : email #1 « confirmation + billet » reçu (inbox, pas spam), **en français**, montants au centime                                       | [ ]  | [ ]  |
| 10  | L'email contient le QR inline + un bouton/lien billet **tokenisé** vers `…/fr/booking/{id}?token=…` (PAS la homepage, PAS `/billets/…` — cette route n'existe pas)        | [ ]  | [ ]  |
| 11  | **2e device** (laptop, navigation privée, aucune session) : ouvrir le lien tokenisé → le billet s'affiche **sans login** — QR, détails, bouton « Annuler » avec politique | [ ]  | [ ]  |
| 12  | **2e device** : scanner le QR de l'email avec l'appareil photo → l'URL décodée est le lien billet tokenisé et s'ouvre sans compte                                         | [ ]  | [ ]  |
| 13  | PJ de l'email : PDF billet lisible + .ics importable (date/heure Europe/Zurich correctes)                                                                                 | [ ]  | [ ]  |
| 14  | Email #14 « nouvelle réservation » côté cave : `info@germanier.example.com` est invérifiable → vérifier via **Resend** (delivered) + SQL `email_logs` ci-dessous          | [ ]  | [ ]  |

```sql
SELECT type, "recipientId", "bookingId", status, "createdAt"
FROM email_logs ORDER BY "createdAt" DESC LIMIT 10;
```

### C. Vérification DB / Stripe

```sql
SELECT reference, status, "guestCount", "totalPrice", "serviceFeeCents",
       "platformFee", "wineryPayout", "stripePaymentIntentId",
       "stripeCheckoutSessionId", "accessTokenHash", "confirmationSentAt", locale
FROM bookings WHERE reference = 'ENC-XXXXXXXX';
```

| #   | Attendu                                                                                                                                                                                              | PASS | FAIL |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 15  | `status = CONFIRMED` · `totalPrice` = prix × 2 (centimes) · `serviceFeeCents = 0` · `platformFee` = round(totalPrice × commissionRate noté en prérequis) · `wineryPayout = totalPrice − platformFee` | [ ]  | [ ]  |
| 16  | `accessTokenHash` non nul (jamais de token en clair) · `confirmationSentAt` non nul · `locale = FR`                                                                                                  | [ ]  | [ ]  |
| 17  | Dashboard Stripe (test) → Paiements → le PI du booking : montant exact, destination = compte Connect cave 1, `application_fee_amount` = `platformFee` (0 si commission 0)                            | [ ]  | [ ]  |
| 18  | `SELECT "stripeEventId", type, status FROM stripe_events ORDER BY "createdAt" DESC LIMIT 5;` → `checkout.session.completed` en `PROCESSED`                                                           | [ ]  | [ ]  |

### D. Refus carte → `/reservation/erreur` (parcours 7)

| #   | Action / attendu                                                                                                                                                    | PASS | FAIL |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 19  | Nouveau booking invité (autre occurrence), sur Stripe payer avec `4000 0000 0000 9995` (insufficient_funds) → Stripe affiche le refus, la session reste ouverte     | [ ]  | [ ]  |
| 20  | Quitter la page Stripe (flèche retour) → `https://encave-dev.vercel.app/fr/reservation/erreur?cause=payment…` : cause lisible, **retry direct** (hold encore actif) | [ ]  | [ ]  |
| 21  | Retry → nouvelle page Stripe → payer 4242 → succès (le hold a survécu)                                                                                              | [ ]  | [ ]  |

### E. Hold expiré → place restituée (parcours 7)

| #   | Action / attendu                                                                                                                                                                      | PASS | FAIL |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 22  | Créer un hold (aller jusqu'à Stripe, **ne pas payer**). Noter la référence (SQL : dernier booking `PENDING_PAYMENT`)                                                                  | [ ]  | [ ]  |
| 23  | Antidater l'expiration puis lancer le cron (ci-dessous) → réponse 200, compteur d'expirés ≥ 1                                                                                         | [ ]  | [ ]  |
| 24  | `SELECT status FROM bookings WHERE reference='ENC-…';` → le hold n'est plus `PENDING_PAYMENT` et la place est **revendable** (la fiche publique repropose le créneau au compte plein) | [ ]  | [ ]  |

```sql
UPDATE bookings SET "expiresAt" = NOW() - INTERVAL '5 minutes'
WHERE reference = 'ENC-XXXXXXXX' AND status = 'PENDING_PAYMENT';
```

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://encave-dev.vercel.app/api/cron/expire-pending-bookings
```

> Vigilance (comportement voulu) : le cron interroge Stripe avant d'annuler —
> une session **payée** n'est jamais expirée (garde anti-stale-session). Si le
> booking reste `PENDING_PAYMENT` avec une session payée, c'est le webhook
> qu'il faut regarder (Q4), pas le cron.

## Vigilances (bugs historiques)

- **P-01** : email #1 sans `bookingId`/`accessToken` → bouton billet vers la
  homepage. Si l'étape 10 échoue, c'est un **Blocker**.
- Le QR encode l'URL billet tokenisée — pas `/checkin/{id}` (ancien format).
- `serviceFeeCents` doit rester 0 tant que `BOOKING_FEE` est OFF.

## Résultat

| Verdict global | PASS [ ] · FAIL [ ] | Date/heure : `____` |
| -------------- | ------------------- | ------------------- |

Anomalies ouvertes (IDs `UAT-S01-yy` → UAT-DEFECTS.md) : `____`

## Artefacts créés

```
Booking nominal   : ENC-__________  PI : pi_______________  cs_______________
Booking refus/retry : ENC-__________  PI : pi_______________
Hold expiré       : ENC-__________
Lien billet tokenisé (email #1) : ______________________________________
resendMessageId #1 : ________________  #14 : ________________
```
