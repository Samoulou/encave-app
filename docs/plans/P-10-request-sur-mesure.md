# P-10 — Request / sur-mesure 💰

> **Statut** : plan · **Branche** : `claude/p10-implementation-plan-tj96sd` (imposée) · **PR** : # (cible `dev`) · titre `P-10: Request / sur-mesure`
> **Sources** : `docs/ENCAVE-V3-DELIVERY-PLAN.md` §P-10 + §3 socle · items `L-090→L-095` (E7, US-240) · specs `docs/v3/ENCAVE-V3-PRD.md` US-240, `docs/v3/ENCAVE-V3-PAGES-EMAILS.md` (`/sur-mesure`, `/compte/demandes`, emails #8/#9/#10/#15), `docs/v3/ENCAVE-V3-BUSINESS.md` §4
> **Type** : 💰 → flag `REQUESTS` (déjà déclaré OFF) + `/security-review` + `/code-review high`. Dépend de **P-02** (schéma ✅) + **P-03** (flags/commission ✅), tous deux mergés.

## Contexte — pourquoi ce package

US-240 « sur-mesure » : aujourd'hui un client qui veut une prestation hors catalogue (EVG, sortie d'équipe, anniversaire) n'a aucun canal. P-10 ouvre la boucle **formulaire client → offre vigneron → lien de paiement → billet** en 2 allers-retours max, avec SLA 48 h visible, relance unique et clôture auto. C'est le flux **le plus rentable par transaction** (paniers 400–1'500 CHF) et le capteur B2B de la morte-saison nov-déc. Résultat attendu : une cave reçoit une demande, compose une offre en ≤ 5 min, le client paie, un vrai billet QR est émis (scan, rappel J-1, annulation identiques à une réservation normale).

**L'acquis P-02** fait déjà l'essentiel du socle : modèles `Request`/`RequestOffer` + enums + machine à états `request-transitions.ts`, flag `REQUESTS`, moteur `ScheduledJob` générique (`process-scheduled-jobs`). **P-10 consomme ce schéma** ; il n'écrit aucun lecteur/écrivain runtime — tout est à construire, presque exclusivement en réutilisant le code checkout/emails/crons existant.

## 1. Objectif

Un client décrit un besoin sur `/sur-mesure` (cave obligatoire au launch) ; la cave voit la demande dans son inbox `/dashboard/demandes` (badge), compose une offre (message, prix total tout compris, date/heure, échéance) ; le client paie via un lien tokenisé → **réservation `CONFIRMED` + billet QR émis** (commission du palier correcte). Relance unique J-1 puis clôture auto ; alerte cave > 24 h, email à Sam > 48 h. Flag OFF = aucune surface, zéro changement de comportement.

## 2. Décision d'architecture centrale (validée — pressure-test agent Plan)

**Le billet est la réservation, et `Booking.experienceId` est REQUIS** (FK non-nullable). Une offre sur-mesure ne correspond à aucune expérience du catalogue → **Option A : expérience « sur-mesure » cachée par cave.**

- `getOrCreateSurMesureExperience(wineryId)` : **une** `Experience` par cave, `status = DRAFT`, marqueur additif **`Experience.isCustom = true`**, sans `AvailabilitySlot` ni occurrence, `slug='sur-mesure'` (singleton via `@@unique([wineryId, slug])` existant → **pas de nouvel index**), `coverPhoto` placeholder (champ requis), `price = 0` (le prix vient de l'offre).
- La réservation sur-mesure s'y rattache ; **`booking.totalPrice = offer.totalPrice`** posé explicitement (on court-circuite `price × guests`), `date`/`timeSlot` = champs confirmés de l'offre.
- **Réutilisation totale** : ticket/QR, scan/check-in, rappel J-1, email de confirmation, annulation/refund fonctionnent sans un octet de code nouveau — c'est une vraie ligne `Booking`.

**Rejeté** : Option C (`experienceId` nullable) casse ~12 sites de lecture `booking.experience.title` sous TS strict = réécriture de la couche booking. Option B (rattacher à une expérience publiée) pollue la capacité/le fill-rate et ne représente pas un prix bespoke.

**Fuite du marqueur — checklist exhaustive (agent Plan).** `status = DRAFT` exclut déjà l'expérience cachée de TOUTES les surfaces publiques (catalogue/recherche, fiche, `getWineryBySlug`, génération d'occurrences, sitemap, gift-cards, garde de booking public — toutes filtrent `status = PUBLISHED`). **Seuls 2 sites** listent délibérément les DRAFT et doivent recevoir un filtre `isCustom: false` :

- **L1 (obligatoire)** `src/app/[locale]/(protected)/dashboard/experiences/ExperiencesContent.tsx` (~L46-76) : la grille de gestion + les 3 `count` (drafts/total). Sans filtre, l'expérience cachée apparaît comme carte et gonfle les compteurs.
- **L2 (optionnel)** `src/server/queries/booking.queries.ts` `getWineryExperiencesForFilter` (~L244) : entrée « Sur-mesure » dans le dropdown de filtre des réservations. Cosmétique — à filtrer OU garder volontairement pour que la cave filtre ses résas sur-mesure (à trancher au BUILD).

Les surfaces **booking** (calendrier cave, scan, my-bookings, earnings/payouts, rappels, confirmation) affichent correctement la résa sur-mesure via un `title` réel — comportement voulu, zéro changement. Note UX : le lien fiche depuis my-bookings (`H.slug`) 404 (fiche PUBLISHED-gated) → rendre la carte sur-mesure **non-cliquable**.

## 3. Scope

**IN** (`L-090→L-095`) :

- **L-090** — Formulaire public `/sur-mesure` (cave **obligatoire** au launch, date souhaitée, nb pers., budget indicatif, description) + **bloc prérempli** sur chaque fiche domaine (îlot client, `wineryId`/`wineryName` en props, ISR préservée) + rate-limit IP + **email #8** accusé (48 h) au client + **email #15** à la cave (SLA 48 h, CTA répondre).
- **L-091** — Inbox encaveur `/dashboard/demandes` (item nav gaté `REQUESTS` + **badge compteur** — 1er badge de l'app) : liste tenant-gated, détail, **composer l'offre** (message, prix total, date+heure confirmées, validité) → `RequestOffer` (SENT), `Request`→OFFERED, **email #9** avec lien de paiement tokenisé.
- **L-092** — Paiement de l'offre : page publique tokenisée `/sur-mesure/offre/[token]` → `createRequestOfferCheckout` (Stripe destination charge, **commission du palier sur le prix total, aucun frais de service** — décision Sam) → webhook `kind:'request_offer'` → réservation confirmée + billet.
- **L-093** — Jobs `ScheduledJob` (3 nouveaux types au `JOB_REGISTRY`, flag `REQUESTS`) : relance **unique** J-1 (email #10), clôture auto à échéance, escalade SLA. + email #15 déjà en L-090.
- **L-094** — SLA visible : alerte dashboard cave « demande sans réponse > 24 h » (query + banner, modèle `TastingSheetAlertBanner`) ; **email à Sam > 48 h** (`ADMIN_ALERT_EMAIL`, décision Sam).
- **L-095 (Should)** — `/dashboard/mes-demandes` (client connecté) : suivi statut (En attente / Offre reçue / Payée / Expirée) + CTA payer. _(Le suivi invité passe par le lien tokenisé des emails.)_

**OUT (explicite)** :

- Modèles `Request`/`RequestOffer` + enums + `request-transitions.ts` + flag `REQUESTS` + moteur `ScheduledJob` : **livrés en P-02/P-07** — on les consomme.
- **« Laissez EnCave proposer » (wineryId null)** : reporté (décision Sam — cave obligatoire au launch). Le schéma reste prêt (`wineryId String?`) ; aucune surface d'assignation admin.
- **Frais de service 2.50 sur l'offre** : retiré (décision Sam — offre tout compris). `serviceFeeCents = 0` sur la résa sur-mesure ; seule la commission du palier s'applique. _(Écart assumé vs la lettre de la DoD « fee + commission » — voir §7.)_
- Messagerie in-app client↔cave, modification d'offre après paiement, offres multiples simultanées avancées (une offre active à la fois par demande au launch), diffusion multi-cave.

## 4. Definition of Done (gate — copiée du delivery plan §P-10, adaptée aux décisions Sam)

- [ ] Formulaire `/sur-mesure` (+ bloc prérempli fiche domaine) → accusé immédiat avec délai 48 h (**email #8**) ; **email #15** reçu par la cave
- [ ] Inbox encaveur `/dashboard/demandes` avec **badge** ; composer une offre (texte, prix, date/heure, échéance) en ≤ 5 min → **email #9** avec lien de paiement tokenisé
- [ ] Paiement de l'offre → réservation confirmée + billet QR émis ; **commission du palier correcte** (Fondateur 0 % vs standard) ; **aucun frais de service** (offre tout compris, décision Sam)
- [ ] Offre non payée : relance **unique** J-1 (**email #10**) puis clôture auto (cron testé) ; demande sans réponse > 24 h = alerte dashboard cave, > 48 h = **email à Sam** (`ADMIN_ALERT_EMAIL`)
- [ ] Fusible documenté : dégradation « formulaire → email » sans toucher au schéma (livrer L-090 + #8/#15 seuls, différer offre/paiement in-app)
- [ ] Flag `REQUESTS` OFF = `/sur-mesure` 404, bloc fiche masqué, item nav absent, actions `NOT_FOUND`/`FORBIDDEN`, jobs non claimés, page offre 404 ; **e2e existants verts flag OFF sans modification**
- [ ] Socle transverse §3 : lint · format · i18n ×3 · `test:run` · e2e existants verts ; migration **additive** relue (`prisma migrate diff`) ; chaque server action testée unauthorized/validation/happy ; commission sur prix total testée aux deux paliers ; aucun secret/`console.log`/`as any`/`!`

## 5. Découpage technique

**1. Migration additive unique** (`prisma migrate diff` relu, 100 % additive) :

- `Experience.isCustom Boolean @default(false)` (marqueur expérience cachée).
- `RequestOffer` : `scheduledDate DateTime? @db.Date`, `scheduledStartTime String?` (date/heure confirmées → `Booking.date`/`timeSlot`), `accessTokenHash String?` (+ `@@index`) pour le lien de paiement tokenisé. `bookingId` reste `String?` **sans FK** (blast minimal — écrit une fois à la confirmation).
- `env.ts` : `ADMIN_ALERT_EMAIL` (optional, validé Zod).

**2. Libs & helpers** :

- `generateRequestReference()` → `REQ-${createId().slice(0,8).toUpperCase()}` (miroir de `generateBookingReference`, `checkout.ts:158`).
- `offer-transitions.ts` : `canTransitionRequestOffer`/`assertRequestOfferTransition` (`SENT→PAID|EXPIRED|WITHDRAWN`) — jumeau de `request-transitions.ts` (absent aujourd'hui). Les actions **valident toute transition** via ces helpers, jamais d'écriture directe de `status`.
- `getOrCreateSurMesureExperience(wineryId)` (service) : upsert DRAFT `isCustom` (cf. §2).
- `rate-limit.service.ts` : `REQUEST_RATE_LIMIT` (public form, ~5/h façon `WINE_ORDER_RATE_LIMIT`) ; l'offer-checkout réutilise `BOOKING_RATE_LIMIT`.

**3. Validators** (`src/lib/validators/request.ts`, Zod v4, `safeParse` only) : `createRequestSchema` (wineryId **requis**, clientEmail/Name/Phone, desiredDate?, guestCount, budget?, description bornée), `composeOfferSchema` (message, `totalPrice` cents borné, `scheduledDate`, `scheduledStartTime`, durée de validité → `expiresAt`). Convention 2-schémas (serveur + form client) comme `validators/giftCard.ts`.

**4. Server actions** (`src/server/actions/request.ts`, `'use server'`, retour `ActionResult`) :

- `createRequestAction` — public, **flag `REQUESTS`** (sinon `NOT_FOUND`), `getClientIp`+`checkRateLimit`, `safeParse`, garde cave `VERIFIED`+Stripe onboarding → crée `Request` (PENDING) → emails **#8** (client, `Request.locale`) + **#15** (cave, `preferredLocale`) via le fan-out « email cave = livrable, échec ⇒ escalade » (modèle `sendWineOrderRequestEmails`) → arme job `REQUEST_SLA_ESCALATION` (runAt = +48 h).
- `composeRequestOfferAction` — auth **WINEMAKER**, **tenant-check** (`request.wineryId === own winery`), flag → crée `RequestOffer` (SENT, mint token → `accessTokenHash`), `Request` PENDING→OFFERED (`assertRequestTransition`) → **email #9** (client, lien `/sur-mesure/offre/{token}`) → arme jobs `REQUEST_OFFER_REMINDER` (runAt = `expiresAt − 24h`) + `REQUEST_OFFER_EXPIRY` (runAt = `expiresAt`) → **annule** `REQUEST_SLA_ESCALATION` (répondu). Une offre active/demande.
- `createRequestOfferCheckout` — public + rate-limité (offre atteinte par le lien tokenisé) : charge l'offre par `accessTokenHash`, assert `status === SENT` && `expiresAt > now`, `getOrCreateSurMesureExperience` → **crée la résa `PENDING_PAYMENT` directement** (pas de hold/capacité — §6) avec `totalPrice = offer.totalPrice`, `platformFee = computeCommissionCents(total, getEffectiveCommissionRate(winery, getPlatformCommissionRate()))`, `serviceFeeCents = 0`, `wineryPayout = total − platformFee`, `cancellationPolicy = winery.cancellationPolicy` (snapshot requis pour le refund), visiteur/locale depuis `Request` → **session Stripe** façon branche non-gift destination-charge (`checkout.ts:949-963`) : 1 line item `unit_amount=total, qty 1`, `application_fee_amount=platformFee` (omis si 0), `transfer_data.destination=stripeAccountId`, `metadata={kind:'request_offer', bookingId, requestOfferId}` → persiste `session.id` sur booking + offre.

**5. Webhook** (`src/app/api/webhooks/stripe/checkout/route.ts::handleCheckoutCompleted`) : **nouvelle branche avant le chemin booking par défaut** —
`if (session.metadata?.kind === 'request_offer') { const { result } = await confirmBookingFromPaidCheckoutSession(session, 'webhook'); if (result === 'confirmed' || result === 'already_confirmed') await flipRequestOfferPaid(requestOfferId); return; }`.
`confirmBookingFromPaidCheckoutSession` **réutilisé verbatim** (mint accessToken, transition atomique `updateMany` idempotente, emails). `flipRequestOfferPaid` : `RequestOffer` SENT→PAID + `Request` OFFERED→PAID (`updateMany` gardés `where status`, idempotents au rejeu, via `assertRequestTransition`) + stampe `offer.bookingId` + passe les jobs reminder/expiry restants à `CANCELLED`. Idempotence webhook = `StripeEvent` (inchangée). `checkout.session.expired` réutilise `handleCheckoutExpired` (supprime la résa `PENDING` par `metadata.bookingId` ; l'offre reste `SENT`, re-payable jusqu'à `expiresAt`).

**6. Jobs** (`JOB_REGISTRY` de `process-scheduled-jobs/route.ts` — 3 entrées, `type+flag+handler` inséparables, **aucun nouveau cron**) :

- `REQUEST_OFFER_REMINDER` (flag `REQUESTS`) : si offre `SENT` && non expirée && `reminderSentAt == null` → **email #10** (relance unique, client), stampe `reminderSentAt` ; sinon `{ok:false, skipReason}`.
- `REQUEST_OFFER_EXPIRY` : si offre `SENT` → offre→EXPIRED + `Request` OFFERED→EXPIRED + `closedAt` (clôture) ; si déjà PAID → skip.
- `REQUEST_SLA_ESCALATION` : si `Request` toujours `PENDING` (aucune offre) → email à `ADMIN_ALERT_EMAIL` ; sinon skip. Handlers idempotents, re-lecture fraîche (modèle `processTastingRecapJob`).

**7. Queries** (`src/server/queries/request.queries.ts`, `React.cache`, DTO, tenant-gate) : `getWineryRequests` (inbox), `getRequestDetail`, `getPendingRequestCount` (badge — `unstable_cache` + tag, invalidé sur changement d'état), `getUnansweredRequestsOlderThan24h` (alerte), `getRequestOfferByToken` (page paiement, read-only), `getClientRequests` (L-095 Should). Invalidation : nouveau tag `'requests'` revalidé dans chaque action.

**8. Emails** (`src/emails/translations.ts` blocs **accentués** modèle `manualRefund` + templates `src/emails/templates/`, subjects ×3 locales) : `RequestSubmittedEmail` (#8, `Request.locale`), `RequestNewCustomEmail` (#15, cave), `RequestOfferReceivedEmail` (#9, client, CTA paiement `EmailButton`), `RequestOfferExpiringEmail` (#10, client), `RequestSlaEscalationEmail` (Sam, FR). Layout `EmailLayout` + `unsubscribeUrl` tokenisé. Enregistrer dans `src/emails/index.ts`.

**9. UI** (mobile-first, états loading/empty/error, i18n ×3, `loading.tsx`/`error.tsx` par segment) :

- `/sur-mesure` (public, `setRequestLocale`, flag OFF→`notFound`) : formulaire RHF + `zodResolver` (modèle `GiftCardConfigurator`), sélecteur de cave requis. `metadata` noindex.
- Bloc `SurMesureBlock` (îlot client) injecté dans `wineries/[slug]/page.tsx` (gaté `isFlagEnabled('REQUESTS')` dans le `Promise.all` existant, ISR préservée) — colonne gauche après « À propos ».
- `/sur-mesure/offre/[token]` (public) : récap offre + « Payer » → `createRequestOfferCheckout`.
- `/dashboard/demandes` (WINEMAKER, flag OFF→`notFound`) : liste + détail + `ComposeOfferForm`. Item nav gaté injecté dans `DashboardSidebar` (modèle `winesLink` + prop `showRequests` résolue au layout) avec **badge** (`getPendingRequestCount`).
- `RequestsAlertBanner` (dashboard) : modèle `TastingSheetAlertBanner`, renvoie `null` si flag OFF ou 0.
- `/dashboard/mes-demandes` (CLIENT, **Should**) + item `ClientDashboardSidebar`.
- Filtre **L1** `isCustom:false` sur `ExperiencesContent.tsx` (grille + 3 counts) ; décider **L2**.

**10. i18n** : namespace `surMesure` (formulaire + bloc fiche), namespace `requests`/`demandes` (inbox/compose), `nav.requests`, `clientDashboard.nav.myRequests`, `metadata.*`. Emails hors `messages/*.json` (dans `translations.ts`). `npm run i18n:check` vert (DE réel, pas des copies FR).

## 6. Tests & mesures

- **Unit** : `request-transitions` + `offer-transitions` (autorisées/interdites/terminales) ; validators ; `createRequestAction` (flag OFF `NOT_FOUND` / validation / rate-limit / happy) ; `composeRequestOfferAction` (unauthorized / non-propriétaire tenant / mauvais statut / happy) ; `createRequestOfferCheckout` (offre expirée / déjà payée / happy) ; **commission sur prix total** Fondateur 0 % vs standard (cents integer) ; handlers des 3 jobs (skip/dedup/flag OFF non claimé).
- **DB-gated** (`skipIf(!INVARIANTS_DATABASE_URL)`) : flip offre/demande→PAID **idempotent** au rejeu webhook ; résa sur-mesure **bypasse la capacité** (aucune occurrence) ; **expérience cachée exclue du catalogue** (assert `getPubliclyVisibleWineries`/recherche n'incluent pas `isCustom` DRAFT) ; L1 exclut l'expérience cachée de la grille + compteurs.
- **Flag OFF** : e2e checkout/booking existants verts sans modification ; `/sur-mesure` 404 ; item nav absent.
- **Scénario manuel Sam** : activer `REQUESTS` (admin, < 1 min) → `/sur-mesure` (choisir une cave) → **#8** + cave **#15** → `/dashboard/demandes` composer offre (prix, date/heure, validité) ≤ 5 min → **#9** → payer (carte test) → **billet QR + résa CONFIRMED** visible dans scan/calendrier → offre/demande PAID → vérifier commission (Fondateur vs standard) dans Earnings → avancer `expiresAt−24h` + drainer `process-scheduled-jobs` (Bearer `CRON_SECRET`) → **#10** → avancer `expiresAt` + drainer → EXPIRED/clôture → laisser une demande 48 h sans réponse + drainer → **email Sam** → flag OFF → `/sur-mesure` 404.
- **Revue** : `/code-review high` + **`/security-review`** (💰) — isolation tenant (offre d'une cave sur la demande d'une autre refusée), commission/money-routing (destination charge, refund `reverse_transfer`), idempotence webhook/jobs, tokens hashés, rate limits publics.

## 7. Risques & rollback

- **Fuite de l'expérience cachée** dans une surface publique → mitigation : `status=DRAFT` couvre tout sauf L1/L2 (checklist §2), test DB d'exclusion catalogue bloquant.
- **Money-routing offre → cave** (prix arbitraire) → destination charge standard `application_fee=commission`, refund via `reverse_transfer:true`+`refund_application_fee:true` (chemin existant, snapshot `cancellationPolicy` requis). `/security-review` + scénario Stripe-test.
- **Double flip / double email au rejeu webhook** → `updateMany` gardés `where status` + handlers idempotents + `StripeEvent`.
- **Écart DoD « fee »** : décision Sam = offre tout compris, `serviceFeeCents=0` → la ligne DoD se lit « commission du palier correcte, pas de frais sur le sur-mesure ». Consigné, non un manque.
- **Fusible (delivery plan)** : si dérive, livrer L-090 + #8/#15 seuls (formulaire → email, offre/paiement manuels hors app) — aucun changement de schéma requis.
- **Rollback** : flag `REQUESTS` OFF < 1 min (toggle admin, cache 60 s) → surfaces 404, actions `NOT_FOUND`, jobs non drainés (restent `PENDING`, réversibles). Migration 100 % additive → revert PR sans perte ; demandes/offres créées survivent.

## 8. Décisions (tranchées)

- [x] **Rattachement billet = expérience cachée par cave** (`Experience.isCustom`, Option A) — agent Plan, blast minimal, réutilisation totale.
- [x] **Aucun frais de service sur l'offre** (offre tout compris ; commission du palier seule) — Sam.
- [x] **Cave obligatoire au launch** (« laissez EnCave proposer » reporté, schéma prêt) — Sam.
- [x] **Escalade > 48 h = email à Sam** (`ADMIN_ALERT_EMAIL` + job `REQUEST_SLA_ESCALATION`) — Sam.
- [x] **Booking créé au paiement** (pas à la composition) — pas de résa fantôme, capacité intacte.
- [x] **Lien de paiement tokenisé** (`RequestOffer.accessTokenHash`) — non devinable, modèle P-07.
- [ ] **L2** (dropdown filtre résas) : filtrer ou garder l'entrée « Sur-mesure » — à trancher au BUILD (cosmétique).
- [ ] **Routes** : `/dashboard/demandes` (feuille FR, précédent `bons-cadeaux`) confirmé ; `/dashboard/mes-demandes` (client, Should) — `/compte/*` reste hors scope (épic de renommage dédié).
