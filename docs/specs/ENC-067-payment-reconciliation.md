# ENC-067 — Payment Reconciliation (fallback synchrone)

Auteur : Luca (paiements)
Date : 2026-05-12
Statut : Spec — prête pour implémentation par Nora

## Contexte

Sur previews Vercel, les webhooks Stripe ne sont pas livrés (endpoint pas configuré pour les URLs de preview). Résultat : un booking confirmé par Stripe reste à `PENDING_PAYMENT` côté DB, et la page `/[locale]/booking/[id]/confirmation?session_id=cs_test_...` affiche indéfiniment "paiement en attente".

Le webhook reste **source de vérité**. On ajoute un **fallback synchrone** qui, depuis la page confirmation, interroge Stripe et applique la même mutation que le webhook si la session est payée. Côté prod, le webhook gagne quasi toujours la course ; le fallback est un filet de sécurité.

## Audit existant

- **Webhook handler** : `src/app/api/webhooks/stripe/checkout/route.ts` — gère `checkout.session.completed` et `checkout.session.expired`. La logique de flip `PENDING_PAYMENT → CONFIRMED` vit **inline** dans la fonction privée `handleCheckoutCompleted` (ligne 92+). Elle fait : check idempotence sur `booking.status`, génération `accessTokenHash`, update booking, envoi emails client + winery, capture PostHog, update `confirmationSentAt` / `wineryNotifiedAt`. **Non réutilisable telle quelle** : à extraire dans un service partagé.
- **Page confirmation** : `src/app/[locale]/(public)/booking/[id]/confirmation/page.tsx` — Server Component **passif** qui lit `booking.status` via `db.booking.findUnique` direct. Affiche un état "paymentPending" figé si `PENDING_PAYMENT`. Ne touche jamais à Stripe.
- **Checkout creation** : `src/server/actions/checkout.ts` (`createBookingAndCheckout`) — crée la Stripe Checkout Session avec `payment_method_types: ['card']` (TWINT pas encore activé ici — à noter pour Margot, hors scope ENC-067), `metadata.bookingId`, `success_url` contient `session_id={CHECKOUT_SESSION_ID}`. **Bonne nouvelle** : le sessionId est déjà dans l'URL de retour, on n'a rien à changer côté création.
- **Wrapper Stripe** : `src/server/stripe.ts` expose `getStripe()` + `isStripeConfigured()`. API version pinned `2025-12-15.clover`. À utiliser tel quel.
- **Pas de table `stripe_events`** : l'idempotence repose 100% sur le check `booking.status !== PENDING_PAYMENT`. Suffit pour ENC-067 (la collision webhook/fallback se résout via la transaction Prisma sur le booking). Une vraie table `stripe_events` reste recommandée à terme — à signaler à Margot pour un ADR séparé.

### Action préalable obligatoire

Extraire la logique de confirmation dans un **service partagé** : `src/server/services/booking-confirmation.service.ts`, exposant :

```ts
export async function confirmBookingFromCheckoutSession(args: {
  bookingId: string;
  stripeSessionId: string;
  stripePaymentIntentId: string;
  source: 'webhook' | 'reconciliation';
}): Promise<{ confirmed: boolean; alreadyConfirmed: boolean }>;
```

Le webhook ET l'action `reconcileBookingPayment` appellent ce service. La logique d'idempotence + emails + PostHog vit là, **une seule fois**. Le `source` part en log pour traçabilité.

## Contrat action `reconcileBookingPayment`

### Emplacement

`src/server/actions/booking-reconciliation.ts` (nouveau fichier, `'use server'`).

### Signature

```ts
'use server';

import type { ActionResult } from '@/types/actions';

export type PaymentReconciliationState =
  | { kind: 'CONFIRMED'; bookingId: string }
  | { kind: 'ALREADY_CONFIRMED'; bookingId: string }
  | { kind: 'ALREADY_CANCELLED'; bookingId: string; status: BookingStatus }
  | { kind: 'PAYMENT_FAILED_INSTANT'; retryUrl?: string }
  | { kind: 'PAYMENT_ASYNC_PENDING'; expectedBy?: Date }
  | { kind: 'SESSION_EXPIRED' };

export async function reconcileBookingPayment(
  input: ReconcileBookingPaymentInput
): Promise<ActionResult<PaymentReconciliationState>>;
```

