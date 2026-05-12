# Runbook — Stripe webhooks par environnement

> Auteur : Marco (devops). Date : 2026-05-12.
> Statut : note d'arbitrage + actions pour Sam. À faire valider par Margot avant exécution.

## Contexte

Bug repro en preview Vercel : `/[locale]/booking/[id]/confirmation?session_id=...`
reste en "paiement en attente" alors que Stripe a accepté la carte test `4242`.
Cause : **aucun endpoint webhook Stripe n'est configuré pour les deployments preview**,
donc `checkout.session.completed` n'est jamais reçu et le booking reste en
`PENDING_PAYMENT` indéfiniment.

Code actuel câblé :

- `POST /api/webhooks/stripe/checkout` — vérifie `STRIPE_WEBHOOK_SECRET`.
  Events gérés : `checkout.session.completed`, `checkout.session.expired`.
- `POST /api/webhooks/stripe/connect` — vérifie `STRIPE_CONNECT_WEBHOOK_SECRET`.
  Events gérés : `account.updated`, `account.application.deauthorized`.

Tout autre event Stripe est logué via `logInfo` et renvoie 200, donc inoffensif
côté Stripe mais sans effet métier.

---

## Partie 1 — Stratégie webhook par environnement

### Matrice d'arbitrage

| Critère | Option A — endpoint par env (preview/dev/prod) | Option B — endpoint unique + proxy dispatch | Option C — local (CLI) + dev + prod, **pas de webhook preview** |
| --- | --- | --- | --- |
| Complexité infra | Moyenne (3 endpoints, 3 secrets) | Élevée (service intermédiaire à héberger + maintenir) | Faible (2 endpoints stables seulement) |
| Couverture preview | OK si Vercel expose un alias stable preview (à vérifier — Vercel n'a **pas** d'alias preview stable par défaut, chaque PR a sa propre URL) | OK | KO côté webhook, **mais** compensé par fallback synchrone via `stripe.checkout.sessions.retrieve` (Luca contractualise en parallèle) |
| Surface de bugs | Moyenne (3 secrets à gérer dans Vercel) | Élevée (un point de défaillance custom) | Faible |
| Coût Stripe / quotas | Acceptable | Acceptable | Le plus bas |
| Réalisme operationnel pour MVP | Discutable : un endpoint preview qui pointe vers un alias instable casse vite | Sur-engineering | Aligné MVP, on déplace la responsabilité dans la page confirmation |
| Sécurité webhook secret | 3 secrets à rotater | 1 secret central (point chaud) | 2 secrets, surface réduite |

### Recommandation : **Option C**

Justification :

1. Vercel ne fournit pas d'alias "preview stable" pour un projet : chaque PR
   produit un nouvel hostname (`encave-app-<hash>-<scope>.vercel.app`). On ne
   peut donc pas pointer un endpoint Stripe vers une URL preview de façon
   durable — l'option A est en réalité fragile pour le preview.
2. Le fallback synchrone côté page confirmation
   (`stripe.checkout.sessions.retrieve` + transition `PENDING_PAYMENT → CONFIRMED`
   guardée par idempotence) rend le webhook **non bloquant** pour le flow user.
   C'est exactement le contrat que Luca finalise. Le webhook reste la source
   de vérité asynchrone côté prod, mais la page n'en dépend plus pour afficher
   l'état correct.
3. Moins de secrets à gérer = moins de surface pour rotations ratées
   ou secrets exposés.
4. Stripe CLI couvre le dev local proprement, sans avoir à exposer le poste
   via ngrok.

**Trade-off accepté** : en preview, les emails de confirmation transactionnels
ne partent pas automatiquement (le webhook ne tourne pas), donc à tester
explicitement sur `encave-dev.vercel.app` (staging) avant merge `main`.
À documenter dans la checklist de PR.

---

## Partie 2 — Runbook actionnable pour Sam

### Pré-requis

- Accès Stripe Dashboard en **mode test** (et **live** pour prod).
- Accès Vercel project EnCave (Owner ou Member avec droit env vars).
- Stripe CLI installé localement (`brew install stripe/stripe-cli/stripe`).

### Étape 1 — Audit des events à écouter

> Audit code confirmé le 2026-05-12 par lecture de
> `src/app/api/webhooks/stripe/checkout/route.ts` et
> `src/app/api/webhooks/stripe/connect/route.ts`. Toute extension de cette
> liste demande une PR qui ajoute le `case` correspondant dans le `switch`
> sinon l'event tombe dans le `default` (logué via `logInfo`, sans effet).

Côté `checkout` route, le code ne switch que sur :

- `checkout.session.completed`
- `checkout.session.expired`

**Reco events à abonner** dans l'endpoint Stripe (même si le code ne les
traite pas encore, ça évite d'avoir à toucher l'endpoint plus tard et la
route renvoie 200 sur les events inconnus) :

