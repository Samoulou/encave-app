# P-01 — Fiabilisation & quick wins perf

> **Statut** : code terminé — reste : test manuel scan (Sam), ⑤ code-review, ⑥ PR vers `dev` · **Branche** : `claude/encave-v3-business-model-8bv7bd` (contient aussi les docs V3 ; PR unique vers `dev`) · **PR** : [#90](https://github.com/Samoulou/encave-app/pull/90)
> **Sources** : `docs/ENCAVE-V3-DELIVERY-PLAN.md` §P-01 · items L-001→L-013, L-200, L-204→L-206, L-215→L-217 · `docs/ENCAVE-V3-GAP-ANALYSIS.md` §10 · `docs/ENCAVE-V3-PERF-AUDIT.md`

## 1. Objectif

Après le merge, l'existant est **fiable** (l'invité reçoit un billet fonctionnel, les holds expirent, les remboursements/suppressions ont une UI) et **rapide à bas coût** (bundle initial allégé, hero optimisé) — sans aucun changement de comportement produit.

## 2. Scope

**IN — sous-package A « bugs » (L-001→L-013)** : email de confirmation avec token+QR (+ resend), planification des 3 crons manquants, QR écran compatible scanner, idempotence webhook Connect, lien mort ModifyBookingCard, onglets my-bookings, UI suppression de compte, UI refund admin, sendEmail fail-loud, localisation des 5 templates FR-en-dur, retrait KPI occupation, dead code, mention taxes du reçu.
**IN — sous-package B « perf quick wins » (L-200, L-204→L-206, L-215→L-217)** : hero desktop next/image + un seul éditorial rendu, posthog lazy post-consentement, Sentry Replay lazy, galerie sans `unoptimized` + fonts réduites + framer-motion→CSS + preconnects, images config (`minimumCacheTTL`, héros ≤ 200 kB, hero wineries hors Unsplash), suppression NavigationLoader + HealthStatus, CSP connect-src carte.
**OUT** : ISR/header découplé, i18n subset, index DB (→ P-06) ; toute feature V3 (→ P-02+).
**Ajout en cours de route (documenté)** : forme minimale de **L-201** (gate `DesktopOnly` autour de `DynamicMap` home + catalogue) tirée de P-06 — sans elle, le chunk mapbox de 439 kB saturait la 4G mobile et la DoD « home ≥ 65 » était inatteignable (mesuré : 51 avec les seuls quick wins). Le reste de L-201 (lazy IntersectionObserver sur les autres cartes) reste en P-06.

## 3. Definition of Done (gate)

- [x] L'email de confirmation contient le QR et un lien billet token fonctionnel (tests intégration : token ↔ hash, QR CID) — _parcours invité e2e complet à écrire en P-16/L-181_
- [x] Les 5 crons sont dans `vercel.json`
- [ ] Le QR affiché à l'écran est scannable par le scanner (**test manuel Sam sur staging** — même URL token que l'email, format vérifié contre le parser du scanner)
- [x] Webhook Connect : un event rejoué = zéro effet (tests : duplicate skipped, FAILED retryable)
- [x] Suppression de compte (client) et remboursement support (admin) accessibles depuis l'UI
- [x] Plus aucun item du GAP §10 ouvert ; dead code supprimé (+ fuite de visibilité caves sans photos corrigée)
- [x] Hero desktop optimisé (4.8 MB → 154 kB source) ; posthog + Sentry Replay hors du bundle initial (vérifié dans les manifests) ; 9 fichiers de police (18 avant — l'italique Fraunces 400 est réellement utilisé, conservé)
- [x] **Lighthouse home mobile 84** (≥ 65 requis ; baseline 48) · catalogue 84 · LCP 4.4 s · TBT 0 ms · First Load JS partagé 202 → 165 kB
- [x] Socle transverse vert : tsc, ESLint, i18n:check, **789 tests** unit+intégration, build prod OK

## 4. Découpage technique

1. **A1** — `checkout-confirmation.service.ts` + `resendConfirmationEmail` : propager `bookingId` + `accessToken` à `sendBookingConfirmationEmail` ; tests intégration sur l'URL et le QR CID.
2. **A2** — `vercel.json` : + `expire-pending-bookings` (toutes les 10 min), `follow-ups` (0 8 \* \* \*), `weekly-summary` (0 6 \* \* 1).
3. **A3** — `QRCodeCard` : encoder la même URL token que l'email (nécessite le token → passer par la page de confirmation qui le détient via session Stripe → sinon encoder `/booking/{id}?token=` reçu du service).
4. **A4** — webhook Connect : réutiliser `claimStripeEvent`/`markStripeEventProcessed`.
5. **A5** — UI : bouton suppression de compte (profil client, double confirmation), formulaire refund admin (montant + motif), onglets my-bookings, retrait ModifyBookingCard/KPI/dead code, mention reçu.
6. **A6** — emails : `sendEmail` fail-loud sans clé en prod ; 5 templates → `translations.ts` (clés ×3 locales).
7. **B1** — home : rendu conditionnel serveur (un seul éditorial), hero desktop en `next/image` sur l'asset v2 (154 kB) ; retirer le `priority` du bloc caché.
8. **B2** — `PostHogProvider` : `import('posthog-js')` dans `initPostHogFromConsent` ; `sentry.client.config.ts` : `lazyLoadIntegration('replayIntegration')`.
9. **B3** — galerie : retirer `unoptimized` ; fonts : Fraunces sans italique (3 graisses), Manrope 3 graisses ; framer-motion → CSS + dépendance retirée ; preconnects (Blob, Stripe) ; `minimumCacheTTL` 30 j ; hero catalogue → v2 ; hero wineries → asset local/Blob ; NavigationLoader + HealthStatus supprimés ; CSP + OSM hosts.

## 5. Tests & mesures

- Intégration : confirmation email (URL token + attachement), webhook Connect idempotent, expiration de hold.
- E2E : parcours invité complet (réserver → billet → annuler) ; my-bookings onglets.
- Mesures : `next build` (First Load JS, poids), Lighthouse home mobile (≥ 65) — méthode du perf audit.
- Scénario manuel Sam : réserver en invité sur staging, ouvrir l'email, scanner le QR écran avec le scanner du dashboard, annuler via le lien.

## 6. Risques & rollback

- L-001 touche le chemin d'argent (post-paiement) → aucun changement de logique de paiement, uniquement le payload email ; testé en intégration.
- B1 (rendu conditionnel device) : risque de mismatch SSR — approche : détection UA côté serveur (headers) OU garder les deux arbres mais démonter `DynamicMap` mobile et retirer les preloads cachés (choix au moment du code, le plus sûr des deux).
- Rollback : revert PR ; aucun changement de schéma, aucun flag nécessaire (pas de nouveau comportement produit).

## 7. Décisions ouvertes

- Aucune (tout est du correctif conforme aux specs existantes).
