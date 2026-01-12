import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';

export const dynamic = 'force-dynamic';

type UnsubscribeType = 'daily_digest' | 'weekly_summary' | 'marketing' | 'all';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const { searchParams } = new URL(request.url);
    const type = (searchParams.get('type') as UnsubscribeType) || 'all';

    // Find preferences by unsubscribe token
    const preferences = await db.notificationPreferences.findUnique({
      where: { unsubscribeToken: token },
      include: { winery: true },
    });

    if (!preferences) {
      // Redirect to error page
      return NextResponse.redirect(
        new URL('/unsubscribe?status=invalid', request.url)
      );
    }

    // Update preferences based on type
    const updateData: Record<string, boolean> = {};

    switch (type) {
      case 'daily_digest':
        updateData.dailyDigest = false;
        break;
      case 'weekly_summary':
        updateData.weeklySummary = false;
        break;
      case 'marketing':
        updateData.marketingEmails = false;
        break;
      case 'all':
      default:
        updateData.dailyDigest = false;
        updateData.weeklySummary = false;
        updateData.marketingEmails = false;
        break;
    }

    await db.notificationPreferences.update({
      where: { id: preferences.id },
      data: updateData,
    });

    // Redirect to success page
    return NextResponse.redirect(
      new URL(`/unsubscribe?status=success&type=${type}`, request.url)
    );
  } catch (error) {
    console.error('[Unsubscribe] Error:', error);
    return NextResponse.redirect(
      new URL('/unsubscribe?status=error', request.url)
    );
  }
}
