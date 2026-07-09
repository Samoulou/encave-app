# EnCave V3 — Plan & backlog launch (16 novembre 2026)

> **Version** : 1.0 — 9 juillet 2026 · **Owner** : Sam · **Base** : `dev` @ `8368daf`
> **Sources** : `docs/v3/` (PRD 3.1, BUSINESS 1.0, PAGES-EMAILS 1.0, PLANNING 3.1) + `docs/ENCAVE-V3-GAP-ANALYSIS.md`
> **Stratégie** : convergence incrémentale depuis la base V2 (voir `docs/v3/README.md`). Ce document remplace la lecture « from scratch » des phases A-D du planning : il repart de l'acquis réel.
> **IDs** : `L-xxx` (backlog launch). À importer dans Linear (les `ENC-XXX` existants référencés quand un item recoupe une spec V2). `[FLAG]` = derrière feature flag. Estimations en heures de pilotage Sam (Claude Code exécute) — ordres de grandeur à recaler après les 2 premières semaines.

---

## 0. Cadre

- **Aujourd'hui → launch** : 9 juil → 16 nov = 18.5 semaines, dont 1 OFF (Edinburgh 31.08–06.09) → **~17.5 semaines × 12 h = ~210 h**.
- **Budget backlog** : Must ≈ 190 h · Should ≈ 38 h → les Should sont les fusibles (§6). Marge structurelle ≈ 0 : toute dérive se paie en Should, jamais en Must d'argent.
- **Déjà couvert par l'existant (on ne refait pas)** : découverte + carte + fiche expérience (C1-C2), checkout invité + anti-survente Serializable, Stripe Connect Express + KYC + refunds + webhook checkout idempotent, scan QR + check-in/no-show/revert, duplication + export CSV, i18n fr/de/en, SEO socle, validation admin des domaines, 19 templates email, design Fraunces.
- **Gates conservés** (dates inchangées) : G-R0' 02.08 · G-R1 13.09 · G-R2 01.11 · G-Supply 02.11 · G-Launch 16.11. « RLS 100% » de G-R0 se lit « invariants DB + isolation applicative testée » (décision stack).

---

## 1. Backlog exhaustif par epic

### E0 — Fiabiliser l'existant (P0 — on garde du code sain) — **12 h, Must**

| ID    | Item                                                                                                                    | DoD                                                                        | Réf                 | Est.  |
| ----- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------- | ----- |
| L-001 | Email de confirmation : passer `bookingId` + `accessToken` (aussi dans `resendConfirmationEmail`)                       | QR joint, bouton billet → page token, lien magique invité livré ; test e2e | GAP §10.1, ENC-068b | 2 h   |
| L-002 | Planifier `expire-pending-bookings`, `follow-ups`, `weekly-summary` dans `vercel.json`                                  | Les 5 crons tournent en prod, logs vérifiés                                | GAP §10.2, ENC-067  | 1 h   |
| L-003 | QR écran de confirmation : encoder l'URL token compatible scanner (même cible que l'email)                              | Scan du QR écran = check-in OK                                             | GAP §10.3           | 1 h   |
| L-004 | Idempotence webhook Stripe Connect via `StripeEvent`                                                                    | Event dupliqué ignoré, test intégration                                    | GAP §10.4, ENC-030b | 1.5 h |
| L-005 | Supprimer/corriger `ModifyBookingCard` (lien mort `/bookings/[id]/manage`)                                              | Plus de lien mort                                                          | GAP §10.5           | 0.5 h |
| L-006 | Onglets « À venir / Passées » fonctionnels sur my-bookings                                                              | Segmented control filtre réellement                                        | GAP §10.6           | 1 h   |
| L-007 | UI client « supprimer mon compte » (double confirmation) branchée sur `requestAccountDeletion`                          | Parcours nLPD complet self-service                                         | GAP §10.7, ENC-135  | 1.5 h |
| L-008 | UI admin remboursement support (brancher `refundBookingManually`, motif obligatoire)                                    | Refund partiel/total depuis /admin/bookings, AdminAction journalisée       | GAP §10.7           | 1.5 h |
| L-009 | `sendEmail` : échec explicite (log + Sentry) si `RESEND_API_KEY` absent en prod — plus de succès silencieux             | Alerte visible, flags dedup non posés à tort                               | GAP §10.8           | 0.5 h |
| L-010 | Localiser les 5 templates FR-en-dur (CancelledByWinery, Expired, ManualRefund ×2, AccountDeleted) via `translations.ts` | `locale` respectée, i18n:check vert                                        | GAP §7              | 1 h   |
| L-011 | Retirer le KPI « taux d'occupation » placebo (vraie métrique en L-130)                                                  | Plus de métrique mensongère                                                | GAP §10.9           | 0.5 h |
| L-012 | Nettoyer le dead code (`HowItWorks`, `PopularExperiences`, `HeroSearchBar`)                                             | 0 composant orphelin                                                       | GAP §10.12          | 0.5 h |
| L-013 | Reçu PDF : corriger la mention « Taxes et frais de service inclus »                                                     | Mention exacte (pas de TVA facturée)                                       | GAP §10.11          | 0.5 h |

### E1 — Schéma V3 & invariants (fondations) — **18 h, Must**

Migrations **additives** uniquement. Tout modèle d'argent a ses invariants testés.

