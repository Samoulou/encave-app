import { NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
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
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        emailVerified: true,
        role: true,
        preferredLocale: true,
        cookieConsent: true,
        anonymizedAt: true,
        suspendedAt: true,
        createdAt: true,
        updatedAt: true,
        winery: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            address: true,
            commune: true,
            phone: true,
            email: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            experiences: {
              select: {
                id: true,
                title: true,
                slug: true,
                type: true,
                duration: true,
                price: true,
                status: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const bookings = await db.booking.findMany({
      where: { visitorEmail: { equals: user.email, mode: 'insensitive' } },
      select: {
        id: true,
        reference: true,
        visitorEmail: true,
        visitorName: true,
        visitorPhone: true,
        date: true,
        timeSlot: true,
        guestCount: true,
        totalPrice: true,
        status: true,
        cancelledAt: true,
        cancellationReason: true,
        refundIssued: true,
        refundAmount: true,
        checkedInAt: true,
        ageConfirmedAt: true,
        ageConfirmedVersion: true,
        createdAt: true,
        updatedAt: true,
        experience: {
          select: {
            title: true,
            slug: true,
            winery: { select: { name: true, slug: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      subject: {
        user,
        bookings,
      },
    };

    return new NextResponse(JSON.stringify(exportPayload, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="encave-data-${user.id}.json"`,
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
