# ADR 0002 — Architecture de la réconciliation paiement Stripe (ENC-067)

- **Statut** : Accepté
- **Date** : 2026-05-12
- **Décideurs** : Margot, Sam, Jonas (archi), Luca (paiements)
- **Tickets** : ENC-067

## Contexte

Sur previews Vercel, les webhooks Stripe `checkout.session.completed` ne sont pas livrés (endpoint non configuré pour URLs preview). Conséquence : un booking payé par l'utilisateur reste figé sur `PENDING_PAYMENT` et la page `/[locale]/booking/[id]/confirmation` affiche indéfiniment "paiement en attente". Le webhook reste la source de vérité (Option C runbook), on ajoute un **fallback synchrone** côté page confirmation et un **cron d'expiration** des bookings abandonnés. Décisions Sam actées : carte only (`payment_method_types: ['card']`), pas de retry sur le même bookingId (un échec = nouveau booking).

## Décision

### 1. Découpage modules

- **`src/server/services/booking-confirmation.service.ts`** *(nouveau)* — extrait la logique inline de `handleCheckoutCompleted` (webhook actuel) dans un service réutilisable. Signature :
  ```ts
  export async function confirmBookingFromCheckoutSession(args: {
    bookingId: string;
    stripeSessionId: string;
    stripePaymentIntentId: string;
    source: 'webhook' | 'reconciliation';
  }): Promise<{ confirmed: boolean; alreadyConfirmed: boolean }>;
  ```
  Gère : update conditionnel `updateMany({ where: { status: 'PENDING_PAYMENT' } })`, génération `accessTokenHash`, envoi emails (client + winery), capture PostHog, log Pino structuré avec `source`. **Une seule fois**.

- **`src/server/actions/booking-reconciliation.ts`** *(nouveau, `'use server'`)* — server action `reconcileBookingPayment`. **Ne pas** mettre dans `booking.ts` existant (fichier déjà chargé en responsabilités). Le naming `booking-reconciliation.ts` respecte la convention kebab du dossier `actions/`.

- **`src/app/api/webhooks/stripe/checkout/route.ts`** *(refactor)* — la fonction privée `handleCheckoutCompleted` (lignes 92-200) délègue désormais au service partagé en passant `source: 'webhook'`. Le handler garde la responsabilité de signature verification + dispatch d'event uniquement.

- **`src/app/api/cron/release-pending-bookings/route.ts`** *(nouveau)* — endpoint cron d'expiration (voir §5). Convention de nommage alignée sur l'existant (`reminders`, `daily-digest`, etc.).

- **`src/lib/validators/booking.ts`** *(extend)* — ajout `reconcileBookingPaymentSchema` (Zod v4, `safeParse` only).

### 2. Schema Prisma — pas de migration

**Aucun changement de schema requis.** Audit :

- `Booking.status` : enum existant `PENDING_PAYMENT | CONFIRMED | CANCELLED_BY_CLIENT | CANCELLED_BY_WINERY | COMPLETED | NO_SHOW`.
- `Booking.stripePaymentIntentId : String?` — **naming trompeur** : avant confirmation, ce champ contient en réalité le `cs_...` (checkout session id, cf `checkout.ts:231`) ; après confirmation, le webhook l'écrase avec le `pi_...` (cf `webhooks/stripe/checkout/route.ts:161`). C'est de la dette mais pas un blocker pour ENC-067 : on le réutilise tel quel. **À renommer dans un ticket dédié** (proposition : split en `stripeCheckoutSessionId` + `stripePaymentIntentId`, hors scope).
- `Booking.expiresAt : DateTime?` — déjà présent, utilisé par le cron (§5).
- `Booking.accessTokenHash : String?` — déjà présent.

**Pas de champ `paymentReconciledAt` / `confirmationSource` ajouté** : la traçabilité passe par le log Pino structuré (`source: 'webhook' | 'reconciliation'`) émis par le service. Ajouter une colonne pour de la pure observabilité est une dette qu'on ne contracte pas tant que les logs Sentry/Pino suffisent. Si Marco a besoin de stats produit là-dessus, on ajoute la colonne au moment où le besoin est confirmé (YAGNI).

