# Audit pré-launch — qualité, sécurité, performance, capacité à partir en prod

> **Date** : 12.11.2026 · **Base auditée** : `main` @ `dab4701` · **Branche de correctifs** : `claude/audit-qualite-performance-dk8p8z` (7 commits)
> **Périmètre** : revue complète du code (89 server actions, 23 handlers API, requêtes, crons, emails), scan Lighthouse des 16 pages publiques (mobile + desktop), audit de mise en production.
> **Méthode** : build de production local sur Postgres 16 seedé, serveur `next start`, Lighthouse 12.6 ; les constats bloquants ont été reproduits à chaud contre ce serveur avant correction.

## 1. Verdict

**NO-GO en l'état de `main`. GO atteignable pour le 16.11 si la branche est mergée et si les actes « propriétaire » du §5 sont faits** — sinon le fusible du 23.11 prévu au planning s'applique.

`main` contenait des défauts qui auraient été visibles ou exploitables dès le premier jour :

| Constat sur `main`                                                                                 | Vérifié comment                                   | État                    |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------- |
| N'importe qui pouvait s'inscrire en `ADMIN` (`POST /api/auth/sign-up/email` avec `"role":"ADMIN"`) | Reproduit : compte créé avec `role=ADMIN` en base | Corrigé                 |
| Les crons s'exécutaient avec un simple en-tête `x-vercel-cron: 1`                                  | Reproduit : 200 sans secret                       | Corrigé                 |
| Les emails affichaient l'heure de la séance en UTC (14:00 → 13:00 en hiver)                        | Lecture + test                                    | Corrigé                 |
| Les frais de no-show ne pouvaient jamais être prélevés (1er essai toujours refusé)                 | Lecture SQL + test sur Postgres réel              | Corrigé                 |
| La fiche expérience n'avait aucun contenu dans son HTML serveur (ni h1, ni description)            | Reproduit : 20 caractères de texte visible        | Corrigé                 |
| `/contact` affichait des clés brutes (`contact.form.email`…) dans les 3 langues                    | Reproduit                                         | Corrigé                 |
| Le scanner de billets ne pouvait pas ouvrir la caméra (`Permissions-Policy: camera=()`)            | Lecture de la config                              | Corrigé                 |
| PostHog bloqué par la CSP (aucune statistique ni web-vitals en prod)                               | Lecture de la config                              | Corrigé                 |
| `/api/auth/get-session` en 429 après ~10 pages vues par minute                                     | Reproduit pendant le crawl                        | Corrigé                 |
| Mentions légales avec `[À COMPLÉTER]`, « EnCave SA » et adresse fictives                           | Lecture                                           | **Ouvert — action Sam** |

Ce qui était déjà solide : isolation des données entre caves (aucun IDOR trouvé sur les 89 actions), tokens invités hashés, signatures des webhooks, ledger des bons cadeaux (verrou `FOR UPDATE`, contrainte de solde ≥ 0), calculs de prix côté serveur, holds en transaction Serializable.

## 2. Ce que contient la branche

| Commit                   | Contenu                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `9787606` fix(security)  | Rôle non modifiable par le client · garde admin sur chaque page + TOTP/suspension vérifiés dans les actions · cron par `CRON_SECRET` uniquement · échappement JSON-LD (XSS stocké) · propriété des images Blob · bons cadeaux / demandes réservés aux emails vérifiés · `E2E_TEST` refusé en production · injection de formules CSV                                                                                             |
| `2ef2d61` fix(payments)  | Prélèvement no-show · session Stripe payée « orpheline » remboursée au lieu d'être ignorée · places des billets scannés non revendues + créneau commencé non réservable · événements Stripe jamais perdus sur redélivrance concurrente · faux incidents « remboursement impossible » sur le paiement sur place · limite par IP au checkout · email de confirmation non bloqué par PostHog et jamais marqué envoyé s'il a échoué |
| `6df5884` fix            | Heure des emails en Europe/Zurich · `/contact` · caméra du scanner · CSP PostHog · slugs d'expérience uniques globalement                                                                                                                                                                                                                                                                                                       |
| `172da81` perf(sentry)   | SDK Sentry hors du bundle initial (165 → 91,5 kB de JS partagé) · Session Replay uniquement avec consentement                                                                                                                                                                                                                                                                                                                   |
| `196d782` perf(seo,a11y) | Rendu serveur des fiches et des listings · images LCP · polices · titres, canonical, image sociale · lien d'évitement, landmarks, libellés                                                                                                                                                                                                                                                                                      |
| `a74d6ff` perf(a11y)     | Image unique sur login/register · crédits de la carte accessibles                                                                                                                                                                                                                                                                                                                                                               |
| `9a3d5c2` chore(deps)    | Sentry 10.78, next-intl 4.15, zod 4.6.7 (correctifs de sécurité)                                                                                                                                                                                                                                                                                                                                                                |

