# Revue ENC-067 — Rachid (sécu + qualité)

- **Date** : 2026-05-12
- **Branche** : `claude/improve-payment-status-yKSKL`
- **Commits reviewés** : `11727e9` → `13de19a` (8 commits applicatifs au-dessus de `dev`)
- **Périmètre** : implémentation Nora du fallback synchrone de réconciliation paiement + cron 30 min + UI 3 états.

## Périmètre audité

Fichiers nouveaux :

- `src/server/services/booking-confirmation.service.ts`
- `src/server/actions/booking/reconcileBookingPayment.ts`
- `src/types/payment-reconciliation.ts`
- `src/app/api/cron/expire-pending-bookings/route.ts`
- `src/components/features/booking/confirmation/ConfirmationHeader.tsx`
- `src/components/features/booking/confirmation/ConfirmationFinalizing.tsx`
- `src/components/features/booking/confirmation/ConfirmationPaymentFailed.tsx`
- `tests/unit/server/services/booking-confirmation.service.test.ts`
- `tests/unit/server/actions/reconcileBookingPayment.test.ts`

Fichiers modifiés :

- `src/app/[locale]/(public)/booking/[id]/confirmation/page.tsx` (rebranchement sur les 3 états)
- `src/app/api/webhooks/stripe/checkout/route.ts` (délégation au service partagé)
- `src/lib/validators/booking.ts` (schema reconcile)
- `messages/{fr,de,en}.json` (clés `booking.confirmation.*`)
- `vercel.json` (cron entry)

Fichiers supprimés :

- `AnimatedCheckmark.tsx`, `ConfirmationSuccess.tsx` (remplacés par `ConfirmationHeader.tsx`)

Vérifications externes lancées :

- `npx tsc --noEmit` → 0 erreur
- `npm run lint` → 0 warning / 0 erreur
- `npm run i18n:check` → 100% sur les 3 locales, 0 missing
- `npx vitest run` sur les 2 fichiers de test → 8 tests / 8 passent
- `npm run format:check` → warnings sur `docs/*.md` et `ExperienceManagementCard.tsx`, **hors scope ENC-067**

---

## BLOCKER (0)

Aucun. Aucun risque sécu, argent ou data leak critique identifié sur l'implémentation Nora.

---

## HIGH (3)

### H1 — `confirmBookingFromCheckoutSession` peut envoyer 2× les emails sur double appel post-flip

**Fichier** : `src/server/services/booking-confirmation.service.ts:184-245`

Le service utilise bien un `updateMany` conditionnel `status: PENDING_PAYMENT` pour la course (ligne 70-81). C'est correct pour la race entre 2 callers concurrents. **Mais** : la garde d'idempotence est portée par `count === 1` sur l'`updateMany`, pas par les flags `confirmationSentAt` / `wineryNotifiedAt`. Conséquence : si un opérateur appelle manuellement le service sur un booking déjà CONFIRMED **avec `status` forcé à PENDING_PAYMENT** (cas hypothétique mais non-bloqué côté code), ou si quelqu'un câble un retry sur un booking que le webhook a flippé puis ré-update vers PENDING_PAYMENT (cf. dette `revertBookingCheckIn` documentée dans ADR-0001), les emails partent une 2e fois.

Le contrat Luca précise (spec ENC-067-payment-reconciliation.md ligne 143) : « idempotence sur `confirmationSentAt` ». Ce n'est pas implémenté — la garde repose uniquement sur le statut.

**Suggestion** : avant `sendBookingConfirmationEmail`, ajouter un check `if (!booking.confirmationSentAt)`. Idem winery. Ces colonnes existent déjà. La redondance avec l'updateMany conditionnel est une ceinture+bretelles voulue par Luca dans le contrat.

### H2 — Auth niveau 1 (email match) accepte des emails non-vérifiés

**Fichier** : `src/server/actions/booking/reconcileBookingPayment.ts:58-63` (combiné à `src/server/better-auth.ts:96-102`)

C'est exactement le risque que Nora a remonté. Audit côté config better-auth :

```
emailAndPassword: { enabled: true, password: { ... } }
```

Aucun `requireEmailVerification: true`. Aucun bloc `emailVerification`. Conclusion : `session.user.email` n'est **pas garanti vérifié** pour les comptes créés en email/password. Pour Google/Apple OAuth l'email est implicitement vérifié côté provider, mais le flow email/password ne l'est pas.

