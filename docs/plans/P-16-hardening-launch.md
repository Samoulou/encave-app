# P-16 — Hardening & launch

> **Statut** : en cours — PR-1 #118 (CI verte), PR-2 #119 (fixes Codex poussés, attend validation preview G-1 par Sam), PR-3 #120 (code complet), PR-4 à venir · **Branches** : `claude/p-16-ci-tests` (PR-1) · `claude/p-16-auth-hardening` (PR-2) · `claude/p-16-launch-hardening` (PR-3) · `claude/p-16-perf-should` (PR-4)
> **Sources** : `docs/ENCAVE-V3-DELIVERY-PLAN.md` §P-16 · L-180→L-189, L-208, L-210, L-211, L-213, L-214 · gaps sécu P-14 §6bis · escalades `docs/plans/P-09-bons-cadeaux.md`

## 1. Objectif (2 lignes max)

Transformer l'app feature-complete en app launchable : gates instrumentés (k6, 6 e2e, LHCI, axe), money-routing bons cadeaux vérifié bout-en-bout, alerting < 5 min, légal/nLPD publié, gaps sécu P-14 fermés, bascule prête. Fin de P-16 = launch.

## 2. Scope

**IN** : L-180 (k6 + concurrence gift), L-181 (6 parcours e2e en CI), L-182 (LHCI ≥ 95 + budgets), L-183 (axe) + L-214 (a11y Must), L-184 (alerting + health probes), L-185/186 (nLPD + CGV), L-187 (runbooks), L-188 (/security-review final), L-189 (bascule flag Coming Soon, redirects, sitemap/robots) ; fix corrélation payout gift (DoD-e) ; **reversal annulation booking financé par bon (ADR-0003 + code — décision Sam 16.07)** ; gaps sécu P-14 G-1/G-2/G-3 ; Should sécables L-208/210/211/213 (PR-4).
**OUT** : L-212 (vérifié fait en P-06) ; escalade Luca (c) buffer trésorerie (décision finance Sam, hors code) ; activation des flags en prod (post-launch, décision Sam) ; TWINT/Stripe live/DPA/astreinte/entité légale = checklist ops Sam (§5 du plan de session).

**Dérogation actée (Sam 16.07)** : 3 PRs + 1 optionnelle au lieu de « 1-2 PR » — PR-1 CI/tests (~18 h), PR-2 sécu auth isolée (revert chirurgical, validation preview Google), PR-3 hardening bascule (cible du `/code-review max` + `/security-review`), PR-4 perf Should (sécable).

## 3. Definition of Done (gate — copiée du delivery plan)

