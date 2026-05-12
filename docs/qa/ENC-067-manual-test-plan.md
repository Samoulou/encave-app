# ENC-067 — Manual test plan

> Pour Sam, à exécuter sur la preview Vercel avant feu vert merge. Compter
> ~10 minutes pour les 3 scénarios principaux + checklist finale.

## Pré-requis

- URL preview Vercel (fournie par Margot après push de la branche)
- Stripe en mode **test** (les clés `sk_test_*` sont injectées dans
  l'environnement Vercel preview — pas d'action côté Sam)
- Un éditeur d'URL et la console DevTools ouverte (onglet Network)
- Optionnel : accès Neon DB `preview` pour valider l'état booking en SQL

## Scope

On valide les 3 états UI de `/[locale]/booking/[id]/confirmation` :

1. État **Confirmé** (carte test 4242 → reconcile synchrone passe le booking en `CONFIRMED`)
2. État **Paiement non finalisé** (carte refusée 4000 0000 0000 0002)
3. Cron d'expiration `/api/cron/expire-pending-bookings` (libère les `PENDING_PAYMENT` > 30 min)

---

## Scénario 1 — Happy path : carte 4242 (état "Confirmé")

**Objectif** : sur preview (donc sans webhook Stripe configuré), le fallback synchrone reconcile bien le paiement et la page affiche l'état "Confirmé" en < 3 sec.

1. Ouvre une expérience publiée, ex. `/fr/experiences/<wineryslug>/<experienceslug>` sur la preview.
2. Sélectionne une date future + un créneau + 2 invités, puis "Continuer".
3. Remplis le formulaire visiteur (email perso pour recevoir le mail) puis "Payer".
4. Sur le Stripe Checkout, carte test :
   - Numéro : `4242 4242 4242 4242`
   - Expiry : `12 / 30` (toute date future)
   - CVC : `123`
   - Nom : libre, code postal `1000` si demandé
5. Valide le paiement.
6. Stripe redirige vers `/fr/booking/<id>/confirmation?session_id=cs_test_...`.

### Attendus

- [ ] L'état "Réservation confirmée, à très vite !" s'affiche en **moins de 3 secondes**.
- [ ] La référence `ENC-XXXXXX` est visible.
- [ ] Le récap booking est correct (expérience, date, heure, nb invités, prix total).
- [ ] CTA "Voir ma réservation" présent et cliquable.
- [ ] Un mail de confirmation arrive dans la boîte du visiteur dans les ~30 sec.
- [ ] Refresh F5 sur la page : toujours "Confirmé", **pas** de retour à "paiement en attente".
- [ ] Console DevTools : pas d'erreur rouge.

### Si ça échoue

