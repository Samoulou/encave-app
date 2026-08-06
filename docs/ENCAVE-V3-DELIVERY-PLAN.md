# EnCave V3 — Delivery Plan (pilotage par packages)

> **Version** : 1.0 — 9 juillet 2026 · **Owner** : Sam · **Statut** : actif
> **Rôle** : LE document de pilotage de l'exécution. On y prend le prochain package, on le livre selon la boucle §2, on coche, on recommence. Les items détaillés (`L-xxx`) vivent dans `docs/ENCAVE-V3-LAUNCH-BACKLOG.md` ; les specs produit dans `docs/v3/`.
> **Granularité** : un package = une fonctionnalité livrable de bout en bout (valeur visible ou gate technique franchi), ~8-25 h. Jamais de PR-miette, jamais de PR-monstre.

---

## 1. Règles du jeu (non négociables)

1. **Un package = un plan = une (ou deux) PR vers `dev`.** Jamais de push direct sur `dev` ni `main`. `dev` → `main` se décide manuellement par Sam, en temps voulu (staging validé) — jamais dans la boucle.
2. **Chaque package a une DoD écrite AVANT l'implémentation** — mesurable, binaire, tous critères requis, à l'image des gates V3. Pas de DoD verte = pas de merge. La DoD est copiée dans la description de la PR et cochée ligne par ligne.
3. **Tout ce qui touche l'argent est feature-flaggé** et livré flag OFF par défaut. Flag OFF = comportement actuel strictement inchangé (prouvé par les e2e existants).
4. **On garde l'existant** : migrations additives uniquement, pas de réécriture cosmétique, pas de renommage de route hors epic dédié (cf. `CLAUDE.md` §V3 Convergence).
5. **Un seul package actif à la fois** (WIP = 1). Exception unique : si le package courant passe ⏸ (bloqué sur décision/externe), on avance un bouche-trou (P-06/P-14/P-15) — jamais deux packages 🟨 simultanés. Si un package révèle un travail imprévu > 2 h, il retourne au backlog comme item — on ne gonfle pas la PR en cours.

## 2. La boucle de livraison

```
        ┌─────────────────────────────────────────────────────────────┐
        │                                                             │
   ①NEXT → ②PLAN → ③BUILD → ④VERIFY → ⑤REVIEW → ⑥MERGE → ⑦UPDATE ──┘
```

| Étape        | Quoi (précisément)                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ① **NEXT**   | Ouvrir §5. Prendre le **premier package ⬜ dont toutes les dépendances sont ✅**. Passer son statut à 🟨.                                                                                                                                                                                                                                                                                                    |
| ② **PLAN**   | Écrire `docs/plans/P-XX-<slug>.md` depuis `docs/plans/TEMPLATE.md` : scope in/out, découpage technique, la **DoD copiée depuis §4** (+ critères additionnels si découverts), risques/rollback, décisions ouvertes. **Si une décision produit est ouverte → la poser à Sam AVANT de coder.**                                                                                                                  |
| ③ **BUILD**  | Créer l'issue Linear (idéal) et sa branche `samuel/enc-XX-<slug>` depuis `dev` à jour. Fallback sans Linear : branche `claude/p-XX-<slug>`, commits `feat(p-XX): …`, titre PR `P-XX: <package>` — régulariser l'issue Linear a posteriori. Implémenter par commits conventionnels `feat(enc-XX): …`. Tests écrits AVEC le code, pas après. Flags d'abord, feature ensuite.                                   |
| ④ **VERIFY** | Dérouler la DoD ligne par ligne + le socle §3. Mesurer ce qui doit l'être (Lighthouse, concurrence, EXPLAIN…). Une ligne rouge = on reste en ③.                                                                                                                                                                                                                                                              |
| ⑤ **REVIEW** | `/code-review high` par défaut. **`/code-review max`** (le « ultra » du planning V3 — 3 runs réservés) sur **P-04 (booking core), P-09 (gift cards), P-16 (pré-launch)**. `/security-review` sur chaque package 💰 (P-03, P-04, P-08, P-09, P-10), sur P-14 (auth), et **pendant P-16 avant la bascule** (le launch est la FIN de P-16). Corriger tout blocker ; re-VERIFY si le fix touche du comportement. |
| ⑥ **MERGE**  | PR vers `dev`, titre `ENC-XX: <package>`, description = résumé + DoD cochée + `Fixes ENC-XX`. CI verte obligatoire. Merge → deploy staging `encave-dev.vercel.app` → **smoke test staging** (le parcours principal du package, à la main ou e2e).                                                                                                                                                            |
| ⑦ **UPDATE** | Cocher §5 (✅ + n° PR). Mettre à jour `CLAUDE.md` (si conventions/comportement changent), le backlog (items faits), et les docs touchées. Démo Loom aux caves pilotes si le package est visible encaveur (DoD release du planning V3). **Retour en ①.**                                                                                                                                                      |

