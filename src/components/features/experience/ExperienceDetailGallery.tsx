'use client';

import { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IMAGE_PLACEHOLDERS } from '@/lib/image-placeholder';

interface GalleryImage {
  id: string;
  url: string;
  order: number;
}

interface ExperienceDetailGalleryProps {
  coverPhoto: string;
  images: GalleryImage[];
  experienceTitle: string;
}

export function ExperienceDetailGallery({
  coverPhoto,
  images,
  experienceTitle,
}: ExperienceDetailGalleryProps) {
  const t = useTranslations('gallery');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Combine cover photo with gallery images for the display
  const allImages = [
    { id: 'cover', url: coverPhoto, order: 0 },
    ...images.slice(0, 4), // Take up to 4 gallery images
  ];

  const openLightbox = (index: number) => {
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

  const remainingCount = images.length > 4 ? images.length - 4 : 0;

  return (
    <>
      {/* Gallery Grid */}
      <div
        className="grid grid-cols-1 md:grid-cols-4 gap-3 h-[400px] md:h-[500px] mb-12 rounded-2xl overflow-hidden"
        data-testid="experience-gallery"
      >
        {/* Main Image (spans 2 cols, 2 rows) */}
        <button
          type="button"
          onClick={() => openLightbox(0)}
          className="md:col-span-2 md:row-span-2 h-full relative group cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors z-10" />
          <div className="relative w-full h-full">
            <Image
              src={coverPhoto}
              alt={experienceTitle}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, 50vw"
              priority
              placeholder="blur"
              blurDataURL={IMAGE_PLACEHOLDERS.hero}
            />
          </div>
        </button>

        {/* Secondary Images */}
        {allImages.slice(1, 5).map((image, index) => {
          const isLastWithMore = index === 3 && remainingCount > 0;

          return (
            <button
              key={image.id}
              type="button"
              onClick={() => openLightbox(index + 1)}
              className="hidden md:block h-full relative group cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              {isLastWithMore ? (
                <>
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors z-10 flex items-center justify-center">
                    <span className="text-white font-bold text-lg border-b-2 border-white pb-1">
                      View All Photos
                    </span>
                  </div>
                  <div className="relative w-full h-full">
                    <Image
                      src={image.url}
                      alt={t('imageAlt', { title: experienceTitle, index: index + 2 })}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, 25vw"
                      placeholder="blur"
                      blurDataURL={IMAGE_PLACEHOLDERS.square}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors z-10" />
                  <div className="relative w-full h-full">
                    <Image
                      src={image.url}
                      alt={t('imageAlt', { title: experienceTitle, index: index + 2 })}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      sizes="(max-width: 768px) 50vw, 25vw"
                      placeholder="blur"
                      blurDataURL={IMAGE_PLACEHOLDERS.square}
                    />
                  </div>
                </>
              )}
            </button>
          );
        })}

        {/* Fill empty slots if less than 4 gallery images */}
        {allImages.length < 5 &&
          Array.from({ length: 5 - allImages.length }).map((_, index) => (
            <div
              key={`empty-${index}`}
              className="hidden md:block h-full bg-stone-200"
            />
          ))}
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
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
            <Image
              src={allImages[currentIndex]?.url ?? ''}
              alt={t('imageAlt', { title: experienceTitle, index: currentIndex + 1 })}
              fill
              className="object-contain"
              sizes="90vw"
              priority
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
            {t('imageCounter', { current: currentIndex + 1, total: allImages.length })}
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
                  <Image
                    src={image.url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="48px"
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
