# US-UI-04: User Login Page UI Adaptation

## Story

**As a** returning user or new visitor wanting to book,
**I want** a clean, trustworthy login page with multiple sign-in options,
**So that** I can quickly access my account or create one with minimal friction.

---

## References

| Resource | Location |
|----------|----------|
| **Mockup PNG** | `docs/mockups/user_login/screen.png` |
| **Mockup Code** | `docs/mockups/user_login/code.html` |
| **UI Spec** | `docs/ui-adaptation-spec.md` (Section: User Login) |
| **Current Page** | `src/app/[locale]/(auth)/login/page.tsx` |

---

## Acceptance Criteria

### AC1: Page Layout (Desktop)
- [ ] Split-screen layout: Form (50%) | Image (50%)
- [ ] Form section: `bg-background-light` (#f8f6f6)
- [ ] Image section: Full-height vineyard/wine image with subtle overlay
- [ ] Vertically centered content on both sides

### AC2: Page Layout (Mobile)
- [ ] Full-width form
- [ ] Image as background with dark overlay
- [ ] Form card with semi-transparent background or solid white

### AC3: Login Form
- [ ] EnCave logo at top
- [ ] Heading: "Welcome back" (`text-2xl font-bold`)
- [ ] Subheading: "Sign in to your account" (`text-text-secondary`)
- [ ] Email input with envelope icon prefix
- [ ] Password input with lock icon prefix + show/hide toggle
- [ ] "Remember me" checkbox
- [ ] "Forgot password?" link (text-primary, right-aligned)
- [ ] "Sign In" button (full-width, primary style)

### AC4: Input Field Styling
- [ ] Height: `h-12` (48px)
- [ ] Border: `border-[#e5d2d7]`
- [ ] Background: `bg-[#fbf9f9]`
- [ ] Focus: `border-primary ring-2 ring-primary/20`
- [ ] Icon prefix: `text-[#915564]` with `pl-10` padding
- [ ] Placeholder: `text-[#915564]/60`

```tsx
<div className="relative">
  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#915564]" />
  <Input
    type="email"
    placeholder="you@example.com"
    className="pl-10 h-12 border-[#e5d2d7] bg-[#fbf9f9] focus:border-primary"
  />
</div>
```

### AC5: Social Login Buttons
- [ ] Divider: "Or continue with" with horizontal lines
- [ ] Google button: White/light gray background, Google logo
- [ ] Apple button: Black background, white Apple logo (optional)
- [ ] Button styling: `h-12 rounded-lg border font-medium`
- [ ] Full-width, stacked vertically

### AC6: Registration Link
- [ ] Text: "Don't have an account?"
- [ ] Link: "Sign up" (text-primary, underline on hover)
- [ ] Positioned below form

### AC7: Trust Elements
- [ ] Secure connection indicator (lock icon) subtle
- [ ] Clean, professional appearance instills trust

---

## Technical Notes

### Components to Update
- `src/app/[locale]/(auth)/login/page.tsx`
- `src/components/features/auth/LoginForm.tsx`
- `src/components/features/auth/SocialLoginButtons.tsx`

### Split Layout Implementation
```tsx
<div className="min-h-screen flex">
  {/* Form Side */}
  <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-[#f8f6f6]">
    <div className="w-full max-w-md">
      <LoginForm />
    </div>
  </div>

  {/* Image Side - Desktop only */}
  <div className="hidden lg:block w-1/2 relative">
    <Image
      src="/images/auth-vineyard.jpg"
      alt="Valais vineyard"
      fill
      className="object-cover"
    />
    <div className="absolute inset-0 bg-black/20" />
  </div>
</div>
```

### NextAuth Integration
Ensure social login buttons trigger NextAuth providers:
```tsx
<Button onClick={() => signIn('google')}>
  <GoogleIcon className="mr-2 h-5 w-5" />
  Continue with Google
</Button>
```

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Split-screen on desktop | Creates visual interest, matches mockup |
| Image hidden on mobile | Keeps form accessible, reduces load time |
| Icon prefixes in inputs | Improves scanability and visual hierarchy |
| Social login prominent | Reduces friction, faster sign-in |

---

## Out of Scope
- Password reset flow (separate page/US)
- Two-factor authentication UI
- Account linking

---

## Definition of Done
- [ ] Split layout renders correctly on desktop
- [ ] Mobile layout with form centered
- [ ] All form inputs styled per spec
- [ ] Social login buttons functional
- [ ] Form validation with error states
- [ ] Remember me functionality working
- [ ] Visual match with mockup 90%+
- [ ] Code reviewed and merged
