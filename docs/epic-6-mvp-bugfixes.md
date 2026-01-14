# Epic 6: MVP Bug Fixes & Polish

## Status

In Progress

## Epic Goal

Corriger tous les bugs critiques identifiés lors de la révision post-MVP pour garantir une expérience utilisateur fluide, fiable et professionnelle avant le lancement public.

## Epic Description

### Existing System Context

- **Current relevant functionality:** Application MVP complète avec authentification, gestion des expériences, flux de réservation/paiement, dashboard winemaker, et système de notifications
- **Technology stack:** Next.js 15, React 19, TypeScript, Prisma, PostgreSQL (Neon), Stripe Connect, next-intl (i18n)
- **Integration points:** Booking widget, Dashboard queries, Calendar views, Checkout flow, Maps integration

### Enhancement Details

- **What's being fixed:** 28 bugs identifiés classifiés P0-P3 touchant le flux de réservation, l'affichage des données dashboard, la navigation, les performances et l'accessibilité
- **How it integrates:** Corrections ciblées dans les composants existants sans changement architectural majeur
- **Success criteria:**
  - Tous les bugs P0/P1 résolus
  - Flux de réservation 100% fonctionnel
  - Dashboard affiche les données correctes
  - Navigation fluide (<1s entre pages)
  - Score Lighthouse Performance > 90

## Bug Reference Matrix

| Bug ID | Severity | Story | Description |
|--------|----------|-------|-------------|
| BUG-001 | P0 | 6.1 | Guest count infinite loading |
| BUG-002 | P0 | 6.1 | +/- guests buttons not working |
| BUG-003 | P0 | 6.1 | Missing capacity validation before payment |
| BUG-003b | P0 | 6.1 | **NEW** - Continue button not disabled when capacity exceeded |
| BUG-004 | P0 | 6.2 | Dashboard cards not updating |
| BUG-005 | P0 | 6.2 | Calendar events not displaying |
| BUG-006 | P1 | 6.2 | Earnings not displaying |
| BUG-007 | P1 | 6.4 | Map pin not showing |
| BUG-008 | P1 | 6.5 | Slow navigation |
| BUG-009 | P1 | 6.3 | No back button to home |
| BUG-010 | P1 | 6.3 | Forgot password link broken |
| BUG-011 | P1 | 6.3 | Checkout missing header |
| BUG-012 | P1 | 6.3 | Breadcrumbs missing locale prefix |
| BUG-013 | P1 | 6.1 | No availability recheck on checkout load |
| BUG-014 | P2 | 6.6 | Error page not i18n |
| BUG-015 | P2 | 6.6 | No character counters |
| BUG-016 | P2 | 6.6 | No real-time validation |
| BUG-017 | P2 | 6.6 | Accessibility pointer-events issue |
| BUG-018 | P2 | 6.5 | Images without blur placeholder |
| BUG-019 | P2 | 6.5 | No pagination on tables |
| BUG-020 | P2 | 6.6 | Settings page empty |
| BUG-021 | P2 | 6.2 | Calendar not reactive |
| BUG-022 | P2 | 6.6 | Missing metadata on dashboard |
| BUG-023 | P2 | 6.1 | Stale closure in BookingWidget |
| BUG-024 | P3 | 6.6 | PWA icons missing |
| BUG-025 | P3 | 6.6 | No image error handler |
| BUG-026 | P3 | 6.6 | Missing autocomplete attributes |
| BUG-027 | P3 | 6.6 | Link contrast issues |
| BUG-028 | P3 | 6.6 | Date picker overflow mobile |
| BUG-029 | P1 | 6.1 | **NEW** - Booking confirmation email not sending |

## Stories

| # | Story | Priority | Bugs Covered |
|---|-------|----------|--------------|
| 6.1 | Fix Critical Booking Flow | P0 | BUG-001, 002, 003, 003b, 013, 023, 029 |
| 6.2 | Fix Dashboard Data Display | P0 | BUG-004, 005, 006, 021 |
| 6.3 | Fix Navigation & Headers | P1 | BUG-009, 010, 011, 012 |
| 6.4 | Fix Map Location Display | P1 | BUG-007 |
| 6.5 | Optimize Performance | P1 | BUG-008, 018, 019 |
| 6.6 | Polish & Accessibility | P2 | BUG-014-017, 020, 022, 024-028 |

## Compatibility Requirements

- [x] Existing APIs remain unchanged
- [x] Database schema changes are backward compatible (only additions)
- [x] UI changes follow existing patterns
- [x] Performance impact is positive (optimization)

## Risk Mitigation

- **Primary Risk:** Date handling changes could affect existing bookings
- **Mitigation:** Add comprehensive tests before modifying date logic
- **Rollback Plan:** Feature flags on critical changes, incremental deployment

## Definition of Done

- [ ] All P0 bugs resolved and verified
- [ ] All P1 bugs resolved and verified
- [ ] P2/P3 bugs addressed where time permits
- [ ] Existing functionality verified through E2E tests
- [ ] No regression in booking flow
- [ ] Lighthouse Performance score > 90
- [ ] Manual QA pass on all affected flows

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-01-12 | 1.0 | Epic creation from MVP bug review | PM Agent |
| 2026-01-12 | 1.1 | Added BUG-003b and BUG-029 to Story 6.1 | PM Agent |
