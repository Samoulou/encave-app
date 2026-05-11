# Specs MVP — EnCave V2

> Spécifications fonctionnelles détaillées des 45 US du backlog MVP résiduel.
> Chaque fichier suit le même template : objectif, acteurs, préconditions, user stories, critères d'acceptation Gherkin, règles métier, copy FR définitive avec clés i18n, états UI, cas limites, dépendances, hors-périmètre.
> Source du backlog : [`../backlog.md`](../backlog.md).

---

## 🔴 P0 — Bloquant MVP (14 US)

### Réservation & paiement
- [ENC-067](./ENC-067.md) — Cron expiration `PENDING_PAYMENT` après 30 min
- [ENC-068b](./ENC-068b.md) — QR code PNG attaché à l'email de confirmation
- [ENC-045](./ENC-045.md) — Annulation événement par encaveur → refund auto + emails

### Détail événement encaveur (jour-J)
- [ENC-096](./ENC-096.md) — Page détail événement encaveur (inscrits par session + actions)
- [ENC-100](./ENC-100.md) — Page `/dashboard/scan` mobile (caméra + html5-qrcode)
- [ENC-101](./ENC-101.md) — Endpoint check-in (`checkedInAt` + transition CONFIRMED → COMPLETED)
- [ENC-102](./ENC-102.md) — Liste check-in manuelle (fallback caméra)
- [ENC-103b](./ENC-103b.md) — UI "marquer no-show"

### Onboarding & visibilité
- [ENC-027](./ENC-027.md) — Logique visibilité cave publique (KYC + photos + VERIFIED)
- [ENC-028](./ENC-028.md) — `WelcomeEmail` au signup encaveur

### Admin SAV
- [ENC-128](./ENC-128.md) — Refund manuel admin + log

### Légal & conformité
- [ENC-133](./ENC-133.md) — Bannière cookies + opt-in PostHog (nLPD)
- [ENC-134](./ENC-134.md) — Mention 18+ event + checkout
- [ENC-135](./ENC-135.md) — Droit à l'oubli nLPD (anonymisation)

---

## 🟠 P1 — Must avant ouverture publique (25 US)

### Auth & profil
- [ENC-013](./ENC-013.md) — Reset password via magic link
- [ENC-015b](./ENC-015b.md) — Renforcer middleware admin (Edge level)

### Onboarding & landing pro
- [ENC-021](./ENC-021.md) — Landing pro `/pro`
- [ENC-025](./ENC-025.md) — Étape onboarding "premier événement" (skippable)
- [ENC-026b](./ENC-026b.md) — Compléter page édition profil cave

### Stripe Connect
- [ENC-030b](./ENC-030b.md) — Table `StripeEvent` pour idempotence webhooks
- [ENC-035](./ENC-035.md) — Email relance KYC J+1

### Événements
- [ENC-044b](./ENC-044b.md) — Règles édition événement avec bookings
- [ENC-052b](./ENC-052b.md) — CTA sticky `fixed bottom` mobile (détail event)
- [ENC-069](./ENC-069.md) — Fichier `.ics` attaché à l'email de confirmation

### Dashboard encaveur
- [ENC-092b](./ENC-092b.md) — Section "Cette semaine" enrichie
- [ENC-097](./ENC-097.md) — Mailto: groupé sur page détail événement
- [ENC-114](./ENC-114.md) — Page "Reversements" (lecture Stripe API)

### Espace client
- [ENC-080b](./ENC-080b.md) — Pagination + filtres "Mes réservations"
- [ENC-083](./ENC-083.md) — Invitation +1 par email (`BookingGuest`)
- [ENC-084](./ENC-084.md) — Email invitation +1 avec QR personnel

### Admin
- [ENC-124](./ENC-124.md) — Liste admin événements + suspension manuelle
- [ENC-125](./ENC-125.md) — Liste admin réservations + détail
- [ENC-126](./ENC-126.md) — Table `AdminAction` + log automatique
- [ENC-127](./ENC-127.md) — Action admin : suspension cave / utilisateur

### Légal & conformité
- [ENC-132b](./ENC-132b.md) — Audit page mentions légales
- [ENC-136](./ENC-136.md) — Export données perso `.json` (nLPD)

### Tests & qualité
- [ENC-144](./ENC-144.md) — Audit a11y axe-core pages publiques
- [ENC-150](./ENC-150.md) — Audit emails (deliverability + rendu mobile)
- [ENC-151](./ENC-151.md) — Audit Lighthouse pages publiques (>90 mobile)

---

## 🟡 P2 — Nice-to-have (6 US)

- [ENC-016b](./ENC-016b.md) — Téléphone profil client
- [ENC-032b](./ENC-032b.md) — Champ `kycStatus` explicite sur `Winery`
- [ENC-094](./ENC-094.md) — Dashboard mini graph 30j
- [ENC-145](./ENC-145.md) — Tests de charge basiques (200 résas/h)
- [ENC-152](./ENC-152.md) — Page 404 / erreurs custom
- [ENC-153](./ENC-153.md) — Loading states + skeleton UI

---

## Convention

Chaque spec suit le template :

```markdown
# ENC-XXX — Titre

## Objectif métier
## Acteurs
## Préconditions & déclencheurs
## User stories
## Critères d'acceptation (Gherkin)
## Règles métier
## Copy FR définitive (avec clés i18n suggérées)
## États UI
## Cas limites
## Dépendances
## Hors-périmètre explicite
## Métriques de succès (optionnel)
## ❓ Questions ouvertes pour Sam (si ambiguïtés non tranchables)
```

**Locale** : copy FR uniquement à ce stade. Les traductions DE/EN se font à l'implémentation via `messages/{de,en}.json`.

**Ton** : EnCave premium-décontracté. Vouvoiement client. **Tutoiement vs vouvoiement encaveur : à arbitrer par Sam** (cf. ENC-092b + tous les écrans dashboard).

---

**Version** : 1.0 — 11 mai 2026
**Spec par** : Théo (product-expert) sous la supervision orchestrale.
**Validation** : à valider par Sam avant que Jonas (archi) et Léa (UX) ne partent sur les écrans.
