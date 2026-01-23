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
- [ ] Fixed sidebar on desktop (w-64, 256px)
- [ ] EnCave logo with wine icon at top
- [ ] Navigation items with Lucide icons:
  - Dashboard (home icon)
  - **Experiences** (celebration/wine icon) - Active state
  - Bookings (calendar icon)
  - Messages (chat icon)
  - Settings (settings icon)
- [ ] Active state: `bg-primary/10 text-primary font-bold`
- [ ] Hover state: `hover:bg-gray-100`
- [ ] User profile section at bottom with avatar, name, winery name
- [ ] Mobile: Collapsible hamburger menu

### AC2: Page Header
- [ ] Title: "Manage Experiences" (`text-3xl md:text-4xl font-black`)
- [ ] Subtitle: "Curate your wine tasting offerings for visitors."
- [ ] "New Experience" button (primary, with + icon)
- [ ] Button animates on hover: `group-hover:rotate-90` on icon

### AC3: Filter & Search Bar
- [ ] Container card with white background
- [ ] Search input with search icon prefix
- [ ] Placeholder: "Search experiences by name..."
- [ ] Filter chips/tabs:
  - All (default active)
  - Published (with count badge)
  - Drafts (with count badge)
  - Archived
- [ ] Active chip: `bg-primary text-white`
- [ ] Inactive chip: `bg-[#f8f6f6] text-gray-600 hover:bg-gray-200`

### AC4: Experience Cards Grid
- [ ] Grid: 3 columns (xl), 2 columns (md), 1 column (mobile)
- [ ] Gap: `gap-6`
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
- [ ] **Published**:
  - `bg-green-100 text-green-700 border-green-200`
  - Green dot indicator
- [ ] **Draft**:
  - `bg-gray-100 text-gray-600 border-gray-200`
  - Gray dot indicator
  - Image has `grayscale-[30%]` filter
- [ ] **Archived**:
  - Muted styling throughout

### AC6: Card Actions
- [ ] Visible on hover (desktop) or always visible (mobile)
- [ ] Actions row at bottom:
  - Duplicate icon button (copy icon)
  - Delete icon button (trash icon, hover:text-red-500)
  - Edit button: `bg-primary/10 text-primary hover:bg-primary hover:text-white`
- [ ] More menu (⋮) in top-right corner on hover

### AC7: Card Hover Effects
- [ ] `hover:-translate-y-1`
- [ ] `hover:shadow-[0_12px_30px_rgba(205,45,85,0.15)]`
- [ ] `hover:border-primary/20`
- [ ] Image: `hover:scale-105` with `transition-transform duration-700`
- [ ] Title: `hover:text-primary`

### AC8: Create New Card (Placeholder)
- [ ] Dashed border card: `border-2 border-dashed border-primary/30`
- [ ] Centered content:
  - Large + icon in circle
  - "Create New Experience" title
  - Subtitle: "Offer a new tasting, tour or workshop."
- [ ] Hover: `border-primary bg-[#f2e9eb]/80`
- [ ] Click navigates to create form

### AC9: Pagination
- [ ] Centered pagination below grid
- [ ] Previous/Next arrows
- [ ] Numbered page buttons
- [ ] Current page: `bg-primary text-white`

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
- [ ] Sidebar navigation matches mockup
- [ ] Filter tabs functional with counts
- [ ] Search filters results in real-time
- [ ] All card states render correctly (Published/Draft/Archived)
- [ ] Hover effects smooth and matching mockup
- [ ] Duplicate action creates copy
- [ ] Delete action with confirmation
- [ ] Edit navigates to edit form
- [ ] Create card navigates to new form
- [ ] Pagination working
- [ ] Mobile responsive (sidebar collapses)
- [ ] Visual match with mockup 90%+
- [ ] Code reviewed and merged
