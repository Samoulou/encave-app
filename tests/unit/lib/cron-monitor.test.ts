import { describe, expect, it } from 'vitest';
import vercelJson from '../../../vercel.json';
import { CRON_SCHEDULES } from '@/lib/cron-monitor';

/**
 * P-16 review (#120): CRON_SCHEDULES hand-mirrors vercel.json — a drift
 * means false "missed check-in" pages (schedule moved without updating the
 * monitor) or, worse, a real dead cron masked by a looser declaration.
 * This test makes the invariant mechanical: for every cron route path in
 * vercel.json, the monitor slug's crontab must equal the exact UNION of
 * its schedules — and no monitored slug may exist without a vercel entry.
 */

function slugForPath(path: string): string {
  const route = path.replace('/api/cron/', '').split('?')[0];
  return `encave-${route}`;
}

/** '0 16 * * *' + '0 17 * * *' → '0 16,17 * * *' (same shape as the file). */
function unionCrontabs(crontabs: string[]): string {
  const parts = crontabs.map((c) => c.trim().split(/\s+/));
  const first = parts[0];
  if (!first) throw new Error('no crontab to union');
  for (const p of parts) {
    expect(p).toHaveLength(5);
    // Only the hour field may differ between invocations of one route.
    expect([p[0], p[2], p[3], p[4]]).toEqual([
      first[0],
      first[2],
      first[3],
      first[4],
    ]);
  }
  const hours = Array.from(new Set(parts.map((p) => p[1] as string))).sort(
    (a, b) => Number(a) - Number(b)
  );
  return [first[0], hours.join(','), first[2], first[3], first[4]].join(' ');
}

describe('CRON_SCHEDULES mirrors vercel.json (P-16 / WS-E)', () => {
  const byRoute = new Map<string, string[]>();
  for (const cron of vercelJson.crons) {
    const slug = slugForPath(cron.path);
    byRoute.set(slug, [...(byRoute.get(slug) ?? []), cron.schedule]);
  }

  it('every vercel.json cron route has a monitor slug with the exact union schedule', () => {
    for (const [slug, schedules] of byRoute) {
      expect(CRON_SCHEDULES, `missing monitor slug for ${slug}`).toHaveProperty(
        slug
      );
      expect(
        CRON_SCHEDULES[slug as keyof typeof CRON_SCHEDULES],
        `schedule drift for ${slug}`
      ).toBe(unionCrontabs(schedules));
    }
  });

  it('no monitor slug exists without a vercel.json entry (dead declaration)', () => {
    for (const slug of Object.keys(CRON_SCHEDULES)) {
      expect(byRoute.has(slug), `orphan monitor slug ${slug}`).toBe(true);
    }
  });

  it('every monitored route file actually wraps withCronMonitor with its slug', async () => {
    const { readFile } = await import('node:fs/promises');
    for (const slug of Object.keys(CRON_SCHEDULES)) {
      const route = slug.replace(/^encave-/, '');
      const source = await readFile(
        `src/app/api/cron/${route}/route.ts`,
        'utf8'
      );
      // Prettier may break the call across lines — match loosely.
      expect(source, `route ${route} not wrapped`).toMatch(
        new RegExp(`withCronMonitor\\(\\s*'${slug}'`)
      );
    }
  });
});