- Récupère le `bookingId` (segment de l'URL) et le `session_id` (query param), screenshot, et ping Margot.
- Vérifie côté Stripe Dashboard (mode test) que la session est bien `paid`.

---

## Scénario 2 — Carte refusée (état "Paiement non finalisé")

**Objectif** : la carte est refusée par Stripe, le booking reste en `PENDING_PAYMENT` DB, l'UI affiche fermement "paiement non finalisé" sans culpabiliser.

1. Reprends le parcours du scénario 1 jusqu'à Stripe Checkout.
2. Carte test : `4000 0000 0000 0002` (Stripe la refuse systématiquement).
3. Expiry `12/30`, CVC `123`, valide.
4. Stripe peut soit afficher l'erreur "Your card was declined" directement dans le checkout, soit rediriger vers la page de confirmation avec `payment_status: unpaid`.

### Cas A — Stripe refuse en amont (avant redirect)

- [ ] Tu restes sur Stripe Checkout avec une erreur claire.
- [ ] Aucun booking flippé en DB.

→ Pas d'action côté EnCave. C'est cohérent : on n'a même pas atteint la page confirmation.

### Cas B — Stripe redirige avec `payment_status=unpaid`

- [ ] La page affiche le bloc `Alert` destructive avec **"Le paiement n'a pas abouti"** (ou variante FR).
- [ ] Le sous-titre confirme **"Aucun montant n'a été débité"**.
- [ ] CTA "Refaire une réservation" est présent et pointe vers `/fr/experiences/<wineryslug>/<experienceslug>` (page de l'expérience, **pas** un retry sur le même booking).
- [ ] CTA secondaire "Voir mes réservations" → `/fr/dashboard/my-bookings`.
- [ ] Le lien support `mailto:contact@encave.ch` est visible en bas.
- [ ] **Aucun email** de confirmation reçu (ni client, ni encaveur).
- [ ] Si tu vérifies en DB : le booking reste `PENDING_PAYMENT` (sera nettoyé par le cron à T+30 min — voir scénario 3).

---

## Scénario 3 — Cron d'expiration (libération capacité)

**Objectif** : le cron `*/15 * * * *` flippe les bookings `PENDING_PAYMENT` > 30 min vers `CANCELLED_BY_CLIENT` et libère la capacité.

### Préparation

1. Crée un booking et abandonne le checkout (ferme l'onglet Stripe avant de payer). Le booking est en `PENDING_PAYMENT`.
2. Note son `id` (depuis l'URL ou la DB Neon preview).

### Option A — Attendre le cron Vercel

3. Attendre 30 min + le tick du cron (max 15 min de plus → fenêtre 30-45 min).
4. Vérifier en DB que le booking est passé en `CANCELLED_BY_CLIENT`.

### Option B — Trigger manuel (recommandé pour ne pas attendre)

3. Depuis ton terminal, avec le `CRON_SECRET` de la preview (Margot peut te le donner ou il est dans Vercel env vars) :

   ```bash
   curl -i -H "Authorization: Bearer $CRON_SECRET" \
     https://<preview-url>.vercel.app/api/cron/expire-pending-bookings
   ```

4. Réponse attendue : `200` avec body `{"success":true,"expired":N,"durationMs":...}` où `N` = nombre de bookings flippés.

### Attendus

- [ ] Le booking abandonné passe de `PENDING_PAYMENT` → `CANCELLED_BY_CLIENT` après le run.
- [ ] La capacité du créneau est libérée (vérifier en re-bookant la même date/créneau : on doit pouvoir réserver).
- [ ] Re-trigger immédiat du cron : `{"expired":0}` (idempotence — le booking n'est plus en `PENDING_PAYMENT`).
- [ ] Sans `Authorization` : réponse `401 Unauthorized`.

### Cas de garde — race webhook

Cas peu probable sur preview (pas de webhook) mais documenté : si un webhook arrivait en parallèle et flippait le booking en `CONFIRMED` entre le `findMany` et le `updateMany`, le filtre `where: { status: PENDING_PAYMENT }` du `updateMany` ne matcherait plus — pas de double-flip, pas de corruption. Cf. tests d'intégration `tests/integration/api/cron-expire-pending-bookings.test.ts`.

---

## Checklist finale (synthèse)

À cocher avant de merger :

- [ ] Scénario 1 : état "Confirmé" affiché en < 3 sec, mail reçu, refresh OK
- [ ] Scénario 1 bis : marche sur preview **sans** webhook Stripe configuré (c'est le fallback synchrone qui fait le job)
- [ ] Scénario 2 : état "Paiement non finalisé" affiché, CTAs OK, aucun email envoyé
- [ ] Scénario 2 bis : carte refusée → booking reste `PENDING_PAYMENT` en DB (le cron fera le ménage)
- [ ] Scénario 3 : cron `expire-pending-bookings` répond 200 avec count correct
- [ ] Scénario 3 bis : sans `CRON_SECRET`, 401
- [ ] Scénario 3 ter : capacité du créneau libérée après expiration
- [ ] Aucune erreur rouge en console DevTools sur les 3 scénarios
- [ ] Aucun double-email observé sur le scénario 1 (cohérent avec l'idempotence `updateMany` conditionnelle)

## Cas que tu peux skipper si pressé

- Tester en locales `de` et `en` si seulement la copy FR a changé sur la page confirmation. Sinon, vérifier les 3 (la spec impose i18n complète).
- Tester mobile viewport — Léa a livré responsive mobile-first selon spec ; un coup d'oeil sur DevTools mode mobile suffit.

## Si un scénario échoue

Renvoie à Margot :

1. Numéro du scénario (1, 2, ou 3) + sous-cas (A/B le cas échéant)
2. URL preview exacte et `bookingId`
3. Screenshot de la page + onglet console DevTools
4. Si scénario 1/2 : `session_id` de l'URL + statut côté Stripe Dashboard (paid/unpaid/expired)
5. Si scénario 3 : output complet de la commande `curl` + statut DB du booking
