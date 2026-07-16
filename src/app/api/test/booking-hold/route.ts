import { NextRequest, NextResponse } from 'next/server';
import { createBookingHold } from '@/server/actions/checkout';

/**
 * k6-only entry point to the hold engine (P-16 / L-180). Server actions are
 * addressed by build-hashed IDs that the reference manifest does not map to
 * names, so the oversell load scenario calls the REAL `createBookingHold`
 * (same validation, rate limiting, transaction and capacity CAS) through
 * this route instead. Hard-gated on E2E_TEST — in any environment where the
 * variable is unset (production included) the route is a plain 404.
 */
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (process.env.E2E_TEST !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_JSON' } },
      { status: 200 }
    );
  }

  // Always 200: k6 asserts on the JSON `success` flag, and a NO_CAPACITY
  // refusal is an EXPECTED outcome of the oversell scenario, not an HTTP
  // failure (http_req_failed would otherwise trip on it).
  const result = await createBookingHold(
    body as Parameters<typeof createBookingHold>[0]
  );
  return NextResponse.json(result, { status: 200 });
}
