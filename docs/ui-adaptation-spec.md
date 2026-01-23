# EnCave UI/UX Adaptation Specification

## Document Purpose

This specification defines the UI/UX adaptations required to align the EnCave application with the high-fidelity mockups. It serves as the reference document for all UI adaptation user stories.

---

## Design System Changes

### Typography Migration

| Element | Current | Target (Mockups) | CSS Variable |
|---------|---------|------------------|--------------|
| **Font Family** | Playfair Display + DM Sans | **Manrope** | `--font-display`, `--font-sans` |
| **Weights Used** | 400, 500, 700 | 400, 500, 600, 700, 800 | - |
| **Import** | Google Fonts | Google Fonts | `fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800` |

### Color Palette

| Token | Hex Code | Usage |
|-------|----------|-------|
| `--primary` | `#cd2d55` | Primary actions, accents, links |
| `--primary-hover` | `#a62444` / `#b02246` | Button hover states |
| `--background-light` | `#f8f6f6` | Page backgrounds |
| `--background-dark` | `#201216` | Dark mode backgrounds (future) |
| `--surface-light` | `#ffffff` | Cards, modals |
| `--surface-dark` | `#2a1a20` | Dark mode cards (future) |
| `--text-main` | `#1a0f12` | Primary text |
| `--text-secondary` | `#915564` | Secondary text, labels |
| `--border-light` | `#e5d2d7` | Card borders, dividers |
| `--success` | `#047857` | Confirmed status, positive feedback |
| `--warning` | `#b45309` | Pending status, warnings |
| `--error` | `#991b1b` | Cancelled status, errors |

### Icon System

| Aspect | Decision |
|--------|----------|
| **Library** | Keep **Lucide React** (current) |
| **Size Standard** | 18px (inline), 20px (buttons), 24px (navigation) |
| **Color** | Inherit from parent or use `text-secondary` |

### Border Radius Scale

| Token | Value | Usage |
|-------|-------|-------|
| `rounded-DEFAULT` | 0.25rem (4px) | Small elements, badges |
| `rounded-lg` | 0.5rem (8px) | Inputs, small cards |
| `rounded-xl` | 0.75rem (12px) | Cards, modals |
| `rounded-2xl` | 1rem (16px) | Large cards |
| `rounded-full` | 9999px | Avatars, pills |

### Shadow Scale

```css
/* Card shadows */
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-card: 0 4px 20px rgba(0, 0, 0, 0.05);
--shadow-card-hover: 0 12px 30px rgba(205, 45, 85, 0.15);
--shadow-primary: 0 4px 14px rgba(205, 45, 85, 0.2);
```

---

## Screen-by-Screen Specifications

### 1. Homepage (`encave_home_page`)

**Mockup Location:** `docs/mockups/encave_home_page/`

**Key Components:**
- Hero section with gradient overlay on background image
- Search bar with location autocomplete + date picker inline
- Featured Experiences carousel (horizontal scroll)
- Region filter chips with circular images
- Trust badges section

**Layout:**
- Full-width hero (min-height: 500px)
- Max-width container: 1280px (7xl)
- Section spacing: 64px (py-16)

---

### 2. Experience Listing (`experience_listing`)

**Mockup Location:** `docs/mockups/experience_listing/`

**Key Components:**
- Sidebar filters (collapsible on mobile)
- Experience cards grid (3 columns desktop, 2 tablet, 1 mobile)
- Sorting dropdown
- Pagination with numbered pages

**Card Anatomy:**
- Image ratio: 3:2
- Badge position: top-left (status), top-right (price)
- Content: Title, duration, max guests, rating
- Hover: scale(1.02), elevated shadow

---

### 3. Experience Details (`experience_details_&_booking`)

**Mockup Location:** `docs/mockups/experience_details_&_booking/`

**Key Components:**
- Photo gallery (main + thumbnails)
- Sticky booking widget (right column)
- Tabs: Overview | What's Included | Reviews
- Host section with avatar
- Location map
- Similar experiences carousel

**Booking Widget:**
- Position: sticky, top: 96px
- Contains: date picker, guest selector, price breakdown, CTA

---

### 4. User Login (`user_login`)

**Mockup Location:** `docs/mockups/user_login/`

**Key Components:**
- Split layout (form left, image right)
- Social login buttons (Google, Apple style)
- Input fields with icon prefixes
- "Forgot password" link
- "Create account" link

**Layout:**
- Desktop: 50/50 split
- Mobile: Form only, image as background with overlay

---

### 5. Create Experience Form (`create_experience_form`)

**Mockup Location:** `docs/mockups/create_experience_form/`

**Key Components:**
- Multi-step stepper (4 steps)
- Image upload zone (drag & drop)
- Rich form inputs with validation
- Inclusion tags (selectable chips)
- Preview panel (optional)

