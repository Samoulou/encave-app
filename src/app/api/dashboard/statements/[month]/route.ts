import { NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { isMonthKey } from '@/lib/utils/date-key';
import { getMonthlyStatementData } from '@/server/queries/earnings.queries';
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
  const requestUrl = new URL(request.url);
  const localeParamRaw = requestUrl.searchParams.get('locale');
  const locale: StatementLocale = LOCALES.includes(
    localeParamRaw as StatementLocale
  )
    ? (localeParamRaw as StatementLocale)
    : 'fr';

  const session = await auth();
  if (!session?.user) {
    // Email #17 links land here from mail clients without a session:
    // a login page beats a raw 401 JSON dead-end. The login flow brings
    // the user back to their dashboard, where the statement is one tap
    // away.
    return NextResponse.redirect(new URL(`/${locale}/login`, requestUrl));
  }

  const { month } = await params;
  if (!isMonthKey(month)) {
    return NextResponse.json({ error: 'Invalid month' }, { status: 400 });
  }

  const winery = await db.winery.findUnique({
    where: { userId: session.user.id },
    select: { id: true, name: true },
  });
  if (!winery) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

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
