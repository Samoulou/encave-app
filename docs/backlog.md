# Backlog MVP — EnCave V2 (résiduel)

> Liste des incréments restants à livrer pour atteindre la cible MVP.
> Reflète le **code actuel** sur la branche `dev` (audit du 11 mai 2026).
> Quand cette liste est vide, le MVP est livré.

---

## Décisions d'architecture actées

Ces choix corrigent les divergences entre le backlog d'origine et le code réel :

| Sujet | Choix MVP | Justification |
|---|---|---|
| Stack auth | Better Auth email/password (client + encaveur) | Plus simple que l'OTP, déjà en place |
| Stack DB | Neon + Prisma, RLS au niveau applicatif (auth() + checks dans actions) | Pas de RLS Postgres pour MVP |
| Multi-membres cave | Relation 1:1 user ↔ cave | Migration vers `CaveMembership` reportée post-MVP (~1j) |
| Payouts | Rolling balance Stripe Connect auto | Pas de pipeline custom ; lecture historique via API Stripe |
| Adresses | OSM Nominatim (déjà intégré) | Gratuit, suffisant pour la Romandie |
| Créneaux | `AvailabilitySlot` (dayOfWeek + heures) + `BlockedDate` | Pas de moteur rrule avancé en MVP |
| Rappels | 24h + 2h + follow-up post-event | Mieux que le "J-2" du backlog d'origine |
| Stack frameworks | Next.js 14 + Tailwind v3 | Pas de migration v15/v4 pour MVP |

---

## Légende

- **Taille** : S (≤4h) · M (≤1 jour) · L (2-3 jours)
- **Priorité** : P0 (bloque MVP) · P1 (must avant ouverture publique) · P2 (nice-to-have)
- **Statut** : 🆕 nouveau · 🔧 reprise d'un US partiel · 📋 issu du backlog d'origine

---

## 🔴 P0 — Bloquant MVP (à livrer avant bêta Fondateurs)

### Réservation & paiement

| ID | Titre | Taille | Statut |
|---|---|---|---|
| ENC-067 | Cron expiration `PENDING_PAYMENT` après 30 min (libère la capacité) | S | 📋 |
| ENC-068b | Joindre QR code en PNG à l'email de confirmation (actuellement client-side uniquement) | S | 🔧 |
| ENC-045 | Annulation événement par encaveur déclenche refund auto + emails | M | 📋 |

### Détail événement encaveur (jour-J)

| ID | Titre | Taille | Statut |
|---|---|---|---|
| ENC-096 | Page détail événement encaveur (liste des inscrits par session + actions) | M | 📋 |
| ENC-100 | Page `/dashboard/scan` mobile (caméra + html5-qrcode) | M | 📋 |
| ENC-101 | Endpoint check-in : ajouter `checkedInAt` au modèle `Booking` + transition CONFIRMED → COMPLETED via scan | S | 📋 |
| ENC-102 | Liste check-in manuelle sur page détail événement (fallback si pas de caméra) | S | 📋 |
| ENC-103b | UI "marquer no-show" sur page détail événement (logique back déjà présente dans `booking-dashboard.ts:265`) | S | 🔧 |

### Onboarding & visibilité

| ID | Titre | Taille | Statut |
|---|---|---|---|
| ENC-027 | Logique visibilité cave publique (critères : KYC ok + photos min + infos complètes + status VERIFIED) | S | 📋 |
| ENC-028 | Brancher l'envoi de `WelcomeEmail` au signup encaveur (template existe déjà) | S | 🔧 |

### Admin SAV

| ID | Titre | Taille | Statut |
|---|---|---|---|
| ENC-128 | Action admin : refund manuel d'une booking + log | M | 📋 |

### Légal & conformité

| ID | Titre | Taille | Statut |
|---|---|---|---|
| ENC-133 | Bannière cookies + opt-in PostHog (nLPD) | M | 📋 |
| ENC-134 | Mention 18+ sur pages event + checkout (obligation alcool Suisse) | S | 📋 |
| ENC-135 | Endpoint droit à l'oubli nLPD (anonymisation user + bookings) | M | 📋 |

---

