# ENC-030b — Table `StripeEvent` pour idempotence webhooks (éviter double-traitement)

## Objectif métier

Stripe peut renvoyer un même webhook plusieurs fois (retries réseau, redeploy Vercel, replay). Sans table d'idempotence, on risque : 2 confirmations de booking pour 1 paiement, 2 emails envoyés, 2 transferts comptables. Cette US persiste chaque `event.id` Stripe avec son statut de traitement pour garantir l'exactly-once côté logique métier.

## Acteurs

- **SYSTEM (webhook handler)** : unique consommateur.
- **ADMIN** : peut interroger la table pour debugger un événement.

## Préconditions & déclencheurs

- Tout appel à `/api/webhooks/stripe` doit passer par le check d'idempotence avant d'exécuter le handler métier.
- Signature webhook déjà vérifiée en amont (`stripe.webhooks.constructEvent`).

## User stories

- En tant que **plateforme**, je veux la garantie qu'un événement Stripe est traité au plus une fois avec succès, peu importe le nombre de retries.
- En tant qu'**admin**, je veux pouvoir consulter l'historique brut des événements reçus pour diagnostiquer un incident.

## Critères d'acceptation (Gherkin)

```gherkin
Scénario : premier traitement d'un événement
  Étant donné un webhook Stripe avec event.id "evt_abc123" jamais vu
  Quand le handler reçoit la requête
  Alors une ligne est créée dans StripeEvent avec stripeEventId="evt_abc123", status="PROCESSING"
  Et le handler métier s'exécute (ex : confirmer un booking)
  Et à la fin, la ligne passe à status="PROCESSED" avec processedAt = now()

Scénario : retry d'un événement déjà traité
  Étant donné un événement "evt_abc123" déjà en status="PROCESSED"
  Quand le même event arrive à nouveau
  Alors le handler retourne 200 OK immédiatement sans rejouer la logique métier
  Et aucun email, aucune transition d'état, aucun refund n'est déclenché

Scénario : retry d'un événement en cours de traitement
  Étant donné un événement "evt_abc123" en status="PROCESSING" depuis 4 secondes
  Quand un retry arrive
  Alors le handler répond 409 Conflict (Stripe re-tentera)
  Et le premier traitement continue sans interruption

Scénario : traitement précédent a échoué
  Étant donné un événement "evt_abc123" en status="FAILED" avec failedAt < now() - 10s
  Quand un retry arrive
  Alors le handler relance le traitement (nouvelle tentative)
  Et incrémente attemptCount

Scénario : contrainte unique
  Quand deux requêtes concurrentes tentent d'insérer le même stripeEventId
  Alors une seule insère, l'autre reçoit une erreur P2002 Prisma
  Et le doublon répond 409 sans rejouer la logique
```

## Règles métier

- **Schéma Prisma proposé** (à valider par Jonas) :

```prisma
model StripeEvent {
  id              String              @id @default(cuid())
  stripeEventId   String              @unique
  eventType       String              // ex: "checkout.session.completed"
  apiVersion      String?             // event.api_version pour audit
  status          StripeEventStatus
  payload         Json                // event raw (pour debug)
  attemptCount    Int                 @default(1)
  lastError       String?             @db.Text
  receivedAt      DateTime            @default(now())
  processedAt     DateTime?
  failedAt        DateTime?

  @@index([eventType])
  @@index([status])
  @@index([receivedAt])
}

enum StripeEventStatus {
  PROCESSING
  PROCESSED
  FAILED
  IGNORED  // event reçu mais non géré (type non supporté)
}
```

- **Workflow handler** :
  1. Vérifier signature Stripe (déjà fait).
  2. `INSERT … ON CONFLICT DO NOTHING` ou `create()` catch P2002.
     - Si conflit → lire la ligne existante : si PROCESSED → 200, si PROCESSING → 409, si FAILED & failedAt > 10s → reprendre.
  3. Si insertion OK : status PROCESSING, lancer le handler métier (dispatch sur `event.type`).
  4. Sur succès : update status PROCESSED + processedAt.
  5. Sur exception : update status FAILED + failedAt + lastError. **Renvoyer 500** pour que Stripe retente.
