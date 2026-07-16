# Runbook — Restauration base de données (Neon PITR)

## Contexte

- Base production : projet Neon, branche `production` (voir CLAUDE.md
  §Environnements). Le PITR (point-in-time recovery) de Neon couvre la
  fenêtre d'historique du plan (vérifier la rétention configurée dans
  Neon → Settings → History retention ; viser ≥ 7 jours).
- Cas d'usage : suppression/écrasement accidentel de données, migration
  destructrice passée par erreur, corruption applicative.

## Procédure (restore par branche — jamais en écrasant la prod à chaud)

1. **Figer les écritures** si l'incident le justifie : poser
   `COMING_SOON` ≠ `false` (gate middleware) ou couper les flags argent
   (voir `kill-switch-flags.md`).
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
6. Rouvrir les écritures (flags / COMING_SOON), annoncer la fin d'incident.

## À NE PAS faire

- Restaurer via `pg_restore` par-dessus la prod pendant que l'app écrit.
- Restaurer sans réconcilier Stripe : l'argent encaissé fait foi.
- Tester la procédure pour la première fois pendant un vrai incident — un
  test à froid sur staging fait partie du DoD P-16 (Sam).
