# Audit pré-launch — qualité, sécurité, performance, capacité à partir en prod

> **Date** : 12.11.2026 · **Base auditée** : `main` @ `dab4701` · **Branche** : `claude/audit-qualite-performance-dk8p8z` (14 commits, poussée)
> **Périmètre** : revue complète du code (89 server actions, 23 handlers API, requêtes, crons, emails), scan Lighthouse des 16 pages publiques (mobile + desktop), audit de mise en production, puis correction de tout ce qui pouvait l'être dans le code.
> **Méthode** : build de production local sur Postgres 16 seedé, serveur `next start`, Lighthouse 12.6 ; les constats bloquants ont été reproduits à chaud avant correction.

## 1. Verdict

**`main` n'était pas prêt. La branche l'est côté code, sous réserve de la validation Stripe en mode test (§4) et des actes « propriétaire » (§5).** Si l'un des deux glisse, le fusible du 23.11 prévu au planning s'applique.

Ce que `main` contenait, reproduit avant correction :

| Constat sur `main`                                                          | État                    |
| --------------------------------------------------------------------------- | ----------------------- |
| N'importe qui pouvait s'inscrire en `ADMIN` (un POST avec `"role":"ADMIN"`) | Corrigé                 |
| Les crons s'exécutaient avec un simple en-tête `x-vercel-cron: 1`           | Corrigé                 |
| Les emails affichaient l'heure de la séance en UTC (14:00 → 13:00 en hiver) | Corrigé                 |
| Les frais de no-show ne pouvaient jamais être prélevés                      | Corrigé                 |
| La fiche expérience n'avait aucun contenu dans son HTML serveur             | Corrigé                 |
| `/contact` affichait des clés brutes dans les 3 langues                     | Corrigé                 |
| Le scanner de billets ne pouvait pas ouvrir la caméra                       | Corrigé                 |
| PostHog bloqué par la CSP                                                   | Corrigé                 |
| `/api/auth/get-session` en 429 après ~10 pages vues par minute              | Corrigé                 |
| Mentions légales avec `[À COMPLÉTER]`, « EnCave SA » et adresse fictives    | **Ouvert — action Sam** |

**Validation de la branche** (état final) : lint, prettier, `i18n:check`, `tsc` verts · 1767 tests unitaires/intégration · 183 tests sur Postgres réel · 43 E2E Playwright · build de production · `npm ci` propre sur le lockfile · schéma Prisma et migrations strictement alignés (`migrate diff` vide).

**Non validé** : rien n'a été exercé contre Stripe en mode test, ni contre un vrai fournisseur Google, ni sur un déploiement Vercel (le projet Vercel d'EnCave n'est pas visible depuis cette session).

## 2. Contenu de la branche

### Premier passage — audit et bloquants

| Commit                               | Contenu                                                                                                                                                                                                  |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `9787606` fix(security)              | Rôle non modifiable par le client · garde admin sur chaque page · cron par `CRON_SECRET` · échappement JSON-LD · propriété des images Blob · `E2E_TEST` refusé en production · injection de formules CSV |
| `2ef2d61` fix(payments)              | Prélèvement no-show · session payée orpheline remboursée · places des billets scannés non revendues · événements Stripe jamais perdus · limite par IP au checkout                                        |
| `6df5884` fix                        | Heure des emails en Europe/Zurich · `/contact` · caméra · CSP PostHog · slugs uniques                                                                                                                    |
| `172da81` perf(sentry)               | SDK Sentry hors du bundle initial (165 → 92 kB de JS partagé) · Session Replay avec consentement                                                                                                         |
| `196d782` · `a74d6ff` perf(seo,a11y) | Rendu serveur des fiches et listings · images LCP · polices · titres, canonical, image sociale · accessibilité                                                                                           |
| `9a3d5c2` chore(deps)                | Sentry 10.78, next-intl 4.15, zod 4.6.7                                                                                                                                                                  |

### Second passage — tout le reste

| Commit                    | Contenu                                                                                                                                                                                                                                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `35bfa25` fix(security)   | **better-auth 1.4.17 → 1.7.21** (3 failles de détournement de compte) · liaison Google refusée sur compte non vérifié · reset de mot de passe qui révoque les sessions · utilisateur suspendu sans session possible · tokens sur-mesure hachés en base · export et anonymisation nLPD complets · images d'expérience limitées à son propre espace |
| `1571e9e` fix(payments)   | Litiges et remboursements Stripe synchronisés · course à l'expiration · montant payé recoupé avec la réservation · relevés et revenus sur une règle unique · bons cadeaux indépendants du flag · reliquat < 0.50 CHF · balayage d'expiration paginé · annulation de session bornée et reprenable                                                  |
| `3317667` fix(emails,ops) | Français accentué dans tous les emails · désinscription tokenisée et `List-Unsubscribe` · rappel 2 h réellement déclenchable · **mode maintenance** · mention TVA unique · purge de rétention · docs et runbooks à jour                                                                                                                           |
| `1936f7b` perf(data)      | Pagination serveur des réservations · tags de cache par expérience / cave · 9 index · messages d'erreur traduits par code (34 sites) · chaînes en dur traduites · tests des 13 actions qui n'en avaient pas                                                                                                                                       |
| `4fcf1b2` perf            | `/cadeaux` statique · calendrier chargé à l'ouverture · hydratation progressive de la home                                                                                                                                                                                                                                                        |