- [ ] k6 : zéro survente Slot + zéro double-rédemption gift, exécution en CI hebdo (`weekly-gates.yml` + `workflow_dispatch` pré-release)
- [ ] Rédemption bon cadeau — vérif money-routing bout-en-bout Stripe-test/staging : (a) partielle (b) totale card=0 (c) abandon→REFUND (d) idempotence + reconcile (e) payout dashboard corrèle le transfert bon (f) buffer trésorerie. **Bloquant launch**
- [ ] 6 parcours e2e en CI sur chaque PR (booking invité, cadeau A→Z, request A→Z, annulation+refund, scan, onboarding cave)
- [ ] Lighthouse CI ≥ 95 (gate staging) sur home/catalogue/fiche + budgets bloquants ; axe : 0 violation bloquante booking + cadeaux
- [ ] Alerting : incident simulé (webhook en échec, cron mort) → alerte < 5 min ; `/api/health` probe DB/Redis/Stripe
- [ ] Checklist nLPD signée ; CGV couvrant cadeaux/no-show/request/politiques/fee (+ roster collectifs P-11) publiées
- [ ] Runbooks testés à froid (incident paiement, litige no-show, kill-switch flag, restauration DB) ; astreinte définie
- [ ] `/security-review` final sur l'état de bascule — 0 blocker
- [ ] Bascule prête : gate Coming Soon derrière flag env `COMING_SOON`, Stripe live vérifié (TWINT, webhooks, Connect), redirections/sitemap OK
- [ ] **Additionnels découverts au plan** : CI déclenchée sur `dev` (aujourd'hui `main` only — les PRs vers dev ne sont pas testées) ; job `db-invariants` en CI (les 9 suites `tests/db/` sont silencieusement skippées) ; gaps P-14 G-1/G-2/G-3 fermés ; reversal gift implémenté
- [ ] Socle transverse (§3 du delivery plan) vert

## 4. Découpage technique

**PR-1 `claude/p-16-ci-tests` — ✅ code complet (suite CI locale 42/42, unit 1164, db 53, LHCI budgets verts)** : ① ci.yml triggers dev + concurrency + job db-invariants (postgres service) ② `tests/db/gift-redemption-concurrency.test.ts` (FOR UPDATE réel, modèle booking-hold-concurrency) ③ k6 éphémère CI (`tests/k6/`) + `weekly-gates.yml` — _déviation_ : le manifest Next ne mappe pas les noms d'actions → route de test gated `E2E_TEST` `/api/test/booking-hold` (mêmes garde-fous que la vraie action) au lieu de l'extraction d'ID ④ infra e2e : webhook Stripe signé simulé (`generateTestHeaderString`), `.env.test.example`, seed étendu (flags ON, ids fixes format cuid — les pages ISR embarquent les ids), branches `E2E_TEST` ajoutées à `createGiftCardCheckoutAction`/`createRequestOfferCheckout`/`processRefund`/`settleGiftTransfer`/`checkRateLimit` (convention P-14) ⑤ 6 specs `tests/e2e/flows/` + 5 POMs — l'onboarding déroule le VRAI enrôlement TOTP admin (secret lu de la réponse `/two-factor/enable` + otplib) ⑥ LHCI 2 étages (PR warn-only build local / gate ≥95 staging) + budgets ressources en assertions `maxNumericValue` (budgets.json n'est PAS câblé par LHCI — trouvé via review Codex ; baseline locale : script 516 KB, doc 33 KB, font 296 KB ; scores simulés conteneur ~50-63 = artefact Lantern connu, vérité = staging) ⑦ `@axe-core/playwright` + specs a11y booking/cadeaux — 0 violation, 6 violations réelles corrigées (breadcrumb focusable, contrastes TrustBadges/CancellationPolicy/OrderSummary/GiftCardPreview, nom accessible des Select cadeaux) ⑧ L-214 : Dialog Radix lightbox, aria-pressed pills tri, aria-live stepper. _Casse pré-existante réparée (révélée par la 1re exécution CI)_ : test db request-sur-mesure (dedupe keys), seed `signatureGrapes` (drift schéma/migration), specs ux-redesign pré-P-05, admin-regression sans TOTP P-14, docs non formatées.

**PR-2 `claude/p-16-auth-hardening` — ✅ code complet (#119, unit 1161)** : G-1 plugin `authHardening` (`src/server/auth-hardening.ts`) — hook after sur `/sign-in/email-otp` + `/callback/*` miroir du built-in twoFactor (révocation session fraîche + cookie two*factor + `twoFactorRedirect`, redirect `/login/2fa` pour les callbacks) ; G-2 notice sécurité à l'ancienne adresse sur `/change-email` non vérifié (template `EmailChangedNoticeEmail` FR/DE/EN) — \_déviation* : better-auth exige déjà la confirmation par l'adresse actuelle quand elle est vérifiée, le deny prévu était inutile ; G-3 — _déviation_ : le cap au refresh (`session.update.before`) ne tient pas (le slide réécrit expiresAt à 90 j) → contrôle de l'ÂGE de session aux boundaries : `isCurrentAdminSessionExpired()` (fail-closed) dans admin/layout + `requireAdmin()` (fix review Codex) + route `GET /api/auth/session-expired` gated (fix review Codex : un lien forgé ne déconnecte pas un tiers). **Reste : validation preview login Google réel par Sam avant merge.**

**PR-3 `claude/p-16-launch-hardening` — ✅ code complet (#120, unit 1188)** : A.1 corrélation `transfer.metadata.bookingId` dans `getPayoutDetail` (garde stripeAccountId, DTO `kind:'charge'|'noShowFee'|'gift'`, badges UI, log si montant ≠ wineryPayout) ; A.3 ADR-0003 + `booking-refund.service.ts` partagé par les 2 actions d'annulation (refund carte d'abord plafonné à la charge plateforme `reverse_transfer:false`, reliquat recrédité sur le bon via `releaseGiftForBooking` paramétré, reversal proportionnel au barème — idempotent clé Stripe + colonne `giftTransferReversalId`, migration additive ; échecs bon/reversal non bloquants → `refundError` + runbook) ; E `/api/health` réécrit (DB/Redis 2 s, `?deep=1` Stripe + StripeEvents bloqués/échoués + ScheduledJobs FAILED, 200/503) + Sentry `area:stripe-webhook`/`area:email`/`area:gift-transfer` + `withCronMonitor` (crontab miroir vercel.json) sur les 9 crons ; H CGV 6 sections FR/DE/EN (fee, politiques, bons, no-show, sur-mesure, roster collectifs = dette nLPD P-11 soldée) + privacy complète (+Sentry/Upstash, renvoi export/suppression) + sitemap/robots + runbooks ×5 + `docs/legal/nlpd-checklist.md` ; I `COMING_SOON` env dans le middleware (fail-closed, documenté flags.ts) + redirect 308 www→apex + `.env.example` aligné. _Reste : variante e2e annulation-bon (attend la merge de #118), campagne staging A.2 (a→f) avec Sam, incident simulé, `/code-review max` + `/security-review`._

**PR-4 `claude/p-16-perf-should`** (sécable) : L-208 selects/groupBy earnings/take ; L-210 timeout Nominatim + geocode post-commit + polling visibilitychange ; L-211 crons groupés + emails bornés ; L-213 WebVitalsReporter → PostHog.

## 5. Tests & mesures

- Automatisés : gift-redemption-concurrency (rouge si FOR UPDATE retiré), k6 oversell ≤ capacité + invariant SQL, 6 e2e, axe ×2, unit payout gift + reversal (3 cas) + health + hooks auth (fonctions pures).
- Mesures : LHCI staging ≥ 95 (médiane 3 runs) ; incident simulé chronométré < 5 min (webhook FAILED + cron mort) ; campagne money-routing (a)→(f) sur staging avec captures Dashboard Stripe.
- Manuel Sam : (1) staging — acheter un bon 50 CHF, réserver 120 CHF avec le code, vérifier la ligne « Bon cadeau » dans `/dashboard/payouts` ; (2) preview PR-2 — login Google d'un admin enrôlé TOTP → challenge exigé ; (3) flip `COMING_SOON=false` sur preview → site ouvert, re-flip → gate revenu.

## 6. Risques & rollback

- Gate LHCI staging < 95 (artefact Lantern connu) → levier n°1 = PR-4 ; sinon **fusible planning : launch 23.11** (jamais de contournement silencieux du gate).
- G-1 hook fragile sur les internals better-auth → fallback documenté (deny social/OTP pour ADMIN), validation preview obligatoire avant merge.
- Reversal gift = chemin money neuf → tests unit 3 cas + variante e2e annulation + vérif staging dédiée ; rollback = revert PR-3 (aucune migration).
- Rollback général : aucune migration destructive prévue (0 ou 1 migration additive max — heartbeat éventuel) ; flags métier inchangés (OFF).

## 7. Décisions ouvertes (à trancher AVANT ③ BUILD)

Aucune côté code (décisions Sam du 16.07 actées : gaps P-14 in, Should sécables in, reversal implémenté, 3+1 PRs). Restent des décisions **ops** non bloquantes pour le build : montant buffer trésorerie · entité mentions légales + validation juridique CGV · astreinte · DPA · date de bascule réelle · Better Stack + alert rules Sentry.