**Cas d'échec en boucle** : si ④ ou ⑤ bloque > 2 jours ouvrés sur le même point, on applique les fusibles du backlog (§4 du backlog) ou on descend le package d'un cran dans l'ordre ; la décision est notée dans le plan du package (`docs/plans/P-XX-*.md`, section Risques). Un package 🟨 sans décision depuis > 1 semaine = sujet n°1 de la revue dominicale.

## 3. Socle DoD transverse (s'applique à CHAQUE package, en plus de sa DoD propre)

- [ ] `npm run lint` + `npm run format:check` + `npm run i18n:check` verts
- [ ] `npm run test:run` vert (unit + integration) ; e2e existants verts (`npm run test:e2e`)
- [ ] Tests nouveaux : chaque server action couvre unauthorized / validation / happy path ; chaque invariant d'argent a son test de violation
- [ ] Migrations **additives** uniquement ; `prisma migrate diff` relu
- [ ] Feature flag si argent, livré OFF ; flag OFF prouvé sans effet
- [ ] Chaînes UI dans les 3 locales (fr/de/en) ; états loading/empty/error présents
- [ ] Aucun secret/console.log/`as any`/`!` ; conventions `CLAUDE.md` respectées
- [ ] Docs à jour (backlog coché, CLAUDE.md si besoin)

## 4. Les packages, dans l'ordre de livraison

> 💰 = package d'argent : feature flag obligatoire + `/security-review` (+ `/code-review max` pour P-04 et P-09 uniquement — cf. ⑤). Les items `L-xxx` renvoient au backlog. Estimations = heures de pilotage (somme des items du backlog).

### P-01 — Fiabilisation & quick wins perf _(items L-001→L-013, L-200, L-204→L-206, L-215→L-217 · ~21 h · dépend de : rien)_

Répare tout ce qui est cassé sur l'existant + les gains perf à effort minimal. Deux PRs autorisées (bugs / perf).

**DoD (gate — tous requis)** :

- [ ] L'email de confirmation contient le QR et un lien billet token **fonctionnel** ; parcours invité e2e : réserver → recevoir → ouvrir billet → annuler
- [ ] Les 5 crons sont dans `vercel.json` ; `expire-pending-bookings` libère un hold expiré (test)
- [ ] Le QR affiché à l'écran est scannable par le scanner (test manuel documenté)
- [ ] Webhook Connect : un event rejoué = zéro effet (test intégration)
- [ ] Suppression de compte (client) et remboursement support (admin) accessibles depuis l'UI
- [ ] Plus aucun item du GAP §10 ouvert ; dead code supprimé
- [ ] Hero desktop < 500 kB total ; posthog + Sentry Replay hors du bundle initial ; ≤ 7 fichiers de police
- [ ] **Lighthouse home mobile ≥ 65** (remesure locale, méthode du perf audit)