Vecteur d'attaque concret :
1. Attaquant crée un compte avec l'email `mallory@example.com`.
2. Une vraie cliente fait un guest checkout en saisissant `mallory@example.com` (faute de frappe ou attaque ciblée).
3. Attaquant connecté arrive sur `/booking/<id>/confirmation` (devine le bookingId via énumération ou récupération depuis logs/Sentry/référer).
4. Level 1 match → attaquant peut déclencher `reconcileBookingPayment` → voit `kind: CONFIRMED` + `bookingId`.

Le risque est **partagé avec le reste du système** (n'importe quelle query email-based subit le même), mais ce ticket le matérialise au plus proche du paiement. Le bookingId n'est pas devinable (cuid 25 chars), donc l'attaque demande une fuite préalable du bookingId — risque résiduel faible mais non nul.

**Suggestion à court terme** : restreindre level 1 à des sessions dont l'email est vérifié. À défaut : créer un ticket dédié (à signaler à Margot + Élise pour le backlog) qui active `requireEmailVerification: true` côté better-auth. Si Sam estime que c'est hors scope ENC-067, accepter mais **documenter le risque résiduel dans l'ADR-0002** (3 lignes), pour ne pas qu'il disparaisse.

### H3 — Dette de naming `stripePaymentIntentId` rend la policy de niveau 3 fragile

**Fichier** : `src/server/actions/booking/reconcileBookingPayment.ts:77-82` (combiné à `src/server/actions/checkout.ts:231`)

La policy d'auth niveau 3 (sessionId-as-capability) repose sur le fait que `booking.stripePaymentIntentId` contient un `cs_...` **uniquement** en `PENDING_PAYMENT`. C'est documenté dans l'ADR-0002 §2 (« dette de naming ») mais le code ne se protège pas si la convention casse silencieusement. Si un refactor change l'ordre (par exemple : Stripe finit par renvoyer un PI inline, on l'update sans attendre le webhook), level 3 silencieusement échoue → tous les guest checkouts bascullent sur level 1 (email non-vérifié, cf H2) ou level 2 (token pas encore reçu).

**Suggestion** :
- Ajouter un type guard explicite à la ligne 78 : `booking.stripePaymentIntentId?.startsWith('cs_')`. Si le champ commence par `pi_...`, level 3 ne peut pas matcher de toute façon (sessionId fourni est `cs_...`), mais le guard explicite la dépendance et permet à la prochaine personne qui touche checkout.ts de comprendre pourquoi.
- Ajouter un commentaire ASCII-doc en tête de la fonction `authorizeAccess` qui pointe vers ADR-0002 §2 et le ticket de refacto à venir.

---

## MEDIUM (4)

### M1 — PII en clair dans les logs Pino (visitorEmail, winery email)

**Fichier** : `src/server/services/booking-confirmation.service.ts:202, 235`

```ts
logInfo('Confirmation email sent', {
  to: booking.visitorEmail,
  bookingRef: booking.reference,
  source,
});
```

L'email visiteur part en clair dans Pino → Vercel logs → potentiellement Sentry breadcrumbs. nLPD recommande la minimisation des données perso dans les logs (principe de minimisation art. 6 al. 3 nLPD). Le `bookingRef` suffit pour le debugging — le `to` n'apporte rien d'utile vs ce qu'on peut récupérer par jointure depuis bookingRef.

**Note** : cette log existait déjà dans la version webhook avant refactor — donc dette pré-existante. Nora l'a juste relocalisée. À traiter dans un ticket dédié si Sam préfère pas mélanger avec ENC-067.

**Suggestion** : remplacer `to: booking.visitorEmail` par `bookingRef: booking.reference` (déjà présent) et supprimer le `to`. Idem pour winery email.

### M2 — État UI 1bis "ça prend plus de temps que prévu" + polling 3s × 10 non implémenté

**Fichier** : `src/components/features/booking/confirmation/ConfirmationFinalizing.tsx`

La spec ENC-067.md (lignes 137-141) prescrit un polling client toutes les 3s, max 10 tentatives, puis état 1bis avec CTA "Actualiser". L'implémentation actuelle est un simple Suspense fallback (sans polling, sans état 1bis). Les clés i18n `BookingConfirmation.finalizing.slow.*` mentionnées dans la spec n'apparaissent pas dans `messages/`.

L'ADR-0002 ne mentionne pas ce simplification — donc soit c'est une décision implicite Jonas/Nora soit c'est un manque. Je n'ai pas le contexte pour trancher si c'est OK ou pas.

**Suggestion** : confirmer avec Margot/Théo si la simplification (Suspense-only) est validée. Sinon, soit ajouter le polling (server action `checkBookingConfirmationStatus` + composant client `'use client'`), soit acter la simplification en mettant à jour la spec et l'ADR.

### M3 — `kind: 'ALREADY_CANCELLED'` peut router le client guest non-owner vers la UI succès

**Fichier** : `src/app/[locale]/(public)/booking/[id]/confirmation/page.tsx:159-160, 170-184`

Le commentaire dans le code dit « ALREADY_CONFIRMED / ALREADY_CANCELLED → fall through ; we'll branch below based on the (possibly re-read) booking.status ». Le fall-through arrive sur un branch qui rend `ConfirmedView` pour tout statut **autre** que CANCELLED_BY_CLIENT / CANCELLED_BY_WINERY. Donc pour un statut `COMPLETED` ou `NO_SHOW`, on rend la UI "confirmé". C'est OK fonctionnellement (le booking a bien eu lieu) mais l'UX est ambiguë si le client revient sur la page après le rendez-vous.

Hors-scope direct ENC-067 (la spec se concentre sur PENDING → CONFIRMED / FAILED), mais à clarifier : le state machine `ALREADY_CANCELLED` retourne aussi le statut dans `data.status` mais on ne l'utilise pas pour différencier l'UI. On switch sur `booking.status` en local. C'est cohérent vu que la page re-fetch après CONFIRMED, mais incohérent vu qu'on ne re-fetch pas après ALREADY_CANCELLED → si entre-temps un cancel a eu lieu côté webhook, on rend stale.

**Suggestion** : re-fetch `loadBooking(id)` aussi sur `ALREADY_CONFIRMED` et `ALREADY_CANCELLED` pour garantir la cohérence avec le statut réel. Ça coûte une query, on est en SSR, c'est acceptable.

### M4 — Tests unitaires : `as unknown as Awaited<...>` dans les mocks

**Fichier** : `tests/unit/server/actions/reconcileBookingPayment.test.ts:90-93, 122-125, 167-170` et plusieurs autres lignes ; `tests/unit/server/services/booking-confirmation.service.test.ts:82-88, 86-88`

`as unknown as` est un cousin de `as any` interdit par `CLAUDE.md`. Il est tolérable quand on mock du Prisma typé (les types sont énormes), mais préférable d'utiliser un helper typé ou de définir un type local minimal qu'on étend ensuite. Pas un blocker, mais une dette qui se reproduira à chaque test booking.

**Suggestion** : créer un helper `tests/unit/_helpers/mockBooking.ts` qui retourne un objet typé `Partial<Booking> & { ... }` et qui isole le cast en un seul endroit.

---

## LOW / NIT (5)

### N1 — `bookingId` schema accepte `.min(1)` au lieu d'un cuid pattern

**Fichier** : `src/lib/validators/booking.ts:11`

Booking IDs sont des cuids (25 chars). Le validator accepte n'importe quelle string non-vide. Pas exploitable (Prisma escape), mais on perd un check précoce.

**Suggestion** : `z.string().regex(/^c[a-z0-9]{24}$/)` ou `.length(25)`. Cohérent avec la rigueur du `sessionId` schema juste en dessous.

### N2 — Level 3 auth : comparaison `===` non timing-safe

**Fichier** : `src/server/actions/booking/reconcileBookingPayment.ts:79`

`booking.stripePaymentIntentId === providedSessionId` est une comparaison string standard. Le sessionId Stripe a ~30 chars d'entropie, donc le risque de timing attack est très faible. Néanmoins, pour cohérence avec le level 2 (qui utilise `crypto.timingSafeEqual` ligne 72) on pourrait timing-safe le level 3 aussi.

**Suggestion** : `crypto.timingSafeEqual(Buffer.from(...), Buffer.from(...))` ou laisser tel quel et noter que c'est un capability token, pas un secret.

### N3 — `index.ts` barrel maintenu

**Fichier** : `src/components/features/booking/confirmation/index.ts`

CLAUDE.md interdit explicitement les barrel files. Le fichier existait déjà avant le PR (Nora l'a juste modifié). À supprimer dans un ticket dédié de nettoyage (signaler à Margot).

### N4 — `confirmation/page.tsx` importe `db` directement

**Fichier** : `src/app/[locale]/(public)/booking/[id]/confirmation/page.tsx:7, 69-92`

Pré-existant — la page utilise `db.booking.findUnique` directement au lieu de passer par une query cachée. Convention CLAUDE.md violée (« Components never import `db` »). Hors scope ENC-067, à traiter avec le ticket de migration vers `src/server/queries/booking.queries.ts`.

### N5 — Service partagé pourrait split le côté "emails" en sous-fonction

**Fichier** : `src/server/services/booking-confirmation.service.ts:184-245`

La fonction `confirmBookingFromCheckoutSession` fait ~190 lignes : updateMany + reload + revalidateTag + PostHog + 2 emails. Lisible mais touffue. À l'aise pour le merge actuel, mais si on rajoute des side effects (notif winemaker push, audit log, ICS), extraire `sendConfirmationSideEffects(booking, source)` aérera.

---

## Bons points

- Service partagé bien découpé. La logique d'idempotence (`updateMany` conditionnel) est correctement en première position avant tout side effect — la garde fonctionne.
- Auth policy 3-niveaux **documentée dans le code** (commentaire ligne 35-43), pas seulement dans la spec.
- `crypto.timingSafeEqual` correctement utilisé pour le hash de token (level 2) avec le bon check de longueur préalable.
- Rate limit 5/min × IP × booking est raisonnable. Pas exploitable pour scraper en l'état — l'`updateMany` conditionnel + le check metadata `bookingId` au step 7 verrouillent la session.
- Cron protégé par `verifyCronRequest()` (CRON_SECRET ou header `x-vercel-cron`). OK.
- Webhook conserve la signature Stripe `constructEvent` — non régression.
- Cache invalidation **uniquement quand `count === 1`** — conforme ADR-0002 §3.
- Pas de `console.log` dans le diff, pas de `parse()` (que des `safeParse`), pas de `throw` depuis l'action, `'use server'` en première ligne du fichier action — clean.
- Tous les montants restent en `Int` centimes, conversion `/ 100` propre dans le PostHog capture seulement (ligne 161-163 du service).
- i18n : 100% coverage sur les 3 locales, les 14 nouvelles clés sont dans `fr/de/en`.
- Tests : couvrent le happy path, ALREADY_CONFIRMED (sans appel Stripe), ALREADY_CANCELLED, FAILED_INSTANT, SESSION_EXPIRED + le race-loser côté service. Bonne couverture.
- TS strict : 0 erreur tsc, 0 warning lint, 0 `!`, 0 `as any` dans le code applicatif (seulement `as unknown as` dans les mocks de test).
- Webhook handler refactoré sans casser les events `checkout.session.expired` (pré-existant).

---

## Réponse aux 3 points d'attention Nora

1. **Auth niveau 1 sur email non-vérifié** → **risque RÉEL** confirmé (voir H2). Sans `requireEmailVerification` côté better-auth, level 1 est exploitable si le bookingId fuite. Le fallback level 3 (sessionId-as-capability) est OK pour le cas légitime du guest fraîchement payé — il **n'est pas un palliatif** au pb de level 1, c'est un mécanisme complémentaire pour le guest sans token email. Décision à prendre avec Margot : durcir tout de suite (level 1 = email vérifié uniquement) ou ouvrir ticket dédié. Ma reco : durcir maintenant, le coût est de 2 lignes.

2. **Dette `stripePaymentIntentId` cs_/pi_** → confirmée fragile (H3). Bug subtil possible si quelqu'un refactor checkout.ts sans capter la dépendance. Mitigation simple : type guard `startsWith('cs_')` ligne 79 + commentaire pointant vers ADR-0002 §2. Pas un blocker, mais à faire dans ce même PR si possible (3 lignes).

3. **Rate limit 5/min × IP × bookingId** → suffisant et non-exploitable pour scraper. Le bookingId est dans la clé de rate limit donc un attaquant qui itère sur des bookingIds frappe une clé fresh à chaque coup → bénéfice nul puisque l'auth check rejette de toute façon. Si jamais le rate limit est contourné via IP rotation, l'attaquant frappe le step 5 (idempotent short-circuit, pas d'appel Stripe). Le risque scraping est négligeable. OK.

---

## Verdict

**MERGE AVEC FIX** des 3 HIGH avant merge sur `dev`.

- **H1** (double email garde) : 5 lignes à ajouter dans le service. Bloquant si on veut respecter le contrat Luca.
- **H2** (level 1 email non-vérifié) : si Sam tranche "durcir maintenant" → 2 lignes (check `emailVerified`). Si "ticket dédié" → ajouter 3 lignes dans ADR-0002 et créer le ticket. Quoi qu'il arrive, **un retour Luca recommandé** sur le risque.
- **H3** (cs_/pi_ type guard) : 3 lignes à ajouter dans `authorizeAccess`. Petit mais important.

Les MEDIUM peuvent être adressés en même temps si Nora a la bande passante, sinon en suivi. Les NIT sont optionnels.

**Ping Margot** : H2 implique une décision produit/sécu (durcir l'email verification globalement). Recommande de faire trancher Sam et de ramener Luca sur le sujet.