**Validation de la branche** : lint, prettier, `i18n:check`, `tsc` verts · 1368 tests unitaires/intégration · 129 tests sur Postgres réel (invariants + concurrence) · 43 E2E Playwright (invité, cadeau, sur-mesure, annulation, scan, onboarding, a11y) · build de production.

**Non validé — à faire sur staging avant la bascule** : les chemins d'argent modifiés n'ont pas été exercés contre Stripe en mode test (voir §4.1).

## 3. Lighthouse

### 3.1 Résultat

Sur les 13 pages indexables : **accessibilité 100, bonnes pratiques 100, SEO 100**, mobile et desktop. Les trois pages à SEO 66/69 (`/coming-soon`, `/login`, `/register`) sont en `noindex` volontaire.

**Performance** : desktop 97–100 (médiane 99). Mobile simulé 77–93 (médiane 85, contre 78 avant). **Le 100 mobile n'est pas atteint.**

| Page (mobile)                | Perf        | A11y         | Bonnes pratiques | SEO          | LCP simulé    | TBT             |
| ---------------------------- | ----------- | ------------ | ---------------- | ------------ | ------------- | --------------- |
| `/coming-soon`               | 78 → **88** | 100          | 100              | 66           | 5.3 s → 3.8 s | 140 ms → 20 ms  |
| `/fr`                        | 71 → **82** | 100          | 96 → **100**     | 100          | 8.5 s → 4.6 s | 230 ms → 110 ms |
| `/fr/about`                  | 84 → **88** | 98 → **100** | 96 → **100**     | 100          | 4.2 s → 3.8 s | 150 ms → 100 ms |
| `/fr/cadeaux`                | 80 → **77** | 98 → **100** | 96 → **100**     | 92 → **100** | 4.7 s → 5.2 s | 190 ms → 230 ms |
| `/fr/cepages-valaisans`      | 81 → **91** | 98 → **100** | 96 → **100**     | 100          | 5.0 s → 3.4 s | 90 ms → 30 ms   |
| `/fr/contact`                | 86 → **91** | 98 → **100** | 96 → **100**     | 100          | 3.8 s → 3.4 s | 190 ms → 120 ms |
| `/fr/degustation-vin-valais` | 79 → **93** | 98 → **100** | 96 → **100**     | 100          | 5.1 s → 3.1 s | 180 ms → 130 ms |
| `/fr/experiences`            | 71 → **78** | 91 → **100** | 96 → **100**     | 100          | 5.6 s → 4.5 s | 350 ms → 280 ms |
| `/fr/experiences/[slug]`     | 70 → **84** | 94 → **100** | 96 → **100**     | 100          | 6.5 s → 4.4 s | 330 ms → 90 ms  |
| `/fr/legal/terms`            | 82 → **93** | 98 → **100** | 100              | 100          | 4.2 s → 3.1 s | 230 ms → 110 ms |
| `/fr/login`                  | 75 → **83** | 94 → **100** | 96 → **100**     | 69           | 5.7 s → 3.8 s | 230 ms → 290 ms |
| `/fr/mentions-legales`       | 77 → **87** | 98 → **100** | 100              | 100          | 5.5 s → 3.6 s | 190 ms → 170 ms |
| `/fr/register`               | 76 → **85** | 98 → **100** | 100              | 69           | 5.7 s → 3.8 s | 180 ms → 200 ms |
| `/fr/sur-mesure`             | 79          | 97 → **100** | 96 → **100**     | 66 → **100** | 5.0 s → 4.8 s | 190 ms → 180 ms |
| `/fr/wineries`               | 76 → **81** | 93 → **100** | 100              | 100          | 5.3 s → 4.6 s | 240 ms → 170 ms |
| `/fr/wineries/[slug]`        | 70 → **80** | 98 → **100** | 96 → **100**     | 100          | 6.5 s → 4.8 s | 320 ms → 190 ms |

