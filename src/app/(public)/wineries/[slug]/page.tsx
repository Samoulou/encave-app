import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { getWineryBySlug } from '@/server/queries/winery.queries';

interface WineryPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: WineryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const winery = await getWineryBySlug(slug);

  if (!winery) {
    return { title: 'Winery Not Found' };
  }

  return {
    title: `${winery.name} | EnCave`,
    description: winery.description.substring(0, 160),
    openGraph: {
      title: `${winery.name} | EnCave`,
      description: winery.description.substring(0, 160),
      type: 'website',
      ...(winery.coverPhoto && { images: [winery.coverPhoto] }),
    },
  };
}

export default async function WineryPage({ params }: WineryPageProps) {
  const { slug } = await params;
  const winery = await getWineryBySlug(slug);

  if (!winery) {
    notFound();
  }

  return (
    <div className="min-h-screen">
      {/* Cover Photo */}
      {winery.coverPhoto ? (
        <div className="relative h-[300px] w-full md:h-[400px]">
          <Image
            src={winery.coverPhoto}
            alt={winery.name}
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
            <div className="container">
              <h1 className="text-3xl font-bold md:text-4xl">{winery.name}</h1>
              <p className="mt-2 text-lg opacity-90">{winery.commune}, Valais</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-burgundy-700 py-16">
          <div className="container">
            <h1 className="text-3xl font-bold text-white md:text-4xl">
              {winery.name}
            </h1>
            <p className="mt-2 text-lg text-white/90">
              {winery.commune}, Valais
            </p>
          </div>
        </div>
      )}

      <div className="container py-10">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* About */}
            <Card>
              <CardContent className="p-6">
                <h2 className="mb-4 text-xl font-semibold text-slate-900">
                  About
                </h2>
                <p className="whitespace-pre-wrap text-slate-600">
                  {winery.description}
                </p>
              </CardContent>
            </Card>

            {/* Gallery */}
            {winery.galleryImages.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="mb-4 text-xl font-semibold text-slate-900">
                    Gallery
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                    {winery.galleryImages.map((image) => (
                      <div
                        key={image.id}
                        className="relative aspect-square overflow-hidden rounded-lg"
                      >
                        <Image
                          src={image.url}
                          alt={`${winery.name} gallery`}
                          fill
                          className="object-cover transition-transform hover:scale-105"
                          sizes="(max-width: 768px) 50vw, 33vw"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <h2 className="mb-4 text-lg font-semibold text-slate-900">
                  Contact
                </h2>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <svg
                      className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <div>
                      <p className="text-slate-900">{winery.address}</p>
                      <p className="text-slate-600">{winery.commune}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <svg
                      className="h-5 w-5 flex-shrink-0 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                    <span className="text-slate-900">{winery.phone}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <svg
                      className="h-5 w-5 flex-shrink-0 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    <span className="text-slate-900">{winery.email}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Coming Soon Teaser */}
            <Card className="border-dashed border-2 border-burgundy-200 bg-burgundy-50">
              <CardContent className="p-6 text-center">
                <svg
                  className="mx-auto h-10 w-10 text-burgundy-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <h3 className="mt-3 font-semibold text-burgundy-900">
                  Coming soon: Book experiences
                </h3>
                <p className="mt-1 text-sm text-burgundy-700">
                  Wine tastings and tours will be available for booking soon.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
