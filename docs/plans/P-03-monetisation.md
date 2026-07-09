# P-03 — Monétisation Phase 1 💰

> **Statut** : en cours · **Branche** : `claude/encave-v3-business-model-8bv7bd` (fallback session, cf. P-01) · **PR** : #
> **Sources** : `docs/ENCAVE-V3-DELIVERY-PLAN.md` §P-03 · items L-040→L-045 · specs `docs/v3/ENCAVE-V3-BUSINESS.md` §2/§9, `docs/v3/ENCAVE-V3-PRD.md` §5

## 1. Objectif

Le modèle économique V3 devient réel et pilotable : frais de service 2.50 CHF/billet encaissés (flag ON), commission par cave (Fondateurs 0 %), remboursements selon la politique de chaque cave, et les chiffres business visibles côté cave et côté admin. Tout l'argent nouveau est derrière un kill-switch < 1 min.

## 2. Scope

**IN** :

- **L-040** Système de feature flags : table `feature_flags` (migration additive) + lecture cachée 60 s + toggle admin (revalidateTag → effet immédiat) ; registre : `BOOKING_FEE`, `GIFT_CARDS`, `NO_SHOW_FEES`, `REQUESTS`, `TASTING_SHEET`, `COLLECTIVE_EVENTS` (seul `BOOKING_FEE` est consommé dans ce package)
- **L-041** Frais de service 2.50 CHF/billet : line item Stripe séparé, colonne additive `Booking.serviceFeeCents`, ligne « Frais de service » réelle (widget, checkout, succès, reçu PDF), encaissés côté plateforme (`application_fee_amount` += fee), jamais dans `wineryPayout`
- **L-042** Commission par cave : `getEffectiveCommissionRate()` = `winery.commissionRate ?? env PLATFORM_COMMISSION_RATE` ; admin peut définir plan (FOUNDER/…) et taux par cave ; Earnings reflète le taux réellement appliqué (déjà stocké par booking)
- **L-043** Politiques d'annulation par cave : lib pure `cancellation-policy.ts` (3 barèmes), remplacement des deux `>24h` codés en dur (`cancelClientBooking`, annulation invitée), remboursement partiel Stripe au montant exact, affichage fiche + checkout + emails + page légale
- **L-044** Bloc Earnings « EnCave vous a apporté X CHF » (GMV cumulée de la cave)
- **L-045** KPIs admin : GMV, billets/mois, take rate blended, CA bons cadeaux, passif gift cards (les modèles P-02 suffisent)

**OUT** : TWINT/Link/saved cards (P-04), occurrences au checkout (P-05), Stripe Tax/TVA (backlog), UI de rédemption gift cards (P-09), changement effectif du taux standard 12 % → 10 % (= flip d'env var par Sam au launch, pas de code).

## 3. Definition of Done (gate — délivery plan + ajouts)

- [ ] **Kill-switch prouvé < 1 min sans deploy** : flag en DB, cache ≤ 60 s, toggle admin avec invalidation immédiate — mécanisme tranché ici (cf. §7) ; **flags OFF = e2e existants verts sans modification**
- [ ] Flag ON : checkout affiche « Frais de service 2.50 » × billets en ligne séparée ET l'encaisse (test Stripe mode test) ; reçu/relevés cohérents ; `serviceFeeCents` persisté
- [ ] Cave Fondateur → `application_fee` = fee client seule ; cave standard → fee + taux env (tests intégration sur les deux)
- [ ] Remboursement calculé selon la politique de la cave (tests des 3 barèmes, bornes incluses) ; montant exact dans l'email ; page légale alignée
- [ ] « EnCave vous a apporté X CHF » visible côté cave ; GMV/passif visibles côté admin
- [ ] Chaque nouvelle server action : tests unauthorized / validation / happy path
- [ ] Socle transverse (§3 du delivery plan) vert ; `/security-review` (package 💰) au stade ⑤

## 4. Découpage technique

1. **Migration additive** : `feature_flags(key unique, enabled, updatedAt)` + `Booking.serviceFeeCents Int @default(0)`.
2. **Lib flags** (`src/lib/flags.ts` + query cachée + action admin `setFeatureFlag`) — lecture `unstable_cache(60s, tag 'feature-flags')`, écriture admin → `revalidateTag`.
3. **Lib argent** : `src/lib/business-rules/commission.ts` (`getEffectiveCommissionRate`), `src/lib/business-rules/cancellation-policy.ts` (barèmes + `computeRefundCents(policy, hoursUntilStart, paidCents)`).
4. **Checkout** (`checkout.ts` + `payment.service.ts`) : si `BOOKING_FEE` ON → 2e line item Stripe, `application_fee_amount = platformFee + serviceFee`, persistance `serviceFeeCents` ; OFF → strictement identique à aujourd'hui.
5. **Annulations** (`booking.ts` ×2) : remboursement au pourcentage du barème sur le total payé (billets + frais, cf. décision D2), email avec montant exact.
6. **UI** : ligne frais dans BookingWidget/OrderSummary/MobileOrderSummary/succès/PDF ; label politique sur fiche + checkout ; toggle flags + plan/taux cave dans admin ; bloc GMV Earnings ; KPIs admin. i18n ×3, états loading/empty/error.
7. **Tests** : unit (barèmes, commission, flags), intégration (checkout fee ON/OFF, founder vs standard, refunds ×3), e2e existants inchangés flag OFF.

## 5. Tests & mesures

- Chrono kill-switch documenté (toggle admin → refresh checkout < 60 s).
- Stripe test : session avec 2 line items, `application_fee_amount` vérifié pour founder (fee seule) et standard (fee + commission).
- Scénario manuel Sam : ① activer `BOOKING_FEE` dans l'admin ② réserver 2 billets sur une cave standard → total = 2×prix + 5.00, ligne « Frais de service » visible ③ vérifier le montant dans Stripe ④ annuler > 24 h → remboursement 100 % ⑤ couper le flag → la ligne disparaît immédiatement.

## 6. Risques & rollback

- **Risque principal** : incohérence montants (Stripe vs DB vs emails) → une seule source de calcul (`payment.service`/libs pures), testée aux bornes ; jamais de calcul dupliqué dans l'UI.
- Webhooks : le montant Stripe reste la source de vérité ; `serviceFeeCents` est écrit à la création du hold, pas au webhook.
- Rollback : `BOOKING_FEE` OFF < 1 min (kill-switch) ; les politiques d'annulation ne sont PAS flaggées (comportement par défaut = Standard = règle actuelle → zéro changement tant que les caves ne choisissent pas un autre barème) ; revert PR possible, les colonnes additives restent inertes.

## 7. Décisions (tranchées avant build)

- **D1 — Barèmes (validés Sam 09.07)** : Flexible : 100 % jusqu'à 2 h avant · Standard (défaut, = règle actuelle) : 100 % jusqu'à 24 h · Stricte : 100 % jusqu'à 7 jours, 50 % jusqu'à 48 h, 0 % ensuite.
- **D2 — Frais de service en cas d'annulation (validé Sam 09.07)** : remboursés au même pourcentage que le billet (100 % → tout, 50 % → moitié des frais aussi). Simple à expliquer, cohérent « pas de marge sur les frais ».
- **D3 — Mécanisme de flags (technique)** : DB + cache 60 s + toggle admin (pas Edge Config : aucun vendor de plus, fonctionne en local/preview/staging/prod, kill-switch via admin OU SQL direct).
- **D4 — Taux standard** : le code lit `winery.commissionRate ?? PLATFORM_COMMISSION_RATE` ; le passage 12 % → 10 % au launch est un flip d'env var par Sam, hors code.