## 🟠 P1 — Must avant ouverture publique (Phase 4)

### Auth & profil

| ID | Titre | Taille | Statut |
|---|---|---|---|
| ENC-013 | Reset password via magic link (Better Auth a la primitive, à câbler) | S | 📋 |
| ENC-015b | Renforcer middleware : check rôle ADMIN au niveau middleware (pas seulement layout) | S | 🆕 |

### Onboarding & landing pro

| ID | Titre | Taille | Statut |
|---|---|---|---|
| ENC-021 | Landing pro `/pro` (proposition de valeur encaveur, indispensable pour onboarder les 10 Fondateurs) | M | 📋 |
| ENC-025 | Étape onboarding "premier événement" (skippable) | S | 📋 |
| ENC-026b | Compléter page édition profil cave (revue exhaustivité des champs) | S | 🔧 |

### Stripe Connect — robustesse

| ID | Titre | Taille | Statut |
|---|---|---|---|
| ENC-030b | Table `StripeEvent` pour idempotence webhooks (éviter double-traitement) | S | 🆕 |
| ENC-035 | Email relance KYC J+1 si onboarding Stripe pas commencé | S | 📋 |

### Événements

| ID | Titre | Taille | Statut |
|---|---|---|---|
| ENC-044b | Valider et tester les règles d'édition d'événement quand des bookings existent (prix, capacité, créneaux) | S | 🔧 |
| ENC-052b | CTA sticky en `fixed bottom` sur mobile pour la page détail événement | S | 🔧 |
| ENC-069 | Génération + attachement `.ics` à l'email de confirmation | S | 📋 |

### Dashboard encaveur

| ID | Titre | Taille | Statut |
|---|---|---|---|
| ENC-092b | Enrichir section "Cette semaine" (détail jour par jour avec actions rapides) | S | 🔧 |
| ENC-097 | Action mailto: groupé sur page détail événement (contacter tous les inscrits) | S | 📋 |
| ENC-114 | Page encaveur "Reversements" (lecture historique via Stripe API, pas de table custom) | M | 🔧 |

### Espace client

| ID | Titre | Taille | Statut |
|---|---|---|---|
| ENC-080b | Pagination + filtres UI sur page "Mes réservations" | S | 🔧 |
| ENC-083 | Invitation +1 par email (nouvelle table `BookingGuest` + formulaire) | M | 📋 |
| ENC-084 | Email invitation +1 avec QR personnel | S | 📋 |

### Admin