**Pas de table `stripe_events`** pour ce ticket. L'idempotence repose sur l'`updateMany` conditionnel `where: { id, status: 'PENDING_PAYMENT' }` qui est atomique au niveau row Postgres. Suffisant pour la collision webhook/reconcile. Une vraie table `stripe_events` (avec event.id Stripe en PK pour deduper les replays) reste recommandée à terme et fera l'objet d'un ADR séparé si on observe des doublons en prod.

### 3. Caching

- La page `confirmation/page.tsx` est un Server Component. L'appel à `reconcileBookingPayment` est une **mutation** : aucun cache à poser sur le call.
- Le `getBooking(id)` (lecture pour rendre l'UI) **doit déjà** être taggé `booking:${id}` côté `src/server/queries/`. Si ce n'est pas le cas, ajouter le tag dans ce ticket.
- **Tags à `revalidateTag()` après `CONFIRMED`** (dans le service `confirmBookingFromCheckoutSession`, **uniquement** si `count === 1` côté `updateMany`) :
  - `booking:${bookingId}` — détail booking (page confirmation + page guest)
  - `booking:winery:${winerySlug}` — liste dashboard winery (pour faire apparaître la nouvelle confirmation)
  - `experience:${experienceSlug}:availability` — capacité dispo réajustée (la place est désormais ferme, plus juste une réservation pending). Réutiliser `invalidateExperienceCaches(winerySlug, experienceSlug)` si déjà branché sur ces tags.
- **Pas de `revalidatePath`.** Tags only, conformément à `CLAUDE.md`.

### 4. Contrat ActionResult — 5 états (pas 6)

Le retrait de `PAYMENT_ASYNC_PENDING` (Sam : carte only, pas d'async settlement) **simplifie** le contrat de Luca à 5 états :

```ts
export type PaymentReconciliationState =
  | { kind: 'CONFIRMED'; bookingId: string }
  | { kind: 'ALREADY_CONFIRMED'; bookingId: string }
  | { kind: 'ALREADY_CANCELLED'; bookingId: string; status: BookingStatus }
  | { kind: 'PAYMENT_FAILED_INSTANT' }   // pas de retryUrl : nouveau booking obligatoire
  | { kind: 'SESSION_EXPIRED' };
```

Notes vs spec Luca :

- `PAYMENT_ASYNC_PENDING` **supprimé**. La branche (c) de la spec (step 8c) qui traitait `requires_action` / `processing` est repliée sur `PAYMENT_FAILED_INSTANT` côté carte : si `payment_status === 'unpaid'` après retour sur `success_url`, c'est que la carte a été refusée ou que l'user a abandonné le 3DS. Pas d'attente.
- `PAYMENT_FAILED_INSTANT` **ne porte plus de `retryUrl`** : décision Sam, retry = nouveau booking depuis la page expérience. L'UI affiche "Paiement échoué" + CTA "Réserver à nouveau" qui pointe vers `/experiences/[slug]`.
- Toutes les branches d'erreur restent les mêmes : `UNAUTHORIZED` (no-op : action publique avec capability token), `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `RATE_LIMITED`, `STRIPE_ERROR`. Retour `ActionResult<PaymentReconciliationState>` jamais throw.

Autres validations du contrat Luca :

- ✅ Politique d'auth 3-niveaux (session user / accessToken hashé / sessionId-as-capability) — OK, le sessionId Stripe est non-devinable (entropie suffisante) et exclusivement passé par redirect Stripe.
- ✅ Rate limit `reconcile:${ip}:${bookingId}` 5 req/min — OK, à brancher sur `rate-limit.service.ts` existant.
- ✅ `updateMany` conditionnel pour la race webhook/reconcile — OK et **obligatoire**.
- ✅ Tenant isolation : non applicable ici (l'action lit son propre booking via ID, vérifie ownership user/token/session). Pas de risque cross-tenant.

### 5. Cron d'expiration

- **Endpoint** : `src/app/api/cron/release-pending-bookings/route.ts` (GET, `export const dynamic = 'force-dynamic'`, `export const maxDuration = 60`).
- **Auth** : `await verifyCronRequest()` depuis `src/lib/cron-auth.ts` (pattern existant).
- **Schedule** : `*/5 * * * *` (toutes les 5 min). À ajouter dans `vercel.json` :
  ```json
  { "path": "/api/cron/release-pending-bookings", "schedule": "*/5 * * * *" }
  ```
- **Note Hobby** : Vercel Hobby plafonne à 2 crons configurés et fréquence min = 1/jour. À vérifier avec Margot — si toujours sur Hobby, le cron 5min nécessite l'upgrade Pro (déjà identifié dans backlog cdg1). Sinon, fallback : `*/15` ou cron horaire avec fenêtre de tolérance plus large.
- **Logique** :
  ```ts
  const cutoff = new Date(Date.now() - 30 * 60 * 1000);
  const result = await db.booking.updateMany({
    where: {
      status: 'PENDING_PAYMENT',
      createdAt: { lt: cutoff },
    },
    data: { status: 'CANCELLED_BY_CLIENT', cancelledAt: new Date() },
  });
  ```
- **Statut utilisé** : `CANCELLED_BY_CLIENT` (réutilise l'enum existant). **Pas de nouveau statut `CANCELLED_BY_SYSTEM`** : ajouter une valeur d'enum casse les `switch` exhaustifs partout dans le code (audit rapide : ≈15 fichiers). Le commentaire sémantique "expiration timeout" passe par le log Pino. Si Marco veut distinguer abandon vs annulation manuelle dans les stats, on ajoutera une colonne booléenne `expired` plus tard. **Alternative écartée** : créer `CANCELLED_BY_SYSTEM` — bénéfice marginal, coût élevé (refacto exhaustif + migration enum).
- **Side effects** :
  - Aucun email envoyé (décision spec : le client comprendra qu'il doit refaire).
  - Pas d'appel Stripe (la session expire d'elle-même côté Stripe via `expires_at` déjà passé en `createCheckoutSession`).
  - Invalidation cache : `revalidateTag('experience:${experienceSlug}:availability')` pour libérer la capacité côté UI. Optionnellement `booking:${id}` mais peu utile (booking abandonné, pas d'UI à rafraîchir).
  - Log Pino : `{ msg: 'pending_bookings_released', count: result.count, cutoff }`.

## Conséquences

### Positives

- Page confirmation débloquée sur preview sans dépendre du webhook (déblocage Margot/Hugo immédiat).
- Une seule source de logique de confirmation (`booking-confirmation.service.ts`) → emails / PostHog / `accessTokenHash` jamais dédupliqués accidentellement.
- Idempotence garantie par contrainte DB (`updateMany` conditionnel), pas par convention applicative.
- Cron d'expiration libère la capacité expérience pour les autres clients (sans cron, un abandon bloque un créneau 24h).
- Aucune migration cassante : déploiement preview → staging → prod sans risque schema.

### Négatives

- **Dette de naming** : `Booking.stripePaymentIntentId` continue de stocker un `cs_...` puis un `pi_...` selon le statut. Pollution sémantique persistante jusqu'au ticket de refacto.
- **Pas de table `stripe_events`** : si Stripe replaye un event ancien après refacto, on s'appuie uniquement sur le state machine du booking. Risque faible mais réel — à monitorer.
- **Cron 5min sur Hobby** : nécessite upgrade Pro Vercel. Si Margot refuse, fenêtre de release passe à 15min, donc capacité bloquée jusqu'à 45min sur un abandon (acceptable).
- **`PAYMENT_FAILED_INSTANT` sans retry** : si l'user fait une faute de frappe carte, il refait toute la saisie (date, guests, infos visiteur). UX dégradée vs retry classique — assumé par Sam.

## Alternatives écartées

1. **Webhook only, sans fallback** : laisse la page confirmation cassée sur preview. Inacceptable pour Hugo qui teste sur preview.
2. **Polling client-side `useEffect` toutes les 2s** : viole l'architecture (Server Component → Server Action), gaspille des appels Stripe, expose le sessionId côté client. Rejeté.
3. **Ajout colonne `confirmationSource` + `paymentReconciledAt`** : observabilité gratuite mais YAGNI tant que les logs Pino suffisent. Reportée.
4. **Nouveau statut `CANCELLED_BY_SYSTEM`** : sémantiquement propre mais casse tous les `switch` exhaustifs. Coût > bénéfice tant qu'on n'a pas de besoin produit distinct.
5. **Table `stripe_events` pour idempotence forte** : pertinent à terme, surdimensionné pour ENC-067 où la race est résolue au niveau row.
