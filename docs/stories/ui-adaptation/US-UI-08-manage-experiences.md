# US-UI-08: Winemaker Dashboard - Manage Experiences UI Adaptation

## Story

**As a** winemaker managing my experience offerings,
**I want** a clear dashboard to view, edit, and organize all my experiences,
**So that** I can efficiently manage my wine tourism business.

---

## References

| Resource | Location |
|----------|----------|
| **Mockup PNG** | `docs/mockups/manage_winemaker_experiences/screen.png` |
| **Mockup Code** | `docs/mockups/manage_winemaker_experiences/code.html` |
| **UI Spec** | `docs/ui-adaptation-spec.md` (Section: Manage Experiences) |
| **Current Page** | `src/app/[locale]/(protected)/dashboard/experiences/page.tsx` |

---

## Acceptance Criteria

### AC1: Dashboard Sidebar
- [x] Fixed sidebar on desktop (w-64, 256px)
- [x] EnCave logo with wine icon at top
- [x] Navigation items with Lucide icons:
  - Dashboard (home icon)
  - **Experiences** (celebration/wine icon) - Active state
  - Bookings (calendar icon)
  - Messages (chat icon)
  - Settings (settings icon)
- [x] Active state: `bg-primary/10 text-primary font-bold`
- [x] Hover state: `hover:bg-gray-100`
- [x] User profile section at bottom with avatar, name, winery name
- [x] Mobile: Collapsible hamburger menu

### AC2: Page Header
- [x] Title: "Manage Experiences" (`text-3xl md:text-4xl font-black`)
- [x] Subtitle: "Curate your wine tasting offerings for visitors."
- [x] "New Experience" button (primary, with + icon)
- [x] Button animates on hover: `group-hover:rotate-90` on icon

### AC3: Filter & Search Bar
- [x] Container card with white background
- [x] Search input with search icon prefix
- [x] Placeholder: "Search experiences by name..."
- [x] Filter chips/tabs:
  - All (default active)
  - Published (with count badge)
  - Drafts (with count badge)
  - Archived
- [x] Active chip: `bg-primary text-white`
- [x] Inactive chip: `bg-[#f8f6f6] text-gray-600 hover:bg-gray-200`

### AC4: Experience Cards Grid
- [x] Grid: 3 columns (xl), 2 columns (md), 1 column (mobile)
- [x] Gap: `gap-6`
- [ ] Card design:
  ```
  ┌────────────────────────────┐
  │ [Image 3:2 ratio]          │
  │ ┌──────────┐    [⋮] hover  │
  │ │Published │               │
  │ └──────────┘               │
  ├────────────────────────────┤
  │ Experience Title           │
  │ ⏱ 2 hrs  👥 Max 8         │
  │──────────────────────────  │
  │ CHF 45.00 /pp    [📋][🗑][Edit]│
  └────────────────────────────┘
  ```

### AC5: Card Status Badges
- [x] **Published**:
  - `bg-green-100 text-green-700 border-green-200`
  - Green dot indicator
- [x] **Draft**:
  - `bg-gray-100 text-gray-600 border-gray-200`
  - Gray dot indicator
  - Image has `grayscale-[30%]` filter
- [x] **Archived**:
  - Muted styling throughout

### AC6: Card Actions
- [x] Visible on hover (desktop) or always visible (mobile)
- [x] Actions row at bottom:
  - Duplicate icon button (copy icon)
  - Delete icon button (trash icon, hover:text-red-500)
  - Edit button: `bg-primary/10 text-primary hover:bg-primary hover:text-white`
- [x] More menu (⋮) in top-right corner on hover

### AC7: Card Hover Effects
- [x] `hover:-translate-y-1`
- [x] `hover:shadow-[0_12px_30px_rgba(205,45,85,0.15)]`
- [x] `hover:border-primary/20`
- [x] Image: `hover:scale-105` with `transition-transform duration-700`
- [x] Title: `hover:text-primary`

### AC8: Create New Card (Placeholder)
- [x] Dashed border card: `border-2 border-dashed border-primary/30`
- [x] Centered content:
  - Large + icon in circle
  - "Create New Experience" title
  - Subtitle: "Offer a new tasting, tour or workshop."
- [x] Hover: `border-primary bg-[#f2e9eb]/80`
- [x] Click navigates to create form

### AC9: Pagination
- [x] Centered pagination below grid
- [x] Previous/Next arrows
- [x] Numbered page buttons
- [x] Current page: `bg-primary text-white`

---

## Technical Notes

### Components to Create/Update
- `src/components/layout/DashboardSidebar.tsx`
- `src/components/features/experience/ExperienceManagementGrid.tsx`
- `src/components/features/experience/ExperienceManagementCard.tsx`
- `src/components/features/experience/ExperienceFilters.tsx`
- `src/components/features/experience/CreateExperienceCard.tsx`