| ID    | Item                                                                                                                                                                                                   | DoD                                                                        | Réf                | Est.  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------ | ----- |
| L-020 | Modèles `Wine` (nom, cépage, millésime, prix, dispo, wineryId) + `BookingWine` (vins servis par réservation)                                                                                           | Migration + CRUD queries testées                                           | PRD US-230         | 1.5 h |
| L-021 | Modèles `GiftCard` + `GiftCardTransaction` (ledger append-only) : code unique, solde dérivé du ledger, CHECK solde ≥ 0, expiration 5 ans, statut                                                       | Test : rédemption concurrente → une seule passe ; solde jamais négatif     | PRD US-210         | 3 h   |
| L-022 | Modèles `Request` + `RequestOffer` (statuts, prix, échéance) + table `ScheduledJob` générique (relances, envois programmés, J+2)                                                                       | Machine à états testée ; jobs schedulables par cron                        | PRD US-240         | 2.5 h |
| L-023 | Politiques par cave : `cancellationPolicy` (FLEXIBLE/STANDARD/STRICT), `noShowFeeEnabled`, `noShowFeeCents` (0–5000, défaut 1500)                                                                      | Champs + validation Zod + défauts                                          | PRD US-220, §5     | 1 h   |
| L-024 | Entité `ExperienceOccurrence` persistée : générée depuis récurrence hebdo **ou** dates ponctuelles ; capacité override, statut (open/closed/cancelled) ; migration douce depuis les sessions calculées | Occurrences générées, bookings rattachés, aucune régression sur l'existant | PRD US-101, GAP §2 | 5 h   |
| L-025 | `languages` sur Experience (FR/DE/EN, multi)                                                                                                                                                           | Champ + affichage fiche + filtre prêt                                      | PRD §5             | 1 h   |
| L-026 | `ExperienceType` : + `MEAL`, + `EVENT` (additif)                                                                                                                                                       | Enum étendu, i18n, filtres                                                 | PRD §5             | 0.5 h |
| L-027 | Plan par cave : `plan` (FOUNDER/STANDARD — la grille Avr 2027 viendra après), `commissionRate` par cave (fallback env)                                                                                 | Commission résolue par cave dans le checkout                               | BUSINESS §2        | 1 h   |
| L-028 | Événements collectifs : `isCollective`, `organizerId`, `EventParticipant` (wineryId, logo, descriptif)                                                                                                 | Modèle + relations                                                         | PRD US-250         | 1 h   |
| L-029 | Seed réaliste étendu : 10 caves, 40 expériences (types/langues/politiques variés), 60 vins, requests, gift cards                                                                                       | `dev:db:setup` reproduit un état V3 complet                                | PLANNING A3        | 1.5 h |
| L-030 | Suite de tests d'invariants : capacité par occurrence, solde gift card, transitions Booking/Request, isolation tenant (rôle×ressource)                                                                 | Toute violation échoue en test — **G-R0'**                                 | PLANNING G-R0      | 1 h   |

### E2 — Monétisation Phase 1 — **14 h, Must** `[FLAG]`

