import { NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import {
  getMonthlyStatementData,
  STATEMENT_MONTH_KEY_REGEX,
} from '@/server/queries/earnings.queries';
import {
  generateMonthlyStatementPDF,
  type StatementLocale,
} from '@/server/services/monthly-statement.service';
import { logError } from '@/lib/logger';

const LOCALES: StatementLocale[] = ['fr', 'de', 'en'];

/**
 * Monthly statement PDF (P-13 / L-142). Session-authenticated: the
 * statement always belongs to the caller's own winery — the month is the
 * only variable input. Linked from the earnings page and email #17.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ month: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { month } = await params;
  if (!STATEMENT_MONTH_KEY_REGEX.test(month)) {
    return NextResponse.json({ error: 'Invalid month' }, { status: 400 });
  }

  const winery = await db.winery.findUnique({
    where: { userId: session.user.id },
    select: { id: true, name: true },
  });
  if (!winery) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const localeParam = new URL(request.url).searchParams.get('locale');
  const locale: StatementLocale = LOCALES.includes(
    localeParam as StatementLocale
  )
    ? (localeParam as StatementLocale)
    : 'fr';

  try {
    const data = await getMonthlyStatementData(winery.id, month);
    if (!data) {
      return NextResponse.json({ error: 'Invalid month' }, { status: 400 });
    }

    const pdf = await generateMonthlyStatementPDF(winery.name, data, locale);

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="encave-releve-${month}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    logError('Monthly statement generation failed', error, {
      action: 'monthlyStatement',
      userId: session.user.id,
      month,
    });
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}
