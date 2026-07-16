# k6 — gates de charge P-16 (L-180)

Deux scénarios, exécutés en hebdo (`.github/workflows/weekly-gates.yml`,
lundi 05:00 UTC) et à la demande (`workflow_dispatch` = run pré-release) :

| Script                | Ce qu'il prouve                                                                                                                           | Gate                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `booking-oversell.js` | 20 visiteurs concurrents sur un créneau de 3 places via le **vrai** `createBookingHold` (route gated `E2E_TEST` `/api/test/booking-hold`) | `holds_created ≤ capacité` + invariant SQL post-run (`scripts/k6-assert-invariants.ts`) |
| `smoke.js`            | Surface publique sous charge légère (5 VUs / 30 s)                                                                                        | p95 < 800 ms, 0 5xx                                                                     |

La **double-rédemption gift** n'est pas k6-able hermétiquement (le chemin
HTTP exige une session Stripe Checkout complète) : son invariant est prouvé
contre un vrai Postgres par `tests/db/gift-redemption-concurrency.test.ts`
(verrou `SELECT … FOR UPDATE`), qui tourne sur **chaque PR** (job
`db-invariants`) et en hebdo. Répartition documentée au plan P-16.

## Run local

```bash
# 1. DB de test + schéma
npm run test:db:start
DATABASE_URL=postgresql://encave:encave@localhost:5433/encave_test npx prisma migrate deploy

# 2. Build + serveur avec la route k6 activée
npm run build
E2E_TEST=true npm run start &

# 3. Cible + tir + invariant
npx tsx scripts/k6-seed-oversell.ts > k6-target.json
k6 run \
  -e K6_BASE_URL=http://localhost:3000 \
  -e K6_EXPERIENCE_ID=$(jq -r .experienceId k6-target.json) \
  -e K6_DATE=$(jq -r .date k6-target.json) \
  -e K6_TIME_SLOT=$(jq -r .timeSlot k6-target.json) \
  -e K6_CAPACITY=$(jq -r .capacity k6-target.json) \
  tests/k6/booking-oversell.js
K6_EXPERIENCE_ID=... K6_DATE=... K6_TIME_SLOT=10:00 npx tsx scripts/k6-assert-invariants.ts

k6 run -e K6_BASE_URL=http://localhost:3000 tests/k6/smoke.js
```

Jamais contre staging/production : pollution DB + rate limiting per-IP
depuis une IP unique faussent la mesure (décision plan P-16).
