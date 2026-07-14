# P-12 — Pages publiques & légal

> **Statut** : en cours · **Branche** : `claude/zealous-bohr-e4sm3d` · **PR** : #
> **Sources** : `docs/ENCAVE-V3-DELIVERY-PLAN.md` §P-12 · items `L-112→L-117`, `L-220`, `L-221` du backlog · specs `docs/v3/ENCAVE-V3-PAGES-EMAILS.md` §2/§4

## 1. Objectif

Fermer la surface publique du lancement : politiques (annulation + no-show) lisibles et acceptées avant paiement, pages légales/support en ligne (3 locales), home complète et fiche domaine enrichie — « plus aucune page ❌ » au sitemap public [L].

## 2. Scope

**IN** :

- **L-112** — no-show affiché _en clair_ sur la fiche (ON_SITE + cave opt-in, flag `NO_SHOW_FEES`) + **case d'acceptation CGV + politique** au checkout (bloquante), serveur `acceptedTerms: z.literal(true)` → `Booking.termsAcceptedAt`.
- **L-113** — sections home : « comment ça marche » + bon cadeau (`GIFT_CARDS`) + sur-mesure (`REQUESTS`), home ISR inchangée.
- **L-114** — `/contact` (action rate-limitée → e-mail `samuel@encave.ch` + accusé client, honeypot, pas de table), `/mentions-legales` (échafaudé, placeholders `[À COMPLÉTER]` + sous-traitants remplis), `/maintenance` (statique, freeze), privacy **nLPD explicite** + section sous-traitants ; liens Footer + nav légale.
- **L-115** — barre de filtres V3 : presets budget (< 50 / 50-100 / 100+), filtre langue (`Experience.languages`), pills de filtres actifs avec ×.
- **L-116** — toggle Liste/Carte au catalogue (carte pleine largeur + carrousel mobile).
- **L-117** — fiche domaine : horaires (Must) + chips famille/altitude/hectares/cépages (Should) + saisie réglages encaveur + empty state « Vous êtes encaveur ? ».
- **L-220/L-221** — fiche expérience : skeleton unique (plus de loader), panneau réservation desktop sticky/aligné.

**OUT** (explicitement) :

- Réécriture des CGV (cadeaux/no-show/request/fee) → **L-186 / P-16**.
- Checklist nLPD signée (registre, DPA) → **L-185 / P-16**.
- Identité légale réelle des mentions légales → Sam (placeholders livrés).

## 3. Definition of Done

- [x] Politique d'annulation + no-show lisibles sur CHAQUE fiche et au checkout avant paiement (+ acceptation CGV bloquante).
- [x] Home complète : sections bon cadeau + sur-mesure + comment ça marche ; ISR active.
- [x] `/contact` (formulaire), `/mentions-legales`, `/maintenance` en ligne, 3 locales.
- [x] Fiche domaine : horaires + bloc sur-mesure prérempli (déjà P-10) ; empty state « Vous êtes encaveur ? ».
- [ ] Sitemap public [L] : plus aucune page ❌ (L-115/L-116 en cours de finalisation).
- [x] Socle transverse (lint / format / i18n:check / tsc / tests) vert.

## 4. Découpage technique

1. **Migration additive** (`20260714120000_p12_pages_publiques`) : `Winery.openingHours/altitude/hectares/familyName/signatureGrapes`, `Booking.termsAcceptedAt`.
2. **Actions / queries** : `sendContactMessageAction` (+ validateur `contact.ts`, `CONTACT_RATE_LIMIT`, `sendContactMessageEmail` + 2 templates React Email) ; `updateWineryProfile` étendu ; `getExperienceBySlug` gagne `paymentMode` + no-show cave (cache `-v2`) ; `CreateBookingSchema.acceptedTerms` ; recherche : filtre `language`.
3. **UI** : `NoShowFeeInfo`, `HomeConversionSections`, `WineryDomaineDetailsSection`, `/contact`+form, `/mentions-legales`, `/maintenance`, bande identité fiche domaine, presets budget + filtre langue + `ActiveFilterPills`, toggle Liste/Carte, skeleton fiche + panneau sticky. i18n ×3 partout.
4. **Emails** : `ContactMessageEmail` (équipe, reply-to) + `ContactAckEmail` (client).
5. **Flags** : pas de flag argent nouveau ; `GIFT_CARDS`/`REQUESTS`/`NO_SHOW_FEES` gèrent les sections concernées.

## 5. Tests & mesures

- Tests ajoutés : `sendContactMessageAction` (validation / rate-limit / happy / honeypot / échec e-mail) ; checkout `acceptedTerms` (rejet si absent).
- Scénario manuel Sam : cf. checklist front (contact → e-mail loggé + accusé ; /mentions-legales + /maintenance en fr/de/en ; fiche montre no-show si cave opt-in ; checkout bloqué sans case ; fiche domaine horaires+chips + empty state ; filtres budget/langue + pills + toggle carte).

## 6. Risques & rollback

- Risque : no-show affiché à tort sur une offre ONLINE → gardé par `paymentMode === 'ON_SITE'` + flag.
- Rollback : revert PR ; les colonnes additives restent inertes (aucune donnée détruite).

## 7. Décisions ouvertes

- Aucune (périmètre, data-model fiche domaine, placeholders mentions légales, destinataire contact : tranchés avec Sam).