Découvert **en intégrant** les lots, grâce aux E2E : better-auth 1.7 refuse une connexion par mot de passe si le compte n'est pas indexé sur l'identifiant utilisateur, or les scripts de seed l'indexaient sur l'email. Sans la migration de données ajoutée (`20261112130200_sec_credential_account_id`), tout compte créé par seed — l'admin de production s'il vient de là — aurait été bloqué après la montée de version.

## 3. Lighthouse

**Accessibilité 100, bonnes pratiques 100, SEO 100** sur les 13 pages indexables, mobile et desktop. Les trois pages à SEO 66/69 (`/coming-soon`, `/login`, `/register`) sont en `noindex` volontaire.

**Performance** : desktop 97–100 (médiane 99). Mobile simulé 79–97 (médiane 87, contre 78). **Le 100 mobile n'est pas atteint.**

| Page (mobile)                | Perf        | A11y         | Bonnes pratiques | SEO          | LCP simulé    | TBT             |
| ---------------------------- | ----------- | ------------ | ---------------- | ------------ | ------------- | --------------- |
| `/coming-soon`               | 78 → **87** | 100          | 100              | 66           | 5.3 s → 3.9 s | 140 ms → 30 ms  |
| `/fr`                        | 71 → **81** | 100          | 96 → **100**     | 100          | 8.5 s → 4.9 s | 230 ms → 60 ms  |
| `/fr/about`                  | 84 → **90** | 98 → **100** | 96 → **100**     | 100          | 4.2 s → 3.6 s | 150 ms → 20 ms  |
| `/fr/cadeaux`                | 80 → **82** | 98 → **100** | 96 → **100**     | 92 → **100** | 4.7 s → 4.3 s | 190 ms → 210 ms |
| `/fr/cepages-valaisans`      | 81 → **91** | 98 → **100** | 96 → **100**     | 100          | 5.0 s → 3.5 s | 90 ms → 90 ms   |
| `/fr/contact`                | 86 → **88** | 98 → **100** | 96 → **100**     | 100          | 3.8 s → 3.8 s | 190 ms → 110 ms |
| `/fr/degustation-vin-valais` | 79 → **95** | 98 → **100** | 96 → **100**     | 100          | 5.1 s → 2.9 s | 180 ms → 30 ms  |
| `/fr/experiences`            | 71 → **79** | 91 → **100** | 96 → **100**     | 100          | 5.6 s → 4.7 s | 350 ms → 230 ms |
| `/fr/experiences/[slug]`     | 70 → **82** | 94 → **100** | 96 → **100**     | 100          | 6.5 s → 4.7 s | 330 ms → 70 ms  |
| `/fr/legal/terms`            | 82 → **97** | 98 → **100** | 100              | 100          | 4.2 s → 2.6 s | 230 ms → 90 ms  |
| `/fr/login`                  | 75 → **84** | 94 → **100** | 96 → **100**     | 69           | 5.7 s → 4.4 s | 230 ms → 120 ms |
| `/fr/mentions-legales`       | 77 → **91** | 98 → **100** | 100              | 100          | 5.5 s → 3.5 s | 190 ms → 30 ms  |
| `/fr/register`               | 76 → **83** | 98 → **100** | 100              | 69           | 5.7 s → 4.7 s | 180 ms → 70 ms  |
| `/fr/sur-mesure`             | 79 → **95** | 97 → **100** | 96 → **100**     | 66 → **100** | 5.0 s → 2.6 s | 190 ms → 150 ms |
| `/fr/wineries`               | 76 → **85** | 93 → **100** | 100              | 100          | 5.3 s → 3.9 s | 240 ms → 180 ms |
| `/fr/wineries/[slug]`        | 70 → **79** | 98 → **100** | 96 → **100**     | 100          | 6.5 s → 5.2 s | 320 ms → 160 ms |

| Page (desktop)               | Perf         | A11y         | Bonnes pratiques | SEO          |
| ---------------------------- | ------------ | ------------ | ---------------- | ------------ |
| `/coming-soon`               | 97 → **99**  | 100          | 100              | 66           |
| `/fr`                        | 96 → **98**  | 96 → **100** | 96 → **100**     | 100          |
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

