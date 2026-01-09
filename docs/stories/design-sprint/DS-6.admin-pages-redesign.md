# Story DS-6: Admin Pages Premium Redesign

## Status

Ready for Dev

## PM Validation

| Criteria | Status |
|----------|--------|
| Clear user story | ✅ |
| Numbered ACs | ✅ 19 ACs |
| Technical notes | ✅ Code examples |
| Files identified | ✅ 7 files |
| Dependencies | ✅ DS-1, DS-2 |
| Effort estimate | ✅ Medium (4-8h) |
| UX Spec reference | ✅ Section 6.7, 6.8 & 6.9 |

**Validated by:** John (PM Agent) on 2026-01-09

## Story

**As a** platform administrator,
**I want** the admin interface to be clean, efficient, and professional,
**so that** I can manage winery verifications with confidence.

## Acceptance Criteria

### Admin Dashboard (`/admin`)
1. Page title uses `font-display`
2. KPI stat cards in a grid (2×2 or 4×1 depending on screen)
3. Each stat card has:
   - Colored left border indicating type (amber=pending, green=verified, red=rejected, slate=total)
   - Large stat number
   - Label below
   - Subtle background color matching border
4. "Quick Actions" section with links to common tasks
5. "Recent Pending" section showing latest 5 pending wineries
6. Cards use premium Card styling from DS-2

### Pending Queue (`/admin/wineries/pending`)
7. Page header with count badge (burgundy background)
8. Filter controls styled consistently
9. Table with:
   - Clean header with subtle background
   - Row hover states
   - Proper spacing and alignment
   - "Review" action button per row
10. Time-ago formatting for submission dates (e.g., "2 hours ago")
11. Empty state if no pending wineries

### Winery Review (`/admin/wineries/[id]`)
12. Clear section headers for submitted information
13. All winery details displayed in organized layout
14. Applicant information section
15. Photos displayed in grid
16. Action buttons prominently displayed:
    - "Approve" (green/emerald)
    - "Reject" (requires reason)
17. Rejection reason textarea appears when reject selected
18. Back to queue link
19. Confirmation dialog before approve/reject actions

## Technical Notes

Reference: `docs/epic-1-premium-redesign-spec.md` Section 6.7, 6.8 & 6.9

### KPI Card Structure

```tsx
<Card className="relative overflow-hidden">
  <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />
  <CardContent className="p-6">
    <p className="text-4xl font-bold text-slate-900">{count}</p>
    <p className="text-sm text-slate-600 mt-1">{label}</p>
  </CardContent>
</Card>
```

### Files to Modify

- `src/app/admin/page.tsx`
- `src/app/admin/layout.tsx`
- `src/app/admin/wineries/pending/page.tsx`
- `src/app/admin/wineries/[id]/page.tsx`
- `src/components/features/admin/AdminStats.tsx`
- `src/components/features/admin/PendingWineriesTable.tsx`
- `src/components/features/admin/WineryDetailView.tsx`

## Dependencies

- DS-1 (Design System Foundation)
- DS-2 (Core Components)

## Effort Estimate

Medium (4-8 hours)

## Change Log

| Date       | Version | Description            | Author   |
| ---------- | ------- | ---------------------- | -------- |
| 2026-01-09 | 1.0     | Initial story creation | PM Agent |
