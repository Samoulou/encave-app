'use client';

import { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IMAGE_PLACEHOLDERS } from '@/lib/image-placeholder';
import { FadeIn } from '@/components/shared/FadeIn';
import { ImageWithFallback } from '@/components/shared/ImageWithFallback';

interface GalleryImage {
  id: string;
  url: string;
  order: number;
}

interface ExperienceDetailGalleryProps {
  coverPhoto: string | null;
  images: GalleryImage[];
  experienceTitle: string;
}

function getValidImageUrl(url: string | null | undefined) {
  const trimmed = url?.trim();
  if (!trimmed) return null;

  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    return ['http:', 'https:'].includes(parsed.protocol) ? trimmed : null;
  } catch {
    return null;
  }
}

export function ExperienceDetailGallery({
  coverPhoto,
  images,
  experienceTitle,
}: ExperienceDetailGalleryProps) {
  const t = useTranslations('gallery');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Combine only valid images; production data can contain legacy/empty URLs.
  const allImages = [
    ...(getValidImageUrl(coverPhoto)
      ? [{ id: 'cover', url: getValidImageUrl(coverPhoto)!, order: 0 }]
      : []),
    ...images
      .map((image) => ({ ...image, url: getValidImageUrl(image.url) }))
      .filter(
        (image): image is GalleryImage =>
          typeof image.url === 'string' && image.url.length > 0
      )
      .slice(0, 4),
  ];

  const heroImage = allImages[0] ?? null;

  const openLightbox = (index: number) => {
    if (allImages.length === 0) return;
    setCurrentIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
  }, [allImages.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1));
  }, [allImages.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!lightboxOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') goToPrevious();
      if (e.key === 'ArrowRight') goToNext();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [lightboxOpen, goToPrevious, goToNext]);

  const remainingCount =
    images.filter((image) => getValidImageUrl(image.url)).length > 4
      ? images.filter((image) => getValidImageUrl(image.url)).length - 4
      : 0;

  return (
    <>
      {/* Gallery — vertical layout for side-by-side with booking widget */}
      <div
        className="mb-10 flex flex-col gap-3"
        data-testid="experience-gallery"
      >
        {/* Hero image — full width of left column */}
        <button
          type="button"
          onClick={() => openLightbox(0)}
          data-testid="experience-hero-image"
          className={cn(
            'group relative aspect-[16/10] w-full overflow-hidden rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
            heroImage ? 'cursor-pointer' : 'cursor-default'
          )}
        >
          <div className="absolute inset-0 z-10 bg-black/10 transition-colors group-hover:bg-black/0" />
          {heroImage ? (
            <ImageWithFallback
              src={heroImage.url}
              alt={experienceTitle}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, 66vw"
              priority
              unoptimized
              placeholder="blur"
              blurDataURL={IMAGE_PLACEHOLDERS.hero}
            />
          ) : (
            <ImageWithFallback
              src=""
              alt={experienceTitle}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 66vw"
              fallbackClassName="absolute inset-0"
            />
          )}
        </button>

        {/* Secondary images — 2-col grid, fade in on scroll (hidden on mobile) */}
        {allImages.length > 1 && (
          <div className="hidden grid-cols-2 gap-3 md:grid">
            {allImages.slice(1, 5).map((image, index) => {
              const isLastWithMore = index === 3 && remainingCount > 0;

              return (
                <FadeIn key={image.id} delay={index * 150} direction="up">
                  <button
                    type="button"
                    onClick={() => openLightbox(index + 1)}
                    className="group relative aspect-[4/3] w-full cursor-pointer overflow-hidden rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  >
                    {isLastWithMore && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 transition-colors group-hover:bg-black/30">
                        <span className="border-b-2 border-white pb-1 text-lg font-bold text-white">
                          View All Photos
                        </span>
                      </div>
                    )}
                    {!isLastWithMore && (
                      <div className="absolute inset-0 z-10 bg-black/10 transition-colors group-hover:bg-black/0" />
                    )}
                    <ImageWithFallback
                      src={image.url}
                      alt={t('imageAlt', {
                        title: experienceTitle,
                        index: index + 2,
                      })}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      sizes="(max-width: 768px) 50vw, 33vw"
                      unoptimized
                      placeholder="blur"
                      blurDataURL={IMAGE_PLACEHOLDERS.square}
                    />
                  </button>
                </FadeIn>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxOpen && allImages[currentIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
          role="dialog"
          aria-modal="true"
          aria-label={t('lightbox')}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white"
            aria-label={t('closeLightbox')}
          >
            <X className="h-6 w-6" />
          </button>

          {/* Previous button */}
          {allImages.length > 1 && (
            <button
              type="button"
              onClick={goToPrevious}
              className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white"
              aria-label={t('previousImage')}
            >
              <ChevronLeft className="h-8 w-8" />
            </button>
          )}

          {/* Image */}
          <div className="relative h-[80vh] w-[90vw] max-w-5xl">
            <ImageWithFallback
              src={allImages[currentIndex].url}
              alt={t('imageAlt', {
                title: experienceTitle,
                index: currentIndex + 1,
              })}
              fill
              className="object-contain"
              sizes="90vw"
              priority
              unoptimized
              placeholder="blur"
              blurDataURL={IMAGE_PLACEHOLDERS.hero}
            />
          </div>

          {/* Next button */}
          {allImages.length > 1 && (
            <button
              type="button"
              onClick={goToNext}
              className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white"
              aria-label={t('nextImage')}
            >
              <ChevronRight className="h-8 w-8" />
            </button>
          )}

          {/* Image counter */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-4 py-2 text-sm text-white">
            {t('imageCounter', {
              current: currentIndex + 1,
              total: allImages.length,
            })}
          </div>

          {/* Thumbnail strip */}
          {allImages.length > 1 && (
            <div className="absolute bottom-16 left-1/2 flex -translate-x-1/2 gap-2">
              {allImages.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => setCurrentIndex(index)}
                  className={cn(
                    'relative h-12 w-12 overflow-hidden rounded-md border-2 transition-all focus:outline-none focus:ring-2 focus:ring-white',
                    index === currentIndex
                      ? 'border-white'
                      : 'border-transparent opacity-60 hover:opacity-100'
                  )}
                  aria-label={t('goToImage', { index: index + 1 })}
                >
                  <ImageWithFallback
                    src={image.url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="48px"
                    unoptimized
                    placeholder="blur"
                    blurDataURL={IMAGE_PLACEHOLDERS.square}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