- `checkout.session.completed` — **utilisé** (CONFIRMED + emails)
- `checkout.session.expired` — **utilisé** (cleanup PENDING_PAYMENT)
- `checkout.session.async_payment_succeeded` — pas utilisé aujourd'hui,
  mais à ajouter si on accepte un jour des moyens de paiement asynchrones
  (SEPA, Bancontact). À ouvrir comme une US séparée plutôt que d'élargir
  silencieusement la surface d'événements.
- `checkout.session.async_payment_failed` — idem
- `payment_intent.payment_failed` — pas utilisé. **À ne pas abonner**
  tant qu'on n'a pas de handler dédié, sinon on flood les logs `logInfo`
  pour rien.
- `charge.refunded` — pas utilisé. **À ne pas abonner** non plus.

**Décision MVP** : on s'abonne uniquement aux 2 events câblés
(`checkout.session.completed`, `checkout.session.expired`). Le reste est
backlog explicit (US dédiée pour refunds & async payments).

Côté `connect` route :

- `account.updated`
- `account.application.deauthorized`

### Étape 2 — Créer les endpoints Stripe (mode test)

Dans https://dashboard.stripe.com/test/webhooks → **Add endpoint**.

#### 2.1 — Endpoint staging (`encave-dev.vercel.app`)

**Checkout endpoint** :

- URL : `https://encave-dev.vercel.app/api/webhooks/stripe/checkout`
- Description : `EnCave staging — checkout`
- Events : `checkout.session.completed`, `checkout.session.expired`
- API version : `2025-12-15.clover` (matcher la version pinned dans le code)
- Après création → cliquer **Reveal signing secret** → noter le `whsec_...`
  → c'est le `STRIPE_WEBHOOK_SECRET` pour staging.

**Connect endpoint** :

- URL : `https://encave-dev.vercel.app/api/webhooks/stripe/connect`
- Description : `EnCave staging — connect`
- Events : `account.updated`, `account.application.deauthorized`
- Listen to events on : **Connected accounts** (case à cocher importante,
  sinon les events Connect n'arrivent pas)
- API version : `2025-12-15.clover`
- Noter le `whsec_...` → `STRIPE_CONNECT_WEBHOOK_SECRET` pour staging.

#### 2.2 — Endpoint production (`encave.ch`, mode **live**)

Aller sur https://dashboard.stripe.com/webhooks (sans `/test/`).

Mêmes 2 endpoints, en remplaçant l'hôte par `https://encave.ch`. Noter les
secrets `whsec_...` séparément. Mode live = vraies cartes, séparation
totale des secrets test.

#### 2.3 — Preview : **pas d'endpoint Stripe** (cf option C)

Le flow s'appuie sur le fallback synchrone côté page confirmation. À
documenter dans le README de la PR Luca quand son code arrive.

### Étape 3 — Pousser les secrets dans Vercel

Via le dashboard Vercel (Project Settings → Environment Variables) **OU**
en CLI :

```
# Staging (env "Preview" sur la branche dev OU env "Production" si la branche
# dev est configurée comme prod target d'un projet séparé encave-dev — à
# vérifier avec Sam la conf actuelle des projets Vercel)
vercel env add STRIPE_WEBHOOK_SECRET preview
vercel env add STRIPE_CONNECT_WEBHOOK_SECRET preview

# Production
vercel env add STRIPE_WEBHOOK_SECRET production
vercel env add STRIPE_CONNECT_WEBHOOK_SECRET production
```

**Important** : on ne **pas** mettre ces secrets sur l'env `Development`
(Vercel local) — pour le dev local on utilise Stripe CLI listen (voir
étape 4) qui génère son propre secret éphémère.

Après ajout des env vars, **redéployer** staging et prod pour que les
secrets soient injectés (Vercel ne propage pas les changements aux
deployments existants).

### Étape 4 — Dev local (Stripe CLI)

Dans un terminal séparé :

```
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe/checkout
# CLI imprime: "Ready! Your webhook signing secret is whsec_xxxx (^C to quit)"
```

Copier ce `whsec_xxxx` dans `.env.local` comme `STRIPE_WEBHOOK_SECRET`.
Faire pareil dans un 2e terminal pour `connect` si on travaille sur le
flow winemaker onboarding.

À documenter dans le README dev (Élise / Margot).

### Étape 5 — Vérification post-déploiement

À demander à Sam après redeploy :

1. Sur `encave-dev.vercel.app`, faire un booking de bout en bout avec carte
   test `4242 4242 4242 4242`. Vérifier que la page confirmation passe en
   `CONFIRMED` dans les ~5s.
2. Stripe Dashboard test → endpoint staging → onglet **Events** → vérifier
   que le `checkout.session.completed` a un status `200`.
3. Vercel logs (projet EnCave, deployment staging) → grep
   `Booking confirmed via webhook` → log Pino doit apparaître.
4. Côté DB (Neon `development`) → `select reference, status from "Booking"
   order by "createdAt" desc limit 5;` → status doit être `CONFIRMED`.
5. Pour prod : refaire le test après merge sur `main`, avec **carte live
   réelle de Sam** sur un experience à 1 CHF, puis refund immédiat depuis
   Stripe Dashboard live.

### Étape 6 — Rotation des secrets

À documenter (Élise) : tous les 6 mois minimum. Procédure : rotate
l'endpoint Stripe (bouton "Roll secret" dans le dashboard, garde l'ancien
actif 24h), update Vercel env var, redeploy, supprimer l'ancien secret.