Limites : un seul run par page (±5 points de bruit sur la perf mobile), serveur local sans CDN, 3 caves et 4 expériences en base. Le gate officiel reste **LHCI ≥ 95 sur staging** ; il est à repasser sur cette branche.

### Ce qui expliquait les mauvais scores

1. **La fiche expérience basculait entièrement en rendu client** : `BookingWidget` lit l'URL (nuqs) sans frontière `Suspense`, ce qui sur une page ISR abandonne le rendu serveur jusqu'au `loading.tsx` de la route. Même mécanisme sur le catalogue et les domaines : aucune carte ni lien dans le HTML.
2. **Les images prioritaires étaient invisibles jusqu'à l'hydratation** (`opacity-0` levé par un `onLoad` React).
3. **Le SDK Sentry (107 kB gzip) était dans le bundle de toutes les pages**, et le Session Replay téléchargé pour tous.
4. 10 polices préchargées, préconnexions Stripe inutiles, 7 préchargements du même payload catalogue, calendrier chargé d'emblée.

Le plan P-06 attribuait l'écart à un « artefact Lantern » ; les points 1 à 3 étaient des dépendances réelles au JavaScript.

### Pourquoi pas 100 en mobile

Les temps observés sont bons (LCP réel 200–450 ms en local, 2,3–3,1 s sous throttling appliqué). Le score simulé pénalise le volume de JavaScript (~330 kB) et le CSS bloquant (21 kB). Les deux leviers restants sont structurels et **volontairement non faits à quatre jours du launch** :

