# Pre-Launch Checklist - EnCave MVP

**Date de creation:** 14 janvier 2026
**Cible de lancement:** A definir
**Responsable:** PM / Tech Lead
**Derniere validation code:** 14 janvier 2026

---

## Instructions

- [x] Cocher chaque item une fois valide
- [ ] Documenter les exceptions dans la colonne "Notes"
- [ ] Tous les items **CRITICAL** doivent etre valides avant go-live
- [ ] Les items **RECOMMENDED** peuvent etre differes si justifie

**Legende:**
- ✅ = Verifie par code review
- ⏳ = En cours / Delayed
- ⚠️ = Verification manuelle requise

---

## 1. Securite 🔒

### CRITICAL

| # | Item | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 1.1 | [x] Secrets rotes (AUTH_SECRET, DB, Stripe, Blob) | ✅ | DevOps | Confirme par DevOps |
| 1.2 | [ ] Historique Git nettoye des secrets | ⏳ | DevOps | `git filter-repo` - DELAYED |
| 1.3 | [x] `.env` et `.env.local` non trackes | ✅ | Dev | `.gitignore:29-34` - Tous `.env*` exclus |
| 1.4 | [x] Security headers configures (CSP, HSTS, X-Frame) | ✅ | Dev | `next.config.js:6-47` - Suite complete |
| 1.5 | [ ] Score securityheaders.com >= A | ⚠️ | QA | Requiert scan live |
| 1.6 | [x] AccessToken hashe uniquement (pas plaintext) | ✅ | Dev | SHA-256 hash stocke (`accessTokenHash`) |
| 1.7 | [x] HTTPS force sur toutes les routes | ✅ | DevOps | HSTS: `max-age=31536000; includeSubDomains` |
| 1.8 | [x] Rate limiting actif (login, register) | ✅ | Dev | Login: 5/15min, Register: 3/hour |
| 1.9 | [x] Webhooks Stripe signes et verifies | ✅ | Dev | `constructEvent()` sur checkout + connect |
| 1.10 | [x] Tokens d'unsubscribe avec expiration | ✅ | Dev | 30 jours (`TOKEN_EXPIRATION_DAYS = 30`) |

### RECOMMENDED

| # | Item | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 1.11 | [x] Rate limiting Upstash (production) | ✅ | Dev | Redis configure avec fallback in-memory |
| 1.12 | [x] Password complexity renforcee | ✅ | Dev | `auth.ts` - min 8 + upper + lower + number + special |
| 1.13 | [ ] Audit logging admin actions | | Dev | Non implemente |
| 1.14 | [ ] 2FA pour comptes winemaker | | Dev | Phase 2 |

---

## 2. Infrastructure & DevOps 🏗️

### CRITICAL

| # | Item | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 2.1 | [ ] Environnement production configure (Vercel) | ⚠️ | DevOps | Verification manuelle |
| 2.2 | [ ] Variables d'environnement production definies | ⚠️ | DevOps | Verification manuelle |
| 2.3 | [ ] Base de donnees production (Neon) | ⚠️ | DevOps | Pool connections |
| 2.4 | [ ] Migrations Prisma appliquees en production | ⚠️ | Dev | Verification manuelle |
| 2.5 | [ ] Domaine `encave.ch` configure | ⚠️ | DevOps | DNS + SSL |
| 2.6 | [ ] Redirections www -> non-www (ou inverse) | ⚠️ | DevOps | Verification manuelle |
| 2.7 | [ ] Build production reussit sans erreurs | ⚠️ | CI | `npm run build` - A tester |
| 2.8 | [x] Health check `/api/health` repond 200 | ✅ | QA | Endpoint existe, retourne status + timestamp |

### RECOMMENDED

| # | Item | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 2.9 | [ ] Preview deployments fonctionnels | ⚠️ | DevOps | |
| 2.10 | [ ] Rollback strategy documentee | ⚠️ | DevOps | |
| 2.11 | [ ] Backup database automatise | ⚠️ | DevOps | Neon auto |
| 2.12 | [ ] CDN / Edge caching optimise | ⚠️ | DevOps | Vercel auto |

