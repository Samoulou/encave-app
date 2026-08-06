# UAT-CAMPAIGN — Plan maître de la campagne UAT pré-launch EnCave V3

> **Statut** : prêt à exécuter · **Exécutant** : Sam (seul, fiches autoportantes)
> **Source** : plan approuvé « Plan de test pré-launch EnCave V3 » (2026-07-17), Volet C
> (UAT) + Volet D (argent & ops, voir [MONEY-ROUTING-PROTOCOL.md](./MONEY-ROUTING-PROTOCOL.md)).
> **Traçabilité** : parcours 1–31 (§4) ↔ US-XXX du PRD (`docs/v3/ENCAVE-V3-PRD.md`)
> ↔ emails #1–#22 (`docs/v3/ENCAVE-V3-PAGES-EMAILS.md` §8).
> Chaque détail opérationnel (URL, table, colonne, flag, montant) a été vérifié
> dans le code au SHA de préparation — quand le plan et le code divergent, le
> code gagne (écarts consignés en §11).
>
> Convention : les blancs `` `____` `` sont à remplir à la main pendant l'exécution.

---

## 1. Objet et périmètre

Valider sur **staging** que les besoins du PRD (user stories launch) sont
couverts de bout en bout, avant la bascule `dev` → `main` du launch
(16.11.2026). La campagne couvre :

- 14 sessions fonctionnelles S1–S14 + 1 session de clôture S15
  (`BOOKING_FEE` + smoke « tout ON ») — fiches dans [`sessions/`](./sessions/).
- Le gate bloquant **money-routing** (Volet D) —
  [MONEY-ROUTING-PROTOCOL.md](./MONEY-ROUTING-PROTOCOL.md). S8 ne peut pas
  passer PASS tant que le Bloc A (a)→(f) n'est pas vert.
- Le balayage des 22 emails — [UAT-EMAIL-CHECKLIST.md](./UAT-EMAIL-CHECKLIST.md).
- Le registre d'anomalies — [UAT-DEFECTS.md](./UAT-DEFECTS.md) — et le rapport
  de sortie — [UAT-EXIT-REPORT.md](./UAT-EXIT-REPORT.md).

Hors périmètre UAT (rappel au rapport de sortie) : LHCI ≥ 95 staging, incident
simulé < 5 min, `/security-review`, plan crons Vercel — traités par le Volet D
Bloc E et les gates P-16.

---

## 2. Environnements et gel de version

| Rôle              | URL                                             | Base               | Stripe    |
| ----------------- | ----------------------------------------------- | ------------------ | --------- |
| **UAT (staging)** | `https://encave-dev.vercel.app`                 | Neon `development` | clés test |
| Preview (G-1 MFA) | URL Vercel de la PR concernée                   | Neon `preview`     | clés test |
| Local             | reproduction de bugs uniquement, jamais un PASS | Docker             | clés test |

Règles :

- **Toutes les URL des fiches** sont préfixées locale (`localePrefix: always`) :
  `https://encave-dev.vercel.app/fr/...` (fr par défaut ; de/en pour S14).