| Levier                                                                    | Pourquoi pas maintenant                                             |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Home : un seul arbre responsive au lieu de mobile + desktop (HTML 210 kB) | Refonte visuelle de la page d'accueil sans maquette de référence    |
| Next 15 (retire les polyfills hérités, permet d'inliner le CSS critique)  | Migration majeure : sémantique de cache et APIs de requête changent |

## 4. À valider avant la bascule

### 4.1 Stripe en mode test (bloquant)

Événements à **ajouter sur l'endpoint webhook plateforme** : `charge.dispute.created`, `charge.dispute.closed`, `charge.refunded`.

| Scénario                                                          | Attendu                                                                      |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Réservation simple, réservation bon + carte, paiement sur-mesure  | Confirmées, aucune alerte `amount-mismatch`                                  |
| Payer → retour → payer à nouveau                                  | La réservation survit à l'expiration de l'ancienne session                   |
| Offre sur-mesure ouverte sur deux onglets                         | Un seul paiement possible ; un paiement sur l'ancienne session est remboursé |
| Remboursement partiel depuis le Dashboard, puis annulation client | Seul le reliquat est remboursé                                               |
| Carte de test « litige » sur un bon cadeau                        | Le bon passe en désactivé                                                    |
| Bon laissant moins de 0.50 CHF à payer                            | 0.50 CHF débité, reliquat conservé sur le bon                                |
| Annulation d'une session à plusieurs réservations                 | Tous remboursés ; un échec forcé est repris au second passage                |
| Frais de no-show                                                  | Prélevés une seule fois                                                      |

### 4.2 Authentification (staging)

- **Appliquer les migrations avant de déployer le code** : better-auth 1.7 contrôle le schéma et refuse toute requête d'auth si une colonne manque.
- Connexion Google : compte vérifié, nouveau compte, et compte mot de passe non vérifié (désormais refusé, message traduit sur `/login`).
- Connexion par code, simple et pour un admin avec TOTP ; admin déjà enrôlé ; nouvel enrôlement. Dix codes faux verrouillent le compte 15 minutes.
- Les sessions existantes doivent survivre au déploiement (non vérifiable ici).

### 4.3 Changements de comportement à connaître

- **Invitation fondateur** : deux étapes pour un nouveau compte (inscription, clic sur le lien de vérification, puis validation).
- **Liste des réservations** : 10 par page, découpées côté serveur.
- **Messages d'erreur** : génériques par code et traduits ; le détail serveur n'est plus affiché, sauf « a des réservations » et « créneaux qui se chevauchent » qui ont leur propre message.
- **Créneaux du jour déjà commencés** : masqués et refusés.
- **Relevés et revenus** : les chiffres changent pour les caves avec paiement sur place, annulations tardives ou remboursements partiels. Les lignes « sur place » ne sont pas encore listées dans le tableau des transactions.
- **Emails** : le rappel 2 h part désormais réellement ; toutes les réponses arrivent sur `support@encave.ch` (variable `EMAIL_REPLY_TO`).
- **Crons** : 33 entrées dans `vercel.json`.
- **Mode maintenance** : `MAINTENANCE_MODE=true` + redéploiement ; webhooks, crons et health restent ouverts. Le 503 de la page n'a été vérifié qu'en test unitaire.
- **Seed via le workflow GitHub** : bloqué tant que la variable de dépôt `SEED_ALLOWED_DB_HOSTS` ne liste pas les hôtes staging/preview.
- **Rétention** : logs d'emails 180 jours (365 pour les échecs), sessions et codes expirés, jobs terminés 90 jours.

## 5. Bloquants hors code — actions Sam

1. **Identité légale** : mentions légales (3 langues), « EnCave SA » et l'adresse fictive dans CGV, confidentialité, annulation.
2. **Campagne UAT** : `UAT-EXIT-REPORT.md` est un gabarit vide ; la vérification money-routing A.2 n'est pas faite.
3. **Variables d'environnement de production** :

   | Variable                                                          | Si oubliée                                                                    |
   | ----------------------------------------------------------------- | ----------------------------------------------------------------------------- |
   | `CRON_SECRET`                                                     | **Les 33 crons répondent 401**                                                |
   | `UPSTASH_REDIS_REST_*`                                            | Limite de débit en mémoire par instance, donc inopérante                      |
   | `RESEND_API_KEY`                                                  | Aucun email, connexion par code comprise                                      |
   | `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET`          | Webhooks en 500                                                               |
   | `BETTER_AUTH_URL`, `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_SITE_URL` | Liens d'emails, QR, canonical et sitemap sur une URL Vercel                   |
   | `PLATFORM_COMMISSION_RATE`                                        | 12 % au lieu des 10 % de lancement                                            |
   | `NEXT_PUBLIC_SENTRY_DSN`                                          | Ni Sentry ni moniteurs de cron                                                |
   | `E2E_TEST`                                                        | Doit être **absente** (le démarrage échoue si elle vaut `true` en production) |
   | `DIRECT_URL` (scope Preview)                                      | Ne doit pas pointer sur la production : tout build lance `migrate deploy`     |

4. **Vercel** : plan compatible avec 33 crons et `maxDuration = 300` ; région alignée sur Neon ; protection du domaine `*.vercel.app` de production.
5. **Données de production** : flags (tous OFF par défaut, la matrice de lancement en veut six ON), admin avec TOTP, caves vérifiées avec Stripe Connect actif.
6. **Alerting** : `astreinte.md` contient encore `[À DÉCIDER]` ; moniteur externe sur `/api/health?deep=1` ; règles d'alerte Sentry (`area:stripe-webhook`, `area:email`, `incident:*`).
7. **Email** : boîte `support@encave.ch` lue ; SPF, DKIM, DMARC pour Resend.
8. **Neon** : rétention PITR confirmée, restauration testée une fois.
9. **Image sociale** : `public/og-image.jpg` est provisoire.

## 6. Reste ouvert dans le code

| Sujet                                                                                          | Pourquoi ce n'est pas fait                                                                  |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Next.js 14 → 15** (avis DoS / empoisonnement de cache corrigés seulement en 15.5.x)          | Migration majeure ; vérifier les mitigations plateforme Vercel et planifier après le launch |
| **maplibre-gl v6** (contournement du sanitizer)                                                | Version majeure ; les popups échappent déjà leur HTML                                       |
| **CSP à nonce** (`'unsafe-inline'` et `'unsafe-eval'` encore présents)                         | Demande une refonte du chargement des scripts                                               |
| Suspension effective sous 5 minutes seulement                                                  | Fermer la fenêtre coûterait une lecture en base par appel                                   |
| Tokens de désinscription en clair en base                                                      | Faible valeur ; non traité                                                                  |
| Index redondants sur `Booking` et `Experience`                                                 | Suppression = migration destructive sur la table la plus chaude                             |
| 27 messages d'erreur bruts dans admin, auth et revenus ; libellés des squelettes de chargement | Hors périmètre des lots, sans impact client                                                 |
| Lignes « paiement sur place » absentes du tableau des transactions                             | Demande un nouveau statut d'affichage                                                       |
| Home en double arbre, composant catalogue de 932 lignes                                        | Voir §3                                                                                     |
| Champ `engines` Node dans `package.json`                                                       | La CI tourne en Node 20, la version Vercel n'est pas connue d'ici                           |

`npm audit --omit=dev` : 47 avis contre 65 au départ ; les critiques restants sont portés par Next, maplibre et vitest (dépendance de test).

## 7. Ordre conseillé d'ici le 16.11

1. Relire et merger la branche (PR vers `dev`) ; CI verte.
2. Staging : migrations, puis validations des §4.1 et §4.2, LHCI.
3. Identité légale ; variables de production ; événements webhook Stripe ; moniteur externe.
4. Redéployer la production avec le gate encore levé, pour prouver migrations et build.
5. Bascule `COMING_SOON=false`, puis : `/api/health?deep=1` en 200, un cron sans secret en 401, une réservation réelle TWINT et carte avec email reçu à la bonne heure, une annulation remboursée, un achat de bon.