| Page (desktop)               | Perf         | A11y         | Bonnes pratiques | SEO          |
| ---------------------------- | ------------ | ------------ | ---------------- | ------------ |
| `/coming-soon`               | 97 → **99**  | 100          | 100              | 66           |
| `/fr`                        | 96 → **97**  | 96 → **100** | 96 → **100**     | 100          |
| `/fr/about`                  | 98 → **99**  | 98 → **100** | 96 → **100**     | 100          |
| `/fr/cadeaux`                | 97 → **99**  | 98 → **100** | 100              | 92 → **100** |
| `/fr/cepages-valaisans`      | 98 → **100** | 98 → **100** | 96 → **100**     | 100          |
| `/fr/contact`                | 98 → **99**  | 98 → **100** | 96 → **100**     | 100          |
| `/fr/degustation-vin-valais` | 98 → **100** | 98 → **100** | 96 → **100**     | 100          |
| `/fr/experiences`            | 96 → **97**  | 89 → **100** | 96 → **100**     | 100          |
| `/fr/experiences/[slug]`     | 97 → **98**  | 98 → **100** | 96 → **100**     | 100          |
| `/fr/legal/terms`            | 99 → **100** | 98 → **100** | 96 → **100**     | 100          |
| `/fr/login`                  | 91 → **99**  | 94 → **100** | 96 → **100**     | 69           |
| `/fr/mentions-legales`       | 98 → **100** | 98 → **100** | 100              | 100          |
| `/fr/register`               | 85 → **99**  | 98 → **100** | 96 → **100**     | 69           |
| `/fr/sur-mesure`             | 99           | 97 → **100** | 100              | 66 → **100** |
| `/fr/wineries`               | 97 → **98**  | 93 → **100** | 100              | 100          |
| `/fr/wineries/[slug]`        | 97 → **98**  | 98 → **100** | 96 → **100**     | 100          |

Limites de la mesure : un seul run par page (±5 points de bruit sur la perf mobile), serveur local sans CDN, base seedée avec 3 caves et 4 expériences. Le « avant » a été mesuré sans DSN Sentry ; le « après » avec un DSN factice, donc dans la configuration de production. `/cadeaux` (80 → 77) est dans le bruit ; c'est aussi la seule page publique encore dynamique.

### 3.2 Ce qui expliquait les mauvais scores

