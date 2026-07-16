/**
 * P-16 / L-180 — oversell load scenario: 20 concurrent visitors race for a
 * 3-seat slot through the REAL hold engine (`createBookingHold`, exposed to
 * k6 via the E2E_TEST-gated route /api/test/booking-hold).
 *
 * Pass = at most K6_CAPACITY holds are created (threshold below) AND the
 * post-run SQL invariant (scripts/k6-assert-invariants.ts) holds.
 *
 * Local run:
 *   E2E_TEST=true npm run start &
 *   npx tsx scripts/k6-seed-oversell.ts > k6-target.json
 *   k6 run -e K6_BASE_URL=http://localhost:3000 \
 *          -e K6_EXPERIENCE_ID=$(jq -r .experienceId k6-target.json) \
 *          -e K6_DATE=$(jq -r .date k6-target.json) \
 *          -e K6_TIME_SLOT=$(jq -r .timeSlot k6-target.json) \
 *          tests/k6/booking-oversell.js
 */
import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const holdsCreated = new Counter('holds_created');
const CAPACITY = Number(__ENV.K6_CAPACITY || '3');
const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:3000';

export const options = {
  scenarios: {
    oversell: {
      executor: 'per-vu-iterations',
      vus: 20,
      iterations: 1,
      maxDuration: '2m',
    },
  },
  thresholds: {
    // The gate: more successful holds than seats = oversell = red build.
    holds_created: [`count<=${CAPACITY}`],
    // Transport-level failures only — NO_CAPACITY refusals come back as
    // HTTP 200 with success:false by design.
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  const payload = JSON.stringify({
    experienceId: __ENV.K6_EXPERIENCE_ID,
    date: __ENV.K6_DATE,
    timeSlot: __ENV.K6_TIME_SLOT,
    guestCount: 1,
  });

  const res = http.post(`${BASE_URL}/api/test/booking-hold`, payload, {
    headers: {
      'Content-Type': 'application/json',
      // One synthetic IP per VU: the per-IP hold rate limit (12/10 min)
      // must not serialize the race we are trying to provoke.
      'x-forwarded-for': `203.0.113.${(__VU % 250) + 1}`,
    },
  });

  const ok = check(res, {
    'HTTP 200': (r) => r.status === 200,
    'JSON body': (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch {
        return false;
      }
    },
  });

  if (ok) {
    const body = JSON.parse(res.body);
    if (body.success) {
      holdsCreated.add(1);
    } else {
      // Anything other than a clean capacity/validation refusal is a bug
      // worth failing loudly on.
      check(body, {
        'refusal is NO_CAPACITY': (b) =>
          b.error && b.error.code === 'NO_CAPACITY',
      });
    }
  }
}
