# US-UI-05: Create Experience Form UI Adaptation

## Story

**As a** winemaker creating a new experience offering,
**I want** an intuitive multi-step form with clear guidance,
**So that** I can easily set up my experience with all necessary details.

---

## References

| Resource | Location |
|----------|----------|
| **Mockup PNG** | `docs/mockups/create_experience_form/screen.png` |
| **Mockup Code** | `docs/mockups/create_experience_form/code.html` |
| **UI Spec** | `docs/ui-adaptation-spec.md` (Section: Create Experience Form) |
| **Current Page** | `src/app/[locale]/(protected)/dashboard/experiences/new/page.tsx` |

---

## Acceptance Criteria

### AC1: Multi-Step Stepper
- [ ] 4 steps: Basic Info → Details → Pricing → Availability
- [ ] Visual stepper at top showing progress
- [ ] Completed steps: Checkmark icon, primary color
- [ ] Current step: Highlighted, primary color fill
- [ ] Upcoming steps: Gray/muted
- [ ] Step labels visible on desktop, numbers only on mobile
- [ ] Clickable to navigate (only to completed steps)

```
Step Stepper Design:
[✓] ─── [2] ─── [3] ─── [4]
Basic    Details  Pricing  Availability
 Info
```

### AC2: Step 1 - Basic Info
- [ ] Experience Title input (required)
- [ ] Experience Type selector (dropdown or radio cards)
- [ ] Short Description textarea (with character count)
- [ ] Long Description with rich text editor (optional)
- [ ] Cover Image upload zone

### AC3: Step 2 - Details
- [ ] Duration selector (dropdown: 1h, 1.5h, 2h, etc.)
- [ ] Maximum Guests input (number)
- [ ] Languages offered (multi-select chips)
- [ ] What's Included (tag selector with predefined + custom)
- [ ] What's Not Included (optional)
- [ ] Accessibility options (checkboxes)

### AC4: Step 3 - Pricing
- [ ] Price per Person input (CHF, number with decimals)
- [ ] Group discount toggle + configuration
- [ ] Private booking option toggle + price modifier
- [ ] Children pricing (if applicable)
- [ ] Price preview card showing calculated examples

### AC5: Step 4 - Availability
- [ ] Calendar view for selecting available dates
- [ ] Time slot configuration (start times)
- [ ] Recurring schedule option
- [ ] Blocked dates selector
- [ ] Lead time setting (hours before booking cutoff)

### AC6: Image Upload Zone
- [ ] Drag & drop area with dashed border
- [ ] Click to browse files
- [ ] Accepted formats: JPG, PNG, WebP
- [ ] Max file size indicator
- [ ] Upload progress indicator
- [ ] Preview thumbnails of uploaded images
- [ ] Reorder functionality (drag to sort)
- [ ] Delete button on each thumbnail

```tsx
<div className="border-2 border-dashed border-[#e5d2d7] rounded-xl p-8 text-center
                hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer">
  <Upload className="mx-auto h-12 w-12 text-[#915564]" />
  <p className="mt-4 font-medium">Drag & drop images here</p>
  <p className="text-sm text-[#915564]">or click to browse</p>
</div>
```

### AC7: Inclusion Tags
- [ ] Predefined options as selectable chips:
  - Wine tasting, Cellar tour, Vineyard walk, Food pairing
  - Souvenir glass, Take-home bottle, Lunch, Snacks
- [ ] Selected chips: `bg-primary text-white`
- [ ] Unselected chips: `bg-white border border-[#e5d2d7]`
- [ ] "Add custom" option

### AC8: Form Navigation
- [ ] "Previous" button (secondary style, left)
- [ ] "Next" / "Save & Continue" button (primary, right)
- [ ] "Save as Draft" option
- [ ] Final step: "Publish Experience" button
- [ ] Progress auto-saved

### AC9: Validation & Feedback
- [ ] Inline validation on blur
- [ ] Error messages below fields in red
- [ ] Success indicators (green checkmarks)
- [ ] Required field indicators (*)
- [ ] Toast notifications for save actions

---

## Technical Notes

### Components to Create/Update
- `src/components/features/experience/CreateExperienceForm.tsx`
- `src/components/features/experience/ExperienceStepper.tsx`
- `src/components/features/experience/steps/BasicInfoStep.tsx`
- `src/components/features/experience/steps/DetailsStep.tsx`
- `src/components/features/experience/steps/PricingStep.tsx`
- `src/components/features/experience/steps/AvailabilityStep.tsx`
- `src/components/shared/ImageUpload.tsx` (enhance existing)
- `src/components/shared/TagSelector.tsx`

### Form State Management
Use React Hook Form with Zod validation:
```typescript
const experienceSchema = z.object({
  title: z.string().min(5).max(100),
  type: z.enum(['TASTING', 'CELLAR_VISIT', 'WORKSHOP', 'VINEYARD_TOUR', 'FOOD_PAIRING']),
  shortDescription: z.string().min(20).max(200),
  // ... etc
});
```

### Stepper State
```typescript
const [currentStep, setCurrentStep] = useState(1);
const [completedSteps, setCompletedSteps] = useState<number[]>([]);

const canNavigateToStep = (step: number) => {
  return step <= Math.max(...completedSteps, currentStep);
};
```

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| 4 steps (not 3 or 5) | Balances progress visibility with manageable chunks |
| Auto-save drafts | Prevents data loss, improves UX |
| Predefined inclusion tags | Faster input, consistent data |
| Calendar for availability | Visual, intuitive date selection |

---

## Out of Scope
- Bulk date management
- Template creation from existing experiences
- AI-assisted description writing

---

## Definition of Done
- [ ] All 4 steps implemented and navigable
- [ ] Stepper visually matches mockup
- [ ] Image upload with drag & drop working
- [ ] Form validation on all fields
- [ ] Draft save functionality
- [ ] Publish creates experience in database
- [ ] Mobile responsive
- [ ] Visual match with mockup 90%+
- [ ] Code reviewed and merged