- **Gel de SHA** : à J0, noter le SHA de `dev` déployé sur staging
  (`git rev-parse origin/dev`) dans l'encart ci-dessous. Pendant la campagne,
  seuls les fixes UAT mergent sur `dev` ; tout autre merge ⇒ re-smoke 15 min
  (S1 raccourcie : booking invité + email #1).
- **Webhooks Stripe** : 2 endpoints test distincts, secrets séparés, API
  `2025-12-15.clover` :
  - `https://encave-dev.vercel.app/api/webhooks/stripe/checkout`
  - `https://encave-dev.vercel.app/api/webhooks/stripe/connect`
- **Garde anti-simulation** : la variable d'env `E2E_TEST` ne doit PAS valoir
  `true` sur staging (sinon le checkout fabrique de fausses sessions
  `checkout.stripe.com/pay/e2e_…` et les transferts gift sont synthétiques
  `tr_e2e_…`). Vérifié au gate d'entrée (§9).

```
SHA gelé à J0 : ______________________  (date/heure : ______________)
```

---

## 3. Données : re-seed J0, comptes seed, comptes UAT

### 3.1 Re-seed destructif J0 (état de référence S0)

Une seule fois, à J0, sur la base Neon `development` :

```bash
SEED_ALLOW_DESTRUCTIVE=1 SEED_STRIPE_TEST_ACCOUNT=acct_XXXXXXXX \
DATABASE_URL="<url pooled Neon development>" DIRECT_URL="<url directe>" \
npx prisma db seed
```

- `SEED_STRIPE_TEST_ACCOUNT` = l'id du compte Connect Express **test**
  (`charges_enabled`) — il est posé sur la **cave 1 uniquement** (Domaine
  Germanier). Tous les tests argent passent par cette cave.
- Après S0 : **plus jamais de re-seed en cours de session** (il efface le
  ledger des bons). Re-seed autorisé uniquement entre blocs du Volet D, jamais
  pendant.

### 3.2 Comptes seed (emails `@example.com` — invérifiables, pas de boîte)

Mot de passe clients : `Client1234!` · encaveurs : `Vigneron1!` · admin :
`Admin1234!`.

| Compte                       | Rôle      | Cave / particularité                                                                                                |
| ---------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------- |
| `admin@encave.ch`            | ADMIN     | TOTP forcé au 1er login (P-14) — enrôler à J0 et **conserver le secret TOTP**                                       |
| `laura.meier@example.com`    | CLIENT    | client seed 1                                                                                                       |
| `thomas.brunner@example.com` | CLIENT    | client seed 2                                                                                                       |
| `jean-rene@example.com`      | WINEMAKER | **Cave 1 — Domaine Germanier** (Vétroz) · FOUNDER 0 % · STANDARD · no-show ON 15 CHF · **seul compte Connect réel** |
| `nicolas@example.com`        | WINEMAKER | Cave du Rhodan · FOUNDER 0 % · FLEXIBLE · no-show OFF                                                               |
| `isabelle@example.com`       | WINEMAKER | Cave Fin Bec · FOUNDER 0 % · STRICT · no-show ON 20 CHF                                                             |
| `robert@example.com`         | WINEMAKER | Domaine des Muses · STANDARD (rate null) · FLEXIBLE · no-show OFF                                                   |
| `marie-therese@example.com`  | WINEMAKER | Domaine Chappaz · STRICT · no-show ON 50 CHF                                                                        |
| `olivier@example.com`        | WINEMAKER | Cave Saint-Georges · STANDARD (policy) · no-show ON 10 CHF                                                          |
| `celine@example.com`         | WINEMAKER | Domaine du Mont d'Or · FLEXIBLE                                                                                     |
| `joel@example.com`           | WINEMAKER | Cave La Romaine · STANDARD                                                                                          |
| `anne-sophie@example.com`    | WINEMAKER | Cave du Vieux-Pressoir · STRICT                                                                                     |
| `pierre-alain@example.com`   | WINEMAKER | Cave de la Brunière · FLEXIBLE                                                                                      |

Données seedées utiles aux fiches :

- **Bons cadeaux** : `ENCV-K4M2-P7RD` (100 CHF, solde plein) ·
  `ENCV-W8XQ-4TZN` (150 CHF, solde 90.00) · `ENCV-J6VB-9HSL` (50 CHF, envoi
  programmé J+10, job `GIFT_CARD_DELIVERY` PENDING).
- **Requests** : `REQ-A7K2M9QX` (PENDING, sans cave — legacy seed) ·
  `REQ-B3TR8WLD` (OFFERED, Muses, offre 760 CHF, expire +48 h, job
  `REQUEST_OFFER_REMINDER` à +24 h) · `REQ-C9NF4JZS` (PAID, Germanier).
- 40 expériences publiées (4/cave), occurrences persistées sur 14 jours,
  1 événement collectif, 5 bookings d'exemple.

> Les comptes e2e (`*@test.example.com`, `*@test.encave.ch` de
> `tests/e2e/fixtures/auth.fixture.ts`) vivent dans la base Docker de la CI —
> ils n'existent **pas** sur staging et ne servent pas à l'UAT.

### 3.3 Comptes UAT à créer via l'app (vraies boîtes, plus-addressing Gmail)

Créés à J0 pendant le smoke, noms préfixés `UAT-`, mot de passe unique choisi
par Sam (noté hors repo) :

| Email                                | Usage                                                 |
| ------------------------------------ | ----------------------------------------------------- |
| `sam.copp8+client-fr@gmail.com`      | client connecté FR (S2, S4, S8, S9)                   |
| `sam.copp8+client-de@gmail.com`      | booking complet DE (S14) — `preferredLocale` DE       |
| `sam.copp8+client-en@gmail.com`      | booking complet EN (S14)                              |
| `sam.copp8+guest@gmail.com`          | checkout invité — **jamais de compte** (S1, S3, S10)  |
| `sam.copp8+encaveur-invit@gmail.com` | onboarding voie invitation (S5)                       |
| `sam.copp8+encaveur-self@gmail.com`  | onboarding self-service PENDING (S5)                  |
| `sam.copp8+benef@gmail.com`          | bénéficiaire bons cadeaux (S8) et destinataire divers |

Chaque fiche consigne dans son encart « artefacts » les IDs créés (référence
booking `ENC-XXXXXXXX`, `pi_…`, `cs_…`, code bon `ENCV-…`, `REQ-…`).

---

## 4. Référentiel des parcours 1–31 (canonique)

Le PRD ne numérote que 10 US (US-101, 201, 210, 220, 230, 240, 250, 301, 501 —
US-601 est V3.2, hors launch). La traçabilité est N parcours → 1 US ; les
parcours sans ancre US référencent leur package P-XX (`docs/plans/`).

| #   | Parcours                                                                                      | Ancre               | Session          |
| --- | --------------------------------------------------------------------------------------------- | ------------------- | ---------------- |
| 1   | Booking Slot invité complet (découverte → hold 10 min → Stripe → QR/PDF/.ics → emails #1/#14) | US-201              | S1               |
| 2   | Concurrence anti-survente (2 clients / 3 places)                                              | US-201              | S3               |
| 3   | Booking connecté (pré-rempli, rattachement billets post-paiement insensible à la casse)       | US-201              | S2               |
| 4   | Checkout ON_SITE/gratuit : empreinte SetupIntent zéro débit + politique acceptée horodatée    | US-220              | S2               |
| 5   | Rédemption bon au checkout (partielle, concurrente, card=0 sans Stripe)                       | US-210              | S8               |
| 6   | Annulation self-service (montant AVANT, 3 barèmes, cas 50 %, gift-funded ADR-0003)            | US-201 (+P-09)      | S4, S8           |
| 7   | `/reservation/erreur` : refus vs hold expiré, retry                                           | US-201              | S1               |
| 8   | Billet invité par lien magique tokenisé                                                       | US-301              | S1               |
| 9   | Boucle vin : email J+2 → page commande tokenisée → demande à la cave                          | US-230              | S10              |
| 10  | Achat bon cadeau `/cadeaux` (20–500, envoi programmé, PDF, emails #6/#7)                      | US-210              | S8               |
| 11  | Sur-mesure `/sur-mesure` (formulaire → #8 → offre → #9 → paiement → billets)                  | US-240              | S9               |
| 12  | nLPD : suppression compte client + export                                                     | P-16 (nLPD)         | S12              |
| 13  | Onboarding encaveur 2 voies (invitation VERIFIED direct ; self-service PENDING → validation)  | P-14/P-13           | S5               |
| 14  | Création expérience ponctuelle ET récurrente + blackouts, 12 occurrences < 60 s               | US-101              | S6               |
| 15  | Gestion occurrences (fermer, capacité, ADR-0002 forward-only)                                 | US-101              | S6               |
| 16  | Dashboard « Aujourd'hui » (remplissage 30 j, alertes actionnables)                            | P-13                | S7               |
| 17  | Scan PWA offline (mode avion, sync, double-scan) + reverts ADR-0001                           | US-301              | S7               |
| 18  | Prélèvement no-show manuel 1 tap (nominal, carte refusée, rejet non-NO_SHOW)                  | US-220              | S7               |
| 19  | Offre sur-mesure ≤ 5 min, relance 24 h avant échéance (#10), clôture auto, escalade SLA 48 h  | US-240              | S9               |
| 20  | Payouts Stripe + relevé PDF mensuel (`/api/dashboard/statements/[month]`)                     | US-501              | ⚠ voir note      |
| 21  | Fiche dégustation ≤ 30 s mobile, CRUD vins                                                    | US-230              | S10              |
| 22  | Événement collectif : participants gated, 2 scanners sans collision                           | US-250              | S11              |
| 23  | Validation domaine admin (valider / refuser motif / suspendre, VerificationLog)               | P-13 (admin)        | S12              |
| 24  | Refund support (motif obligatoire) — **REFUS gift-funded** (runbook)                          | US-210/P-09         | S12              |
| 25  | Gestion utilisateurs, anonymisation nLPD, changement de rôle journalisé                       | P-16 (nLPD)         | S12              |
| 26  | Passif bons cadeaux = somme ledger, désactivation code fraude                                 | US-210              | S8               |
| 27  | Ops : santé webhooks (StripeEvent), échecs de jobs                                            | P-16 (WS-E)         | S12              |
| 28  | Événements collectifs — volet admin                                                           | US-250              | S11              |
| 29  | Toggle feature flags, effet ≤ 60 s                                                            | runbook kill-switch | S12 (+S7 chrono) |
| 30  | MFA admin : TOTP forcé, challenge après login Google **et** OTP (gap G-1, preview d'abord)    | P-14                | S12              |
| 31  | Invité intégral : checkout sans compte, billets lien magique, annulation par token            | US-201/US-301       | S1               |

> **Point ouvert (parcours 20)** : les payouts n'étaient rattachés à aucune
> session dans le plan initial. Décision de préparation : intégré au
> **Volet D Bloc A.e** (J+1, [MONEY-ROUTING-PROTOCOL.md](./MONEY-ROUTING-PROTOCOL.md))
> qui couvre `/fr/dashboard/payouts` + relevé PDF. Le PASS du parcours 20 se
> lit donc dans le protocole money-routing, pas dans une fiche session.

---

## 5. Feature flags : état, ordre d'activation, kill-switch

### 5.1 Registre (vérifié `src/lib/flags.ts` + table `feature_flags`)

| Flag                  | Défaut | Coupe (résumé runbook `docs/runbooks/kill-switch-flags.md`)           |
| --------------------- | ------ | --------------------------------------------------------------------- |
| `BOOKING_FEE`         | OFF    | frais 2.50 CHF/billet (ligne « Frais de service » à 0 quand OFF)      |
| `GIFT_CARDS`          | OFF    | `/cadeaux` 404, champ code masqué, cron reconcile skip                |
| `NO_SHOW_FEES`        | OFF    | empreinte carte + prélèvement                                         |
| `REQUESTS`            | OFF    | `/sur-mesure` 404, liens de paiement d'offres refusés                 |
| `TASTING_SHEET`       | OFF    | fiche dégustation + jobs `TASTING_RECAP` (restent PENDING)            |
| `COLLECTIVE_EVENTS`   | OFF    | bandeau/grille événement, ajout participants                          |
| `OCCURRENCE_CAPACITY` | **ON** | ⚠ sémantique INVERSÉE — ne couper qu'en urgence, jamais pendant l'UAT |

- **Toggle UI** : `https://encave-dev.vercel.app/fr/admin` — panneau
  « Feature flags » sur la **page d'accueil admin** (⚠ écart : le runbook dit
  `/admin/compliance`, mais le `FeatureFlagsPanel` est rendu sur `/admin` —
  voir §11).
- **Secours SQL** (console Neon, effet ≤ 60 s — TTL du cache) :

  ```sql
  UPDATE feature_flags SET enabled = true WHERE key = 'GIFT_CARDS';
  -- ligne absente = défaut du registre (OFF, sauf OCCURRENCE_CAPACITY)
  ```

### 5.2 Ordre d'activation pendant la campagne

```
Phase A (S1–S6)   : tout OFF (baseline V2)
S7                : + NO_SHOW_FEES          <- 1er kill-switch chronométré (< 1 min)
S8                : + GIFT_CARDS            <- gate money-routing Bloc A
S9                : + REQUESTS
S10               : + TASTING_SHEET
S11               : + COLLECTIVE_EVENTS
S15 (clôture)     : + BOOKING_FEE           <- en dernier (modifie tous les montants)
```

À la **première** activation (S7) : chronométrer la propagation (≤ 60 s) puis
exécuter le kill-switch chronométré (< 1 min, gate NFR).

### 5.3 Matrice « flag OFF » — 3 vérifications avant chaque activation (~5 min)

Avant d'activer un flag, vérifier son état OFF :

| Flag                | 1. Entrée UI masquée                                   | 2. API refuse proprement                                | 3. Parcours V2 inchangé                 |
| ------------------- | ------------------------------------------------------ | ------------------------------------------------------- | --------------------------------------- |
| `GIFT_CARDS`        | `/fr/cadeaux` → 404 ; pas de champ code au checkout    | soumission directe d'un code → refus                    | checkout carte pure OK                  |
| `REQUESTS`          | `/fr/sur-mesure` → 404 ; pas de bloc sur fiche domaine | lien de paiement d'offre → refus                        | fiches domaines OK                      |
| `NO_SHOW_FEES`      | pas de mention d'empreinte au checkout ON_SITE         | bouton « prélever » absent/refusé côté dashboard        | résa gratuite classique OK              |
| `TASTING_SHEET`     | onglet fiche dégustation masqué                        | jobs `TASTING_RECAP` restent PENDING (curl cron → skip) | détail booking encaveur OK              |
| `COLLECTIVE_EVENTS` | bandeau/grille absents sur la fiche événement          | ajout participant refusé                                | billetterie de l'expérience porteuse OK |
| `BOOKING_FEE`       | ligne « Frais de service » à 0.00 au checkout          | —                                                       | total = prix × pers., au centime        |

Pas de combinatoire inter-flags, **sauf** risque financier : gift × annulation
(S8), no-show × empreinte (S7), fee × gift (S15).

---

## 6. Gestion du temps : crons manuels + antidatage SQL

**Jamais attendre un cron réel.** Les 9 endpoints acceptent
`Authorization: Bearer $CRON_SECRET` (vérifié `src/lib/cron-auth.ts` — accepte
aussi `x-vercel-cron: 1` posé par Vercel). Tous en GET.

### 6.1 Les 9 endpoints (18 entrées `vercel.json`)

```bash
BASE=https://encave-dev.vercel.app
AUTH='Authorization: Bearer '"$CRON_SECRET"

curl -H "$AUTH" "$BASE/api/cron/reminders"                    # #2 J-1 (garde 18h Zurich) + rappel 2h
curl -H "$AUTH" "$BASE/api/cron/daily-digest"                 # digest quotidien encaveur
curl -H "$AUTH" "$BASE/api/cron/expire-pending-bookings"      # libère les holds expirés
curl -H "$AUTH" "$BASE/api/cron/generate-occurrences"         # matérialise les occurrences
curl -H "$AUTH" "$BASE/api/cron/follow-ups"                   # J+1 post-expérience (skip si recap armé)
curl -H "$AUTH" "$BASE/api/cron/weekly-summary"               # récap hebdo (#17)
curl -H "$AUTH" "$BASE/api/cron/process-scheduled-jobs"       # drain ScheduledJob (JOB_REGISTRY)
curl -H "$AUTH" "$BASE/api/cron/tasting-sheet-reminder"       # #21 (garde 21h Zurich + flag)
curl -H "$AUTH" "$BASE/api/cron/reconcile-gift-transfers"     # transferts gift manquants (flag)
```

Notes vérifiées dans le code :

- Sans header valide → `401 {"error":"Unauthorized"}` (test d'entrée J0).
- Les query params de `vercel.json` (`?window=cest|cet`, `?slot=0..21`) ne
  changent **pas** le comportement — ils rendent les 18 entrées uniques. Les
  gardes réelles sont horaires : `reminders` n'envoie le J-1 (#2) **que si
  l'heure Zurich courante = 18 h** (le bloc rappel 2 h tourne à chaque appel) ;
  `tasting-sheet-reminder` n'agit **qu'à 21 h Zurich** (sinon
  `{"skipped":"not_local_reminder_hour"}`) — un `skipped` peut donc être le
  comportement correct.
- `process-scheduled-jobs` répond `{enabledTypes, …, durationMs}` —
  `enabledTypes` liste les types dont le flag est ON. Registre (type → flag) :
  `TASTING_RECAP` → `TASTING_SHEET` · `GIFT_CARD_DELIVERY` → `GIFT_CARDS` ·
  `REQUEST_OFFER_REMINDER` / `REQUEST_OFFER_EXPIRY` / `REQUEST_SLA_ESCALATION`
  → `REQUESTS`. Flag OFF = jobs du type jamais claimés (PENDING, attempts 0).
- `reconcile-gift-transfers` : flag OFF → `{"skipped":"flag_off"}` ; ON →
  `{scanned, transferred, failed, durationMs}`.

### 6.2 Patterns d'antidatage SQL (console Neon, base `development`)

Colonnes camelCase → **toujours entre guillemets doubles**. Tables en
snake_case (mappings Prisma vérifiés dans `prisma/schema.prisma`).

```sql
-- Rendre un ScheduledJob dû (relance offre, envoi bon programmé, recap J+2)
UPDATE scheduled_jobs SET "runAt" = NOW() - INTERVAL '1 hour'
WHERE "dedupeKey" = 'TASTING_RECAP:<bookingId>';   -- ou GIFT_CARD_DELIVERY:<giftCardId>, REQUEST_OFFER_REMINDER:<offerId>

-- Vieillir une request pour l'escalade SLA (48 h)
UPDATE requests SET "createdAt" = NOW() - INTERVAL '49 hours'
WHERE reference = 'REQ-XXXXXXXX';

-- Déplacer un booking à J-1 / J+2 (colonne date = DATE UTC, timeSlot = 'HH:mm')
UPDATE bookings SET date = (CURRENT_DATE - INTERVAL '2 days')::date
WHERE reference = 'ENC-XXXXXXXX';

-- Autoriser le re-envoi de l'email #18 (cooldown 7 jours OU changement du set currently_due)
UPDATE wineries SET "stripeActionEmailAt" = NOW() - INTERVAL '8 days'
WHERE slug = 'domaine-germanier';
```

Chaque fiche embarque ses UPDATE exacts ; consigner tout antidatage dans
l'encart artefacts (traçabilité).

---

## 7. Méthode emails — triple source, dans l'ordre

1. **Boîte Gmail réelle** (`sam.copp8+…@gmail.com`) : rendu, spam ou inbox,
   liens cliquables sans login, pièces jointes (PDF, .ics), locale.
2. **Dashboard Resend** : statut `delivered`, message id.
3. **Table `email_logs`** (Neon) : `status` (`sent`/`failed`/`skipped`),
   `resendMessageId`, `openedAt`/`clickedAt` (preuve webhook Resend) :

   ```sql
   SELECT type, "recipientId", "bookingId", status, "errorMessage",
          "resendMessageId", "openedAt", "createdAt"
   FROM email_logs ORDER BY "createdAt" DESC LIMIT 30;
   ```

Checklist par email (reprise dans [UAT-EMAIL-CHECKLIST.md](./UAT-EMAIL-CHECKLIST.md)) :
destinataire · locale = `Booking.locale` (jamais celle de l'encaveur) ·
montants au centime · dates Europe/Zurich · liens tokenisés sans login · PJ ·
idempotence au re-cron · unsubscribe.

⚠ Tous les envois ne journalisent pas dans `email_logs` (seuls les types cron
et quelques transactionnels le font) : si `email_logs` est vide pour un email
donné, conclure sur Resend + Gmail et le noter dans la checklist.

---

## 8. Matrice i18n / devices

- **fr** = nominal partout (toutes les fiches).
- **de/en** : 1 booking complet chacun + sweep navigation + emails via
  `Booking.locale` → fiche S14.
- Scan PWA : **téléphone réel**, fr uniquement. Dashboard/admin : fr
  uniquement (audience valaisanne).
- Mobile réel pour S1, S7, S10 ; émulation devtools ailleurs.
- Formats : CHF et dates `fr-CH`/`de-CH`/`en-CH` (`src/lib/i18n/formatters.ts`).

---

## 9. Critères d'entrée (J0), sortie (GO), classification

### 9.1 Gates d'entrée J0 (tous verts avant S1)

- [ ] CI verte sur `dev` ; staging déployé au SHA gelé (§2).
- [ ] Re-seed S0 exécuté (§3.1) ; compte Connect cave 1 `charges_enabled`.
- [ ] `E2E_TEST` absent/faux sur staging (Vercel → Settings → Environment
      Variables) — sinon tout le routing argent est simulé.
- [ ] Comptes UAT §3.3 créés et connectables ; TOTP admin enrôlé.
- [ ] `curl -H "Authorization: Bearer $CRON_SECRET" $BASE/api/cron/expire-pending-bookings`
      → 200 ; le même sans header → 401.
- [ ] Email témoin reçu sur `sam.copp8+guest@gmail.com` (un booking smoke).
- [ ] Webhooks Stripe staging : 2 endpoints (§2) actifs, dernière livraison
      2xx (Dashboard Stripe → Développeurs → Webhooks).
- [ ] Les 6 flags argent OFF confirmés (`SELECT * FROM feature_flags;` +
      panneau `/fr/admin`).
- [ ] `/api/health?deep=1` → 200.

### 9.2 Critères de sortie (GO)

- 15 fiches (S1–S15) à 100 % · 0 Blocker · P1 corrigés+retestés **ou**
  acceptés explicitement par Sam (consignés au rapport).
- Money-routing (a)→(f) vert avec captures Stripe ; matrices B 12/12,
  C 6/6, D 3/3 (Volet D).
- Matrice flags du launch arrêtée et documentée (rapport de sortie).
- Smoke « tout ON » 30 min PASS (fiche S15).

### 9.3 Classification des anomalies

| Sévérité    | Définition                                                                                                                                           |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Blocker** | argent perdu/mal routé, survente, fuite de données, impossible de payer/annuler, email #1 absent ou QR non scannable, refus gift-funded contournable |
| **P1**      | parcours dégradé avec workaround, montant affiché faux, email secondaire manquant, i18n cassée sur parcours cœur, propagation flag > 60 s            |
| **P2**      | cosmétique gênant, wording, layout                                                                                                                   |
| **P3**      | mineur, hors parcours cœur                                                                                                                           |

IDs `UAT-Sxx-yy` → registre [UAT-DEFECTS.md](./UAT-DEFECTS.md).

---

## 10. Séquencement et table des sessions

```
J0       Entry gates + seed S0 + smoke (2 h)
Vague 1  Flags OFF : S1 -> S2 -> S3 -> S4 (client), puis S5 -> S6 (encaveur, données disjointes)
Vague 2  S7 (kill-switch chrono) -> S8 (gate Volet D Bloc A) -> S9 -> S10 -> S11
Vague 3  S12 (après G-1 sur preview) -> S13 -> S14
Clôture  S15 : BOOKING_FEE ON + smoke tout-ON -> tri anomalies -> UAT-EXIT-REPORT
```

Dépendances dures : webhooks staging validés (Volet D Phase 0) avant S1 ·
Bloc A money-routing avant le PASS de S8 · G-1 validé sur preview avant S12 ·
gel de `dev` pendant les vagues. Effort : ~17 h de sessions + ~30 % retests ≈
25 h sur 2 semaines calendaires.

| #   | Fiche                                                                            | Parcours              | Flags requis            | Durée  |
| --- | -------------------------------------------------------------------------------- | --------------------- | ----------------------- | ------ |
| S1  | [Booking invité A→Z](./sessions/UAT-S01-booking-invite.md)                       | 1, 7, 8, 31           | tous OFF                | 90 min |
| S2  | [Booking connecté + spéciaux](./sessions/UAT-S02-booking-connecte.md)            | 3, 4                  | tous OFF                | 60 min |
| S3  | [Concurrence anti-survente](./sessions/UAT-S03-concurrence.md)                   | 2                     | tous OFF                | 45 min |
| S4  | [Annulations & refunds](./sessions/UAT-S04-annulations-refunds.md)               | 6                     | tous OFF                | 90 min |
| S5  | [Onboarding encaveur 2 voies](./sessions/UAT-S05-onboarding-encaveur.md)         | 13                    | tous OFF                | 60 min |
| S6  | [Expériences & occurrences](./sessions/UAT-S06-experiences-occurrences.md)       | 14, 15                | tous OFF                | 60 min |
| S7  | [Jour J : dashboard, scan, no-show](./sessions/UAT-S07-jour-j-scan-noshow.md)    | 16, 17, 18            | + NO_SHOW_FEES          | 90 min |
| S8  | [Bons cadeaux A→Z](./sessions/UAT-S08-bons-cadeaux.md)                           | 10, 5, 6-gift, 26     | + GIFT_CARDS            | 90 min |
| S9  | [Sur-mesure A→Z](./sessions/UAT-S09-sur-mesure.md)                               | 11, 19                | + REQUESTS              | 90 min |
| S10 | [Boucle vin + fiche dégustation](./sessions/UAT-S10-boucle-vin.md)               | 9, 21                 | + TASTING_SHEET         | 60 min |
| S11 | [Événement collectif](./sessions/UAT-S11-evenement-collectif.md)                 | 22, 28                | + COLLECTIVE_EVENTS     | 60 min |
| S12 | [Admin, nLPD, MFA](./sessions/UAT-S12-admin-nlpd-mfa.md)                         | 23–25, 27, 29, 30, 12 | —                       | 90 min |
| S13 | [Balayage emails & crons](./sessions/UAT-S13-emails-crons.md)                    | transverse            | —                       | 90 min |
| S14 | [Sweep i18n/devices](./sessions/UAT-S14-i18n-sweep.md)                           | transverse            | —                       | 60 min |
| S15 | [Clôture BOOKING_FEE + smoke tout-ON](./sessions/UAT-S15-cloture-booking-fee.md) | fee × gift            | + BOOKING_FEE (tous ON) | 90 min |

---

## 11. Écarts plan-vs-code détectés à la préparation (le code gagne)

1. **Toggle flags** : plan + runbook `kill-switch-flags.md` disent
   `/admin/compliance` ; le `FeatureFlagsPanel` est en réalité rendu sur
   **`/fr/admin`** (accueil admin). `/admin/compliance` existe mais sans
   section flags. → Les fiches pointent `/fr/admin` ; le runbook est à
   corriger (hors périmètre de cette campagne).
2. **`/billets/[token]` n'existe pas** (PAGES-EMAILS §4/§8 #12) : le billet
   invité est `https://encave-dev.vercel.app/fr/booking/{id}?token=…`, lien
   porté par l'**email #1**. Il n'y a **pas de template email #12 distinct**.
   → S1 vérifie le lien tokenisé de #1 ; #12 marqué « couvert par #1 » dans la
   checklist emails.
3. **Réponse du cron reconcile** : le plan cite `{transferred:1}` ; la route
   répond `{scanned, transferred, failed, durationMs}` (flag OFF →
   `{"skipped":"flag_off"}`).
4. **Relance offre (#10)** : plan « J-1 échéance » ; code =
   `REQUEST_OFFER_REMINDER_LEAD_HOURS = 24` (24 h avant expiry — équivalent
   J-1 seulement si validité > 1 jour).
5. **« Laissez EnCave proposer »** : au launch la cave est **obligatoire** sur
   une request (décision P-10, `src/lib/constants/request.ts`) ; seule la seed
   contient une request sans cave. La fiche S9 teste le formulaire avec cave.
6. **Anti-spam email #18** : plan « KYC incomplet 24 h antidaté » ; code =
   cooldown **7 jours** OU changement du hash `currently_due`
   (`src/lib/business-rules/stripe-action-email.ts`). → antidatage 8 jours
   dans S5.
7. **Carte sauvegardée (`setup_future_usage`)** : prévue par PAGES-EMAILS §4,
   **non implémentée** (aucune occurrence dans `src/`). S2 vérifie l'absence
   propre de la case et le consigne comme dette assumée (pas un défaut UAT).
8. **`i18n:check` en CI** : le plan (Volet A-4) le donnait absent ; il est
   présent dans `ci.yml` (« Check translations »). Item déjà réalisé.
9. **Rappel 2 h** : le cron `reminders` envoie aussi un rappel 2 h avant la
   session (héritage V2) — non listé dans les 22 emails. Vérifié en S13 comme
   email « bonus », pas une anomalie.

---

## 12. À compléter par Sam (jamais dans le repo)

- Valeur de `CRON_SECRET` (Vercel → encave-dev → Settings → Environment
  Variables) — exportée en local : `export CRON_SECRET=…` avant les curls.
- `SEED_STRIPE_TEST_ACCOUNT` (`acct_…` du compte Connect Express test).
- Secrets des 2 endpoints webhook Stripe staging (`whsec_…`).
- Mot de passe unique des comptes UAT §3.3.
- Secret TOTP de `admin@encave.ch` (enrôlé à J0).
- URL de la preview G-1 (S12) et SHA gelé (§2).
