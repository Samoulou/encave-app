# P-03 — Monétisation Phase 1 💰

> **Statut** : reviews passées (code 8 angles + sécurité), corrections livrées · **Branche** : `claude/encave-v3-business-model-8bv7bd` (fallback session, cf. P-01) · **PR** : [#98](https://github.com/Samoulou/encave-app/pull/98)
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

- [x] **Kill-switch prouvé < 1 min sans deploy** : flag en DB, cache ≤ 60 s, toggle admin avec invalidation immédiate — mécanisme tranché ici (cf. §7) ; **flags OFF = e2e existants verts sans modification**
- [x] Flag ON : checkout affiche « Frais de service 2.50 » × billets en ligne séparée ET l'encaisse (test Stripe mode test) ; reçu/relevés cohérents ; `serviceFeeCents` persisté
- [x] Cave Fondateur → `application_fee` = fee client seule ; cave standard → fee + taux env (tests intégration sur les deux)
- [x] Remboursement calculé selon la politique de la cave (tests des 3 barèmes, bornes incluses) ; montant exact dans l'email ; page légale alignée
- [x] « EnCave vous a apporté X CHF » visible côté cave ; GMV/passif visibles côté admin
- [x] Chaque nouvelle server action : tests unauthorized / validation / happy path
- [x] Socle transverse vert ; code-review 8 angles + security-review passées, blockers corrigés (cf. §8)

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
- Scénario manuel Sam : ① activer `BOOKING_FEE` dans l'admin ② réserver 2 billets sur une cave standard → total = 2×prix + 5.00, ligne « Frais de service » visible ③ vérifier le montant dans Stripe ④ annuler > 24 h → remboursement 100 % ⑤ couper le flag → la ligne disparaît immédiatement ⑥ (résidu C de Luca) réserver puis annuler chez une cave Fondateur (0 %) avec flag OFF → le remboursement doit passer.

## 6. Risques & rollback

- **Risque principal** : incohérence montants (Stripe vs DB vs emails) → une seule source de calcul (`payment.service`/libs pures), testée aux bornes ; jamais de calcul dupliqué dans l'UI.
- Webhooks : le montant Stripe reste la source de vérité ; `serviceFeeCents` est écrit à la création du hold, pas au webhook.
- Rollback : `BOOKING_FEE` OFF < 1 min (kill-switch) ; les politiques d'annulation ne sont PAS flaggées (comportement par défaut = Standard = règle actuelle → zéro changement tant que les caves ne choisissent pas un autre barème) ; revert PR possible, les colonnes additives restent inertes.

## 7. Décisions (tranchées avant build)

- **D1 — Barèmes (validés Sam 09.07)** : Flexible : 100 % jusqu'à 2 h avant · Standard (défaut, = règle actuelle) : 100 % jusqu'à 24 h · Stricte : 100 % jusqu'à 7 jours, 50 % jusqu'à 48 h, 0 % ensuite.
- **D2 — Frais de service en cas d'annulation (validé Sam 09.07)** : remboursés au même pourcentage que le billet (100 % → tout, 50 % → moitié des frais aussi). Simple à expliquer, cohérent « pas de marge sur les frais ».
- **D3 — Mécanisme de flags (technique)** : DB + cache 60 s + toggle admin (pas Edge Config : aucun vendor de plus, fonctionne en local/preview/staging/prod, kill-switch via admin OU SQL direct).
- **D4 — Taux standard** : le code lit `winery.commissionRate ?? PLATFORM_COMMISSION_RATE` ; le passage 12 % → 10 % au launch est un flip d'env var par Sam, hors code.

## 8. Bilan des reviews (⑤)

**Code-review (8 angles, 40 candidats → 10 findings majeurs, tous corrigés)** : app fee 0 rejetée par Stripe (Fondateur + flag OFF) ; email de confirmation/PostHog sans les frais ; politique lue au moment de l'annulation au lieu du booking (→ **snapshot** `Booking.cancellationPolicy`, migration additive) ; annulation de session cave et plafond du refund admin sans les frais ; `refundIssued` zéroant les remboursements partiels dans Earnings (→ payout proportionnel) ; modal d'annulation promettant le mauvais montant ; flip du flag entre affichage et paiement (→ `FEE_CHANGED`) ; email « aucun remboursement » à tort quand pas de payment intent ; panneau flags en état périmé. Plus : badge dérivé de `POLICY_TIERS`, label Stripe localisé, sélecteur de politique côté cave (L-043), GMV avec NO_SHOW.

**Security-review (NOGO → corrigé → repasse Luca)** : course au double remboursement **partiel** (2 annulations concurrentes à 50 % = 100 %, débité 2× au vigneron) fermée par claim atomique `updateMany(status: CONFIRMED)` avant Stripe + `idempotencyKey` sur `refunds.create` ; `cancelEventSession` enregistre le montant réellement remboursé ; `requireAdmin` sorti de la surface RPC ; `displayedServiceFeeCentsPerGuest` requis ; `guestCount` entier.

**Repasse Luca (paiements) : GO.** Résidus consignés : (A) clé d'idempotence Stripe expirée (>24 h) après un succès masqué par une erreur réseau → durci : le claim n'est relâché que sur rejet Stripe déterministe, sinon `refundError` stocké pour réconciliation ; (B) `refundBookingManually` sans verrou (course admin+client possible dans la limite du montant de la charge — exposition admin uniquement, à verrouiller en P-04) ; (C) test sandbox à faire : annulation d'une résa Founder 0 % + fee OFF (`refund_application_fee: true` sur charge sans application fee) — ajouté au scénario manuel de Sam.

**Dette assumée (trackée, hors gate)** : KpiCard/StatCard à unifier ; 4 agrégats admin → 2 ; pré-fetch `setWineryPlan` ; RHF sur le panneau admin commission ; blocs arrange dupliqués dans checkout.test ; labels sr-only EN des skeletons (dette préexistante) ; PDF reçu en français (dette connue) ; changement de borne à exactement 24 h (D1 « jusqu'à 24 h » inclusif — comportement voulu, remboursement accordé pile à la borne, communiqué à Sam).