| ID | Titre | Taille | Statut |
|---|---|---|---|
| ENC-124 | Page admin liste événements (filtres statut + suspension manuelle) | M | 📋 |
| ENC-125 | Page admin liste réservations (recherche + détail) | M | 📋 |
| ENC-126 | Table `AdminAction` + log automatique des actions admin sensibles | S | 📋 |
| ENC-127 | Action admin : suspension cave / utilisateur (statut `SUSPENDED` existe déjà dans l'enum) | S | 📋 |

### Légal & conformité

| ID | Titre | Taille | Statut |
|---|---|---|---|
| ENC-132b | Vérifier exhaustivité de la page mentions légales | S | 🔧 |
| ENC-136 | Export données perso utilisateur en `.json` téléchargeable (nLPD) | M | 📋 |

### Tests & qualité

| ID | Titre | Taille | Statut |
|---|---|---|---|
| ENC-144 | Audit a11y rapide avec axe-core sur pages publiques (détail event, checkout, confirmation) | S | 📋 |
| ENC-150 | Audit complet emails : deliverability (SPF/DKIM/DMARC) + rendu mobile (Litmus ou équivalent) | M | 📋 |
| ENC-151 | Audit Lighthouse pages publiques (cible >90 mobile) | M | 📋 |

---

## 🟡 P2 — Nice-to-have (post-launch acceptable)

| ID | Titre | Taille | Statut |
|---|---|---|---|
| ENC-016b | Ajouter champ téléphone à l'édition profil client | S | 🔧 |
| ENC-032b | Champ `kycStatus` explicite sur `Winery` (actuellement proxy via `charges_enabled`) | S | 🆕 |
| ENC-094 | Dashboard mini graph 30j (réservations + remplissage) | M | 📋 |
| ENC-145 | Tests de charge basiques (200 résas/heure simulées) | M | 📋 |
| ENC-152 | Page 404 et erreurs custom (cohérence brand) | S | 📋 |
| ENC-153 | Loading states + skeleton UI sur pages lentes | M | 📋 |

---

## 📦 Marketing & ops (hors code)

| ID | Titre | Prio |
|---|---|---|
| OPS-010 | Onboarding des 10 encaveurs Fondateurs | P0 |
| OPS-011 | Email d'ouverture à toute la waitlist | P0 |
| OPS-012 | Push Insta + LinkedIn + presse locale | P0 |
| OPS-013 | Première campagne Meta Ads (200 CHF, Romandie 30-50) | P1 |

---

## ❄️ Reportés post-MVP (traçabilité)

Ces US du backlog d'origine sont sorties du périmètre MVP suite à l'audit. Conservées ici pour mémoire.

| ID | Titre | Raison |
|---|---|---|
| ENC-010 (RLS) | RLS Postgres natif | Sécurité applicative via `auth()` + checks dans server actions suffit pour MVP ; à reconsidérer si on passe à Supabase ou si on ouvre l'API |
| ENC-014 | Auth client OTP 6 chiffres | Choix produit : on garde email/password Better Auth |
| ENC-020 (multi) | `cave_memberships` (multi-membres par cave) | Migration ~1j, possible sans risque plus tard |
| ENC-024 | Formulaire IBAN/raison sociale natif | Délégué à Stripe Connect KYC |
| ENC-043 | Créneaux récurrents type rrule | Modèle actuel (dayOfWeek + BlockedDate) suffit pour le besoin Fondateurs |
| ENC-110 | Table `Payout` custom | Stripe Connect rolling balance suffit |
| ENC-111 | Création payout `scheduled` J+1 | Stripe gère le timing automatiquement |
| ENC-112 | Cron hebdo batch Stripe Transfer | Idem |
| ENC-113 | Annulation payout si refund | Stripe le gère automatiquement |
| ENC-115 | Email récap virement encaveur | À reconsidérer : utile UX, mais pas critique MVP |

---

## Volume résiduel

| Priorité | Items | Effort estimé |
|---|---|---|
| P0 | 13 | ~10-12 jours-dev |
| P1 | 19 | ~16-20 jours-dev |
| P2 | 6 | ~5-7 jours-dev |
| **Total à livrer** | **38** | **~30-40 jours-dev** |

À 15-20h/semaine + boost agentique, **livrer le P0 prend ~3 semaines**, ajouter le P1 ~4-5 semaines supplémentaires. Cible MVP "ouverture publique complète" atteignable en **7-8 semaines**.

---

## Ordre de bataille proposé (sprints d'une semaine)

1. **Sprint 1 — Jour-J** : ENC-096, ENC-100, ENC-101, ENC-102, ENC-103b *(le check-in physique doit fonctionner avant tout)*
2. **Sprint 2 — Robustesse paiement** : ENC-067, ENC-045, ENC-068b, ENC-069, ENC-030b
3. **Sprint 3 — Légal & conformité** : ENC-133, ENC-134, ENC-135, ENC-132b, ENC-136
4. **Sprint 4 — Onboarding Fondateurs** : ENC-021, ENC-025, ENC-027, ENC-028, ENC-026b
5. **Sprint 5 — Admin & SAV** : ENC-128, ENC-124, ENC-125, ENC-126, ENC-127
6. **Sprint 6 — Polish encaveur** : ENC-097, ENC-114, ENC-092b, ENC-035, ENC-044b
7. **Sprint 7 — Espace client & polish public** : ENC-083, ENC-084, ENC-080b, ENC-052b, ENC-013, ENC-015b
8. **Sprint 8 — Pré-lancement** : ENC-150, ENC-151, ENC-144, ENC-152, ENC-153

---

**Version** : 2.0 — 11 mai 2026 (post-audit)
**Total items** : 38 dev + 4 ops
**Prochaine révision** : à la fin de chaque sprint
