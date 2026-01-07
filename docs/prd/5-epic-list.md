# 5. Epic List

| #          | Epic Title                     | Goal Statement                                                                                                                            |
| ---------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Epic 1** | Foundation & Identity          | Establish project infrastructure, authentication system, and winemaker onboarding - delivering a public page listing verified winemakers. |
| **Epic 2** | Experience Catalog & Discovery | Enable winemakers to create experiences and visitors to search/browse them - delivering a functional discovery platform.                  |
| **Epic 3** | Booking & Payments             | Implement the complete reservation flow with Stripe Connect integration - delivering the core transactional value.                        |
| **Epic 4** | Operations & Launch Readiness  | Complete winemaker dashboard, notification system, and bilingual support - delivering a production-ready marketplace.                     |

## Epic Flow

```
Epic 1: Foundation          Epic 2: Catalog           Epic 3: Booking          Epic 4: Operations
┌─────────────────┐        ┌─────────────────┐       ┌─────────────────┐      ┌─────────────────┐
│ • Next.js setup │        │ • Create exp.   │       │ • Booking flow  │      │ • Dashboard     │
│ • Auth system   │───────▶│ • Search/filter │──────▶│ • Stripe Connect│─────▶│ • Notifications │
│ • Winery profile│        │ • Detail page   │       │ • Confirmations │      │ • Calendar mgmt │
│ • Public listing│        │ • Photo upload  │       │ • Cancellations │      │ • i18n FR/DE    │
└─────────────────┘        └─────────────────┘       └─────────────────┘      └─────────────────┘
```

---
