# ADR 0001 — Transitions arrière scoped sur Booking pour reverts opérationnels

- **Statut** : Accepté
- **Date** : 2026-05-12
- **Décideurs** : Margot, Sam

## Contexte

La règle métier `CLAUDE.md` § Booking State Machine dit : « Never skip states. Never transition backwards. »

ENC-096 (page détail événement encaveur) introduit deux actions jour-J légitimes qui violent cette règle :

- **Annuler un check-in** : l'encaveur a coché par erreur un client → `COMPLETED` doit revenir à `CONFIRMED`.
- **Annuler un no-show** : le client arrive en retard après que l'encaveur l'a marqué absent → `NO_SHOW` doit revenir à `CONFIRMED`.

Sans exception, l'encaveur n'a aucun recours UI et doit passer par le support (Marco / Sam). Sur l'événement en cours, c'est inacceptable.

## Décision

On autorise **deux** transitions arrière, scoped, dans le code applicatif :

| Transition                | Server action          | Acteur                           |
| ------------------------- | ---------------------- | -------------------------------- |
| `COMPLETED → CONFIRMED`   | `revertBookingCheckIn` | Winery owner authentifié (auth()) |
| `NO_SHOW → CONFIRMED`     | `revertBookingNoShow`  | Winery owner authentifié (auth()) |

Contraintes :

- Fenêtre temporelle : **72h après `endsAt`** de la session. Au-delà, action refusée.
- Log Pino obligatoire à chaque revert, structure :
  ```
  { event: 'booking.status.revert', bookingId, actorId, from, to, at }
  ```
- Toutes les autres transitions arrière restent interdites.

## Conséquences

- ✅ L'encaveur récupère lui-même les erreurs jour-J, pas d'astreinte support.
- ✅ Périmètre étroit (2 transitions, 1 rôle, fenêtre 72h) → surface d'attaque limitée.
- ⚠️ La règle « never transition backwards » devient « never transition backwards sauf exceptions documentées ». La doc CLAUDE.md est amendée en conséquence.
- ⚠️ Pas de table d'audit dédiée : la traçabilité repose sur les logs Pino (rétention Vercel/Sentry). Acceptable pour MVP, à revoir si volume d'incidents.
- 🔄 Réversibilité : cheap. Si on déprécie les reverts, on désactive les deux server actions et on retire la mention CLAUDE.md.

## Alternatives écartées

- **Alt A — Interdire les reverts, obliger à passer par un ticket support.** UX dégradée jour-J : encaveur seul sur le terrain, support pas joignable le samedi. Refusé.
- **Alt B — Table `BookingStatusAudit` (id, bookingId, from, to, actorId, reason, at).** Bonne pratique long terme mais overkill MVP : ajoute une migration Prisma, une couche de service, des vues admin. Reporté post-MVP si besoin réel se manifeste.

## Références

- Spec : [`docs/specs/ENC-096.md`](../specs/ENC-096.md)
- Implémentation : `src/server/actions/event-detail.ts` (`revertBookingCheckIn`, `revertBookingNoShow`)
- Règle métier amendée : `CLAUDE.md` § Business Rules → Booking State Machine
- US liées : ENC-101 (check-in via scan), ENC-103b (UI no-show)
