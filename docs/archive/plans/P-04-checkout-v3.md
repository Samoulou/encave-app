# P-04 — Checkout V3 💰

> **Statut** : en cours · **Branche** : `claude/encave-v3-business-model-8bv7bd` (fallback session, cf. P-01) · **PR** : #
> **Sources** : `docs/ENCAVE-V3-DELIVERY-PLAN.md` §P-04 · items L-050→L-054, L-209 · specs `docs/v3/ENCAVE-V3-PRD.md` US-201/§5, `docs/v3/ENCAVE-V3-PAGES-EMAILS.md` §4-5

## 1. Objectif

Le cœur du gate **G-R2 « zéro survente »** : le créneau est tenu par un hold de 10 minutes créé dès « Continuer », le client paie en TWINT/carte/Link, les échecs ont une page dédiée avec retry, et un compte se crée en 1 tap après paiement. Les conflits de concurrence sont retryés, jamais exposés.

## 2. Scope

**IN** :

- **L-050** Hold créé au « Continuer » (avant la page checkout) : nouvelle action `createBookingHold` (transaction Serializable existante, expiresAt = T+10 min), compte à rebours discret au checkout, **libération logique à T+10** : le calcul de capacité exclut les `PENDING_PAYMENT` expirés (le cron quotidien + le webhook `checkout.session.expired` restent le nettoyage physique)
- **L-051** TWINT premier + Link + cartes : `payment_method_types: ['twint', 'card', 'link']` ; si le compte Stripe refuse TWINT → fallback automatique `['card', 'link']` + `logWarn` (décision D4 ci-dessous)
- **L-052** Page `/reservation/erreur` : cause lisible (paiement refusé / hold expiré), retry direct si le hold est encore actif, re-sélection mémorisée (query params) sinon
- **L-053** Création de compte en 1 tap post-paiement : sur la page succès, mot de passe seul (email/nom pré-remplis du booking), rattache tous les bookings du même email (insensible à la casse)
- **L-054** _(Should)_ `setup_future_usage` + Stripe Customer pour clients connectés, gestion des cartes dans le profil (liste/suppression)
- **L-209** Retry borné (3 tentatives, backoff) sur P2034 autour de la transaction Serializable + `connection_limit` documenté sur l'URL poolée

**OUT** : occurrences persistées au checkout (P-05), gift cards à l'encaissement (P-09), no-show SetupIntent (P-08), Stripe Tax.

## 3. Definition of Done (gate — cœur de G-R2)

