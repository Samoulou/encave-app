# P-14 — Auth V3

> **Statut** : plan · **Branche** (à la build) : `claude/p-14-auth-v3` (fallback sans Linear) · **PR** : #
> **Sources** : `docs/ENCAVE-V3-DELIVERY-PLAN.md` §P-14 · items `L-150→L-155` (backlog E12) · specs `docs/v3/ENCAVE-V3-PAGES-EMAILS.md` §3 (email #11), `docs/v3/ENCAVE-V3-PRD.md` §7

## Contexte (pourquoi ce package)

L'auth V2 est incomplète et bloque le launch : le « mot de passe oublié » est un **`mailto:support@encave.ch`** (`LoginForm.tsx:179-185`), il n'y a **aucun login par code**, **aucun changement de mot de passe/email self-service**, **aucun TOTP admin**, et les sessions durent 7 j pour tout le monde (l'encaveur en cave doit se reconnecter sans arrêt). better-auth 1.4.17 est en place mais **sans aucun plugin** (`src/server/better-auth.ts:78-142`, `src/lib/auth-client.ts` = `createAuthClient()` nu) ; les plugins `emailOTP` et `twoFactor` sont installés mais non câblés. Les templates email `PasswordResetEmail`/`EmailVerificationEmail` + leurs senders existent **mais sont du code mort** (jamais appelés). Les constantes `AUTH_RATE_LIMIT`/`REGISTRATION_RATE_LIMIT` (`rate-limit.service.ts:224-232`) existent **mais ne sont câblées nulle part**. P-14 met tout ça en service : OTP (login + reset), self-service mot de passe/email, TOTP admin obligatoire, sessions par rôle, rate limits réels, retrait d'Apple, et la voie d'invitation fondateur.

## Décisions produit (tranchées 2026-07-15)

- **D-Invitation → INCLUS** dans P-14 (L-154, `/invitation/[token]` → compte + cave VERIFIED FOUNDER 0 % sautant la file). Budget assumé ~12-13 h (au-dessus des 9 h nominales).
- **D-RateLimit → base de données** : better-auth `rateLimit.storage: 'database'` + modèle `RateLimit` (migration additive) → limites persistantes entre instances Vercel.
- **D-2FA → ADMIN uniquement** (obligatoire, setup forcé). Pas de 2FA optionnelle encaveur/client.
- **D-Sessions → 90 j encaveur / 30 j client / 7 j admin** via `databaseHooks.session.create.before` (refresh glissant `updateAge` 24 h).
- **D-Apple → RETRAIT** (D5 pré-tranché) : Google + OTP suffisent au launch.

## 1. Objectif

Après merge : un utilisateur peut se connecter **par code OTP** (« Recevoir un code », 6 chiffres, 15 min) ou par mot de passe, **réinitialiser son mot de passe par OTP** (fini le mailto), **changer son mot de passe et son email** en self-service (client + encaveur) ; un **ADMIN sans TOTP** est forcé au setup au login ; les **sessions durent par rôle** (encaveur 90 j) ; les **rate limits auth/inscription sont actifs** (persistants) ; et un **lien d'invitation fondateur** crée un compte + une cave VERIFIED sans passer par la file de validation.

## 2. Scope

**IN** :
- Plugins `emailOTP` + `twoFactor` (server + client) ; retrait d'Apple.
- Login OTP + page `/forgot-password` (email → OTP → nouveau mot de passe).
- Sections self-service **changement de mot de passe + email** (client `/dashboard/profile` + encaveur `/dashboard/settings/account`).
- TOTP **admin** : setup (QR + codes de secours), vérif au login, **enforcement** dans le layout admin.
- Sessions par rôle (databaseHook) ; `rateLimit.customRules` + storage DB (modèle `RateLimit`).
- Email #11 OTP (template + subject + sender).
- Invitation fondateur : modèle `Invitation`, génération admin, page `/invitation/[token]`, provisioning cave VERIFIED FOUNDER.
- Migration additive ; i18n fr/de/en ; états loading/empty/error ; tests actions + e2e.

**OUT (explicitement)** :
- Vérification d'email à l'inscription (`requireEmailVerification` reste OFF — l'inscription auto-login inchangée ; changer ça = comportement séparé).
- 2FA optionnelle encaveur/client, magic link, SMS/phone 2FA (plugins présents, non demandés).
- Auto-attribution « 20 premières caves → FOUNDER » (l'invitation pose `plan=FOUNDER` explicitement ; l'auto reste manuel via `setWineryPlan`).

## 3. Definition of Done (gate — copiée du delivery plan + additions)

- [ ] « Recevoir un code » : OTP 6 chiffres, 15 min, **login e2e complet** ; « mot de passe oublié » → OTP (plus de mailto)
- [ ] Changement de mot de passe **et** d'email self-service (client + encaveur)
- [ ] Compte ADMIN sans TOTP → **setup forcé au login** ; admin avec TOTP e2e
- [ ] Session encaveur ~90 j (re-login uniquement au changement d'appareil) ; **rate limits auth/registration actifs** (persistants)
- [ ] Invitation fondateur `/invitation/[token]` : compte + cave VERIFIED sans file
- [ ] **Additions** : Apple retiré ; `storeOTP: 'hashed'` ; `changePassword` masqué pour comptes OAuth-only ; migration additive relue
- [ ] Socle transverse : lint / format / i18n (3 locales) / `test:run` / e2e verts ; aucun `console.log`/`as any`/`!`

## 4. Découpage technique (ordonné — chaque étape compile vert avant la suivante)

**1 — Migration additive** `prisma/migrations/20260715140000_p14_auth_v3/` (SQL à la main, pas de `better-auth generate`) :
- `User` : `twoFactorEnabled Boolean @default(false)` (+ relation `twoFactor TwoFactor?`).
- `model TwoFactor { id, secret String, backupCodes String, userId String FK onDelete:Cascade, @@index([userId]), @@map("two_factors") }` (colonnes confirmées dans `node_modules/better-auth/dist/plugins/two-factor/schema.d.mts`).
- `model Invitation { id, email, tokenHash String @unique, wineryName String?, invitedBy, acceptedAt?, acceptedUserId?, expiresAt, createdAt, @@index([email]), @@map("invitations") }`.
- `model RateLimit { … }` selon le schéma attendu par better-auth `rateLimit.storage:'database'` (confirmer les colonnes `key`/`count`/`lastRequest` dans les types better-auth). `emailOTP` réutilise la table `verifications` existante (aucun champ).

**2 — Server config** `src/server/better-auth.ts` :
- `import { emailOTP, twoFactor } from 'better-auth/plugins'`.
- `plugins: [ emailOTP({ otpLength: 6, expiresIn: 60*15, storeOTP: 'hashed', sendVerificationOTP }), twoFactor({ issuer: 'EnCave', totpOptions: { digits: 6, period: 30 }, skipVerificationOnEnable: false }) ]`.
- `sendVerificationOTP({ email, otp, type })` : résoudre `preferredLocale` (`db.user.findUnique`), puis `await sendOtpEmail(email, otp, type, locale)` (étape 3). **await** (garantie de livraison serverless — décision D-C par défaut).
- `user.changeEmail: { enabled: true, sendChangeEmailConfirmation }` → câble le sender mort `sendEmailVerificationEmail`.
- `databaseHooks.session.create.before(session)` : lookup `role` → `expiresAt` = now + 90 j (WINEMAKER) / 30 j (CLIENT) / 7 j (ADMIN). Garder `session.expiresIn: 7d` + `updateAge: 24h` comme défaut/refresh. Cookie inchangé → middleware intact.
- `rateLimit: { enabled: !E2E_TEST, window:60, max:10, storage:'database', modelName:'rateLimit', customRules: { '/sign-in/email':{window:900,max:5}, '/sign-in/email-otp':{window:900,max:5}, '/sign-up/email':{window:3600,max:3}, '/email-otp/send-verification-otp':{window:900,max:5}, '/two-factor/verify-totp':{window:900,max:10} } }` (valeurs = `AUTH_RATE_LIMIT`/`REGISTRATION_RATE_LIMIT`).
- **Retrait Apple** : supprimer le bloc `apple` de `getSocialProviders()` (L64-69) + `'apple'` de `accountLinking.trustedProviders` (L132) ; retirer `APPLE_CLIENT_ID/SECRET` de `src/lib/env.ts`.

**3 — Email #11 OTP** : `src/emails/templates/OtpEmail.tsx` (calqué sur `PasswordResetEmail.tsx`, prop `purpose`), export dans `src/emails/index.ts`, `subjects.otpCode` + bloc `otp` dans `src/emails/translations.ts` (fr/de/en), `sendOtpEmail(email, otp, purpose, locale?)` dans `email.service.ts` (patron `sendPasswordResetEmail:368`).

**4 — Client config** `src/lib/auth-client.ts` : `plugins: [emailOTPClient(), twoFactorClient({ onTwoFactorRedirect: () => { window.location.href = '/login/2fa' } })]`. Exporter les nouvelles méthodes : `signIn.emailOtp`, `emailOtp.sendVerificationOtp`, `emailOtp.resetPassword`, `twoFactor.enable/verifyTotp/disable/generateBackupCodes/verifyBackupCode`, `changeEmail`, `changePassword`.

**5 — Session shape** `src/server/auth.ts` : ajouter `twoFactorEnabled: boolean` à l'interface `Session['user']` + le lire depuis `session.user` (booléen natif, **pas** de cast comme role/locale). Évite une requête dans le gate admin.

**6 — Login OTP + forgot-password** :
- `LoginForm.tsx` : toggle `password | otp` ; en mode OTP → email → « Recevoir un code » (`emailOtp.sendVerificationOtp({type:'sign-in'})`) → input 6 chiffres → `signIn.emailOtp`. Extraire le chemin OTP dans `src/components/features/auth/OtpLoginForm.tsx`. Réutiliser la redirection par rôle existante.
- Remplacer le `mailto:` (L179-185) par `<Link href="/forgot-password">`.
- `src/app/[locale]/(auth)/forgot-password/page.tsx` + `ForgotPasswordForm.tsx` (3 états : email → OTP → nouveau mot de passe ; `sendVerificationOtp({type:'forget-password'})` puis `emailOtp.resetPassword`).

**7 — Changement mot de passe + email (client + encaveur)** :
- `src/components/features/auth/ChangePasswordSection.tsx` + `ChangeEmailSection.tsx` (calqués sur `DeleteAccountSection.tsx` : section + `useTransition` + bannière résultat). `changePassword` **masqué** pour comptes sans credential (prop dérivée d'un check serveur `Account.providerId='credential'`).
- Montage client : `src/app/[locale]/(protected)/dashboard/profile/page.tsx` (à côté de `DeleteAccountSection`).
- Montage encaveur : nouvelle sous-page `src/app/[locale]/(protected)/dashboard/settings/account/page.tsx` + carte depuis `settings/page.tsx` (patron hub de cartes).

**8 — TOTP admin (setup + vérif login)** :
- `src/components/features/auth/TotpSetupSection.tsx` : mot de passe → `twoFactor.enable` → rendre `totpURI` en QR (réutiliser `src/server/services/qr-code.service.ts` pour un PNG data-URL depuis l'`otpauth://` — pas de nouvelle dépendance) + afficher les `backupCodes` → confirmer par `verifyTotp` (bascule `twoFactorEnabled`). **Monté uniquement** sur la page setup admin (2FA admin-only).
- Vérif login : `src/app/[locale]/(auth)/login/2fa/page.tsx` + `TwoFactorVerifyForm.tsx` (6 chiffres → `verifyTotp` ; « code de secours » → `verifyBackupCode`). Atteignable en état 2FA-pending (cookie `better-auth.two_factor` seulement).

**9 — Enforcement admin** `src/app/[locale]/admin/layout.tsx` : après le check rôle, `if (!session.user.twoFactorEnabled) redirect('/{locale}/admin-setup/2fa')`. Page setup **hors** layout admin (sinon boucle) : `src/app/[locale]/(protected)/admin-setup/2fa/page.tsx` (gardée session + rôle ADMIN + `!twoFactorEnabled`), rend `TotpSetupSection`, succès → `/admin`.

**10 — Invitation fondateur (L-154)** :
- `src/server/actions/invitation.ts` : `createFounderInvitation({ email, wineryName? })` (`requireAdmin()`, token `randomBytes(32).hex`, stocker `hashToken(token)` via `src/lib/utils/token.ts`, expiry 7 j, retourner l'URL `/invitation/{token}`). `provisionFounderWinery({ token, wineryName })` : re-valider (hash, non expiré, non accepté) ; `$transaction` : `Winery` (`status:'VERIFIED'`, `plan:'FOUNDER'`, `commissionRate:0`, `verifiedAt`, `verifiedBy`, slug via `ensureUniqueSlug`) + rôle `WINEMAKER` + `Invitation.acceptedAt/acceptedUserId` + `VerificationLog(APPROVED)`.
- Admin : `src/app/[locale]/admin/invitations/page.tsx` (form générer + copier le lien ; entrée nav) — UX minimale (décision D-D).
- Accept : `src/app/[locale]/invitation/[token]/page.tsx` (server : valider → form ou état expiré/consommé) + `InvitationAcceptForm.tsx` : **deux appels** — `authClient.signUp.email({email préremplie, name, password})` (pose le cookie + crée le compte credential via bcrypt) **puis** `provisionFounderWinery`. Page top-level → son propre `NextIntlClientProvider` (namespaces `invitation` + `auth`).

**11 — i18n ×3 + namespaces** : toutes les chaînes client en fr/de/en (le guard `IntlError` des e2e casse sur toute clé manquante). OTP login/forgot → namespace `auth` (déjà servi au groupe `(auth)`). Change-password/email → namespace à câbler dans les extras du layout `(protected)/dashboard` + `tests/unit/i18n/client-namespaces.test.ts`. Invitation → namespace dans son provider.

**12 — Tests + socle** : voir §5.

## 5. Tests & mesures

- **Actions** (mock auth/db, patron `wine.test.ts`) : `createFounderInvitation`/`provisionFounderWinery` (unauthorized / expiré / déjà consommé / happy) ; hook session 90j WINEMAKER vs 30j/7j ; `sendOtpEmail` ; wiring `sendChangeEmailConfirmation`.
- **E2E** (POMs `tests/e2e/pages/auth.page.ts` + `auth.fixture.ts`) : login OTP complet ; forgot-password → OTP → reset ; admin sans TOTP → setup forcé ; admin avec TOTP → vérif ; changement mot de passe/email encaveur. Lancer les specs OTP/2FA avec `E2E_TEST=true` (rate limits désactivés) ; OTP déterministe en e2e via override `generateOTP` gated `E2E_TEST` ou lecture de l'endpoint `getVerificationOTP`.
- **i18n** : `client-namespaces.test.ts` mis à jour ; `npm run i18n:check` vert.
- **Mesures** : lint/format/tsc verts ; migration additive relue (`prisma migrate diff`).

## 6. Risques & rollback

- **R-1 (bloquant) — storage rate limit.** Défaut better-auth = mémoire (par instance Vercel). D-RateLimit tranché = `storage:'database'` + modèle `RateLimit` → confirmer les colonnes attendues dans les types better-auth avant la migration.
- **R-2 — `emailVerified=false` majoritaire.** `changeEmail` sur email non vérifié met à jour **immédiatement** (better-auth ne protège que l'email vérifié) ; `signIn.emailOtp` et `resetPassword` passent `emailVerified=true`. Documenter ce comportement.
- **R-3 — comptes OAuth-only (Google) sans mot de passe.** `changePassword` échoue → masquer la section pour `providerId != 'credential'`. `emailOtp.resetPassword` **ajoute** un mot de passe (acceptable).
- **R-4 — résolution du modèle twoFactor.** Le modèle Prisma `TwoFactor` doit mapper le modèle interne `twoFactor` du plugin ; sinon épingler via `twoFactor({ schema: { twoFactor: { modelName: 'TwoFactor' } } })`. Vérifier en exerçant `enable` bout-en-bout.
- **R-5 — boucle de redirection admin.** La page setup TOTP admin **doit** être hors `admin/layout.tsx` (étape 9).
- **R-6 — cookie 2FA-pending vs middleware.** Le middleware ne lit que `better-auth.session_token` → un user 2FA-pending reste « non connecté » et ne peut pas atteindre `/dashboard` ; vérifier que `/login/2fa` est atteignable.
- **R-7 — guard i18n e2e.** Toute clé manquante (3 locales) casse les e2e ; câbler les nouveaux namespaces protected dans les extras **et** le test statique.
- **R-8 — `storeOTP` défaut 'plain'** stocke l'OTP en clair dans `verifications` → forcer `'hashed'`.
- **Rollback** : le socle est additif. En cas de dérive, revert PR. Les plugins peuvent être retirés du tableau `plugins` (la migration reste, inerte). Apple retiré = pas de retour arrière requis (Google + OTP couvrent).

## 6bis. Revue `/code-review high` — findings (2026-07-15)

37 candidats vérifiés. **Corrigés** (commit `fix(p-14): address /code-review high`) :

- **Escalade invitation** (critique) : `provisionFounderWinery` lie désormais la rédemption à l'email invité (l'email de session doit matcher) — un lien fondateur fuité/transféré ne peut plus provisionner une cave VERIFIED FOUNDER sur un autre compte.
- **Concurrence invitation** : consume CAS (`updateMany where acceptedAt null`) dans la transaction.
- **Signup silencieux OTP** : `emailOTP({ disableSignUp: true })` — le login par code ne crée plus de compte pour un email inconnu/mal saisi.
- **Invitation compte existant** : fallback `signIn` (était bloqué) ; corrige aussi l'orphelin non-atomique.
- **Gate Coming-Soon** : `/invitation/[token]` autorisé pré-launch.
- **Lockout admin OAuth** : `AdminSecuritySetup` fait définir un mot de passe par OTP avant l'enrôlement TOTP (qui en exige un).
- **Admin layout** : une seule lecture user (suspendedAt + twoFactorEnabled).

**⚠️ Gaps connus à traiter AVANT `dev` → `main`** (nécessitent un test en preview ou une décision produit — non corrigés ici) :

- **G-1 (HAUT) — Bypass MFA admin via social + email-OTP.** Le hook `after` du plugin `twoFactor` ne matche que `/sign-in/email` (vérifié dans `node_modules`) : un admin 2FA-enrôlé qui se connecte via **Google** ou **code OTP** n'est **pas** challengé → il entre dans `/admin` sans TOTP. Le gate admin ne vérifie que l'enrôlement, pas la vérif 2FA de la session. **Fix** : hook `after` custom mirroring le built-in pour `/sign-in/email-otp` + callback social, OU restreindre le login admin au mot de passe. À implémenter + **tester en preview** (risqué à faire à l'aveugle).
- **G-2 (MOYEN) — `changeEmail` instantané pour comptes non vérifiés.** better-auth n'envoie la confirmation que si l'email courant est vérifié ; or `emailVerified=false` par défaut. Un porteur de session peut changer l'email sans notification à l'ancienne adresse. **Fix** : activer la vérification d'email à l'inscription (hors scope P-14) ou notifier l'ancienne adresse.
- **G-3 (FAIBLE, documenté) — Cap de session par rôle uniquement au login.** Le refresh `updateAge` remet `expiresAt` au global 90 j : le cap admin 7 j ne borne pas une session active. Mitigé par TOTP obligatoire (lui-même affaibli par G-1) + re-check suspension live.

## 7. Décisions ouvertes (défauts proposés, non bloquants)

- [ ] **D-C** `await` dans `sendVerificationOTP` (défaut : **await**, garantie livraison serverless).
- [ ] **D-D** UX admin invitation : form générer + copier (défaut, minimal) vs liste/gestion des invitations.
- [ ] **D-E** email changeEmail : réutiliser `EmailVerificationEmail` mort (défaut) vs template dédié.
- [ ] Colonnes exactes du modèle `RateLimit` : à confirmer dans les types better-auth au démarrage de la build.

## 8. Vérification (bout-en-bout, à la build)

1. **Login OTP (DoD 1)** : login → « Recevoir un code » → email #11 reçu (6 chiffres) → saisie → session ouverte (e2e).
2. **Reset OTP (DoD 1)** : `/forgot-password` → OTP → nouveau mot de passe → login OK ; le `mailto:` a disparu.
3. **Self-service (DoD 2)** : client `/dashboard/profile` + encaveur `/dashboard/settings/account` → changer mot de passe (revoke autres sessions) + email (confirmation).
4. **TOTP admin (DoD 3)** : admin sans TOTP → login mot de passe → **redirigé setup** → QR + codes → confirmé ; re-login → écran vérif 2FA → `/admin`.
5. **Sessions (DoD 4)** : vérifier `expiresAt` d'une session encaveur ≈ 90 j, client ≈ 30 j, admin ≈ 7 j.
6. **Rate limits (DoD 4)** : 6ᵉ login raté en < 15 min → 429 ; 4ᵉ inscription en < 1 h → 429 (mode non-E2E).
7. **Invitation (DoD 5)** : admin génère `/invitation/[token]` → ouvrir → créer compte → cave VERIFIED FOUNDER 0 %, pas de file d'attente.
8. **Socle** : `npm run lint` · `format:check` · `i18n:check` · `test:run` · `test:e2e` verts.

> **Note budget** : périmètre Must + L-154 ≈ 12-13 h (au-dessus des 9 h nominales — assumé). Item le plus lourd après l'invitation : l'UX setup TOTP (QR + codes de secours + boucle de confirmation) — ne pas sous-estimer.