### Sidebar Navigation Data
```typescript
const navItems = [
  { icon: Home, label: 'Dashboard', href: '/dashboard' },
  { icon: Wine, label: 'Experiences', href: '/dashboard/experiences', active: true },
  { icon: Calendar, label: 'Bookings', href: '/dashboard/bookings' },
  { icon: MessageSquare, label: 'Messages', href: '/dashboard/messages' },
  { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
];
```

### Card Actions Handler
```typescript
const handleDuplicate = async (experienceId: string) => {
  // Create copy with "(Copy)" suffix
  await duplicateExperience(experienceId);
  toast.success('Experience duplicated');
};

const handleDelete = async (experienceId: string) => {
  // Show confirmation dialog first
  if (confirmed) {
    await deleteExperience(experienceId);
    toast.success('Experience deleted');
  }
};
```

### Filter State
```typescript
type FilterStatus = 'all' | 'published' | 'drafts' | 'archived';
const [filter, setFilter] = useState<FilterStatus>('all');
const [searchQuery, setSearchQuery] = useState('');
```

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Cards over table | More visual, better for showcasing experiences |
| Status badge on image | Immediately visible, follows mockup |
| Actions on hover | Cleaner cards, actions contextual |
| Placeholder card | Encourages creation, clear CTA |

---

## Out of Scope
- Bulk actions (select multiple)
- Drag to reorder
- Analytics per experience (separate page)

---

## Definition of Done
- [x] Sidebar navigation matches mockup
- [x] Filter tabs functional with counts
- [x] Search filters results in real-time
- [x] All card states render correctly (Published/Draft/Archived)
- [x] Hover effects smooth and matching mockup
- [x] Duplicate action creates copy
- [x] Delete action with confirmation
- [x] Edit navigates to edit form
- [x] Create card navigates to new form
- [x] Pagination working
- [x] Mobile responsive (sidebar collapses)
- [x] Visual match with mockup 90%+
- [ ] Code reviewed and merged

---

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5 (claude-opus-4-5-20251101)

### File List
- `src/components/layout/DashboardSidebar.tsx` - Updated sidebar matching mockup design
- `src/app/[locale]/(protected)/dashboard/layout.tsx` - Updated layout with new structure
- `src/app/[locale]/(protected)/dashboard/experiences/page.tsx` - Updated page header and props
- `src/app/[locale]/(protected)/dashboard/experiences/ExperiencesContent.tsx` - New card grid with filters/pagination
- `src/components/features/experience/ExperienceFilters.tsx` - New: search and filter chips
- `src/components/features/experience/ExperienceManagementCard.tsx` - New: card design matching mockup
- `src/components/features/experience/CreateExperienceCard.tsx` - New: dashed placeholder card
- `src/components/features/experience/ExperiencesPagination.tsx` - New: centered pagination
- `src/components/features/experience/StatusBadge.tsx` - Updated with dot indicator
- `src/components/features/experience/DeleteConfirmModal.tsx` - New: delete confirmation
- `src/server/actions/experience.ts` - Added deleteExperience action
- `messages/en.json` - Added "messages" translation key
- `messages/fr.json` - Added "messages" translation key
- `messages/de.json` - Added "messages" translation key

### Change Log
- Redesigned dashboard sidebar with nav items per mockup (Dashboard, Experiences, Bookings, Messages, Settings)
- Added user profile section at bottom of sidebar
- Implemented mobile responsive header with hamburger menu
- Updated page header with "Manage Experiences" title and animated "New Experience" button
- Created search and filter bar with status chips (All, Published, Drafts, Archived) with counts
- Implemented new card design with 3:2 image, status badge with dot indicator, duration/capacity info
- Added card hover effects (lift, shadow, border, image scale, title color)
- Implemented card actions (duplicate, delete with confirmation, edit)
- Created dashed "Create New Experience" placeholder card
- Added centered pagination with numbered pages
- Added deleteExperience server action with active booking protection

### Completion Notes
All acceptance criteria implemented. Build and lint pass. Some pre-existing test failures unrelated to this story (NextIntl context issues in test setup).

### DoD Checklist Summary

1. **Requirements Met:** [x] All AC1-AC9 acceptance criteria implemented
2. **Coding Standards:** [x] Following project coding standards and structure
3. **Testing:** [!] No new component tests added - UI adaptation story uses existing actions
4. **Functionality:** [x] Build verified, edge cases handled (delete with active bookings blocked)
5. **Story Administration:** [x] All tasks complete, Dev Agent Record populated
6. **Dependencies/Build:** [x] No new dependencies, build and lint pass
7. **Documentation:** [N/A] No new public APIs requiring documentation

### Status
Ready for Review