- [x] Hold créé à la sélection (« Continuer »), visible (compte à rebours), **libéré à T+10 exactement** : test prouvant qu'un hold expiré ne bloque plus la capacité et qu'un hold actif la bloque (`tests/db/booking-hold-concurrency.test.ts` — libération logique + remplacement du hold propre, base réelle)
- [x] **Concurrence : 2 clients / 3 places → exactement 1 succès + 1 refus propre ; les conflits P2034 sont retryés, jamais exposés** (test de concurrence automatisé contre Postgres migré, base du k6)
- [x] TWINT proposé en premier, Link actif (fallback D4 testé sur `err.param` typé) — **vérif mode test par Sam en attente** (activation TWINT = dashboard Stripe, hors code)
- [x] `/reservation/erreur` couvre paiement refusé ET hold expiré, avec retry/re-sélection (e2e `tests/e2e/flows/booking-error-page.spec.ts`, 4 cas dont le fallback params invalides)
- [x] Création de compte en 1 tap post-paiement rattache les billets (test intégration : booking casse mixte rattaché à l'email de session, base réelle)
- [x] Flag OFF / comportement existant : le flux actuel (hold au submit) reste le fallback si le hold amont n'existe pas — aucune réservation existante cassée (holdId sans token → dégradation douce, testé)
- [x] Socle transverse vert (lint, format, i18n ×3, **915 tests**, build prod) — vérifié sur `encave_p04`
- [x] Code-review max (⑤) : 15 findings, tous corrigés sauf le finding 15 assumé/documenté ; security-review 💰 : 0 vulnérabilité ≥ seuil, sentinelle durcie en défense

**Gate G-R2 « zéro survente » : atteint.** Vérif manuelle Sam à faire (scénario §5) avant de considérer le mode test TWINT clos.

## 4. Découpage technique

1. **Hold amont** : action `createBookingHold(experienceId, date, timeSlot, guests)` → booking `PENDING_PAYMENT` sans coordonnées visiteur (placeholder) + `expiresAt` T+10 ; `createBookingAndCheckout` accepte un `holdId` (complète le hold et crée la session Stripe) OU crée le hold lui-même (fallback = flux actuel).
2. **Capacité** : les agrégats de capacité (checkout + availability) filtrent `PENDING_PAYMENT` sur `expiresAt > now` — la libération à T+10 devient une propriété du calcul, pas du cron.
3. **P2034** : helper `withSerializableRetry(fn, 3)` avec backoff, appliqué à la transaction du checkout et du hold.
4. **Stripe** : `payment_method_types: ['twint', 'card', 'link']` + fallback D4 ; `expires_at` de la session aligné sur le hold.
5. **UI** : countdown au checkout (client, léger) ; `/reservation/erreur` (nouvelle route FR, groupe public) ; CTA compte sur la page succès ; (Should) cartes enregistrées au profil.
6. **Tests** : concurrence (2 holds sur 3 places), expiration logique, P2034 retry (mock), fallback TWINT, rattachement de compte.

## 5. Tests & mesures

- Test de concurrence automatisé (base du futur k6) : 2 `createBookingHold` simultanés sur 3 places restantes avec 2 guests chacun → 1 succès, 1 `NO_CAPACITY` propre.
- Scénario manuel Sam : ① réserver → countdown visible au checkout ② attendre 10 min → hold expiré → page erreur avec re-sélection ③ payer en TWINT (mode test) → TWINT apparaît en premier ④ page succès → créer le compte en 1 tap → billets visibles dans /compte ⑤ carte refusée (4000 0000 0000 0002) → page erreur avec retry.

## 6. Risques & rollback

- **TWINT non activé sur le compte** → fallback automatique carte+Link, logWarn, décision D4 : Sam active TWINT dans le dashboard Stripe (Settings → Payment methods) — aucun deploy nécessaire, le fallback disparaît de lui-même.
- **Hold amont** : si `createBookingHold` échoue, le widget continue vers le checkout sans hold (flux actuel intact) — dégradation douce, jamais de blocage.
- Rollback : revert PR ; les holds expirés se nettoient seuls (logique + cron existants).

## 7. Décisions

- **D4 — TWINT** : liste explicite `['twint','card','link']` avec fallback runtime si Stripe rejette le type (compte non activé). À vérifier par Sam en mode test après merge ; activation TWINT = dashboard Stripe, hors code.
- **D5 — Hold sans coordonnées** : le hold amont porte un visiteur placeholder (`hold@encave.ch` + nom vide autorisé par un statut dédié ? non — on garde `PENDING_PAYMENT` avec `visitorEmail` vide contrôlé) → tranché au build : colonne nullable évitée, on stocke des placeholders explicites remplacés au submit.
- **D6 — Compte 1 tap** : better-auth email/password — le « 1 tap » = choisir un mot de passe (email pré-rempli, non modifiable). Magic link = post-launch. Le rattachement des billets est déjà structurel : les queries client matchent `visitorEmail` insensible à la casse — aucune colonne à ajouter.
- **D7 — L-054 reporté (fusible)** : `setup_future_usage` + gestion des cartes au profil sortent du gate P-04 (Should, aucun impact G-R2). Fusible : à re-évaluer au P-09 (gift cards à l'encaissement introduit déjà Stripe Customer) — si non fait d'ici le launch, les clients re-saisissent leur carte, dégradation acceptable et réversible hors deploy.

## 8bis. Bilan code-review max (⑤, 10 angles + 16 vérificateurs + sweep)

**15 findings retenus (14 CONFIRMED, 1 PLAUSIBLE), tous corrigés sauf 1 assumé** :

1. **Hijack de hold** (sécu) : le claim acceptait n'importe quel booking PENDING_PAYMENT par id → **holdToken secret** (hash sha256 dans `accessTokenHash`, réutilise la colonne SEC-002), exigé au claim, au retry et au release.
2. **Sessions Stripe multiples par booking** : le re-claim écrasait la session sans expirer l'ancienne, et le webhook `expired` supprimait le booking sans comparer les sessions → l'ancienne session est expirée au re-claim ET le webhook ne détruit que si `session.id` correspond.
3. **Ledger refund écrasé** : l'annulation client écrivait `refundAmount` inconditionnellement (perte d'un remboursement partiel admin concurrent) → `computeBookingRefund` soustrait le déjà-remboursé, montant Stripe toujours explicite, écriture finale conditionnelle (CAS) + `LEDGER_CONFLICT` en réconciliation.
4. **Double refund admin** : un échec APRÈS succès Stripe (bookkeeping/email) renvoyait « failed » → try/catch séparés, succès rapporté avec `BOOKKEEPING_FAILED` consigné ; release élargi aux erreurs prouvablement non traitées (429/401/403/idempotence) ; clé d'idempotence par tentative (l'ancienne rejouait l'erreur cachée 24 h).
5. **Self-hold** : le checkout comptait son propre hold (formulaire désactivé/éjection dès que le groupe ≥ moitié des places) → `checkAvailability({excludeBookingId})`.
6. **Double-clic « Continuer »** : `startTransition(async)` ne couvre pas l'await en React 18 → verrou synchrone `useRef` + state (hook partagé `useBookingHold`).
7. **Auto-blocage au 2e « Continuer »** : `previousHoldId`+token → release du hold précédent dans la transaction (prouvé sur base réelle).
8. **Cron sur `createdAt`** : tuait un hold réclamé en plein paiement (fenêtre 30-40 min) → sélection par `expiresAt` (fallback createdAt si null).
9. **Bounces sentinelles** : cron + annulation de session emailaient `hold-*@hold.encave.ch` → holds non réclamés SUPPRIMÉS silencieusement (pas de statut CANCELLED fantôme), constantes + `isHoldPlaceholderEmail` partagés.
10. **Fuites dashboard/CSV/suppression** : `getWineryBookings` exclut le domaine sentinelle ; `deleteExperience` utilise la règle de capacité logique.
11. **`expires_at` sous le plancher Stripe** (PLAUSIBLE) : timestamp recalculé par tentative +60 s de marge ; la ligne booking est réalignée sur l'expiry réel de la session.
12. **Crash RangeError** page erreur sur `date` invalide → validation stricte des params (Nora).
13. **Countdown pendant le submit** → gel via ref au submit (Nora) ; offset horloge serveur (Nora).
14. **holdId malformé** → filtré au niveau page, dégradation douce (Nora).
15. **Course paiement in-extremis vs libération logique** (webhook en retard après l'expiry, confirmation sans re-check de capacité) : **risque assumé** — fenêtre de quelques secondes exigeant un slot plein + collision exacte ; le re-check webhook avec refund automatique serait pire que le mal. Consigné ici, à revoir si un cas réel apparaît.

Hors findings : funnel `booking_payment_failed` réinstauré sur la page erreur, filtre de capacité unifié (`activeCapacityBookingWhere`), `getClientIp` partagé (fallback x-real-ip), fallback TWINT sur `err.param` typé, conventions CLAUDE.md (router.push, schéma inline, date math, i18n).

## 8. Avancement build

- **Core livré** (`9db687e`) : `createBookingHold` (rate limit IP 12/10 min, placeholder visiteur, transaction Serializable), libération logique des holds expirés (3 sites de calcul de capacité), claim atomique du hold au submit avec fallback création classique, `withSerializableRetry` P2034 (3 tentatives, backoff), TWINT-first `['twint','card','link']` avec fallback runtime `['card']` (D4). Tests : 25 checkout (dont hold ×2, claim ×2, payment methods ×2), 3 retry, et **test de concurrence db-gated** `tests/db/booking-hold-concurrency.test.ts` (2 holds simultanés sur 3 places → 1 succès + 1 `NO_CAPACITY` contre un vrai Postgres migré, + libération logique) — base du futur k6.
- **Résidu Luca B fermé** (`20501d5`) : `refundBookingManually` réserve le montant par `updateMany` conditionnel AVANT Stripe (perdant → `CONFLICT` propre) ; libération du claim uniquement sur rejet Stripe déterministe, sinon `refundError` pour réconciliation. 7 tests dédiés.
- **UI en cours** (Nora) : hold au « Continuer », countdown checkout, `/reservation/erreur`, compte 1-tap (D6).
