# ENC-032b — Champ `kycStatus` explicite sur `Winery`

## Objectif métier

Aujourd'hui, l'état KYC d'un encaveur est dérivé indirectement de `charges_enabled` (Stripe Account). Cette approche pose 3 problèmes :
1. **Lecture imprécise** : `charges_enabled=true` ne distingue pas "vérifié sans restriction" de "vérifié sous surveillance" (Stripe peut autoriser les charges même avec `requirements.eventually_due`).
2. **Pas de signal pour l'admin** : impossible d'afficher en un coup d'œil un encaveur dont le KYC est en cours de rejet ou requiert une action sous 30j.
3. **Logique métier dupliquée** : chaque appel doit recomputer "est-ce que cette cave peut publier ?" via `charges_enabled + details_submitted + status VERIFIED`.

On veut un **champ enum dénormalisé `kycStatus`** sur `Winery`, synchronisé depuis le webhook Stripe `account.updated`, source de vérité unique pour l'UI et la logique de visibilité.

## Acteurs

- WINEMAKER (impacté) — verra son statut KYC explicite dans son dashboard
- ADMIN (impacté) — colonne `kycStatus` filtrable dans la table wineries
- Système (Stripe webhooks → sync)

## Préconditions & déclencheurs

- Modèle `Winery` Prisma existant
- Webhook Stripe `account.updated` déjà reçu (cf ENC-030b pour idempotence)
- Stripe Connect en place avec `details_submitted`, `charges_enabled`, `requirements`
- Migration Prisma autorisée (Neon prod, backup OK)

## User stories

> En tant qu'**admin**, je veux voir dans la table des wineries une colonne `kycStatus` claire (NOT_STARTED / PENDING / VERIFIED / RESTRICTED / REJECTED), afin de prioriser mes relances et investigations.

> En tant qu'**encaveur**, je veux comprendre où j'en suis dans mon KYC sans interpréter "charges enabled", afin d'agir si besoin.

> En tant que **dev**, je veux requêter `winery.kycStatus === 'VERIFIED'` au lieu de combiner 3 booléens, afin de simplifier la logique de visibilité publique.

## Critères d'acceptation (Gherkin)

```gherkin
Fonctionnalité: Champ kycStatus dénormalisé

  Scénario: Création winery initialise kycStatus
    Étant donné une création de winery via signup encaveur
    Quand la winery est persistée
    Alors winery.kycStatus = "NOT_STARTED"

  Scénario: Onboarding Stripe commencé mais incomplet
    Étant donné un webhook "account.updated" avec details_submitted=true, charges_enabled=false
    Quand le handler traite l'event
    Alors winery.kycStatus = "PENDING"

  Scénario: KYC validé sans restriction
    Étant donné un webhook avec charges_enabled=true, payouts_enabled=true, requirements.currently_due=[]
    Quand le handler traite l'event
    Alors winery.kycStatus = "VERIFIED"

  Scénario: KYC validé mais restriction Stripe
    Étant donné un webhook avec charges_enabled=true mais requirements.disabled_reason présent
    Quand le handler traite l'event
    Alors winery.kycStatus = "RESTRICTED"

  Scénario: KYC rejeté
    Étant donné un webhook avec charges_enabled=false, requirements.disabled_reason="rejected.*"
    Quand le handler traite l'event
    Alors winery.kycStatus = "REJECTED"

  Scénario: Visibilité publique requiert kycStatus VERIFIED
    Étant donné une winery avec status=VERIFIED mais kycStatus=PENDING
    Quand un visiteur accède à "/fr/wineries/[slug]"
    Alors la page renvoie 404

  Scénario: Backfill sur migration
    Étant donné des wineries existantes en prod (sans champ kycStatus)
    Quand la migration est appliquée
    Alors chaque winery a un kycStatus calculé depuis ses booléens Stripe actuels
    Et aucune valeur n'est NULL
```

## Règles métier