---

## Partie 3 — Région Vercel `iad1` vs `cdg1`

### Verdict : **c'est un problème de configuration**, pas un overflow capacity.

`vercel.json` actuel :

```
{
  "crons": [
    { "path": "/api/cron/reminders", "schedule": "0 7 * * *" },
    { "path": "/api/cron/daily-digest", "schedule": "0 6 * * *" }
  ]
}
```

Pas de clé `regions`. Vercel applique alors la région **par défaut du
projet** réglée dans le dashboard. Si personne n'a explicitement mis
`cdg1` au niveau projet, Vercel utilise le défaut compte (souvent `iad1`
pour les comptes US-based ou créés sans région explicite).

CLAUDE.md indique `cdg1 (Paris)` comme cible — c'est une intention non
appliquée techniquement.

### Fix proposée

Deux niveaux possibles, le 2ᵉ est suffisant pour le MVP :

**Niveau 1 (recommandé MVP)** — fixer la région au niveau projet :

- Vercel Dashboard → Project Settings → Functions → Region → sélectionner
  `Paris, France (cdg1)`. S'applique à toutes les fonctions futures.

**Niveau 2 (verrouillage code)** — ajouter dans `vercel.json` :

```
{
  "regions": ["cdg1"],
  "crons": [
    { "path": "/api/cron/reminders", "schedule": "0 7 * * *" },
    { "path": "/api/cron/daily-digest", "schedule": "0 6 * * *" }
  ]
}
```

**Alternative route-level** (si on veut épingler seulement les routes
critiques sans toucher le projet entier) : exporter
`export const preferredRegion = 'cdg1'` au top de chaque
`route.ts`/`page.tsx` sensible (webhooks Stripe, page confirmation,
checkout). Plus chirurgical mais plus de drift potentiel — à n'utiliser
que si Sam ne peut/veut pas figer la région au niveau projet.

C'est la version source-controlled (auditable, on évite un drift dashboard).
**Reco : faire les 2.** Coût zéro, on aligne intention et réalité.

Note : `regions: ["cdg1"]` dans `vercel.json` n'est valide qu'avec un plan
Vercel qui permet de fixer la région des fonctions serverless (Pro ou Team).
À vérifier avec Sam que le compte est sur Pro+. Sur Hobby, la région est
imposée et `cdg1` n'est pas disponible.

### Impact attendu

- Latence webhook Stripe (Europe → cdg1) : ~30ms au lieu de ~120ms iad1.
- Latence Neon (déjà en EU si Sam a setup la DB en EU) : préserve la
  co-localisation, on évite l'aller-retour transatlantique sur chaque
  query Prisma serverless.
- Si la DB Neon est **encore** en US, c'est le bug suivant à fixer
  (Margot → ouvrir une US `enc-XX-relocate-neon-eu`).

### Sur la repro spécifique de la page confirmation

Le fait que la confirmation tourne en `iad1` ne cause pas le bug
"PENDING_PAYMENT à vie" (c'est bien l'absence de webhook), mais il
amplifie la mauvaise expérience : la page est lente à charger (RTT
transatlantique × queries Prisma) et donne l'impression que le système
"attend". Fixer la région est donc complémentaire au fix webhook.

---

## Suivi & ownership

- **Sam** : exécute étapes 2.1 → 2.3 et 3 dans Stripe + Vercel. Confirme
  région compte Vercel.
- **Margot** : valide cette note, met à jour la checklist PR pour exiger
  un test booking sur staging avant tout merge sur `main`.
- **Élise** : intègre le pattern Stripe CLI au README dev, ajoute la
  procédure de rotation secrets en annexe de ce runbook.
- **Luca** : livre le fallback synchrone côté page confirmation
  (`stripe.checkout.sessions.retrieve`). Sans ce fallback, l'option C
  n'est pas viable.

## Garde-fous

- Ne **jamais** mettre un `STRIPE_WEBHOOK_SECRET` mode live sur un env
  preview ou staging. Cross-contamination = bookings confirmés sur la
  mauvaise DB.
- Ne **jamais** supprimer l'ancien endpoint Stripe tant que le nouveau
  n'a pas reçu un event 200 vérifié.
- Ne **jamais** étendre la liste d'events abonnés sans ouvrir la PR qui
  ajoute le handler correspondant (sinon dette silencieuse).