- **Rétention** : conservation 90 jours. Cron de purge mensuel (hors scope MVP, à backlogger).
- **Types ignorés** : si `event.type` n'est pas géré par le switch, status IGNORED, 200 OK (évite retry inutile de Stripe). Liste explicite des types gérés dans une constante `HANDLED_STRIPE_EVENT_TYPES`.
- **Pas de transaction Prisma autour du handler métier + update PROCESSED** : si le métier met du temps (refund Stripe), on ne peut pas tenir une transaction longue. Plutôt : marquer PROCESSING avant, métier, update PROCESSED après.

## Copy FR définitive

Pas de copy utilisateur — feature purement back. Seuls messages techniques (logs, admin) :

| Élément                           | Clé i18n suggérée                      | Texte FR                   |
| --------------------------------- | -------------------------------------- | -------------------------- |
| Admin — colonne status PROCESSED  | `Admin.stripeEvents.status.processed`  | Traité                     |
| Admin — colonne status PROCESSING | `Admin.stripeEvents.status.processing` | En cours                   |
| Admin — colonne status FAILED     | `Admin.stripeEvents.status.failed`     | Échec                      |
| Admin — colonne status IGNORED    | `Admin.stripeEvents.status.ignored`    | Ignoré                     |
| Log info                          | (pas i18n)                             | `stripe.webhook.processed` |
| Log warn doublon                  | (pas i18n)                             | `stripe.webhook.duplicate` |

## États UI

- **Loading** : N/A (pas d'UI client). Une future page admin (hors-scope ici) listera les events.
- **Empty** : N/A.
- **Error** : 500 si le handler métier crash, status FAILED, Stripe retente.
- **Populated** : log structuré chaque traitement.

## Cas limites

- **Event > 256 KB** : `payload` Json devrait tenir, mais tronquer en `lastError` si nécessaire.
- **Concurrence** : 2 instances Vercel reçoivent le même event simultanément. La contrainte UNIQUE sur `stripeEventId` est le garde-fou. La 2e reçoit P2002, répond 409.
- **Event reçu après timeout du handler précédent** : si PROCESSING > 30s, considérer comme stale et permettre reprise (champ `receivedAt` + check >30s pour autoriser une 2e tentative). À implémenter avec prudence — on peut commencer sans, observer.
- **Type d'event non géré aujourd'hui mais important demain** : nécessite seulement d'ajouter le type au switch, la table acceptera tous les events.
- **Replay manuel via Stripe Dashboard** : marche, traité comme un nouveau retry.
- **`event.id` Stripe en mode test vs live** : aucun risque de collision (IDs distincts par environnement).

## Dépendances

- Migration Prisma à créer.
- Refacto du handler `/api/webhooks/stripe/route.ts` : wrapping idempotence autour du dispatch existant.
- Bloque indirectement la fiabilité d'ENC-045 (annulation refund) et ENC-067 (expiration), donc à livrer **en début de Sprint 2**.

## Hors-périmètre explicite

- Pas de page admin pour browse les events (V2 / debug interne via DB direct pour MVP).
- Pas de cron de purge (ajouter au backlog post-MVP).
- Pas de retry custom au-delà de ce que Stripe fait déjà (jusqu'à 3 jours en exponential backoff).
- Pas d'idempotence sur les actions sortantes (refunds, transfers) — Stripe a son propre `Idempotency-Key` à utiliser séparément si besoin.

## Métriques de succès

- 0 incident "double email" ou "double refund" attribuable à un replay webhook.
- > 99.5 % des events en status PROCESSED (le reste = IGNORED ou FAILED tracé).
- Temps médian de traitement webhook < 2 s.

## ❓ Questions ouvertes pour Sam

- **Faut-il une UI admin de browse des events dès le MVP ?** Reco Théo : non, on requête en DB direct pour les rares incidents. Page admin = V2.
- **Retention 90 jours OK pour audit fiscal / comptable ?** Reco Théo : à valider avec ton fiscaliste, 90 jours me semble suffisant car on garde les `Booking` et `stripePaymentIntentId` indéfiniment. Le payload brut est du debug.
