# Runbook — Restauration base de données (Neon PITR)

## Contexte

- Base production : projet Neon, branche `production` (voir CLAUDE.md
  §Environnements). Le PITR (point-in-time recovery) de Neon couvre la
  fenêtre d'historique du plan (vérifier la rétention configurée dans
  Neon → Settings → History retention ; viser ≥ 7 jours).
- Cas d'usage : suppression/écrasement accidentel de données, migration
  destructrice passée par erreur, corruption applicative.

## Procédure (restore par branche — jamais en écrasant la prod à chaud)

1. **Figer les écritures** si l'incident le justifie — voir
   « Gel des écritures » ci-dessous (`MAINTENANCE_MODE=true`). Pour un
   incident limité à une feature, couper son flag suffit et prend moins
   d'une minute (voir `kill-switch-flags.md`).
2. Neon Console → Branches → **Create branch** → « From timestamp » : choisir
   l'instant JUSTE AVANT l'incident (UTC). Nommer `restore-YYYYMMDD-HHMM`.
3. **Vérifier sur la branche de restore** (elle a sa propre connection
   string) : les données perdues y sont-elles ? Comparer les tables
   touchées avec la prod.
4. Deux issues :
   - **Restore ciblé (préféré)** : réinsérer depuis la branche de restore
     les seules lignes perdues (`pg_dump --table` / `COPY`), en respectant
     les invariants (ledger bons cadeaux append-only, `balance >= 0`).
   - **Bascule complète** : Neon → « Restore branch » de `production`
     depuis la branche de restore (Neon fait pointer la branche prod sur le
     nouvel historique). Toute écriture postérieure à l'instant choisi est
     PERDUE — croiser avec Stripe (source de vérité paiements) avant.
5. **Réconciliation post-restore** (toujours) :
   - `stripe_events` : rejouer les événements Stripe postérieurs à
     l'instant de restore (`stripe events resend`, voir
     `incident-paiement.md`) — Stripe garde l'historique.
   - Bookings CONFIRMED côté Stripe absents en DB → recréer via rejeu
     webhook ; jamais à la main.
6. Rouvrir les écritures (`MAINTENANCE_MODE` retiré + redeploy, flags
   réactivés), vérifier `/api/health?deep=1` → 200, annoncer la fin
   d'incident.

## Gel des écritures — `MAINTENANCE_MODE`

`COMING_SOON` n'est **pas** un gel : c'est le gate de pré-lancement (il
réaffiche la landing « offre fondateur », ne couvre qu'`encave.ch` et laisse
toutes les routes `/api` ouvertes). Le gel, c'est `MAINTENANCE_MODE`
(`src/middleware.ts`).

**Activer** : Vercel → Project → Settings → Environment Variables →
`MAINTENANCE_MODE` = `true` (Production) → **Redeploy** le dernier
déploiement de production (~2 min ; le middleware Edge lit la variable au
déploiement, comme `COMING_SOON`). Seule la chaîne exacte `true` ferme le
site.

**Effet** (sur tous les hôtes du déploiement) :

| Requête                                                        | Réponse en maintenance                                           |
| -------------------------------------------------------------- | ---------------------------------------------------------------- |
| Page (GET), toutes locales, y compris `/dashboard` et `/admin` | page `/[locale]/maintenance`, statut 503 + `Retry-After: 600`    |
| Server action (POST sur une URL de page)                       | 503 JSON + `Retry-After` — aucune écriture                       |
| API mutante (POST/PUT/PATCH/DELETE), ex. `/api/auth/*`         | 503 JSON + `Retry-After`                                         |
| API en lecture (GET/HEAD)                                      | inchangée                                                        |
| `/api/webhooks/**` (Stripe, Resend)                            | **inchangée** — Stripe désactive un endpoint qui échoue en série |
| `/api/cron/**`                                                 | **inchangée** (voir ci-dessous)                                  |
| `/api/health`                                                  | **inchangée** — le moniteur continue de voir l'état réel         |

**Ce que le gel ne coupe PAS** — à traiter à la main si la restauration
l'exige :

- **Webhooks** : ils continuent d'écrire (confirmations de paiement en
  vol). C'est voulu : l'argent encaissé doit être enregistré. Pour une
  bascule complète de branche, les événements postérieurs à l'instant de
  restore se rejouent depuis Stripe (étape 5).
- **Crons** : ils continuent de tourner (rappels, expiration des
  réservations en attente, jobs planifiés). Pour les arrêter le temps
  d'une restauration : Vercel → Settings → Cron Jobs → désactiver, ou
  retirer temporairement `CRON_SECRET` (tous répondent alors 401), puis
  redeploy.
- **L'admin** : `/admin` affiche aussi la page de maintenance. Les
  kill-switches se coupent alors en SQL (`kill-switch-flags.md`, §
  secours).

**Lever** : supprimer `MAINTENANCE_MODE` (ou toute valeur ≠ `true`) →
Redeploy. Contrôle : la home répond 200, `/api/health?deep=1` → 200.

**Tester à froid** (preview ou staging) : poser la variable sur
l'environnement Preview, redeploy, puis
`curl -I https://<preview>/fr` → `503` + `Retry-After`, et
`curl -X POST https://<preview>/api/newsletter` → `503`.

## À NE PAS faire

- Restaurer via `pg_restore` par-dessus la prod pendant que l'app écrit.
- Restaurer sans réconcilier Stripe : l'argent encaissé fait foi.
- Tester la procédure pour la première fois pendant un vrai incident — un
  test à froid sur staging fait partie du DoD P-16 (Sam).
