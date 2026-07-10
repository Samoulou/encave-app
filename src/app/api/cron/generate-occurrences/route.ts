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

// Vercel: allow the full catalog sweep to finish (default is 10s-60s
// depending on plan; each experience costs 2 queries).
export const maxDuration = 300;

// Bounded concurrency: enough to amortize latency, small enough to stay
// inside the pooled connection budget shared with live traffic.
const GENERATION_BATCH_SIZE = 5;

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
    for (let i = 0; i < experiences.length; i += GENERATION_BATCH_SIZE) {
      const batch = experiences.slice(i, i + GENERATION_BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((experience) => generateOccurrences(experience.id))
      );
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          created += result.value.created;
        } else {
          failures++;
          logError(
            'generate-occurrences cron: experience failed',
            result.reason,
            {
              action: 'generateOccurrencesCron',
              experienceId: batch[index]?.id,
            }
          );
        }
      });
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
