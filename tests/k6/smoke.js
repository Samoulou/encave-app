/**
 * P-16 / L-180 — light HTTP load smoke over the public surface: the k6
 * complement to the DB-level invariants (gift double-redemption is proven
 * in tests/db/gift-redemption-concurrency.test.ts — its HTTP path requires
 * a full Stripe checkout session and is not k6-able hermetically).
 *
 * Gate: p95 < 800 ms and zero 5xx under 5 VUs sustained.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:3000';

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<800'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
};

const PATHS = ['/fr', '/fr/experiences', '/fr/wineries', '/api/health'];

export default function () {
  for (const path of PATHS) {
    const res = http.get(`${BASE_URL}${path}`, {
      tags: { name: path },
    });
    check(res, {
      [`GET ${path} < 400`]: (r) => r.status < 400,
    });
  }
  sleep(1);
}