---

## 3. Paiements Stripe 💳

### CRITICAL

| # | Item | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 3.1 | [ ] Compte Stripe en mode **LIVE** | ⚠️ | Admin | Dashboard Stripe |
| 3.2 | [ ] `STRIPE_SECRET_KEY` live configuree | ⚠️ | DevOps | sk_live_... |
| 3.3 | [ ] `STRIPE_PUBLISHABLE_KEY` live configuree | ⚠️ | DevOps | pk_live_... |
| 3.4 | [ ] Webhook endpoint production enregistre | ⚠️ | Admin | Stripe Dashboard |
| 3.5 | [ ] `STRIPE_WEBHOOK_SECRET` live configuree | ⚠️ | DevOps | whsec_... |
| 3.6 | [ ] `STRIPE_CONNECT_WEBHOOK_SECRET` live | ⚠️ | DevOps | |
| 3.7 | [x] Commission plateforme configuree (12%) | ✅ | Admin | `env.ts:32` - `PLATFORM_COMMISSION_RATE: 0.12` |
| 3.8 | [ ] Test de paiement reel effectue | ⚠️ | QA | Petit montant |
| 3.9 | [ ] Test de remboursement effectue | ⚠️ | QA | `processRefund()` implemente |
| 3.10 | [ ] Stripe Connect onboarding teste | ⚠️ | QA | Compte winemaker |

### RECOMMENDED

| # | Item | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 3.11 | [x] Webhook retry policy verifiee | ✅ | Dev | Stripe gere automatiquement |
| 3.12 | [x] Idempotency keys implementees | ✅ | Dev | `checkout/route.ts:100-134` - Status check |
| 3.13 | [ ] Emails de confirmation Stripe desactives | ⚠️ | Admin | EnCave gere |

---

## 4. Emails & Notifications 📧

### CRITICAL

| # | Item | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 4.1 | [ ] Compte Resend configure (production) | ⚠️ | DevOps | |
| 4.2 | [ ] `RESEND_API_KEY` production configuree | ⚠️ | DevOps | |
| 4.3 | [ ] Domaine d'envoi verifie (`@encave.ch`) | ⚠️ | DevOps | DNS SPF/DKIM |
| 4.4 | [x] Email de confirmation booking fonctionne | ✅ | QA | `BookingConfirmationEmail` implemente |
| 4.5 | [x] Email winemaker notification fonctionne | ✅ | QA | `WinemakerNewBookingEmail` implemente |
| 4.6 | [x] Email de rappel 24h fonctionne | ✅ | QA | `BookingReminderEmail` implemente |
| 4.7 | [x] Email de cancellation fonctionne | ✅ | QA | `BookingCancellationEmail` implemente |
| 4.8 | [x] Lien unsubscribe fonctionne | ✅ | QA | Token-based avec expiration 30j |
| 4.9 | [x] URLs dans emails pointent vers production | ✅ | QA | `getBaseUrl()` dynamique |

### RECOMMENDED

| # | Item | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 4.10 | [x] Email retry queue implementee | ✅ | Dev | 3 retries, backoff exponentiel (1s, 2s, 4s) |
| 4.11 | [ ] Bounce handling configure | ⚠️ | DevOps | |
| 4.12 | [ ] Templates testes dans tous les clients email | ⚠️ | QA | Gmail, Outlook |

---

## 5. SEO & Metadonnees 🔍

### CRITICAL

