import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { WineryAccessGuard } from '@/components/features/winery/WineryAccessGuard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Wine } from 'lucide-react';

export default async function ExperiencesDashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // Get winery with experiences
  const winery = await db.winery.findUnique({
    where: { userId: session.user.id },
    include: {
      experiences: {
        orderBy: { createdAt: 'desc' },
        include: {
          galleryImages: {
            orderBy: { order: 'asc' },
            take: 1,
          },
        },
      },
    },
  });

  if (!winery) {
    redirect('/onboarding/winery');
  }

  const experiences = winery.experiences;

  return (
    <WineryAccessGuard>
      <div className="container max-w-6xl py-12">
        {/* Page Header */}
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <h1 className="font-display text-display-md text-slate-900">
              Your Experiences
            </h1>
            <p className="text-slate-600">
              Create and manage wine experiences for visitors to book
            </p>
          </div>
          <Button asChild size="lg" className="gap-2">
            <Link href="/dashboard/experiences/new">
              <Plus className="h-5 w-5" />
              Create Experience
            </Link>
          </Button>
        </div>

        {/* Experiences List */}
        {experiences.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-burgundy-100">
                <Wine className="h-8 w-8 text-burgundy-600" />
              </div>
              <h3 className="font-display text-xl font-semibold text-slate-900">
                No experiences yet
              </h3>
              <p className="mt-2 max-w-sm text-slate-600">
                Create your first wine experience and start accepting bookings from
                visitors.
              </p>
              <Button asChild className="mt-6 gap-2">
                <Link href="/dashboard/experiences/new">
                  <Plus className="h-4 w-4" />
                  Create Your First Experience
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {experiences.map((experience) => (
              <Card
                key={experience.id}
                className="overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-warm-lg"
              >
                <div className="relative aspect-video bg-slate-100">
                  {experience.coverPhoto && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={experience.coverPhoto}
                      alt={experience.title}
                      className="h-full w-full object-cover"
                    />
                  )}
                  <div className="absolute right-2 top-2">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        experience.status === 'PUBLISHED'
                          ? 'bg-green-100 text-green-700'
                          : experience.status === 'DRAFT'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {experience.status}
                    </span>
                  </div>
                </div>
                <CardContent className="p-4">
                  <h3 className="font-display text-lg font-semibold text-slate-900 line-clamp-1">
                    {experience.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    CHF {(experience.price / 100).toFixed(0)} &middot;{' '}
                    {experience.duration >= 60
                      ? `${experience.duration / 60}h`
                      : `${experience.duration}min`}
                  </p>
                  <div className="mt-4 flex gap-2">
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <Link href={`/dashboard/experiences/${experience.id}/edit`}>
                        Edit
                      </Link>
                    </Button>
                    <Button asChild variant="secondary" size="sm" className="flex-1">
                      <Link href={`/experience/${experience.slug}`} target="_blank">
                        Preview
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </WineryAccessGuard>
  );
}