1. **La fiche expérience basculait entièrement en rendu client.** `BookingWidget` lit l'URL (nuqs) sans frontière `Suspense` : sur une page ISR, Next abandonne alors le rendu serveur jusqu'à la frontière la plus proche, ici le `loading.tsx` de la route. Le HTML prérendu ne contenait que le squelette. Même mécanisme sur le catalogue et la liste des domaines : aucune carte ni aucun lien vers une fiche dans le HTML.
2. **Les images prioritaires étaient invisibles jusqu'à l'hydratation** (`opacity-0` levé par un `onLoad` React dans `ImageWithFallback`). Le LCP dépendait de l'exécution du JavaScript.
3. **Le SDK Sentry (107 kB gzip) était dans le bundle partagé par toutes les pages** : 0,6 à 1,2 s de CPU sur mobile simulé. Le Session Replay était en plus téléchargé pour 100 % des visiteurs.
4. 10 polices préchargées par page, deux préconnexions Stripe inutiles (Stripe.js n'est jamais chargé), 7 préchargements du même payload catalogue depuis la home (~200 kB).

Le plan P-06 attribuait l'écart à un « artefact Lantern ». Les points 1 à 3 étaient des dépendances réelles au JavaScript ; l'artefact n'explique que le reste.

### 3.3 Pourquoi pas 100 en performance mobile, et ce qui reste

Les métriques **observées** sont bonnes (LCP réel 200–450 ms en local). Le score mobile est une simulation (4G lente + CPU ÷4) qui pénalise le volume total de JavaScript : environ 410 kB transférés par page.

| Levier restant                                                                                  | Gain attendu                    | Effort |
| ----------------------------------------------------------------------------------------------- | ------------------------------- | ------ |
| Home : ne plus rendre les deux arbres mobile **et** desktop (HTML 210 kB, double hydratation)   | Élevé sur `/fr`                 | 1–2 j  |
| Catalogue : sortir filtres et carte du composant client de 932 lignes (`ExperiencesPageClient`) | Élevé sur `/experiences`        | 1–2 j  |
| `/cadeaux` : lire `searchParams` côté client pour redevenir statique                            | Moyen                           | 2 h    |
| CSS bloquant (21 kB) et polyfills hérités de Next 14 (11 kB)                                    | Faible, lié à la montée Next 15 | —      |

Le gate officiel reste **LHCI ≥ 95 sur staging** (CDN, médiane de 3 runs). Il est à repasser sur cette branche ; je ne peux pas le mesurer d'ici.

### 3.4 Autres défauts SEO corrigés au passage

- Aucune page n'avait d'`og:image` (`/og-image.jpg` et `/logo.png` en 404). `public/og-image.jpg` est une image provisoire générée depuis le hero : **à remplacer par un visuel de marque**.
- Titres en « … | EnCave | EnCave ».
- `/cadeaux` avait pour canonical la page d'accueil : Google l'aurait fusionnée avec elle, à cinq semaines de Noël.
- `/sur-mesure` était en `noindex` tout en figurant dans le sitemap. Je l'ai rendue indexable (**décision produit à confirmer**).
- About, articles et pages légales sans canonical ni hreflang.

## 4. Ce qui reste ouvert dans le code

### 4.1 À vérifier sur staging avant la bascule (changements de la branche)

| Changement                                                                                                 | À vérifier                                                                                                       |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Remboursement automatique d'une session payée qui n'est plus celle de la réservation                       | Le remboursement passe en Stripe test, y compris sur une réservation financée par bon (`refund_application_fee`) |
| 409 renvoyé à Stripe quand une redélivrance chevauche un traitement en cours                               | L'alerting webhook le tolère                                                                                     |
| Fenêtre de paiement d'une offre sur-mesure : 24 h → ~31 min ; un 2e clic « Payer » invalide la 1re session | Parcours offre sur deux onglets                                                                                  |
| Créneaux du jour déjà commencés masqués et refusés                                                         | Le sélecteur de date peut encore proposer « aujourd'hui » avec une liste vide                                    |
| Limite checkout par IP : 12 tentatives / 10 min                                                            | Acceptable pour un groupe sur un même Wi-Fi ?                                                                    |
| `maxDuration = 60` sur les webhooks Stripe                                                                 | Pas inférieur au réglage Vercel actuel                                                                           |
| Sentry différé                                                                                             | Avec le vrai DSN : une erreur volontaire arrive bien dans Sentry                                                 |
| Actions admin : TOTP et compte non suspendu désormais exigés                                               | L'admin de prod est bien enrôlé TOTP                                                                             |
| Upload : seule une image de son propre espace Blob est acceptée                                            | Changer la photo de couverture d'une cave                                                                        |

### 4.2 Sécurité

| Sév.    | Constat                                                                                                                                                                                                                                                                                                                                           | Action                                                                                                                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Haute   | **better-auth 1.4.17** : avis publiés corrigés seulement en 1.6.22 / 1.7.7 — détournement de compte par pré-inscription sur la connexion par code email (GHSA-qq9h-g4jm-xgf3), `state` OAuth utilisable comme lien magique (GHSA-965c-763c-88jm), liaison Google sur email non vérifié (GHSA-g38m-r43w-p2q7). L'app utilise les trois mécanismes. | Monter en 1.7.x. Le plugin `auth-hardening` s'appuie sur des internes de better-auth : prévoir une demi-journée à une journée avec re-validation G-1 (MFA). **À trancher avant le launch.** |
| Haute   | **Pré-détournement de compte** : pas de `requireEmailVerification`, Google est fournisseur de liaison « de confiance », un changement de mot de passe ne révoque pas les sessions. `provisionFounderWinery` ne vérifie pas `emailVerified`.                                                                                                       | À la première connexion OAuth/OTP sur un compte non vérifié, effacer mot de passe et sessions ; exiger l'email vérifié pour l'invitation fondateur                                          |
| Haute   | **Next.js 14.2.35 est la dernière version 14** ; les avis suivants ne sont corrigés qu'en 15.5.x (DoS Server Actions / Server Components, empoisonnement de cache RSC). Plusieurs avis « critiques » de la liste ne concernent que l'auto-hébergement.                                                                                            | Vérifier dans le tableau de bord Vercel les mitigations plateforme ; planifier Next 15 après le launch                                                                                      |
| Moyenne | La suspension n'est vérifiée que dans les layouts côté encaveur : une cave suspendue peut encore appeler les actions (`chargeNoShowFee`, annulation de session)                                                                                                                                                                                   | Garde encaveur partagée, comme `checkAdminAccess`                                                                                                                                           |
| Moyenne | `createExperience` / `updateExperience` acceptent des URL d'image non validées                                                                                                                                                                                                                                                                    | `isOwnedBlobUrl`                                                                                                                                                                            |
| Moyenne | CSP avec `'unsafe-inline' 'unsafe-eval'` : ne bloque pas un XSS ; limiteur de débit en mémoire si Upstash absent                                                                                                                                                                                                                                  | Upstash obligatoire en prod (§5) ; CSP à nonce après le launch                                                                                                                              |
| Moyenne | maplibre-gl 5.24 (GHSA-jrc7-96c5-q579, contournement du sanitizer) : corrigé en v6 seulement. Les popups de la carte échappent déjà leur HTML.                                                                                                                                                                                                    | Montée v6 après le launch                                                                                                                                                                   |
| Basse   | Tokens de paiement sur-mesure et de désinscription en clair en base · `?token=` capturé par PostHog et Sentry · actions de lecture publiques sans limite de débit · export et anonymisation nLPD sans GiftCard / Request / WineOrderRequest                                                                                                       | Backlog                                                                                                                                                                                     |

`npm audit --omit=dev` après montées : 49 avis contre 65, dont 6 critiques — tous portés par Next, better-auth, maplibre et vitest ; le reste est transitif et modéré.

### 4.3 Argent — décisions à prendre (non implémenté)

| Sév.    | Constat                                                                                                                                                                                                                               | Décision attendue                                                                 |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Haute   | **Aucune gestion des litiges** (`charge.dispute.*`, `charge.refunded`) : un bon acheté avec une carte volée reste actif après le chargeback ; un remboursement fait dans le Dashboard Stripe n'est pas reflété en base                | Au minimum : alerte + désactivation du bon                                        |
| Haute   | **Course** entre « réessayer après abandon de paiement » et le webhook d'expiration de l'ancienne session : la réservation peut être supprimée en plein réessai (à confirmer en Stripe test)                                          | Le handler d'expiration ignore une réservation dont `expiresAt` est dans le futur |
| Moyenne | **Relevé mensuel et revenus faux dans trois cas** : paiement sur place compté comme « net reversé », annulations où la cave garde de l'argent exclues, remboursements partiels admin ignorés                                          | Règle comptable à définir avant le premier relevé (début décembre)                |
| Moyenne | Couper le flag `GIFT_CARDS` arrête aussi la réconciliation des transferts et les envois programmés de bons déjà payés                                                                                                                 | Sortir ces deux jobs du flag                                                      |
| Moyenne | Les transferts « bon cadeau » partent du solde disponible de la plateforme (`balance_insufficient` possible au lancement)                                                                                                             | Buffer de trésorerie (déjà ouvert, protocole A.f)                                 |
| Basse   | `PLATFORM_COMMISSION_RATE` vaut 0,12 par défaut alors que le taux de lancement est 10 % · reliquat de bon de 1 à 49 centimes refusé par Stripe · validité 5 ans jamais appliquée · balayage d'expiration limité à 100 lignes par jour | —                                                                                 |

### 4.4 Emails et conformité

- Les anciens blocs de `src/emails/translations.ts` sont en français sans accents, **sujet de l'email de confirmation compris**.
- Aucun en-tête `List-Unsubscribe` ; les 3 emails d'agrégat n'ont pas de lien de désinscription tokenisé.
- L'email de remboursement manuel (admin) part toujours en français.
- Le rappel « 2 h avant » ne peut se déclencher que pour des séances entre ~18h30 et 21h30 (le cron ne tourne que deux fois par jour).
- PostHog côté serveur enregistre l'email du visiteur comme identifiant **sans tenir compte du consentement** (`checkout-confirmation.service.ts`), alors que la politique de confidentialité dit le contraire.
- Mentions TVA contradictoires : « Taxes et frais de service inclus » (page de confirmation), « TVA incluse » (offres), « non assujettie » (reçu).

### 4.5 Qualité et efficacité — par rapport bénéfice / effort

| #   | Constat                                                                                                                                                                                                                                 | Effort                   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 1   | Liste des réservations encaveur **sans pagination** : toutes les réservations (emails, téléphones) sont envoyées au navigateur, qui en affiche 5                                                                                        | 0,5 j                    |
| 2   | Résumé des revenus : toutes les réservations de tous les temps chargées pour être sommées en JS                                                                                                                                         | 0,5 j                    |
| 3   | Rappels J-1 : boucle séquentielle sous 60 s, sans rattrapage ; ~100 réservations ou un incident Resend tronquent l'envoi                                                                                                                | 2 h                      |
| 4   | Le moindre changement d'un créneau par une cave purge le cache de **toutes** les pages publiques (`revalidateTag('experiences')` global)                                                                                                | 0,5 j                    |
| 5   | Index manquants : `Experience(slug)`, images de galerie (clé étrangère), `Session(userId)`, `EmailLog(status, createdAt)` ; 5 index redondants sur `Booking`                                                                            | 2 h (migration additive) |
| 6   | Annulation d'une session : remboursements Stripe en série dans une seule action (25 réservations = risque de timeout à mi-parcours)                                                                                                     | 0,5 j                    |
| 7   | Emails « fire-and-forget » dans des actions (refus de réservation, création de cave) : perdus si la lambda gèle                                                                                                                         | 1 h                      |
| 8   | Pas de purge : `EmailLog`, `rate_limits`, `sessions`, `scheduled_jobs` terminés                                                                                                                                                         | 2 h                      |
| 9   | i18n : 411 messages d'erreur d'actions en anglais, affichés tels quels à 45 endroits ; chaînes françaises en dur dans le catalogue et le checkout (« Affiner », « Expériences disponibles », « Paiement sécurisé ») — visibles en DE/EN | 1–2 j                    |
| 10  | 16 fichiers de plus de 600 lignes (`email.service.ts` 1558, `checkout.ts` 1286) ; 14 actions sur 89 sans aucun test (`createExperience`, `createWinery`, `rejectBooking`, `searchExperiencesAction`…)                                   | Continu                  |

Points propres : aucun `as any`, aucun `@ts-ignore`, aucune assertion `!`, aucun `parse()` dans une action, aucun appel Stripe ou Resend à l'intérieur d'une transaction, aucun module mort.

Deux choix laissés volontairement en l'état : le TTL de 60 s du cache des flags (il réduit l'ISR à 60 s au lieu de 300, mais c'est lui qui garantit le kill-switch en moins d'une minute) et les slugs en doublon éventuellement déjà présents en base (résolus de façon déterministe : la plus ancienne garde l'URL).

### 4.6 Documentation à remettre à jour

`CLAUDE.md` : polices (Nunito / Averia / Mukta, pas Manrope / Fraunces), dette connue déjà corrigée (email de confirmation avec token, UI de remboursement admin, gate Coming Soon par variable d'env). `ARCHITECTURE.md` : `/cadeaux` et `/sur-mesure` existent, `/api/health` n'est plus inerte. `kill-switch-flags.md` renvoie à `/admin/compliance` au lieu de `/admin`. ADR-0002 §1 : le prédicat de capacité compte désormais COMPLETED et NO_SHOW.

## 5. Bloquants hors code — actions Sam

1. **Identité légale** : compléter les mentions légales (3 langues), remplacer « EnCave SA » et l'adresse fictive dans CGV, confidentialité et annulation. L'adresse diffère même entre le français et l'allemand.
2. **Campagne UAT** : `UAT-EXIT-REPORT.md` est un gabarit vide, non signé ; les 15 sessions et le registre de défauts sont vierges. La vérification money-routing A.2, marquée bloquante, n'est pas faite.
3. **Variables d'environnement de production** — seules `DATABASE_URL` et `BETTER_AUTH_SECRET` sont obligatoires ; tout le reste se dégrade en silence :

   | Variable                                                          | Si oubliée                                                                                     |
   | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
   | `CRON_SECRET`                                                     | **Depuis cette branche : les 18 crons répondent 401**                                          |
   | `UPSTASH_REDIS_REST_*`                                            | Limite de débit en mémoire par instance, donc inopérante                                       |
   | `RESEND_API_KEY`                                                  | Aucun email, connexion par code comprise                                                       |
   | `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET`          | Webhooks en 500                                                                                |
   | `BETTER_AUTH_URL`, `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_SITE_URL` | Liens d'emails, QR, canonical et sitemap sur une URL Vercel                                    |
   | `PLATFORM_COMMISSION_RATE`                                        | 12 % au lieu des 10 % de lancement                                                             |
   | `NEXT_PUBLIC_SENTRY_DSN`                                          | Ni Sentry ni moniteurs de cron                                                                 |
   | `E2E_TEST`                                                        | Doit être **absente** (la branche fait échouer le démarrage si elle vaut `true` en production) |
   | `DIRECT_URL` (scope Preview)                                      | Ne doit pas pointer sur la base de production : tout build lance `migrate deploy`              |

4. **Vercel** : plan compatible avec 18 crons et `maxDuration = 300` ; région alignée sur Neon ; protection du domaine `*.vercel.app` de production (le gate Coming Soon ne filtre que `encave.ch`).
5. **Données de production** : tous les flags sont OFF par défaut alors que la matrice de lancement en veut six ON ; compte admin avec TOTP ; caves vérifiées avec Stripe Connect actif ; expériences publiées.
6. **Alerting** : `astreinte.md` contient encore `[À DÉCIDER]` ; aucun moniteur externe sur `/api/health?deep=1` ; règles d'alerte Sentry à créer.
7. **Email** : boîtes `support@`, `privacy@`, `legal@`, `contact@` ; SPF, DKIM et DMARC pour Resend.
8. **Neon** : rétention PITR confirmée, restauration testée une fois.
9. **GitHub** : l'accès de Claude au dépôt est refusé (403) — la branche n'a pas pu être poussée depuis cette session.

## 6. Ordre conseillé d'ici le 16.11

1. Pousser et merger la branche ; CI verte.
2. Décider : montée better-auth 1.7.x avant le launch, ou risque accepté par écrit.
3. Renseigner l'identité légale ; corriger le français sans accents de l'email de confirmation.
4. Staging : vérifications du §4.1, money-routing A.2, LHCI.
5. Variables de production (§5.3), flags, Stripe live (deux endpoints sur le domaine apex, TWINT), moniteur externe.
6. Redéployer la production avec le gate encore levé, pour prouver migrations et build.
7. Bascule `COMING_SOON=false`, puis : `/api/health?deep=1` en 200, un cron sans secret en 401, une réservation réelle TWINT et carte avec email reçu à la bonne heure, une annulation remboursée, un achat de bon.
