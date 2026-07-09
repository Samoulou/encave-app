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

- [ ] Hold créé à la sélection (« Continuer »), visible (compte à rebours), **libéré à T+10 exactement** : test prouvant qu'un hold expiré ne bloque plus la capacité et qu'un hold actif la bloque
- [ ] **Concurrence : 2 clients / 3 places → exactement 1 succès + 1 refus propre ; les conflits P2034 sont retryés, jamais exposés** (test de concurrence automatisé)
- [ ] TWINT proposé en premier, Link actif (vérifié en mode test par Sam ; fallback D4 testé)
- [ ] `/reservation/erreur` couvre paiement refusé ET hold expiré, avec retry/re-sélection (e2e)
- [ ] Création de compte en 1 tap post-paiement rattache les billets (test intégration : bookings du même email rattachés)
- [ ] Flag OFF / comportement existant : le flux actuel (hold au submit) reste le fallback si le hold amont n'existe pas — aucune réservation existante cassée
- [ ] Socle transverse vert (lint, format, i18n ×3, 867+ tests, build prod)

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
- **D6 — Compte 1 tap** : better-auth email/password — le « 1 tap » = choisir un mot de passe (email pré-rempli, non modifiable). Magic link = post-launch.
