import { Wine } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/shared/Skeleton';

export default function AuthLoading() {
  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Image placeholder (hidden on mobile) */}
      <div className="relative hidden w-1/2 md:block">
        <div className="absolute inset-0 bg-gradient-to-b from-burgundy-900 to-burgundy-800" />

        {/* Quote skeleton at bottom */}
        <div className="absolute bottom-12 left-8 right-8">
          <Skeleton className="h-8 w-3/4 bg-white/20" />
          <Skeleton className="mt-2 h-8 w-1/2 bg-white/20" />
          <Skeleton className="mt-4 h-4 w-24 bg-white/20" />
        </div>
      </div>

      {/* Right Panel - Form skeleton */}
      <div className="flex w-full flex-col justify-center bg-cream-50 px-6 py-12 md:w-1/2 md:px-12 lg:px-16">
        {/* Logo */}
        <div className="mb-8">
          <Link href="/" className="group inline-flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-burgundy-600 text-white">
              <Wine className="h-5 w-5" />
            </div>
            <span className="font-display text-2xl font-semibold text-burgundy-800">
              EnCave
            </span>
          </Link>
        </div>

        {/* Form skeleton */}
        <div className="w-full max-w-md space-y-6">
          {/* Heading */}
          <div className="mb-8">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="mt-2 h-5 w-64" />
          </div>

          {/* Form fields */}
          <div className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-11 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-11 w-full" />
            </div>

            {/* Button */}
            <Skeleton className="h-11 w-full" />

            {/* Link */}
            <Skeleton className="mx-auto h-4 w-48" />
          </div>
        </div>
      </div>
    </div>
  );
}
