import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';

interface WineryCardProps {
  winery: {
    slug: string;
    name: string;
    commune: string;
    description: string;
    coverPhoto: string | null;
  };
}

export function WineryCard({ winery }: WineryCardProps) {
  return (
    <Link href={`/wineries/${winery.slug}`}>
      <Card className="h-full overflow-hidden transition-shadow hover:shadow-lg">
        <div className="relative aspect-[4/3] w-full">
          {winery.coverPhoto ? (
            <Image
              src={winery.coverPhoto}
              alt={winery.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-100">
              <svg
                className="h-16 w-16 text-slate-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}
        </div>
        <CardContent className="p-4">
          <h3 className="font-semibold text-slate-900">{winery.name}</h3>
          <p className="mt-1 text-sm text-slate-500">{winery.commune}, Valais</p>
          <p className="mt-2 line-clamp-2 text-sm text-slate-600">
            {winery.description}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
