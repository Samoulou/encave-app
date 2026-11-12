import { NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { buildPrivacyExport } from '@/server/services/privacy-export.service';
import { logError } from '@/lib/logger';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // The export dumps guest bookings matched by email alone — require a VERIFIED
  // email so an unverified sign-up can't export another guest's PII.
  if (!session.user.emailVerified) {
    return NextResponse.json({ error: 'Email not verified' }, { status: 403 });
  }

  try {
    // Account + every table keyed by the person's email (bookings, gift
    // cards, sur-mesure requests, wine orders, email preferences,
    // newsletter) — see buildPrivacyExport.
    const exportPayload = await buildPrivacyExport(session.user.id);

    if (!exportPayload) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return new NextResponse(JSON.stringify(exportPayload, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="encave-data-${session.user.id}.json"`,
        // Personal data: never stored by a shared cache or the browser.
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    logError('Privacy export failed', error, {
      action: 'privacyExport',
      userId: session.user.id,
    });
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