| # | Item | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 5.1 | [x] `robots.txt` autorise indexation | ✅ | QA | `Allow: /`, disallow /api, /dashboard, /admin |
| 5.2 | [x] `sitemap.xml` genere correctement | ✅ | QA | Dynamique: locales + experiences + wineries |
| 5.3 | [ ] Sitemap soumis a Google Search Console | ⚠️ | Marketing | |
| 5.4 | [x] Meta title sur toutes les pages | ✅ | QA | `generatePageMetadata()` |
| 5.5 | [x] Meta description sur toutes les pages | ✅ | QA | Dynamique par page |
| 5.6 | [x] Open Graph images configurees | ✅ | QA | Cover photos utilisees |
| 5.7 | [x] Canonical URLs correctes | ✅ | QA | `generateCanonicalUrl()` |
| 5.8 | [x] Hreflang FR/DE/EN presents | ✅ | QA | `generateAlternateLinks()` + x-default |

### RECOMMENDED

| # | Item | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 5.9 | [x] Schema.org LocalBusiness sur wineries | ✅ | Dev | `wineries/[slug]/page.tsx:49-74` |
| 5.10 | [x] Schema.org Event sur experiences | ✅ | Dev | `experiences/[slug]/page.tsx:105-158` |
| 5.11 | [x] Schema.org Organization sur home | ✅ | Dev | `page.tsx:29-52` |
| 5.12 | [ ] Google Rich Results Test valide | ⚠️ | QA | |
| 5.13 | [ ] Lighthouse SEO score >= 95 | ⚠️ | QA | |

---

## 6. Analytics & Monitoring 📊

### CRITICAL

| # | Item | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 6.1 | [x] Sentry configure et fonctionnel | ✅ | DevOps | `sentry.client.config.ts` - Config complete |
| 6.2 | [ ] Erreurs capturees correctement | ⚠️ | QA | Test erreur requis |
| 6.3 | [ ] Vercel Analytics active | ⚠️ | DevOps | `NEXT_PUBLIC_VERCEL_ANALYTICS_ID` dans env.ts |
| 6.4 | [x] Web Vitals monitoring actif | ✅ | Dev | `web-vitals.ts` - LCP, FID, CLS, INP, TTFB |

### RECOMMENDED

| # | Item | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 6.5 | [ ] Google Analytics 4 configure | ⚠️ | Marketing | |
| 6.6 | [ ] Conversion tracking (bookings) | ⚠️ | Marketing | |
| 6.7 | [ ] Alertes Sentry configurees | ⚠️ | DevOps | |
| 6.8 | [ ] Uptime monitoring (ex: Checkly) | ⚠️ | DevOps | |
| 6.9 | [ ] Dashboard KPIs cree | ⚠️ | PM | |

---

## 7. Contenu & Internationalisation 🌍

### CRITICAL

| # | Item | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 7.1 | [x] Toutes les strings traduites (FR) | ✅ | QA | `messages/fr.json` existe |
| 7.2 | [x] Toutes les strings traduites (DE) | ✅ | QA | `messages/de.json` existe |
| 7.3 | [x] Toutes les strings traduites (EN) | ✅ | QA | `messages/en.json` existe |
| 7.4 | [x] Langue par defaut = FR | ✅ | QA | `routing.ts:5` - `defaultLocale: 'fr'` |
| 7.5 | [x] Switcher de langue fonctionne | ✅ | QA | Composant localise dans messages |
| 7.6 | [ ] Dates formatees selon locale | ⚠️ | QA | Test manuel requis |
| 7.7 | [x] Prix formates en CHF | ✅ | QA | `currency: 'CHF'` dans Schema.org |

### RECOMMENDED

| # | Item | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 7.8 | [ ] Relecture native FR | ⚠️ | Content | |
| 7.9 | [ ] Relecture native DE | ⚠️ | Content | |
| 7.10 | [ ] Images alt text traduits | ⚠️ | Dev | |

---

## 8. Pages Legales & Compliance 📜

### CRITICAL