### Validation Zod

Nouveau schema dans `src/lib/validators/booking.ts` (étendre l'existant) :

```ts
export const reconcileBookingPaymentSchema = z.object({
  bookingId: z.string().min(1),
  sessionId: z
    .string()
    .regex(/^cs_(test|live)_[A-Za-z0-9]+$/, 'Invalid Stripe session id'),
  accessToken: z.string().min(16).optional(),
});

export type ReconcileBookingPaymentInput = z.infer<
  typeof reconcileBookingPaymentSchema
>;
```

### Auth & accès

La page confirmation est publique (guest checkout) ; l'auth ne suffit donc pas. Politique :

1. `await auth()` — si user connecté ET `booking.userId === session.user.id` → OK.
2. Sinon, si `accessToken` fourni → hash SHA-256 et comparer à `booking.accessTokenHash` (constant-time). OK si match.
3. Sinon, **autoriser lecture uniquement si `booking.status === PENDING_PAYMENT` ET `sessionId` matche `booking.stripePaymentIntentId`** (le sessionId Stripe agit comme capability token — il est non-devinable et déjà présent dans `success_url` que seul Stripe redirige). Cas couvert : reconciliation immédiate post-checkout pour un guest qui n'a pas encore reçu le mail (donc pas de token).
4. Sinon → `{ code: 'FORBIDDEN' }`.

Note pour Hugo : tester explicitement (1), (2), (3) et le rejet.

### Logique pas-à-pas

```
1. safeParse(input). Erreur → VALIDATION_ERROR.
2. Rate limit : `reconcile:${ip}:${bookingId}`, 5 req/min. Erreur → RATE_LIMITED.
3. Charger booking (select status, stripePaymentIntentId, userId, accessTokenHash, expiresAt).
   - Non trouvé → NOT_FOUND.
4. Vérifier auth/accès selon politique ci-dessus.
5. Court-circuits idempotents (sans appel Stripe) :
   - status === CONFIRMED              → return { kind: 'ALREADY_CONFIRMED' }
   - status ∈ {CANCELLED_*, COMPLETED, NO_SHOW} → return { kind: 'ALREADY_CANCELLED', status }
6. À ce stade status === PENDING_PAYMENT.
   Appel Stripe :
     session = await getStripe().checkout.sessions.retrieve(sessionId, {
       expand: ['payment_intent'],
     });
   - Erreur Stripe (404, network) → log + return STRIPE_ERROR.
7. Vérifier session.metadata.bookingId === input.bookingId.
   - Mismatch → log warning (tentative de réutilisation de session) + FORBIDDEN.
8. Branchement sur session.status + session.payment_status :
   a) session.status === 'expired' OR
      (session.expires_at && session.expires_at * 1000 < Date.now())
      → return { kind: 'SESSION_EXPIRED' }
      (pas de DB write : le webhook expired ou le cron release fera le ménage)
   b) session.payment_status === 'paid'
      → appel confirmBookingFromCheckoutSession({
          bookingId,
          stripeSessionId: session.id,
          stripePaymentIntentId: typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent.id,
          source: 'reconciliation',
        })
        - { confirmed: true }         → return { kind: 'CONFIRMED' }
        - { alreadyConfirmed: true }  → return { kind: 'ALREADY_CONFIRMED' }
   c) session.payment_status === 'unpaid' :
      - Si payment_intent.status === 'requires_action' (3DS pending)
        → return { kind: 'PAYMENT_ASYNC_PENDING' }
      - Si payment_intent.status === 'processing' (TWINT confirmé côté user, settlement en cours, ou virement)
        → return { kind: 'PAYMENT_ASYNC_PENDING' }
      - Si payment_intent.last_payment_error présent
        OU payment_intent.status === 'requires_payment_method'
        → return { kind: 'PAYMENT_FAILED_INSTANT', retryUrl: experiences/[slug]/checkout?... }
      - Défaut prudent → PAYMENT_ASYNC_PENDING (laisser le cron expirer).
   d) session.payment_status === 'no_payment_required' (ne devrait jamais arriver pour nous)
      → log warn + fallback PAYMENT_ASYNC_PENDING.
9. Log structuré (eventId synthétique = `reco_${sessionId}`, bookingRef, amountCents, outcome).
```

### Side effects

- **Aucun DB write** sauf cas (b) `paid`, qui passe par le service partagé. Le service gère la transaction.
- **Pas d'emails depuis l'action elle-même** : le service `confirmBookingFromCheckoutSession` envoie le mail (même path que webhook), **une seule fois** (idempotence sur `confirmationSentAt`).

## Idempotence vs webhook

Trois courses possibles, toutes safe :

1. **Webhook arrive avant** : `reconcileBookingPayment` lit `status === CONFIRMED` au step 5 → `ALREADY_CONFIRMED`, pas d'appel Stripe, pas de DB write.
2. **Reconciliation arrive avant** : webhook ré-appelle `confirmBookingFromCheckoutSession` qui voit `status === CONFIRMED` et retourne `alreadyConfirmed: true` → no-op, no double-email.
3. **Race exact** : le service partagé fait l'update dans `db.$transaction` avec une `update` conditionnelle :
   ```ts
   const res = await tx.booking.updateMany({
     where: { id: bookingId, status: 'PENDING_PAYMENT' },
     data: { status: 'CONFIRMED', stripePaymentIntentId, accessTokenHash, expiresAt: null },
   });
   if (res.count === 0) return { confirmed: false, alreadyConfirmed: true };
   ```
   Un seul des deux callers obtient `count === 1`, l'autre `count === 0`. Email envoyé une seule fois.

Pour Rachid (revue) : vérifier que cette `updateMany` conditionnelle est bien dans la transaction et que les emails / PostHog sont dans le même `if (count === 1)`.

## Cas particuliers Stripe

- **TWINT (CH)** : confirmé via doc Stripe — TWINT est un paiement **instantané** en CHF, pas async. Côté `payment_intent.status` il transite typiquement `requires_action` (user redirige vers app TWINT) → `processing` (court) → `succeeded`. Pendant `requires_action`/`processing`, on retourne `PAYMENT_ASYNC_PENDING` (l'utilisateur n'a pas encore validé dans l'app). TWINT pas encore activé dans `payment_method_types` du checkout actuel (à signaler à Margot — hors scope ENC-067).
- **Cartes 3DS** : sur API `2025-12-15.clover`, `session.payment_status` reste `'unpaid'` tant que l'authentification 3DS n'a pas abouti. Le `payment_intent.status` est `requires_action`. Notre branche (c) le mappe à `PAYMENT_ASYNC_PENDING`. Stripe redirige normalement l'utilisateur vers la page de confirmation **après** 3DS résolu, donc en pratique on devrait toujours voir `paid` ; cette branche couvre l'edge case où l'user revient en arrière dans le flow 3DS.
- **Refund post-confirmation** : **hors scope ENC-067**. Géré par event `charge.refunded` côté webhook (à câbler dans un autre ticket si pas déjà fait — voir backlog). La reconciliation ne touche pas aux bookings déjà `CONFIRMED`.
- **`expand: ['payment_intent']`** : supporté par l'API Stripe `2025-12-15.clover`. Aucun blocker.

## Intégration côté page confirmation

Côté Server Component (`page.tsx`) :

```ts
const sessionId = (await searchParams).session_id;
if (booking.status === 'PENDING_PAYMENT' && typeof sessionId === 'string') {
  const reco = await reconcileBookingPayment({
    bookingId: booking.id,
    sessionId,
    accessToken: (await searchParams).t as string | undefined,
  });
  if (reco.success && reco.data.kind === 'CONFIRMED') {
    // Re-fetch booking pour le UI (status maintenant CONFIRMED)
    booking = await getBooking(id);
  } else if (reco.success && reco.data.kind === 'PAYMENT_FAILED_INSTANT') {
    // Afficher écran "paiement échoué" avec retryUrl
  }
  // Autres kinds → état actuel (pending) reste affiché avec message adapté
}
```

À noter : les `searchParams` du Server Component sont une `Promise` en App Router 14 — penser à `await`.

## Erreurs métier à exposer (copy à valider avec Théo)

| `kind`                   | Message UI                                                                      |
| ------------------------ | ------------------------------------------------------------------------------- |
| `CONFIRMED`              | Écran succès standard                                                           |
| `ALREADY_CONFIRMED`      | Écran succès standard                                                           |
| `ALREADY_CANCELLED`      | "Cette réservation a été annulée."                                              |
| `PAYMENT_FAILED_INSTANT` | "Votre paiement a échoué. Veuillez réessayer." + bouton "Reprendre la réservation" |
| `PAYMENT_ASYNC_PENDING`  | "Paiement en cours de traitement. Vous recevrez un email de confirmation."     |
| `SESSION_EXPIRED`        | "Votre session de paiement a expiré. Veuillez relancer la réservation."        |

À signaler à Théo : ces 4 nouveaux états UI n'existent pas encore dans `messages/{fr,de,en}.json` → keys à créer.

## Tests à prévoir (Hugo)

Unit (vitest) sur `reconcileBookingPayment` :

- [ ] booking inexistant → NOT_FOUND
- [ ] booking `CONFIRMED` → `ALREADY_CONFIRMED`, **pas** d'appel Stripe (mock `getStripe` et vérifier 0 call)
- [ ] booking `CANCELLED_BY_CLIENT` → `ALREADY_CANCELLED`, pas d'appel Stripe
- [ ] booking `PENDING_PAYMENT` + Stripe `payment_status === 'paid'` → `CONFIRMED`, booking flip en DB, mail envoyé
- [ ] booking `PENDING_PAYMENT` + Stripe `payment_status === 'paid'` mais déjà flip par webhook entre-temps → `ALREADY_CONFIRMED`, mail **pas** réenvoyé
- [ ] booking `PENDING_PAYMENT` + `session.status === 'expired'` → `SESSION_EXPIRED`, pas de DB write
- [ ] booking `PENDING_PAYMENT` + `payment_intent.status === 'requires_action'` → `PAYMENT_ASYNC_PENDING`
- [ ] booking `PENDING_PAYMENT` + `payment_intent.last_payment_error` présent → `PAYMENT_FAILED_INSTANT`
- [ ] `session.metadata.bookingId` ne matche pas l'input → FORBIDDEN
- [ ] Auth : user non-owner sans token et sans matching sessionId → FORBIDDEN
- [ ] Auth : access token correct (hash match) → autorisé
- [ ] Rate limit dépassé → RATE_LIMITED
- [ ] Concurrence : 2 appels parallèles sur même booking pending → un seul flip, un seul email (test avec `Promise.all` + mock du service)

E2E (playwright) :

- [ ] Flow happy : Stripe test card 4242 → redirect confirmation → fallback reconcile → UI succès affiché immédiatement (sans webhook configuré)
- [ ] Carte refusée 4000 0000 0000 0002 → UI "paiement échoué" avec retry

Service partagé `confirmBookingFromCheckoutSession` :

- [ ] booking `PENDING_PAYMENT` → confirmé + email envoyé + PostHog capturé
- [ ] booking déjà `CONFIRMED` → no-op, 0 email, 0 PostHog
- [ ] `updateMany` count === 0 (race) → `alreadyConfirmed: true`, 0 email
- [ ] Webhook handler après refacto : appelle bien le service et passe l'event Stripe original

## Points d'attention pour Rachid (revue)

- Vérifier que **tous les montants** restent en centimes integer dans le service (les logs incluent `amountCents`).
- Vérifier que le service partagé est appelé **à la fois** par le webhook et l'action — pas de code dupliqué.
- Vérifier l'`updateMany` conditionnelle (status filter) pour la race condition.
- Vérifier qu'aucun `console.log` ne traîne ; tout passe par `logger.ts`.
- Vérifier que `getStripe()` est utilisé partout (pas de `new Stripe(...)`).
