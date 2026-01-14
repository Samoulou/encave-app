# Epic 7: Booking UX Fixes & Polish

## Status

Ready for Development

## Epic Goal

Corriger les problèmes UX identifiés dans le flux de réservation et améliorer le feedback visuel global pour garantir une expérience utilisateur intuitive et sans friction.

## Epic Description

### Existing System Context

- **Current relevant functionality:** Flux de réservation avec sélection date/heure, compteur d'invités, et widget de booking
- **Technology stack:** Next.js 15, React 19, TypeScript, nuqs (URL state management), Tailwind CSS
- **Integration points:** BookingWidget, BookingDatePicker, TimeSlotSelector, GuestCountInput, Header Navigation

### Enhancement Details

- **What's being fixed:**
  - 4 bugs UX identifiés lors de tests utilisateurs (gestion d'état URL, affichage capacité, bug calendrier)
  - Absence de feedback visuel lors des transitions de route et actions utilisateur
- **How it integrates:** Corrections ciblées dans les composants existants + ajout d'indicateurs de chargement globaux
- **Success criteria:**
  - État URL persiste correctement (date + time)
  - Affichage capacité clair et non-dupliqué
  - Calendrier s'affiche correctement sans éléments parasites
  - Feedback visuel immédiat sur toutes les interactions (navigation, boutons, chargement)

## Bug Reference Matrix

| Bug ID | Severity | Story | Description |
|--------|----------|-------|-------------|
| BUG-030 | P1 | 7.1 | URL state: time slot removed when changing date |
| BUG-031 | P2 | 7.1 | Duplicate capacity display (text + badge) |
| BUG-032 | P2 | 7.1 | Confusing capacity text "8-10 10 personnes" |
| BUG-033 | P1 | 7.1 | Calendar left arrow appearing on right side of page |
| BUG-034 | P2 | 7.2 | No visual feedback on navigation clicks (header links) |
| BUG-035 | P2 | 7.2 | No loading state on login/connection page buttons |
| BUG-036 | P2 | 7.2 | Missing skeleton loaders during data fetching |

## Stories

| # | Story | Priority | Bugs Covered |
|---|-------|----------|--------------|
| 7.1 | Booking UX Improvements | P1 | BUG-030, 031, 032, 033 |
| 7.2 | Loading States & Visual Feedback | P2 | BUG-034, 035, 036 |

## Compatibility Requirements

- [x] Existing booking flow unaffected
- [x] URL query params backward compatible
- [x] UI changes follow design system
- [x] No breaking changes to BookingWidget API

## Risk Mitigation

- **Primary Risk:** URL state changes could affect deep links or shared booking URLs
- **Mitigation:** Test all URL state scenarios before deployment
- **Rollback Plan:** Changes are isolated to UI components, easy rollback

## Definition of Done

- [ ] All P1 bugs resolved and verified
- [ ] All P2 bugs resolved and verified
- [ ] Manual QA pass on booking flow
- [ ] No regression in existing booking functionality
- [ ] URL state persists correctly across interactions

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-01-13 | 1.0 | Epic creation from user-reported bugs | PM Agent |
