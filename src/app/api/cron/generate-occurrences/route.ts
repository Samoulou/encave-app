import { NextResponse } from 'next/server';
import { ExperienceStatus, WineryStatus } from '@prisma/client';
import { verifyCronRequest } from '@/lib/cron-auth';
import { db } from '@/server/db';
import { logError, logInfo } from '@/lib/logger';
import { generateOccurrences } from '@/server/services/occurrence.service';

/**
 * Daily horizon roll (P-05 / L-024): materialize the day newly entering
 * the rolling window for every bookable experience. Idempotent
 * (createMany skipDuplicates) — a missed run only delays the calendar
 * preview; the booking path's defensive resolve never depends on it.
 */
export async function GET() {
  const authorized = await verifyCronRequest();
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    const experiences = await db.experience.findMany({
      where: {
        status: ExperienceStatus.PUBLISHED,
        winery: { status: WineryStatus.VERIFIED },
      },
      select: { id: true },
    });

    let created = 0;
    let failures = 0;
    for (const experience of experiences) {
      try {
        const result = await generateOccurrences(experience.id);
        created += result.created;
      } catch (error) {
        failures++;
        logError('generate-occurrences cron: experience failed', error, {
          action: 'generateOccurrencesCron',
          experienceId: experience.id,
        });
      }
    }

    logInfo('occurrences.cron_roll', {
      action: 'generateOccurrencesCron',
      experiences: experiences.length,
      created,
      failures,
    });
    return NextResponse.json({
      experiences: experiences.length,
      created,
      failures,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    logError('generate occurrences cron failed', error, {
      action: 'generateOccurrencesCron',
    });
    return NextResponse.json(
      { error: 'Internal error', durationMs: Date.now() - startedAt },
      { status: 500 }
    );
  }
}