- **Enum `KycStatus`** :
  | Valeur | Sens | Conditions Stripe |
  |---|---|---|
  | `NOT_STARTED` | Encaveur n'a pas démarré le formulaire Stripe Connect | `details_submitted=false` ET pas de `stripeAccountId` OU `stripeAccountId` créé mais aucune action |
  | `PENDING` | Onboarding démarré, en attente de vérification Stripe | `details_submitted=true` ET `charges_enabled=false` ET pas de rejection |
  | `VERIFIED` | KYC complet, paiements et payouts actifs, aucune action requise | `charges_enabled=true` ET `payouts_enabled=true` ET `requirements.currently_due=[]` ET `requirements.disabled_reason=null` |
  | `RESTRICTED` | KYC OK mais Stripe limite (payouts off, eventually_due en retard, etc.) | `charges_enabled=true` mais (`payouts_enabled=false` OU `requirements.eventually_due` non vide avec deadline dépassée OU `requirements.disabled_reason` présent non rejection) |
  | `REJECTED` | KYC rejeté par Stripe | `requirements.disabled_reason` commence par `"rejected."` OU `account.disabled=true` |

- **Mapping depuis webhook `account.updated`** :
  - Implémenter `mapStripeAccountToKycStatus(account: Stripe.Account): KycStatus` dans `src/server/services/stripe.service.ts` (ou similaire)
  - Idempotence via `StripeEvent` (cf ENC-030b)
  - Toujours recomputer en entier (pas de transition d'état métier ici, c'est un mirror de Stripe)

- **Logique de visibilité publique (à mettre à jour)** :
  - Une winery est visible publiquement si : `winery.status === 'VERIFIED'` ET `winery.kycStatus === 'VERIFIED'` ET (autres critères ENC-027 : photos, infos complètes)
  - `RESTRICTED` : encore visible mais les nouveaux paiements peuvent échouer côté Stripe → choix : on **dépublie** automatiquement (`status` reste VERIFIED, mais visibilité publique masquée par le check `kycStatus === VERIFIED`)
  - `REJECTED` : invisible publiquement, encaveur reçoit email (US séparée)

- **Migration Prisma** :
  ```prisma
  enum KycStatus {
    NOT_STARTED
    PENDING
    VERIFIED
    RESTRICTED
    REJECTED
  }

  model Winery {
    // ...
    kycStatus KycStatus @default(NOT_STARTED)
    kycStatusUpdatedAt DateTime?
    // ...
  }
  ```
  - Backfill : script qui parcourt toutes les wineries existantes, charge l'account Stripe, applique `mapStripeAccountToKycStatus`. Run en one-shot post-migration.
  - Index : pas nécessaire pour MVP (volumétrie faible).

- **Source de vérité** : `kycStatus` est dénormalisé. En cas de désync (webhook raté), recompute via cron quotidien (out of scope ici mais à anticiper).

## Copy FR définitive

Le champ est principalement back-office mais expose des libellés côté admin et dashboard encaveur :

| Élément | Clé i18n suggérée | Texte FR |
|---|---|---|
| Label NOT_STARTED | `Winery.kycStatus.NOT_STARTED` | "À démarrer" |
| Label PENDING | `Winery.kycStatus.PENDING` | "Vérification en cours" |
| Label VERIFIED | `Winery.kycStatus.VERIFIED` | "Vérifié" |
| Label RESTRICTED | `Winery.kycStatus.RESTRICTED` | "Restreint — action requise" |
| Label REJECTED | `Winery.kycStatus.REJECTED` | "Refusé" |
| Tooltip RESTRICTED encaveur | `Winery.kycStatus.RESTRICTED.help` | "Stripe demande des informations complémentaires. Ouvrez votre tableau de bord Stripe pour régulariser." |
| Tooltip REJECTED encaveur | `Winery.kycStatus.REJECTED.help` | "Votre vérification d'identité n'a pas pu être validée. Contactez-nous à bonjour@encave.ch." |
| Bandeau dashboard si PENDING | `Dashboard.kyc.banner.pending` | "Vérification Stripe en cours. Vous pourrez publier vos expériences dès validation." |
| Bandeau dashboard si NOT_STARTED | `Dashboard.kyc.banner.notStarted` | "Finalisez votre vérification d'identité pour commencer à recevoir des réservations." |
| CTA bandeau NOT_STARTED | `Dashboard.kyc.banner.cta` | "Démarrer la vérification" |

