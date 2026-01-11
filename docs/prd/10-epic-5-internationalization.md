# Epic 5: Internationalization - Trilingual Support

## Epic Goal

Enable the EnCave platform to serve French, German, and English-speaking users with fully localized UI, ensuring accessibility for Swiss locals and international visitors while maintaining French as the default language.

## Priority

**HIGH** - Starting immediately. This epic runs in parallel with/after Epic 2 completion.

## Background

The EnCave marketplace targets Swiss wine tourism, which serves:

- **Local Swiss users** (French and German-speaking regions)
- **International tourists** (English-speaking visitors)

French is the primary language (Romandie wine region focus), with German and English as secondary options.

---

## Existing System Context

| Aspect               | Current State                                      |
| -------------------- | -------------------------------------------------- |
| Relevant functionality | All UI currently has hardcoded strings (mixed FR/EN) |
| Technology stack     | Next.js 14+ App Router, spec'd for next-intl 3.x   |
| Integration points   | All components, layouts, forms, error messages, emails |

## Enhancement Details

| What               | Details                                            |
| ------------------ | -------------------------------------------------- |
| **Languages**      | French (default), German, English                  |
| **URL structure**  | `/fr/...`, `/de/...`, `/en/...`                    |
| **User preference**| Cookie persistence + logged-in user profile        |
| **Browser detection** | Accept-Language header for first-time visitors  |
| **Admin interface**| French-only (unchanged for MVP)                    |
| **Winemaker content** | Original language (no auto-translation)         |

---

## Stories

| #       | Story Title                    | Description                                                                 |
| ------- | ------------------------------ | --------------------------------------------------------------------------- |
| **5.1** | i18n Infrastructure Setup      | Install next-intl, configure middleware, routing with locale prefixes, language detection, LocaleSwitcher component |
| **5.2** | Translation Files & UI Strings | Create `messages/{fr,de,en}.json`, extract all hardcoded strings, organize by namespace |
| **5.3** | Email Template Localization    | Trilingual email templates (booking confirmations, notifications), send based on user preference |
| **5.4** | SEO & QA Verification          | hreflang tags, localized meta descriptions, sitemap updates, full translation QA pass |

---

## Technical Approach

### next-intl Configuration

```typescript
// i18n.ts
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`../messages/${locale}.json`)).default,
}));

// middleware.ts
import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['fr', 'de', 'en'],
  defaultLocale: 'fr',
});
```

### URL Structure

```
/fr/experiences          → French (default)
/de/experiences          → German
/en/experiences          → English
/experiences             → Redirects to /fr/experiences
```

### Translation File Structure

```
messages/
├── fr.json              # French (complete, primary)
├── de.json              # German
└── en.json              # English
```

### Namespace Organization

```json
{
  "common": {
    "nav": { "home": "...", "experiences": "..." },
    "buttons": { "bookNow": "...", "cancel": "..." }
  },
  "booking": { "selectDate": "...", "guests": "..." },
  "experience": { "duration": "...", "price": "..." },
  "auth": { "signIn": "...", "signUp": "..." },
  "errors": { "required": "...", "invalid": "..." }
}
```

---

## Compatibility Requirements

- [x] Existing APIs remain unchanged (UI strings only)
- [x] Database schema: Add `preferredLocale` to User model (backward compatible)
- [x] UI changes follow existing shadcn/ui patterns
- [x] Performance impact minimal (translation files loaded per-locale)

## Risk Mitigation

| Risk                   | Mitigation                              | Rollback                          |
| ---------------------- | --------------------------------------- | --------------------------------- |
| Missing translations   | Fallback to French for missing keys     | Revert to hardcoded strings       |
| Route breaking changes | Middleware handles legacy non-prefixed URLs | Disable locale routing middleware |
| SEO impact             | Proper redirects + hreflang             | Canonical tags to French          |

---

## Definition of Done

- [ ] All stories completed with acceptance criteria met
- [ ] Language switcher visible and functional on all public pages
- [ ] All UI strings externalized to translation files
- [ ] French, German, and English translations complete
- [ ] Email templates available in all 3 languages
- [ ] SEO: hreflang tags and localized meta descriptions
- [ ] User language preference persists (cookie + profile)
- [ ] No regression in existing features
- [ ] Admin interface remains French-only

---

## Dependencies

- **From Epic 2:** Experience pages and search must be complete before full translation
- **From Epic 3:** Booking flow emails for email localization story

## Notes

- This epic supersedes Story 4.5 (Bilingual Support) which only covered FR/DE
- Currency formatting (CHF) remains consistent across all languages
- Date/time formatting uses locale-aware Intl.DateTimeFormat

---

## Change Log

| Date       | Version | Description                                      | Author   |
| ---------- | ------- | ------------------------------------------------ | -------- |
| 2026-01-10 | 1.0     | Initial epic creation (supersedes Story 4.5)     | PM Agent |
