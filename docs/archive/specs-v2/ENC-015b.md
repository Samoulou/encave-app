# ENC-015b — Renforcer middleware : check rôle ADMIN au niveau middleware (pas seulement layout)

## Objectif métier

Aujourd'hui, l'accès à `/admin/*` est gardé par le layout `src/app/admin/layout.tsx` qui vérifie `session.user.role === 'ADMIN'`. C'est tardif : Next.js a déjà résolu la route, instancié les Server Components, potentiellement déclenché des requêtes data (Server Components qui s'exécutent en parallèle). Un utilisateur non admin qui tape `/admin/wineries` consomme des ressources serveur avant le refus. Pire, si un Server Component fuit dans un boundary mal configuré, des données sensibles peuvent être renvoyées au client. On veut un check au **middleware**, qui bloque la requête avant tout rendu.

## Acteurs

- **ADMIN** : utilisateur autorisé, doit pouvoir accéder à `/admin/*` sans friction.
- **CLIENT / WINEMAKER** : utilisateurs authentifiés mais non admins, doivent être redirigés.
- **VISITEUR anonyme** : non authentifié, doit être redirigé vers `/sign-in`.

## Préconditions & déclencheurs

- Better Auth ^1.4.17 expose le rôle utilisateur dans la session (à vérifier : `session.user.role` doit être présent côté middleware via cookie session ou API edge-compatible).
- Middleware Next.js Edge runtime : pas de DB call possible (Prisma incompatible Edge sans Accelerate ou DataProxy).
- Routes ciblées : `/admin`, `/admin/*` pour les 3 locales (`/fr/admin`, `/de/admin`, `/en/admin`).
- Middleware existant : `src/middleware.ts` (probablement déjà gère `next-intl` localePrefix).

## User stories

- En tant qu'**admin**, je clique sur `/admin/wineries`, je vois la page admin normalement.
- En tant que **client connecté**, je tape `/admin` dans la barre d'adresse, je suis redirigé vers une page 404 (ou vers `/`, à trancher).
- En tant que **visiteur anonyme**, je tape `/admin`, je suis redirigé vers `/sign-in?callbackUrl=/admin`.
- En tant que **plateforme**, je veux que la décision de refus se prenne en Edge avant tout fetch côté Server Component.

## Critères d'acceptation (Gherkin)

```gherkin
Scénario : admin accède à /admin
  Étant donné un utilisateur authentifié avec role = "ADMIN"
  Quand il navigue vers /fr/admin/wineries
  Alors la page admin se charge normalement
  Et aucune redirection n'est déclenchée

Scénario : client tente d'accéder à /admin
  Étant donné un utilisateur authentifié avec role = "CLIENT"
  Quand il navigue vers /fr/admin/wineries
  Alors le middleware retourne une 404 (NextResponse.rewrite vers /not-found)
  Et aucun Server Component admin n'est exécuté
  Et aucune query DB admin n'est déclenchée

Scénario : winemaker tente d'accéder à /admin
  Étant donné un utilisateur authentifié avec role = "WINEMAKER"
  Quand il navigue vers /fr/admin
  Alors comportement identique au cas CLIENT (404)

Scénario : visiteur anonyme tente d'accéder à /admin
  Étant donné un utilisateur non authentifié
  Quand il navigue vers /fr/admin
  Alors le middleware redirige vers /fr/sign-in?callbackUrl=/fr/admin
  Et aucun Server Component admin n'est exécuté

Scénario : session sans champ role (fallback)
  Étant donné un cookie de session valide mais sans claim "role" lisible
  Quand l'utilisateur navigue vers /admin
  Alors le middleware refuse l'accès (fail-closed) et redirige vers /sign-in
  Et un log warn est émis côté Edge

Scénario : matcher middleware ne s'applique pas aux routes hors /admin
  Étant donné un utilisateur CLIENT
  Quand il navigue vers /fr/account
  Alors aucun check ADMIN n'est effectué
  Et la requête poursuit normalement

Scénario : layout admin garde un second check (defense in depth)
  Étant donné un bug hypothétique qui laisserait passer un CLIENT au middleware
  Quand le layout admin s'exécute
  Alors le check de role au layout doit toujours rejeter (notFound() ou redirect)
```

## Règles métier

- **Source de vérité du rôle au middleware** : la session Better Auth doit exposer le rôle de manière edge-readable. Deux options à valider avec Jonas :
  1. Le rôle est dans le cookie de session lui-même (claim JWT signé) → lecture O(1) sans appel réseau.
  2. Better Auth expose un endpoint `getSession` callable en edge (fetch) → 1 round-trip réseau par requête, latence non négligeable.
  - **Préférence produit** : option 1 (claim dans le cookie). Si Better Auth ne le permet pas nativement, ajouter une couche de signature custom (cookie séparé `enc_role` signé HMAC). Jonas tranche l'impl.