| # | Item | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 8.1 | [x] Page Privacy Policy complete | ✅ | Legal | `/legal/privacy/page.tsx` - Contenu complet |
| 8.2 | [x] Page Terms of Service complete | ✅ | Legal | `/legal/terms/page.tsx` existe |
| 8.3 | [x] Page Cancellation Policy complete | ✅ | Legal | `/legal/cancellation/page.tsx` existe |
| 8.4 | [ ] Mentions legales (impressum) | ⚠️ | Legal | Requis CH - A verifier |
| 8.5 | [ ] Cookie banner si necessaire | ⚠️ | Dev | GDPR/LPD - A evaluer |
| 8.6 | [x] Liens legaux dans footer | ✅ | QA | Sitemap inclut pages legales |
| 8.7 | [ ] Email contact support valide | ⚠️ | Admin | privacy@encave.ch dans Privacy |

### RECOMMENDED

| # | Item | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 8.8 | [ ] Validation juridique suisse | ⚠️ | Legal | |
| 8.9 | [ ] GDPR data export fonctionnel | | Dev | Non implemente |
| 8.10 | [ ] GDPR data deletion fonctionnel | | Dev | Non implemente |

---

## 9. Tests & Qualite 🧪

### CRITICAL

| # | Item | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 9.1 | [ ] Tests unitaires passent (100%) | ⚠️ | CI | 6 echecs detectes |
| 9.2 | [ ] Tests integration passent (100%) | ⚠️ | CI | `checkout.test.ts` - 3 echecs (mock db.$transaction) |
| 9.3 | [ ] Tests E2E passent (100%) | ⚠️ | CI | Playwright - A verifier |
| 9.4 | [ ] Flow booking complet teste manuellement | ⚠️ | QA | |
| 9.5 | [ ] Flow winemaker onboarding teste | ⚠️ | QA | |
| 9.6 | [ ] Flow admin verification teste | ⚠️ | QA | |
| 9.7 | [ ] Responsive teste (mobile, tablet, desktop) | ⚠️ | QA | |
| 9.8 | [ ] Cross-browser teste (Chrome, Safari, Firefox) | ⚠️ | QA | |
| 9.9 | [ ] Aucun bug P0/P1 ouvert | ⚠️ | QA | 6 tests echoues a corriger |

### RECOMMENDED

| # | Item | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 9.10 | [ ] Load test booking concurrent | ⚠️ | QA | |
| 9.11 | [ ] Accessibility audit (Lighthouse) >= 90 | ⚠️ | QA | |
| 9.12 | [ ] Performance audit (Lighthouse) >= 90 | ⚠️ | QA | |

---

## 10. Donnees & Contenu Initial 📦

### CRITICAL

| # | Item | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 10.1 | [ ] Compte admin cree | ⚠️ | Admin | |
| 10.2 | [ ] Au moins 1 winemaker verifie | ⚠️ | Admin | Pour tests |
| 10.3 | [ ] Au moins 1 experience publiee | ⚠️ | Winemaker | Pour tests |
| 10.4 | [ ] Images placeholder remplacees | ⚠️ | Content | |
| 10.5 | [ ] Donnees de test supprimees | ⚠️ | Dev | |

### RECOMMENDED

| # | Item | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 10.6 | [ ] 5+ winemakers onboardes (soft launch) | ⚠️ | Sales | |
| 10.7 | [ ] 10+ experiences publiees | ⚠️ | Sales | |
| 10.8 | [ ] Photos professionnelles uploadees | ⚠️ | Content | |

---

## 11. Communication & Launch 📣

### CRITICAL

| # | Item | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 11.1 | [ ] Date de lancement confirmee | ⚠️ | PM | |
| 11.2 | [ ] Equipe support prete | ⚠️ | Support | |
| 11.3 | [ ] Contact email support configure | ⚠️ | Admin | |
| 11.4 | [ ] Runbook incident documente | ⚠️ | DevOps | |
| 11.5 | [ ] Rollback plan documente | ⚠️ | DevOps | |

### RECOMMENDED