## États UI

- **Loading** : table admin → skeleton row (cohérent ENC-153)
- **Empty** : n/a (toujours une valeur post-backfill)
- **Error** : si webhook échoue → log Sentry + retry Stripe natif. Pas d'UI utilisateur impactée (valeur précédente conservée).
- **Populated** : badge coloré dans table admin (vert VERIFIED, ambre PENDING/RESTRICTED, rouge REJECTED, gris NOT_STARTED)

## Cas limites

- **Webhook reçu dans le désordre** : un `account.updated` antérieur écraserait un état plus récent. Prévenir via `kycStatusUpdatedAt` — ignorer un webhook plus vieux que la valeur stockée. Ou bien : recomputer toujours en se basant sur l'`Account.id` rechargé via API (plus safe, plus lent).
- **Winery sans `stripeAccountId`** : `kycStatus = NOT_STARTED`, jamais d'autre valeur.
- **Stripe Account supprimé** : `account.application.deauthorized` → passer en `REJECTED` (ou `NOT_STARTED` ?). À trancher, recommandation Théo : `REJECTED` car action explicite.
- **Backfill sur 100+ wineries** : éviter rate limit Stripe (100 req/s lecture). Batcher par 50 avec sleep 1s.
- **Désync persistante** : prévoir une commande admin "force resync KYC" qui rappelle l'API Stripe pour une winery donnée.
- **Migration sur prod** : appliquer en heure creuse, backup Neon avant, plan de rollback (drop colonne + revert webhook handler).
- **Logique visibilité actuelle** : auditer tous les endroits qui lisent `charges_enabled` et les remplacer par `kycStatus === 'VERIFIED'`. Liste à faire avant migration (grep `charges_enabled`).

## Dépendances

- ENC-030b (table `StripeEvent` idempotence webhooks) — recommandé, évite double-traitement pendant la migration
- ENC-027 (logique visibilité publique) — à mettre à jour pour utiliser `kycStatus`
- Backup Neon prod fait avant migration

## Hors-périmètre explicite

- **Pas** d'UI dashboard encaveur "détail KYC" (juste le label + bandeau bandeau d'appel à l'action)
- **Pas** de cron de resync quotidien (à prévoir en US séparée si désync constatée)
- **Pas** d'email automatique sur changement de `kycStatus` (couvert par ENC-035 et autres)
- **Pas** de migration vers un système KYC non-Stripe (out of MVP)

## Métriques de succès

- 100% des wineries ont un `kycStatus` non-NULL après backfill
- 0 régression sur la visibilité publique (les wineries qui étaient publiées le restent, sauf cas RESTRICTED légitime)
- Webhook handler met à jour `kycStatus` en < 500ms (p95)
- Réduction de la complexité : grep `charges_enabled` côté app passe à 0 occurrence (uniquement dans le mapping interne)

## ❓ Questions ouvertes pour Sam

- **Comportement RESTRICTED** : on dépublie automatiquement (visibilité publique masquée) ou on garde visible avec warning interne ? Recommandation Théo : dépublier, c'est plus safe légalement (payouts potentiellement KO).
- **Suppression Stripe Account** : passe en `REJECTED` ou `NOT_STARTED` ? Recommandation Théo : `REJECTED` car action volontaire ou contrainte.
- **Backfill timing** : on le fait en même temps que la migration ou en US séparée ? Recommandation Théo : même PR, sinon état incohérent en prod.