- **Fail-closed** : si on ne peut pas déterminer le rôle (cookie absent, signature invalide, claim manquant) → refuser. Jamais autoriser par défaut.
- **404 vs 403** : on retourne **404** pour les utilisateurs authentifiés non admins (CLIENT, WINEMAKER). Rationale : ne pas révéler l'existence de `/admin` à un utilisateur lambda. Pour les non-authentifiés, redirect vers sign-in (comportement standard).
- **Defense in depth** : le check au layout reste en place. Le middleware est la 1ère barrière, le layout la 2nde. Ne jamais retirer le check layout.
- **Pas de DB call au middleware** : interdit. Si la source de vérité du rôle nécessite la DB, la décision relève d'une migration de stack (Better Auth → Better Auth avec custom session field, ou ajout d'un mirror role dans le cookie).
- **Matcher Next.js** : ajouter `'/(fr|de|en)/admin/:path*'` au config matcher du middleware. Ne pas matcher `'/_next/*'` ni les assets.
- **Locale** : la redirection vers sign-in préserve la locale de l'URL d'origine.
- **callbackUrl** : on inclut `callbackUrl=<originalPath>` dans la redirect vers `/sign-in` pour ramener l'admin sur la page demandée après login.
- **Logging** : log `logInfo` (edge-compatible) à chaque refus 404 admin avec `userId` (si dispo), `path`, `role`. Utile pour détecter des tentatives.

## Copy FR définitive

| Élément          | Clé i18n suggérée       | Texte FR                                          |
| ---------------- | ----------------------- | ------------------------------------------------- |
| Page 404 (titre) | `errors.notFound.title` | Page introuvable                                  |
| Page 404 (corps) | `errors.notFound.body`  | Cette page n'existe pas ou n'est plus disponible. |
| Page 404 (CTA)   | `errors.notFound.cta`   | Retour à l'accueil                                |

_Note : aucun copy spécifique "admin only" — on assume une 404 silencieuse. Les visiteurs anonymes voient la copy standard sign-in (existante)._

## États UI

### Côté admin authentifié

- **Loading** : N/A au middleware (passe-plat). Le layout admin gère ses propres états de chargement.
- **Populated** : page admin rendue normalement.

### Côté CLIENT / WINEMAKER authentifié

- **Populated** : page `/not-found` standard d'EnCave (déjà existante via `app/not-found.tsx`).

### Côté visiteur anonyme

- Redirection 307 vers `/sign-in?callbackUrl=...`. Pas d'écran intermédiaire.

## Cas limites

- **Cookie session expiré** entre 2 requêtes : middleware traite comme "non authentifié" → redirect sign-in.
- **Race condition** : utilisateur admin dont le rôle vient d'être révoqué par un autre admin → la prochaine requête voit l'ancien cookie ; il reste admin jusqu'à expiration du cookie ou logout. Mitigation : durée de vie de session courte (à valider avec Jonas, cf. config Better Auth). Note Sam : si critique, ajouter une révocation forcée admin → toutes sessions invalidées.
- **Préload Next.js (`<Link prefetch>`)** : les prefetch de routes `/admin/*` depuis une page CLIENT vont déclencher le middleware → refus immédiat, pas de coût Server Component. OK.
- **API routes sous `/api/admin/*`** : hors scope direct de cette US (l'US cible les pages). MAIS : il faut absolument que les routes API admin aient leur propre check `auth()` + `role === 'ADMIN'`. **Flag pour Jonas** : auditer l'existant.
- **Bots crawlers** (Google) qui scrapent `/admin` : ils tombent sur 404 → OK, on ne veut pas que ces URLs soient indexées. Vérifier que `robots.txt` interdit `/admin`.
- **Locale absente dans l'URL** : `next-intl` `localePrefix: always` force la locale. Si quelqu'un tape `/admin` sans locale, le middleware `next-intl` redirige d'abord vers `/fr/admin`. L'ordre d'exécution des middlewares doit être : `next-intl` → check role admin. Composer les deux dans un seul `middleware.ts` chainé.
- **User dont le rôle est `ADMIN` mais dont le compte est SUSPENDED** : à clarifier. Proposition : on traite comme non-admin (404). À confirmer avec Sam.

## Dépendances

- `src/middleware.ts` à modifier.
- Configuration Better Auth pour exposer `role` dans le cookie session — à valider avec Jonas (lib Better Auth ^1.4.17, voir `src/lib/auth.ts` ou équivalent).
- `next-intl` middleware existant à chainer (cf. `src/i18n/`).
- Tests E2E à ajouter : `tests/e2e/admin-access.spec.ts` (4 cas : ADMIN ok, CLIENT 404, WINEMAKER 404, anonyme redirect sign-in).
- Pas de migration DB.

## Hors-périmètre explicite

- Pas de check role granulaire (sous-rôles admin : super-admin, ops, etc.).
- Pas de gestion d'IP allowlist pour `/admin`.
- Pas d'audit log centralisé des accès admin (c'est ENC-126).
- Pas de modification des routes API `/api/admin/*` (US séparée à créer si besoin).
- Pas de UI "Vous n'avez pas les droits" — on assume 404 silencieuse.

## Métriques de succès

- 0 Server Component admin exécuté pour un user non-admin (mesurable via logs Vercel / Sentry).
- Latence ajoutée par le middleware < 5 ms (claim cookie lu en O(1), sans round-trip réseau).
- 0 régression sur le parcours admin légitime (temps de chargement `/admin/wineries` stable).

## ❓ Questions ouvertes pour Sam

- Compte ADMIN dont le statut user est SUSPENDED : on bloque (404 même flow) ou on laisse passer (un admin suspendu ne devrait pas exister) ? Préférence produit ?
- Tu veux qu'on logue côté Sentry les tentatives d'accès `/admin` par des non-admins (signal d'alerte) ou juste un log info sans escalade ?
- Pour les routes API `/api/admin/*` : tu veux qu'on ouvre une US dédiée pour auditer/durcir, ou on considère que `auth()` + check role dans chaque action suffit ?