**Stepper Steps:**
1. Basic Info (title, type, description)
2. Details (duration, capacity, inclusions)
3. Pricing (price per person, group discounts)
4. Availability (calendar, time slots)

---

### 6. Secure Checkout (`secure_checkout`)

**Mockup Location:** `docs/mockups/secure_checkout/`

**Key Components:**
- Simplified header with "Secure Checkout" badge
- Contact details form (first/last name, email, phone)
- Payment section (Stripe Elements)
- Order summary (sticky on desktop)
- Trust badges (SSL, Stripe, 24/7 Support)
- Cancellation policy info

**Layout:**
- Desktop: 7/5 column split (form/summary)
- Mobile: Stacked (summary collapsible)

---

### 7. Booking Confirmation (`booking_confirmation`)

**Mockup Location:** `docs/mockups/booking_confirmation/`

**Key Components:**
- Animated success checkmark
- Booking reference (large, prominent)
- Status badge "Confirmed"
- Experience details recap
- QR code for check-in
- Winery contact card with map
- Action buttons: "Add to Calendar", "Download Receipt"
- "Need to modify?" section

---

### 8. Manage Experiences (`manage_winemaker_experiences`)

**Mockup Location:** `docs/mockups/manage_winemaker_experiences/`

**Key Components:**
- Dashboard sidebar navigation
- Page header with "New Experience" CTA
- Filter tabs (All, Published, Drafts, Archived)
- Search bar
- Experience cards grid
- Card actions: Edit, Duplicate, Delete
- Empty state / "Create New" placeholder card

**Card States:**
- Published: green badge with dot indicator
- Draft: gray badge, image grayscale(30%)
- Archived: muted styling

---

### 9. Winemaker Bookings (`winemaker_dashboard_-_bookings`)

**Mockup Location:** `docs/mockups/winemaker_dashboard_-_bookings/`

**Key Components:**
- KPI cards row (Total Bookings, Upcoming, Occupancy Rate)
- Data table with columns: Date, Client, Experience, Guests, Status, Actions
- Status badges (Confirmed/Pending/Cancelled)
- Action buttons for Pending (Approve/Reject)
- Search + Filter controls
- View toggle (List/Calendar)
- Pagination

**Status Badge Colors:**
- Confirmed: `bg-green-50 text-green-700 border-green-200`
- Pending: `bg-yellow-50 text-yellow-700 border-yellow-200`
- Cancelled: `bg-red-50 text-red-700 border-red-200`

---

### 10. Winemaker Earnings (`winemaker_dashboard_-_earnings`)

**Mockup Location:** `docs/mockups/winemaker_dashboard_-_earnings/`

**Key Components:**
- KPI cards (Total Earnings, Year to Date, Pending Payouts)
- Revenue chart (line chart with gradient fill)
- Transactions table
- Date range selector
- Export button

**Chart Specifications:**
- Use Recharts (already installed)
- Primary line color: `#cd2d55`
- Gradient fill: `rgba(205, 45, 85, 0.2)` to transparent
- Grid lines: dashed, `#e5d2d7`

---

## Common Patterns

### Button Styles

| Variant | Classes |
|---------|---------|
| Primary | `bg-primary hover:bg-[#a62444] text-white font-bold rounded-lg shadow-lg shadow-primary/20` |
| Secondary | `bg-white border border-[#e5d2d7] text-[#1a0f12] hover:bg-[#f8f6f6]` |
| Ghost | `text-primary hover:bg-primary/10` |

### Input Styles

```css
.form-input {
  @apply w-full rounded-lg border border-[#e5d2d7] bg-[#fbf9f9]
         px-4 h-12 text-[#1a0f12] placeholder:text-[#915564]/60
         focus:border-primary focus:ring-2 focus:ring-primary/20;
}
```

### Card Styles

```css
.card {
  @apply bg-white rounded-xl border border-[#e5d2d7] shadow-sm
         hover:shadow-[0_12px_30px_rgba(205,45,85,0.15)]
         hover:-translate-y-1 transition-all duration-300;
}
```

---

## Implementation Notes

1. **Font Migration**: Update `tailwind.config.ts` and `layout.tsx` to use Manrope
2. **Color Tokens**: Update CSS variables in `globals.css`
3. **Component Updates**: Modify shadcn/ui components to match new styles
4. **Testing**: Verify responsive behavior at all breakpoints
5. **Dark Mode**: Prepare tokens but do not implement until mockups provided

---

## References

- **Mockups Directory**: `docs/mockups/`
- **Current Components**: `src/components/`
- **Tailwind Config**: `tailwind.config.ts`
- **Global Styles**: `src/app/globals.css`