| ID    | Item                                                                                                                                                                                                                      | DoD                                                                | Réf            | Est.  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------- | ----- |
| L-040 | Système de feature flags env-based (`src/lib/flags.ts`) : `BOOKING_FEE`, `GIFT_CARDS`, `NO_SHOW_FEES`, `REQUESTS`, `TASTING_SHEET`, `COLLECTIVE_EVENTS`                                                                   | Chaque flag désactivable par env var sans deploy (< 1 min) ; testé | CLAUDE.md §5   | 2 h   |
| L-041 | Booking fee 2.50 CHF/billet : line item Stripe séparé, ligne « Frais de service » réelle (widget/checkout/succès), reçu PDF, part plateforme (pas de la cave)                                                             | Fee visible et encaissée ; total = prix×pers + 2.50×pers ; e2e     | BUSINESS §2    | 3 h   |
| L-042 | Commission par cave : Fondateurs 0 % (flag par cave, ≤ 20, jusqu'au 31.03.27), 10 % lancement sinon ; admin peut définir plan/taux ; relevés reflètent le taux                                                            | `application_fee` correcte par cave ; affiché dans Earnings        | BUSINESS §2    | 2.5 h |
| L-043 | Politiques d'annulation par cave (flexible/standard/stricte) : barèmes définis, sélection par la cave, calcul de remboursement, affichage fiche + checkout + emails + page légale alignée (remplace le >24 h codé en dur) | Remboursement conforme à la politique ; montant exact dans l'email | PRD §5, GAP §4 | 4 h   |
| L-044 | Dashboard cave « EnCave vous a apporté X CHF » (cumul GMV apportée, Phase 1 data)                                                                                                                                         | Bloc visible sur Earnings/Aujourd'hui                              | BUSINESS §2    | 1.5 h |
| L-045 | KPIs business admin : GMV, billets/mois, take rate blended, CA bons cadeaux, passif gift cards (vue simple)                                                                                                               | Chiffres exacts sur /admin                                         | BUSINESS §9    | 1 h   |

### E3 — Checkout & booking core durcis (C3') — **14 h, Must**

| ID    | Item                                                                                                                                                     | DoD                                                                 | Réf              | Est.             |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------- | ---------------- |
| L-050 | Hold créé au « Continuer » (avant la page checkout), durée 10 min, compte à rebours discret au checkout, libération auto (cron déjà fixé en L-002)       | 2 clients / 3 places → 1 succès 1 refus propre ; hold libéré à T+10 | PRD US-201       | 4 h              |
| L-051 | TWINT premier au checkout + Link activé + cartes (payment_method_types ou automatic_payment_methods ; vérifier activation TWINT sur le compte Stripe CH) | TWINT visible en premier en prod test                               | PRD §5, BUSINESS | 2.5 h            |
| L-052 | Page `/reservation/erreur` : cause lisible (refus/hold expiré), retry direct si hold actif, re-sélection mémorisée sinon                                 | Parcours d'échec complet testé                                      | PAGES §4         | 2 h              |
| L-053 | Proposition de création de compte post-paiement (1 tap — email/coordonnées conservés)                                                                    | Compte créé depuis la page succès, billets rattachés                | PAGES §4, UX #4  | 2.5 h            |
| L-054 | `setup_future_usage` + Stripe Customer pour clients connectés (« enregistrer ma carte ») ; gestion des cartes dans `/compte/profil` (liste, supprimer)   | Carte réutilisable au 2ᵉ achat                                      | PAGES §4-5       | 3 h — **Should** |

### E4 — Fiche dégustation → boucle vin (US-230) — **13 h, Must** `[FLAG]`

| ID    | Item                                                                                                                 | DoD                                                                   | Réf        | Est.  |
| ----- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------- | ----- |
| L-060 | CRUD vins encaveur (`/dashboard/wines`) : nom, cépage, millésime, prix, dispo + note « Bientôt : vendez en ligne »   | Cave gère son catalogue en ≤ 2 min                                    | PAGES §6   | 3 h   |
| L-061 | Fiche dégustation par réservation/session : toggles vins ≥ 48 px, ≤ 30 s mobile, « Envoyer le récap »                | Vins servis persistés (`BookingWine`)                                 | PRD US-230 | 3 h   |
| L-062 | Email #3 J+2 « vos coups de cœur » : vins + prix + CTA demande de commande 1 clic → email à la cave avec coordonnées | Envoyé via `ScheduledJob` + cron ; open/click tracés PostHog par cave | PRD US-230 | 3.5 h |
| L-063 | Email #21 rappel « fiche à remplir » (soir de l'event 21 h si vide) + alerte dashboard                               | Cron du soir + dédup                                                  | PAGES §8   | 1.5 h |
| L-064 | Vins affichés sur la fiche domaine publique (catalogue light, sans achat)                                            | Section « Ses vins »                                                  | PAGES §2   | 2 h   |

### E5 — Anti no-show (US-220) — **14 h, Must** `[FLAG]`

| ID    | Item                                                                                                                                                                                | DoD                                                                             | Réf        | Est. |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------- | ---- |
| L-070 | Réglage cave : opt-in no-show, montant 0–50 CHF (défaut 15), dans le profil domaine + wizard expérience                                                                             | Politique paramétrable et affichée avant réservation                            | PRD US-220 | 2 h  |
| L-071 | Checkout empreinte carte : offres gratuites/payables sur place → Stripe Checkout `mode: 'setup'` (SetupIntent), montant des frais affiché en clair, acceptation horodatée persistée | Aucune donnée carte chez EnCave ; consentement stocké avec version de politique | PRD US-220 | 5 h  |
| L-072 | Prélèvement 1 tap par l'encaveur : PaymentIntent off-session sur la carte empreinte, uniquement si statut NO_SHOW + politique active ; jamais automatique                           | Prélèvement déclenché depuis le détail de session ; email #13 au client         | PRD US-220 | 4 h  |
| L-073 | Gestion des échecs (carte refusée : statut, retry manuel, info cave) + no-show fees dans Earnings/relevés                                                                           | Échec visible et actionnable ; comptabilité correcte                            | PRD US-501 | 3 h  |

### E6 — Bons cadeaux (US-210) — chemin critique Noël — **24 h, Must** `[FLAG]`

| ID    | Item                                                                                                                                                                        | DoD                                                                 | Réf           | Est.  |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------- | ----- |
| L-080 | Page `/cadeaux` : vitrine + configurateur (montant libre 20–500 **ou** expérience, message personnel, destinataire, date d'envoi, aperçu live, FAQ 5 ans)                   | Parcours d'achat ≤ 2 min                                            | PAGES §2      | 5 h   |
| L-081 | Checkout cadeau (Stripe, fee 2.50 à l'achat, fonds plateforme — pas de commission à l'achat) + webhook + création GiftCard via ledger                                       | Achat test bout en bout                                             | BUSINESS §4   | 3 h   |
| L-082 | PDF cadeau personnalisé (react-pdf, décliné de la charte, 2-3 variantes)                                                                                                    | PDF élégant avec message + code                                     | PRD §13.2     | 3 h   |
| L-083 | Envoi programmé : email #6 reçu acheteur immédiat, email #7 bénéficiaire à la date choisie (`ScheduledJob` + cron)                                                          | Envoi à J exact, renvoyable                                         | PAGES §8      | 2.5 h |
| L-084 | Rédemption au checkout : champ code (déplie, applique, solde restant affiché), rédemption partielle, verrou transactionnel, commission du palier de la cave à la rédemption | Double-rédemption concurrente impossible (test dédié) ; solde exact | PRD US-210    | 5 h   |
| L-085 | `/compte/bons-cadeaux` : mes bons (achetés/reçus), code, solde, expiration, renvoyer                                                                                        | Page fonctionnelle                                                  | PAGES §5      | 2 h   |
| L-086 | `/admin/bons-cadeaux` : liste, **passif total**, désactiver un code (fraude), ledger par code                                                                               | Chiffre comptable exact                                             | PAGES §7      | 2 h   |
| L-087 | Test de charge/concurrence gift codes (vitest + script k6)                                                                                                                  | Zéro double-rédemption sous concurrence — G-R2                      | PLANNING G-R2 | 1.5 h |

### E7 — Request / sur-mesure (US-240) — **18 h, Must** `[FLAG]` _(1ᵉʳ fusible — dégradable en formulaire → email manuel)_

| ID    | Item                                                                                                                                                                                                | DoD                           | Réf        | Est.               |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ---------- | ------------------ |
| L-090 | Formulaire public `/sur-mesure` (cave optionnelle « laissez EnCave proposer », date, nb pers., budget, description) + bloc prérempli sur chaque fiche domaine + rate limit + email #8 accusé (48 h) | Demande créée, accusé reçu    | PAGES §2   | 4 h                |
| L-091 | Inbox encaveur `/dashboard/requests` (badge nav) : détail, **composer l'offre** (message, prix total, validité) → email #9 avec lien de paiement                                                    | Offre envoyée en ≤ 5 min      | PRD US-240 | 5 h                |
| L-092 | Paiement de l'offre : checkout Stripe (fee 2.50 + commission du palier) → réservation confirmée + billets émis                                                                                      | Parcours payé bout en bout    | PRD US-240 | 4 h                |
| L-093 | Relance auto unique J-1 échéance (email #10) puis clôture ; email #15 nouvelle demande à la cave (SLA 48 h)                                                                                         | Cron + dédup ; états corrects | PAGES §8   | 2.5 h              |
| L-094 | SLA visible : alerte dashboard « demande sans réponse > 24 h » ; notification EnCave/Sam si > 48 h                                                                                                  | Alertes actionnables          | PRD US-240 | 1.5 h              |
| L-095 | `/compte/demandes` : suivi statut (En attente / Offre reçue / Payée / Expirée) + CTA payer                                                                                                          | Suivi client                  | PAGES §5   | 1.5 h — **Should** |

### E8 — Événements collectifs light (US-250) — **10 h, Must** `[FLAG]`

| ID    | Item                                                                                                                                                                | DoD                                          | Réf        | Est.  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ---------- | ----- |
| L-100 | Création/gestion d'un événement collectif (admin, et cave organisatrice) : infos, caves participantes (logo + descriptif), publication — refonte de `/admin/events` | Événement type « Jardin des Vins » publiable | PRD US-250 | 4 h   |
| L-101 | Fiche publique : bandeau organisateur + grille caves participantes + mini-programme                                                                                 | Rendu conforme                               | PAGES §2   | 2.5 h |
| L-102 | Billetterie centrale (l'organisateur encaisse) + scan multi-points (plusieurs scanners) + stats lecture pour les caves participantes                                | Multi-scan sans collision ; stats visibles   | PRD US-250 | 3.5 h |

### E9 — Découverte & pages publiques manquantes — **16 h (Must 11 h)**

| ID    | Item                                                                                                                                                 | DoD                                                   | Réf        | Prio   | Est.                    |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------- | ------ | ----------------------- |
| L-110 | Recherche par **date** : champ « Quand » sur la home + filtre Date au catalogue + tri « prochaine dispo » par défaut (requiert L-024)                | `?quand=` filtre sur les occurrences réelles          | PAGES §0.1 | Must   | 4 h                     |
| L-111 | Chips raccourcis hero (Ce week-end, Dégustations, Avec repas) préremplissant les filtres                                                             | Chips fonctionnelles                                  | PAGES §2   | Must   | 1 h                     |
| L-112 | Politique d'annulation + no-show affichées en clair sur la fiche expérience et au checkout (acceptation CGV + politique)                             | Aucune réservation sans politique visible et acceptée | PAGES §2/4 | Must   | 2 h                     |
| L-113 | Sections home : bon cadeau + sur-mesure + comment ça marche ; ISR sur la home                                                                        | Home V3 complète, TTFB stable                         | PAGES §2   | Must   | 2.5 h                   |
| L-114 | Pages : `/contact` (formulaire simple), `/mentions-legales`, `/maintenance` ; privacy mise à jour **nLPD** explicite                                 | Pages en ligne, 3 locales                             | PAGES §2   | Must   | 2.5 h                   |
| L-115 | Barre de filtres V3 : budget presets (<50/50-100/100+), filtre langue, pills actives avec ×                                                          | Filtres conformes                                     | PAGES §2   | Should | 2.5 h                   |
| L-116 | Toggle Liste/Carte au catalogue (carte plein écran mobile + carrousel)                                                                               | Toggle fonctionnel                                    | PAGES §2   | Should | 3 h                     |
| L-117 | Fiche domaine enrichie : horaires + bloc sur-mesure (Must) ; altitude/hectares/famille/cépages chips (Should) ; empty state « Vous êtes encaveur ? » | Fiche conforme au sitemap                             | PAGES §2   | mixte  | 2 h Must + 1.5 h Should |

### E10 — Dashboard encaveur V3 — **15 h (Must 10 h)**

| ID    | Item                                                                                                                                                                                                                                          | DoD                                 | Réf        | Prio   | Est. |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ---------- | ------ | ---- |
| L-130 | Page « Aujourd'hui » : KPIs réels (résas du jour, couverts 7 j, CA du mois, remplissage 30 j sur occurrences), prochains créneaux avec jauges, bouton scan flottant, alertes actionnables (requests > 24 h, fiche non remplie, KYC incomplet) | Landing encaveur = Aujourd'hui      | PAGES §6   | Must   | 4 h  |
| L-131 | Créneaux : UI mode ponctuel (dates + heures en chips) + blackouts en tap calendrier + aperçu 8 prochaines occurrences live (sur L-024)                                                                                                        | Création ponctuel/récurrent ≤ 4 min | PRD US-101 | Must   | 3 h  |
| L-132 | Calendrier des occurrences par expérience (mois) : fermer, ajuster la capacité, voir les inscrits                                                                                                                                             | Gestion par occurrence complète     | PAGES §6   | Must   | 3 h  |
| L-133 | Wizard création multi-étapes (≤ 5 champs/écran, sauvegarde par étape, langues + politiques intégrées, recadrage photos)                                                                                                                       | Onboarding ≤ 30 min tenu            | PAGES §6   | Should | 3 h  |
| L-134 | Onboarding 3 étapes : Domaine → Stripe KYC → 1ʳᵉ expérience guidée (template), reprise auto                                                                                                                                                   | KYC dans le flow, pas après         | PRD §7     | Should | 2 h  |

### E11 — Scan PWA & payouts réels — **11 h (Must 8 h)**

| ID    | Item                                                                                                                                      | DoD                                            | Réf        | Prio   | Est.  |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------- | ------ | ----- |
| L-140 | Scan offline-tolerant : service worker, liste du jour préchargée, queue de sync au retour réseau, compteur scannés/attendus               | Scan fonctionne en réseau dégradé (test avion) | PRD US-301 | Must   | 4 h   |
| L-141 | Paiements encaveur : payouts **réels** Stripe (balance transactions/payouts API) — remplacer l'heuristique J+5 ; historique des virements | « Prochain virement » = donnée Stripe          | GAP §10.10 | Must   | 2.5 h |
| L-142 | Relevé PDF **mensuel** (brut, commission, fees client, no-show fees, net) + email #17 récap hebdo avec lien relevé                        | Relevé conforme « aucun frais caché »          | PRD US-501 | Must   | 2 h   |
| L-143 | Email #18 « Action requise Stripe » sur webhook account.updated (KYC incomplet)                                                           | Email envoyé avec le manquant                  | PAGES §8   | Must   | 1 h   |
| L-144 | Push web notifications (PushSubscription + service worker + préférences par type)                                                         | Push nouvelle résa / nouvelle demande          | PRD §5     | Should | 2.5 h |

### E12 — Auth V3 — **9 h (Must 7 h)**

| ID    | Item                                                                                                                              | DoD                                                        | Réf      | Prio          | Est.  |
| ----- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------- | ------------- | ----- |
| L-150 | OTP email (better-auth `emailOTP`) : « Recevoir un code » au login + email #11 (6 chiffres, 15 min) — remplace le reset password  | Login par code fonctionnel ; « mot de passe oublié » → OTP | PAGES §3 | Must          | 3 h   |
| L-151 | Changement de mot de passe (dans `/compte/profil` et paramètres encaveur) + changement d'email                                    | Self-service complet                                       | PAGES §3 | Must          | 1.5 h |
| L-152 | TOTP obligatoire pour ADMIN (better-auth `twoFactor`)                                                                             | Admin sans TOTP → setup forcé                              | PAGES §3 | Must          | 2 h   |
| L-153 | Sessions longues encaveur (~90 j refresh) — config par rôle                                                                       | PWA cave sans re-login quotidien                           | PAGES §3 | Must          | 0.5 h |
| L-154 | `/invitation/[token]` voie Fondateurs : crée compte + domaine `VERIFIED` (saute la validation) ; génération des liens par l'admin | 20 caves onboardables sans file d'attente                  | PRD §7   | Should        | 2 h   |
| L-155 | Câbler `AUTH_RATE_LIMIT`/`REGISTRATION_RATE_LIMIT` ; trancher Apple OAuth (bouton ou retrait config)                              | Limites actives                                            | GAP §8   | Must (inclus) | —     |

### E13 — Admin V3 & emails restants — **8 h, Must**

| ID    | Item                                                                                                                                                                       | DoD                                 | Réf      | Est.  |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | -------- | ----- |
| L-160 | `/admin` : GMV/résas du jour, santé webhooks (lag `StripeEvent`), derniers échecs de jobs (`EmailLog` failed)                                                              | Vue ops en un écran                 | PAGES §7 | 2 h   |
| L-161 | Liste complète des domaines (tous statuts) + historique `VerificationLog`/`AdminAction` affiché                                                                            | Plus de write-only audit            | PAGES §7 | 1.5 h |
| L-162 | `/admin/utilisateurs` : liste clients + encaveurs, anonymisation nLPD (UI), changement de rôle journalisé                                                                  | Gestion utilisateurs opérationnelle | PAGES §7 | 2 h   |
| L-163 | Email #22 « nouveau domaine à valider » à l'admin au signup encaveur                                                                                                       | Notification reçue                  | PAGES §8 | 0.5 h |
| L-164 | Email #1 confirmation : joindre PDF billet + .ics (générateurs existants) ; #5 annulation cave : 3 alternatives proches (geo-utils) ; #2 rappel : passage à la veille 18 h | Emails conformes à l'inventaire     | PAGES §8 | 2 h   |

### E14 — Hardening, NFR & conformité (Phase D) — **20 h, Must**

| ID    | Item                                                                                                                                                             | DoD                                               | Réf            | Est.  |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | -------------- | ----- |
| L-180 | k6 : survente Slot (concurrence sur 3 places) + double-rédemption gift — exécution hebdo + avant release                                                         | Zéro survente / zéro double-rédemption — **G-R2** | PRD US-201/210 | 3 h   |
| L-181 | 6 parcours e2e Playwright en CI : booking invité, cadeau (achat + rédemption), request bout en bout, annulation + refund, scan check-in, onboarding cave         | e2e verts en CI sur chaque PR                     | PLANNING D1    | 4 h   |
| L-182 | Lighthouse CI ≥ 95 + budgets perf (LCP < 1.5 s découverte), ISR/tags vérifiés                                                                                    | Budgets tenus sur seed                            | PRD §8         | 2.5 h |
| L-183 | axe (a11y) sur booking + cadeaux — WCAG 2.1 AA                                                                                                                   | 0 violation bloquante                             | PRD §8         | 2 h   |
| L-184 | Alerting : webhook lag > 5 min (cron de contrôle `StripeEvent`), échecs cron/emails, Sentry alerts paiement ; `/api/health` avec probes DB/Redis/Stripe          | Alerte reçue en < 5 min sur incident simulé       | PRD §8         | 2.5 h |
| L-185 | Checklist nLPD complète : registre des traitements, DPA (Vercel/Neon/Stripe/Resend/PostHog), mentions légales, privacy nLPD, effacement + export vérifiés        | Checklist signée — gate                           | PRD §8         | 2 h   |
| L-186 | **CGV mises à jour** : bons cadeaux (validité 5 ans, rédemption partielle), frais no-show (consentement), Request, politiques d'annulation par cave, booking fee | Légal aligné sur le produit                       | PAGES §2       | 1.5 h |
| L-187 | Runbooks (incident paiement, litige no-show, désactivation d'un flag, restauration DB) + astreinte définie                                                       | Runbooks testés à froid                           | PLANNING D1    | 1.5 h |
| L-188 | `/security-review` complet avant launch (CSP, secrets, webhooks, rate limits, tokens)                                                                            | 0 blocker                                         | PLANNING §8    | 1 h   |
| L-189 | Bascule launch : retirer le gate Coming Soon du middleware, vérifier Stripe live (TWINT activé, webhooks prod, Connect), sitemap/robots, redirections            | encave.ch ouvert le 16.11 au matin                | GAP §8         | 1 h   |

### E15 — Performance & Web Vitals — **20.5 h Must, 5.5 h Should** _(issu de l'audit `docs/ENCAVE-V3-PERF-AUDIT.md` — mesuré : home mobile Lighthouse 48, LCP 9.8 s vs cible 95 / 1.5 s)_

| ID    | Item                                                                                                                                                                                                      | DoD                                                          | Réf          | Prio   | Est.  |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------ | ------ | ----- |
| L-200 | Hero desktop : remplacer le CSS background 4.8 MB par `next/image` optimisé ; ne rendre qu'UN éditorial par device (plus de double arbre caché + preloads invisibles)                                     | Home desktop < 1 MB ; un seul fetch hero                     | PERF §3.1    | Must   | 2 h   |
| L-201 | Mapbox : ne pas monter la carte desktop sur mobile (gate media query avant mount) + lazy IntersectionObserver sur toutes les cartes (`DynamicMap`)                                                        | Chunk 439 kB absent du chargement initial mobile             | PERF §3.2    | Must   | 2 h   |
| L-202 | Découpler `<Header>` de `auth()` (session dans un îlot client/Suspense) → home + listes statiques/ISR ; `generateStaticParams` + `revalidate=300` sur fiches expérience/domaine ; retirer `force-dynamic` | Home/listes/fiches servies par le CDN, revalidation par tags | PERF §3.3    | Must   | 4 h   |
| L-203 | i18n : `NextIntlClientProvider` avec `pick()` des namespaces réellement utilisés côté client                                                                                                              | ~−80 kB de HTML sur chaque page                              | PERF §3.4    | Must   | 2 h   |
| L-204 | posthog-js en `import()` dynamique après consentement, `autocapture` désactivé sauf besoin                                                                                                                | posthog absent du bundle initial                             | PERF §3.5    | Must   | 1 h   |
| L-205 | Sentry Session Replay en `lazyLoadIntegration`                                                                                                                                                            | ~−50 kB gz du bundle initial                                 | PERF §3.5    | Must   | 0.5 h |
| L-206 | Retirer `unoptimized` de la galerie fiche ; fonts : supprimer Fraunces italic + graisses superflues ; framer-motion → CSS (2 usages) ; `preconnect` Blob/Stripe + `dns-prefetch` PostHog/Mapbox           | Galerie AVIF/resize ; ≤ 7 fichiers de police                 | PERF §3.6/10 | Must   | 2 h   |
| L-207 | Index DB : pg_trgm GIN sur recherche (title/description/nom/commune), `@@index([visitorEmail])`, composites `[wineryId,status,date]` et `[status,date]` (migration raw additive)                          | Plans de requête indexés (EXPLAIN vérifié)                   | PERF §3.7    | Must   | 2 h   |
| L-208 | `select` sur `searchExperiences`/featured/related/crons (stop `description` dans les cartes) ; earnings en `aggregate`/`groupBy` (fix 6 requêtes séquentielles) ; `take` sur les listes non bornées       | RSC payload des listes allégé ; earnings ≤ 3 requêtes        | PERF §3.9    | Should | 2.5 h |
| L-209 | Retry borné sur P2034 autour de la transaction Serializable du checkout + `connection_limit` sur l'URL poolée                                                                                             | Réservation concurrente = retry, pas d'erreur utilisateur    | PERF §3.8    | Must   | 1.5 h |
| L-210 | Géocode : `AbortSignal.timeout(3s)` + `Cache-Control` + cache Redis partagé ; géocodage onboarding asynchrone (après commit) ; polling checkout pausé si `document.hidden`                                | Plus de SPOF Nominatim ; charge idle réduite                 | PERF §4.4    | Should | 1.5 h |
| L-211 | Crons : requêtes groupées (2 requêtes au lieu de 2×N caves) + envois d'emails à concurrence bornée                                                                                                        | Digest < 30 s même à 50 caves                                | PERF §4.4    | Should | 1.5 h |
| L-212 | Invalidation : supprimer le fan-out `revalidatePath` multi-locales (garder les tags) ; hoister le wrapper `unstable_cache` de `searchExperiences` ; retirer le fetch `getSessionRole` du middleware       | Pas de thrash ISR ; 1 résolution session par requête admin   | PERF §4.1    | Must   | 1 h   |
| L-213 | RUM : `useReportWebVitals` → PostHog (LCP/INP/CLS attribués par route)                                                                                                                                    | Web vitals terrain visibles par page                         | PERF §2      | Should | 1 h   |
| L-214 | A11y systémique : focus trap/restore sur la lightbox, `aria-pressed` sur pills/chips (tri, créneaux), `aria-live` sur le stepper personnes, vérif contrastes gold/cream (tokens)                          | axe (L-183) sans violation sur booking/cadeaux               | PERF §4.5    | Must   | 2 h   |
| L-215 | Images : `minimumCacheTTL` 30 j + `deviceSizes` ajustés ; variante server de `ImageWithFallback` pour les grilles ; héros JPG → v2 154 kB ; hero wineries rapatrié d'Unsplash vers Blob                   | Plus d'image > 200 kB sur les pages découverte               | PERF §4.2    | Must   | 1.5 h |
| L-216 | Supprimer le `NavigationLoader` (listener click global) — garder nprogress ; supprimer `HealthStatus.tsx` (dead code)                                                                                     | Un seul loader de navigation                                 | PERF §3.10   | Must   | 0.5 h |
| L-217 | CSP `connect-src` : ajouter `tile.openstreetmap.org`/`demotiles.maplibre.org` si le fallback carte sans token est conservé (sinon exiger le token)                                                        | Carte fonctionnelle sous CSP dans les deux modes             | PERF §4.4    | Must   | 0.5 h |

---

## 2. Totaux

| Bloc              | Must       | Should    |
| ----------------- | ---------- | --------- |
| E0 Fiabilisation  | 12 h       | —         |
| E1 Schéma         | 18 h       | —         |
| E2 Monétisation   | 14 h       | —         |
| E3 Checkout durci | 11 h       | 3 h       |
| E4 Boucle vin     | 13 h       | —         |
| E5 Anti no-show   | 14 h       | —         |
| E6 Bons cadeaux   | 24 h       | —         |
| E7 Request        | 16.5 h     | 1.5 h     |
| E8 Collectifs     | 10 h       | —         |
| E9 Public         | 12 h       | 7 h       |
| E10 Dashboard     | 10 h       | 5 h       |
| E11 Scan/payouts  | 9.5 h      | 2.5 h     |
| E12 Auth          | 7 h        | 2 h       |
| E13 Admin/emails  | 8 h        | —         |
| E14 Hardening     | 20 h       | —         |
| E15 Performance   | 20.5 h     | 5.5 h     |
| **Total**         | **~220 h** | **~27 h** |

Capacité ~210 h → **avec E15, le Must dépasse la capacité de ~10 h.** Lecture assumée : (1) les estimations sont des heures de pilotage — la vélocité réelle avec Claude Code se recale après S1-S2 ; (2) si elle ne suffit pas, l'écart se prend sur les fusibles §4 (E7 simplifié ≈ −8 h à lui seul), **jamais** sur E15 L-200→L-205 (sans eux, le gate G-R2 « Lighthouse ≥ 95 » est mathématiquement inatteignable — mesuré à 48 aujourd'hui).

---

## 3. Calendrier (9 juil → 16 nov)

| Sem           | Dates       | Contenu                                                                                                                                                             | Jalon                      |
| ------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| S0            | 09–12.07    | Ce plan + décisions §5 + import Linear                                                                                                                              | Backlog actif              |
| S1            | 13–19.07    | **E0** fiabilisation + **E15 quick wins** (L-200, L-204, L-205, L-206, L-215, L-216, L-217)                                                                         | Existant sain + rapide     |
| S2            | 20–26.07    | **E1** part 1 : Wine, GiftCard+ledger, Request, politiques, plans, ScheduledJob                                                                                     |                            |
| S3            | 27.07–02.08 | **E1** part 2 : occurrences persistées, invariants, seed                                                                                                            | **G-R0'** (02.08)          |
| S4            | 03–09.08    | **E2** : flags, fee 2.50, commission par cave, politiques d'annulation                                                                                              | Monétisation flaggée       |
| S5            | 10–16.08    | **E3** : hold 10 min + countdown, TWINT/Link, /reservation/erreur, compte post-paiement + **L-209** retry P2034                                                     | Checkout V3                |
| S6            | 17–23.08    | **L-131/132** créneaux ponctuels + calendrier occurrences + **L-110/111** recherche par date + **L-202/203, L-201, L-207, L-212** (ISR/header, i18n, Mapbox, index) | US-101 + LCP en zone verte |
| S7 _(courte)_ | 24–28.08    | **E4** part 1 : CRUD vins + fiche dégustation UI                                                                                                                    |                            |
| OFF           | 31.08–06.09 | **Edinburgh**                                                                                                                                                       |                            |
| S8            | 07–13.09    | **E4** part 2 : email J+2 + rappel 21 h + **L-130** page Aujourd'hui + alertes                                                                                      | **G-R1** (13.09)           |
| S9            | 14–20.09    | **E5** anti no-show complet (SetupIntent → prélèvement 1 tap)                                                                                                       | US-220                     |
| S10           | 21–27.09    | **E6** part 1 : /cadeaux, checkout cadeau, PDF, envoi programmé                                                                                                     |                            |
| S11           | 28.09–04.10 | **E6** part 2 : rédemption checkout + verrous + compte/admin + tests concurrence                                                                                    | US-210 — prêt Noël         |
| S12           | 05–11.10    | **E7** part 1 : formulaire, inbox, composer l'offre                                                                                                                 |                            |
| S13           | 12–18.10    | **E7** part 2 : paiement offre, relances, SLA + **E8** part 1                                                                                                       | US-240                     |
| S14           | 19–25.10    | **E8** fin (multi-scan, stats) + **E9** Must (politiques affichées, home, pages légales)                                                                            | US-250                     |
| S15           | 26.10–01.11 | **E12** auth (OTP, TOTP, sessions) + **E13** admin/emails + **E11** payouts réels + relevés                                                                         | **G-R2 code** (01.11)      |
| S16           | 02–08.11    | **E14** : k6, e2e CI, Lighthouse, axe, alerting, nLPD, CGV, runbooks + **L-140** scan offline + **E15 solde** (L-208, L-210, L-211, L-213, L-214)                   | D1                         |
| S17           | 09–15.11    | **Beta fermée** : caves fondatrices en réel, ~20 résas vrais paiements, 2-3 cadeaux, 1 request ; corrections ; L-189 bascule                                        | D2                         |
| 🚀            | **16.11**   | **LAUNCH** (G-R2 + G-Supply + runbooks + astreinte)                                                                                                                 |                            |

Chemin critique : `E1 (schéma) → E2 (monétisation) → E3 (checkout) → E5/E6 (no-show, cadeaux) → E7 (request) → D1 → D2`. **E6 fini au 04.10 = 6 semaines de marge avant la saison cadeaux.**

## 4. Fusibles (ordre de dégradation si dérive)

1. **L-095 + E7 simplifié** : Request = formulaire → email à la cave, offre et paiement manuels (upgrade décembre).
2. **L-144** push web → email seulement.
3. **L-133/134** wizard multi-étapes + onboarding 3 étapes → formulaire actuel conservé.
4. **L-115/116** filtres avancés + toggle carte → filtres actuels.
5. **L-154** invitations fondateurs → onboarding assisté par Sam (validation admin rapide).
6. **L-117 Should** (altitude/hectares/famille).
7. **E8 réduit** : caves participantes affichées, stats en 3.3.
8. **E15 Should** (L-208, L-210, L-211, L-213) : optimisations DB fines, RUM — reportables post-launch. Les Must L-200→L-205 ne sont **pas** des fusibles (gate G-R2 Lighthouse ≥ 95).

**Jamais dégradés** : E1, E2, E3, E5, E6, E14 (l'argent et la confiance).

## 5. Décisions à trancher (bloquantes, à prendre en S0/S1)

| #   | Décision                                                                        | Proposition par défaut                                                                  |
| --- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| D1  | Booking fee 2.50 : remboursée en cas d'annulation éligible ?                    | Oui (remboursement intégral = fee incluse) — simple et défendable                       |
| D2  | Barèmes exacts flexible/standard/stricte                                        | Flexible : 100 % > 24 h · Standard : 100 % > 48 h, 50 % 24-48 h · Stricte : 100 % > 7 j |
| D3  | Durée du hold : 10 min (spec) vs 30 min (actuel)                                | 10 min avec countdown (spec) — libère la capacité                                       |
| D4  | TWINT : vérifier l'activation sur le compte Stripe CH (peut nécessiter demande) | À vérifier semaine S0 — risque externe                                                  |
| D5  | Apple OAuth : ajouter le bouton ou retirer la config                            | Retirer (Google + OTP suffisent au launch)                                              |
| D6  | Champs profil domaine enrichi (altitude/hectares/famille) : Must ou Should      | Should (fusible)                                                                        |
| D7  | Événement collectif pilote réel (marché de Noël vigneron ? Saint-Vincent ?)     | Décision produit — conditionne le polish E8                                             |

## 6. Hors-code — checklist launch (chemin critique n°2, inchangé)

- **Acquisition** : 20 conversations (juil-août) → 10 caves onboardées (sept-oct) → **G-Supply 02.11 : ≥ 8 caves actives, ≥ 24 expériences, dispos réelles nov-déc**. Recueillir les politiques annulation/no-show réelles des caves pilotes (alimente D2).
- **Légal/finance** : entité, CGV signées (L-186), TVA (affichage TTC, structure comptable), assurance RC pro, compte Stripe live + TWINT activé (D4).
- **Ops launch** : astreinte définie, runbooks testés, alerting téléphone, flags vérifiés (désactivation < 1 min), plan de communication (réseaux caves + SEO local + push cadeaux Noël).
- **Le Cercle** : 2-3 conversations domaines haut de gamme + 1 sommelier (oct-nov) — zéro dev, signal 2027.
- **Freeze** : 5–15.12 Maldives — zéro deploy, alerting actif ; page `/maintenance` prête (L-114).