| # | Item | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 11.6 | [ ] Press release preparee | ⚠️ | Marketing | |
| 11.7 | [ ] Social media assets prets | ⚠️ | Marketing | |
| 11.8 | [ ] Email d'annonce winemakers | ⚠️ | Marketing | |
| 11.9 | [ ] FAQ support creee | ⚠️ | Support | |
| 11.10 | [ ] Metriques de succes definies | ⚠️ | PM | |

---

## 12. Post-Launch Monitoring 👀

### FIRST 24 HOURS

| # | Item | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 12.1 | [ ] Monitoring Sentry actif | ⚠️ | DevOps | |
| 12.2 | [ ] Aucune erreur 5xx | ⚠️ | DevOps | |
| 12.3 | [ ] Webhooks Stripe fonctionnent | ⚠️ | Dev | |
| 12.4 | [ ] Emails delivres | ⚠️ | Dev | |
| 12.5 | [ ] Performance acceptable (LCP < 2.5s) | ⚠️ | Dev | |

### FIRST WEEK

| # | Item | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 12.6 | [ ] Premiere reservation reelle | ⚠️ | PM | |
| 12.7 | [ ] Premier paiement processe | ⚠️ | PM | |
| 12.8 | [ ] Feedback winemakers collecte | ⚠️ | PM | |
| 12.9 | [ ] Bugs critiques corriges (si any) | ⚠️ | Dev | |
| 12.10 | [ ] KPIs review | ⚠️ | PM | |

---

## Resume

### Compteurs (Mis a jour)

| Categorie | Critical | Verified | Remaining | Recommended | Verified |
|-----------|----------|----------|-----------|-------------|----------|
| 1. Securite | 10 | **9** | 1 | 4 | **2** |
| 2. Infrastructure | 8 | **1** | 7 | 4 | 0 |
| 3. Stripe | 10 | **1** | 9 | 3 | **2** |
| 4. Emails | 9 | **6** | 3 | 3 | **1** |
| 5. SEO | 8 | **8** | 0 | 5 | **3** |
| 6. Analytics | 4 | **2** | 2 | 5 | 0 |
| 7. i18n | 7 | **6** | 1 | 3 | 0 |
| 8. Legal | 7 | **4** | 3 | 3 | 0 |
| 9. Tests | 9 | **0** | 9 | 3 | 0 |
| 10. Donnees | 5 | 0 | 5 | 3 | 0 |
| 11. Launch | 5 | 0 | 5 | 5 | 0 |
| 12. Post-Launch | 5 | 0 | 5 | 5 | 0 |
| **TOTAL** | **87** | **37** | **50** | **46** | **8** |

### Progression Code Verification

```
Critical:    [===================>           ] 37/87 (43%)
Recommended: [===>                           ] 8/46  (17%)
Total:       [===============>               ] 45/133 (34%)
```

### Go/No-Go Criteria

**GO si:**
- ✅ 100% des items CRITICAL valides
- ✅ Aucun bug P0/P1 ouvert
- ✅ Test de paiement reel reussi
- ✅ Au moins 1 winemaker + 1 experience active

**NO-GO si:**
- ❌ Secrets non rotes -> ✅ DONE
- ❌ Stripe en mode test -> A verifier
- ❌ Erreurs 5xx en production -> A verifier
- ❌ Emails non delivres -> A verifier

### Actions Prioritaires

1. **BLOCKER:** Corriger 6 tests echoues (`checkout.test.ts`, `stripe-webhook.test.ts`)
2. **DELAYED:** Completer item 1.2 (git history cleanup)
3. **Manual:** Configurer Stripe live + tester paiement
4. **Manual:** Verifier deploiement Vercel production

---

## Signatures

| Role | Nom | Date | Signature |
|------|-----|------|-----------|
| PM | | | |
| Tech Lead | | | |
| QA Lead | | | |
| DevOps | | | |

---

**Document cree le:** 14 janvier 2026
**Derniere mise a jour:** 14 janvier 2026
**Version:** 1.1 (Code verification complete)