### P-02 — Fondations schéma V3 _(L-020→L-030 · ~19 h · dépend de : rien)_

Toutes les tables V3 (Wine, BookingWine, GiftCard+ledger, Request+Offer, ScheduledJob, occurrences, politiques, plans, collectifs, langues) + invariants + seed. Aucune UI.

**DoD (= gate G-R0')** :

- [ ] Migration(s) 100 % additives, appliquées sur une copie de la DB dev sans perte
- [ ] Tests d'invariants : solde gift card < 0 **impossible**, capacité d'occurrence dépassée **impossible**, transition d'état interdite (Booking/Request) **impossible** — chaque violation = test rouge dédié
- [ ] Occurrences générées depuis récurrence ET ponctuel ; les bookings existants restent rattachés (zéro régression e2e)
- [ ] Seed V3 : 10 caves (plans/politiques variés), 40 expériences, 60 vins, requests, gift cards — `dev:db:setup` vert
- [ ] Matrice d'isolation rôle×ressource testée sur les nouveaux modèles

_Note G-R0'_ : le critère « observabilité live » du gate original est couvert par l'acquis (Sentry + Pino + Speed Insights déjà en prod) ; l'alerting complet (L-184) arrive en P-16 — renégociation documentée ici.

### P-03 — Monétisation Phase 1 💰 _(L-040→L-045 · ~14 h · dépend de : P-02)_

Flags, booking fee 2.50, commission par cave (Fondateurs 0 % / 10 %), politiques d'annulation, KPIs business.

**DoD** :

- [ ] Système de flags : **kill-switch prouvé en < 1 min sans deploy** — le mécanisme (Vercel Edge Config, ou flag en DB avec cache ≤ 60 s ; une simple env var Vercel exige un redeploy et ne suffit PAS) est tranché au plan P-03 ; **flags OFF = e2e existants verts sans modification**
- [ ] Flag ON : checkout affiche « Frais de service 2.50 » × billets en ligne séparée ET l'encaisse (test Stripe mode test) ; reçu/relevés cohérents
- [ ] Cave Fondateur → `application_fee` = fee client seule ; cave standard → fee + 10 % (tests intégration sur les deux)
- [ ] Remboursement calculé selon la politique de la cave (tests des 3 barèmes) ; montant exact dans l'email ; page légale alignée
- [ ] « EnCave vous a apporté X CHF » visible côté cave ; GMV/passif visibles côté admin

### P-04 — Checkout V3 💰 _(L-050→L-054, L-209 · ~15.5 h · dépend de : P-03)_

Hold 10 min au « Continuer », countdown, TWINT/Link, page erreur, compte post-paiement, retry P2034.

**DoD (= cœur du gate G-R2 « zéro survente »)** :

- [ ] Hold créé à la sélection, visible (compte à rebours), libéré à T+10 exactement (test)
- [ ] **Concurrence : 2 clients / 3 places → exactement 1 succès + 1 refus propre ; les conflits P2034 sont retryés, jamais exposés** (test de concurrence automatisé, base du futur k6)
- [ ] TWINT proposé en premier, Link actif (vérifié en mode test ; si TWINT indisponible sur le compte → décision D4 documentée)
- [ ] `/reservation/erreur` couvre paiement refusé ET hold expiré, avec retry/re-sélection (e2e)
- [ ] Création de compte en 1 tap post-paiement rattache les billets

### P-05 — Créneaux & recherche par date _(L-110, L-111, L-131, L-132 · ~11 h · dépend de : P-02)_

Mode ponctuel + calendrier d'occurrences encaveur + champ « Quand » + tri prochaine dispo.

**DoD (= US-101)** :

- [ ] Créer « Dégustation 25 CHF, sam 10h/16h, cap. 8 » génère 12 occurrences publiques en < 60 s ; création ≤ 4 min chrono
- [ ] Mode ponctuel (dates + heures en chips) ET récurrent avec blackouts au tap ; aperçu live des 8 prochaines occurrences
- [ ] Calendrier mensuel : fermer une occurrence, ajuster sa capacité, voir les inscrits — chacun testé
- [ ] Home « Où + Quand » → catalogue filtré par date réelle ; tri par défaut = prochaine dispo ; chips raccourcis fonctionnelles

### P-06 — Performance structurelle _(L-201, L-202, L-203, L-207, L-212 · ~11 h · dépend de : rien — bouche-trou, avançable dès qu'un package bloque)_

ISR/header découplé, i18n subset, Mapbox gated, index DB, invalidation propre.

**DoD (mesurée, méthode du perf audit)** :

- [x] Home, catalogue et fiches présents dans `prerender-manifest` (ISR, revalidation par tags) — 173 routes
- [x] **Lighthouse mobile local : home ≥ 85, catalogue ≥ 85** ; HTML home < 120 kB — ⚠️ gate simulé partiellement manqué (home 73, catalogue 79) MAIS toutes les métriques observées améliorées (LCP réel 747→706 ms, HTML −33 % à −69 %) : artefact Lantern documenté au plan doc ; décision Sam go merge, vérité NFR = staging/CDN + Lighthouse CI (L-182, P-16). HTML home 198 kB (< 120 kB non atteint, −33 %)
- [x] Chunk maplibre absent du chargement initial mobile (network trace + spec perf-budget)
- [x] `EXPLAIN` de la recherche et de my-bookings = index scan (trigram + visitorEmail) — 6/6 db-gated
- [x] Une mutation cave n'évince plus la home ×4 locales (tags seuls, purge tag→Full Route Cache prouvée)

### P-07 — Fiche dégustation → boucle vin _(L-060→L-064 · ~13 h · dépend de : P-02 · feature-flaggé, review `high`)_

**DoD (= US-230 + gate G-R1 « fiche utilisée »)** :

- [ ] CRUD vins ≤ 2 min pour 5 vins (mobile) ; vins visibles sur la fiche domaine publique
- [ ] Fiche dégustation remplie en ≤ 30 s sur mobile (toggles ≥ 48 px), persistée par réservation
- [ ] Email J+2 « vos coups de cœur » : vins + prix + CTA commande 1 clic → la cave reçoit la demande avec coordonnées (cron testé, dédup)
- [ ] Rappel 21 h si fiche vide + alerte dashboard ; open/click tracés par cave
- [ ] Flag OFF = aucune fiche, aucun email

### P-08 — Anti no-show 💰 _(L-070→L-073 · ~14 h · dépend de : P-02, P-04)_

**DoD (= US-220)** :

- [ ] Opt-in par cave, montant 0–50 CHF (défaut 15), politique affichée AVANT réservation et acceptée (horodatage persisté avec version)
- [ ] Offre gratuite/sur place → empreinte carte via SetupIntent, **zéro débit** à la réservation ; aucune donnée carte chez EnCave
- [ ] Prélèvement : uniquement manuel, uniquement si statut NO_SHOW, 1 tap → débit off-session + email #13 citant la politique acceptée (tests : cas nominal + carte refusée + tentative sur booking non-NO_SHOW rejetée)
- [ ] No-show fees visibles dans Earnings/relevés ; flag OFF = checkout actuel inchangé

### P-09 — Bons cadeaux 💰 _(L-080→L-087 · ~24 h · dépend de : P-02, P-04 · 2 PRs autorisées : achat/envoi puis rédemption/admin)_

**DoD (= US-210, chemin critique Noël)** :

- [ ] Achat montant libre (20-500) OU expérience → paiement (fee 2.50) → PDF personnalisé → email acheteur immédiat + bénéficiaire à la **date choisie** (cron testé)
- [ ] Rédemption au checkout : code appliqué, partielle, solde restant affiché et exact ; **test de concurrence : 2 rédemptions simultanées du même code → une seule passe** ; solde jamais négatif (invariant DB)
- [ ] Commission du palier de la cave appliquée à la rédemption (test Fondateur vs standard)
- [ ] `/compte/bons-cadeaux` (solde, renvoyer) et `/admin/bons-cadeaux` (**passif total = somme du ledger**, désactivation code, historique)
- [ ] Validité 5 ans ; flag OFF = pas de champ code, pas de page /cadeaux

### P-10 — Request / sur-mesure 💰 _(L-090→L-095 · ~18.5 h · dépend de : P-02, P-03)_

**DoD (= US-240)** :

- [ ] Formulaire `/sur-mesure` (+ bloc prérempli fiche domaine) → accusé immédiat avec délai 48 h (email #8)
- [ ] Inbox encaveur avec badge ; composer une offre (texte, prix, échéance) en ≤ 5 min → email #9 avec lien de paiement
- [ ] Paiement de l'offre → réservation confirmée + billets émis (fee + commission du palier corrects)
- [ ] Offre non payée : relance **unique** J-1 (email #10) puis clôture auto (cron testé) ; demande sans réponse > 24 h = alerte dashboard, > 48 h = notification Sam
- [ ] Fusible documenté : si dérive, dégradation « formulaire → email » sans toucher au schéma

### P-11 — Événements collectifs _(L-100→L-102 · ~10 h · dépend de : P-02, P-05)_

**DoD (= US-250 light)** :

- [x] Créer un événement avec caves participantes (logo + descriptif) + UN organisateur payé ; publier → fiche publique avec bandeau + grille + programme
- [x] Billetterie centrale opérationnelle ; **2 scanners différents sur le même événement sans collision** (test `tests/db/collective-scan-concurrency.test.ts`, CI Postgres)
- [x] Chaque participant voit billets/scans en lecture ; pas de split automatique (organisateur encaisse)

### P-12 — Pages publiques & légal _(L-112→L-117 · ~16 h dont 7 Should · dépend de : P-03)_

**DoD** :

- [x] Politique d'annulation + no-show lisibles sur CHAQUE fiche et au checkout avant paiement
- [x] Home complète : sections bon cadeau + sur-mesure + comment ça marche ; ISR active
- [x] `/contact` (formulaire), `/mentions-legales`, `/maintenance` en ligne, 3 locales
- [x] Fiche domaine : horaires + bloc sur-mesure prérempli ; empty state « Vous êtes encaveur ? »
- [x] Sitemap public [L] : plus aucune page ❌ au mapping GAP §6

### P-13 — Espace encaveur V3 _(L-130, L-133, L-134, L-140→L-144 · ~21 h dont 7.5 Should · dépend de : P-05)_

**DoD** :

- [ ] `/dashboard` (encaveur) atterrit sur « Aujourd'hui » : résas du jour, couverts 7 j, CA du mois, **remplissage 30 j réel** (occurrences), prochains créneaux avec jauges, alertes actionnables, bouton scan
- [ ] Scan : mode avion → liste du jour préchargée, scan possible, sync au retour réseau, compteur scannés/attendus (test réseau coupé)
- [ ] « Prochain virement » = donnée Stripe réelle ; relevé PDF **mensuel** (brut, commission, fees, no-show, net)
- [ ] Emails #17 (récap hebdo + lien relevé) et #18 (action requise Stripe sur webhook KYC) envoyés (tests)

### P-14 — Auth V3 _(L-150→L-155 · ~9 h · dépend de : rien)_

**DoD** :

- [ ] « Recevoir un code » : OTP 6 chiffres, 15 min, e2e login complet ; « mot de passe oublié » → OTP (plus de mailto)
- [ ] Changement de mot de passe et d'email self-service (client + encaveur)
- [ ] Compte ADMIN sans TOTP → setup forcé au login ; admin avec TOTP e2e
- [ ] Session encaveur ~90 j (re-login uniquement au changement d'appareil) ; rate limits auth/registration actifs
- [ ] Invitation fondateur `/invitation/[token]` : compte + domaine VERIFIED sans file d'attente (Should)

### P-15 — Admin V3 & emails restants _(L-160→L-164 · ~8 h · dépend de : rien)_

**DoD** :

- [ ] `/admin` : GMV/résas du jour + santé webhooks (lag) + derniers échecs de jobs, en un écran
- [ ] Liste complète des domaines (tous statuts) avec historique de validation visible
- [ ] `/admin/utilisateurs` : recherche, anonymisation nLPD, changement de rôle — tous journalisés (AdminAction) et visibles
- [ ] Email #22 à l'admin sur chaque inscription encaveur ; email #1 avec PDF + .ics joints ; #5 avec 3 alternatives ; rappel J-1 à 18 h la veille

### P-16 — Hardening & launch _(L-180→L-189, L-208, L-210, L-211, L-213, L-214 · ~29.5 h · dépend de : TOUS)_

**DoD (= gates G-R2 + G-Launch)** :

- [ ] k6 : zéro survente Slot + zéro double-rédemption gift, exécution en CI hebdo
- [ ] **Rédemption bon cadeau — vérif money-routing bout-en-bout en Stripe-test/staging** (codé en P-09 mais NON vérifiable hors Stripe/DB) : (a) couverture partielle → charge plateforme réduite + `transfer` cave `P` net commission ; (b) **couverture totale `card=0`** → confirmation server-side + transfert inline ; (c) **abandon** → REFUND du bon restauré (webhook expiry + cron holds) ; (d) idempotence transfert (rejeu webhook, `giftTransferId`) + cron `reconcile-gift-transfers` ; (e) **payout dashboard P-13** affiche bien le transfert bon (corrélation `transfer.metadata.bookingId`) ; (f) buffer trésorerie plateforme OK. Cf. design Luca + escalades dans `docs/plans/P-09-bons-cadeaux.md`. **Bloquant launch.**
- [ ] 6 parcours e2e en CI sur chaque PR (booking invité, cadeau A→Z, request A→Z, annulation+refund, scan, onboarding cave)
- [ ] **Lighthouse CI ≥ 95** sur home/catalogue/fiche + budgets bloquants ; axe : 0 violation bloquante sur booking + cadeaux
- [ ] Alerting : incident simulé (webhook en échec, cron mort) → alerte reçue < 5 min ; `/api/health` probe DB/Redis/Stripe
- [ ] Checklist nLPD signée ; **CGV couvrant cadeaux/no-show/request/politiques/fee** publiées
- [ ] Runbooks testés à froid (incident paiement, litige no-show, kill-switch flag, restauration DB) ; astreinte définie
- [ ] `/security-review` final passé sur l'état de bascule (Coming Soon retiré, Stripe live, flags) — 0 blocker
- [ ] Bascule prête : gate Coming Soon retiré derrière un flag, Stripe live vérifié (TWINT, webhooks, Connect), redirections/sitemap OK

## 5. Tableau de suivi (à tenir à jour à CHAQUE merge)

> Statuts : ⬜ à faire · 🟨 en cours · ✅ mergé sur `dev` · ⏸ suspendu (raison en note)

| #      | Package                        | 💰  | Dépend de  | Est.   | Cible cal. | Statut | Branche / PR                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------ | ------------------------------ | --- | ---------- | ------ | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P-01   | Fiabilisation & quick wins     |     | —          | 21 h   | S1-S2      | ✅     | PR [#90](https://github.com/Samoulou/encave-app/pull/90)                                                                                                                                                                                                                                                                                                                                                                                                    |
| P-02   | Fondations schéma V3           |     | —          | 19 h   | S2-S3      | ✅     | PR [#92](https://github.com/Samoulou/encave-app/pull/92) + durcissements #94-#97                                                                                                                                                                                                                                                                                                                                                                            |
| P-03   | Monétisation Phase 1           | 💰  | P-02       | 14 h   | S4         | ✅     | PR [#98](https://github.com/Samoulou/encave-app/pull/98) — flags OFF, review + sécu passées                                                                                                                                                                                                                                                                                                                                                                 |
| P-04   | Checkout V3                    | 💰  | P-03       | 15.5 h | S5         | ✅     | PR [#99](https://github.com/Samoulou/encave-app/pull/99) — DoD G-R2 atteint, review max + sécu passées                                                                                                                                                                                                                                                                                                                                                      |
| P-05   | Créneaux & recherche par date  |     | P-02       | 11 h   | S6         | ✅     | PR [#101](https://github.com/Samoulou/encave-app/pull/101) — ADR-0002, review high 10/10 corrigés                                                                                                                                                                                                                                                                                                                                                           |
| P-06   | Performance structurelle       |     | —          | 11 h   | S6-S8      | ✅     | PR [#104](https://github.com/Samoulou/encave-app/pull/104) — plan : [P-06-performance.md](./archive/plans/P-06-performance.md) ; gate Lighthouse simulé partiel (observé tout vert), re-vérif staging + LHCI en P-16 ; ⚠️ ops : `connection_limit=5&pool_timeout=60` sur DATABASE_URL Vercel                                                                                                                                                                |
| P-07   | Boucle vin (fiche dégustation) |     | P-02       | 13 h   | S7-S8      | ✅     | PR [#102](https://github.com/Samoulou/encave-app/pull/102) — review high 22/22, moteur ScheduledJob                                                                                                                                                                                                                                                                                                                                                         |
| P-06.5 | Nettoyage « ultra clean »      |     | —          | ~8 h   | S8         | ✅     | PR [#105](https://github.com/Samoulou/encave-app/pull/105) — plan : [P-06.5-cleanup.md](./plans/P-06.5-cleanup.md) ; −21k lignes (dead code + docs archivées), [ARCHITECTURE.md](./ARCHITECTURE.md), CI dev verte (981 tests) ; review high 0 réf manquée                                                                                                                                                                                                   |
| P-08   | Anti no-show                   | 💰  | P-02, P-04 | 14 h   | S9         | ✅     | PR [#110](https://github.com/Samoulou/encave-app/pull/110) — empreinte carte SetupIntent + prélèvement off-session ; plan : [P-08-anti-no-show.md](./plans/P-08-anti-no-show.md)                                                                                                                                                                                                                                                                            |
| P-09   | Bons cadeaux                   | 💰  | P-02, P-04 | 24 h   | S10-S11    | ✅     | PR [#107](https://github.com/Samoulou/encave-app/pull/107) (+ fixes [#108](https://github.com/Samoulou/encave-app/pull/108), [#109](https://github.com/Samoulou/encave-app/pull/109)) — achat/envoi/PDF + rédemption/checkout/admin/compte                                                                                                                                                                                                                  |
| P-10   | Request / sur-mesure           | 💰  | P-02, P-03 | 18.5 h | S12-S13    | ✅     | PR [#111](https://github.com/Samoulou/encave-app/pull/111) — formulaire /sur-mesure → offre → paiement → billets ; plan : [P-10-request-sur-mesure.md](./plans/P-10-request-sur-mesure.md)                                                                                                                                                                                                                                                                  |
| P-11   | Événements collectifs          |     | P-02, P-05 | 10 h   | S13-S14    | ✅     | PR [#113](https://github.com/Samoulou/encave-app/pull/113) — plan : [P-11-evenements-collectifs.md](./plans/P-11-evenements-collectifs.md) ; gate éligibilité partagé (`collective-events.ts`), scan CAS existant, review high 10/10 corrigés                                                                                                                                                                                                               |
| P-12   | Pages publiques & légal        |     | P-03       | 16 h   | S14        | ✅     | PR [#112](https://github.com/Samoulou/encave-app/pull/112) — L-112→L-117 + L-220/L-221 ; plan : [P-12-pages-publiques-legal.md](./plans/P-12-pages-publiques-legal.md)                                                                                                                                                                                                                                                                                      |
| P-13   | Espace encaveur V3             |     | P-05       | 21 h   | S15        | ✅     | PR [#103](https://github.com/Samoulou/encave-app/pull/103) — review high 47 candidats corrigés, plan : [P-13-espace-encaveur.md](./archive/plans/P-13-espace-encaveur.md)                                                                                                                                                                                                                                                                                   |
| P-14   | Auth V3                        |     | —          | 9 h    | S15        | ✅     | PR [#115](https://github.com/Samoulou/encave-app/pull/115) — OTP login/reset + TOTP admin + sessions/rôle + rate limit DB + invitation fondateur ; plan : [P-14-auth-v3.md](./plans/P-14-auth-v3.md). ⚠️ 3 gaps sécu (G-1 bypass MFA social/OTP, G-2 changeEmail, G-3 cap session) à fermer AVANT `dev`→`main` — voir §6bis                                                                                                                                 |
| P-15   | Admin V3 & emails              |     | —          | 8 h    | S15        | ✅     | PR [#117](https://github.com/Samoulou/encave-app/pull/117) — /admin santé webhooks + /admin/utilisateurs (rôle + anonymisation nLPD) + emails #1 PDF/.ics, #2 J-1 18h, #5 alternatives, #22 ; plan : [P-15-admin-emails.md](./plans/P-15-admin-emails.md)                                                                                                                                                                                                   |
| P-16   | Hardening & launch             |     | tous       | 29.5 h | S16-S17    | ✅     | Code mergé 16.07 : PRs [#118](https://github.com/Samoulou/encave-app/pull/118) [#119](https://github.com/Samoulou/encave-app/pull/119) [#120](https://github.com/Samoulou/encave-app/pull/120) [#121](https://github.com/Samoulou/encave-app/pull/121) ; plan : [P-16-hardening-launch.md](./plans/P-16-hardening-launch.md) ; restent les gates non-code pré-bascule (staging A.2, LHCI ≥ 95, G-1 staging, incident simulé, `/security-review`, actes Sam) |

> Le total (~236 h Must+Should) dépasse la capacité nominale (~210 h) : les Should (≈ 27 h, marqués dans le backlog) et les fusibles §4 du backlog sont la variable d'ajustement — à recaler sur la vélocité réelle après P-01/P-02.

Jalons macro (dates du planning V3) :

- **G-R0'** 02.08 = fin P-02 (invariants + isolation testés ; observabilité = acquis, cf. note P-02).
- **G-R1** 13.09 = fin P-07 (caves pilotes publient seules ; fiche dégustation utilisée 1× en réel).
- **G-R2 code** 01.11 = fin P-15 : **toutes les features launch sont mergées sur `dev`**, et les tests de concurrence critiques sont verts depuis leurs packages (survente → P-04, double-rédemption → P-09). La validation instrumentée complète (k6 en CI, Lighthouse CI ≥ 95, axe, checklist nLPD) se fait en P-16 = semaine D1 (02–08.11) ; si P-16 révèle un échec de gate, le fusible planning s'applique : **launch 23.11**.
- **G-Supply** 02.11 (hors code) · **🚀 LAUNCH 16.11** = fin P-16.

P-06, P-14, P-15 sont sans dépendance : ce sont les **bouche-trous** — si le package courant passe ⏸ (attente décision, attente Stripe/TWINT), on avance l'un d'eux au lieu d'attendre (cf. règle 5).

## 6. Template de plan (②)

Chaque plan est un fichier `docs/plans/P-XX-<slug>.md` créé depuis [`docs/plans/TEMPLATE.md`](./plans/TEMPLATE.md). Un plan tient sur une page : s'il déborde, le package est trop gros — le couper.
