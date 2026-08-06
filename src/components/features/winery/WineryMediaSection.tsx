'use client';

import { useState } from 'react';
import Image from 'next/image';
import { X, Camera } from 'lucide-react';
import { ImageUpload } from '@/components/shared/ImageUpload';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

interface GalleryImage {
  id: string;
  url: string;
  order: number;
}

interface WineryMediaSectionProps {
  coverPhoto: string | null;
  galleryImages: GalleryImage[];
  isUploadingCover: boolean;
  uploadingGalleryIndex: number | null;
  maxGalleryImages: number;
  onImageUpload: (_file: File) => Promise<string>;
  onCoverPhotoChange: (_url: string | null) => Promise<void>;
  onGalleryUpload: (_file: File, _index: number) => Promise<string>;
  onRemoveGalleryImage: (_imageId: string) => Promise<void>;
}

// Section Header Component (shared)
function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-4 border-b border-stone-200 pb-6">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-burgundy-100 text-burgundy-600">
        {icon}
      </div>
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}

export function WineryMediaSection({
  coverPhoto,
  galleryImages,
  isUploadingCover,
  uploadingGalleryIndex,
  maxGalleryImages,
  onImageUpload,
  onCoverPhotoChange,
  onGalleryUpload,
  onRemoveGalleryImage,
}: WineryMediaSectionProps) {
  const t = useTranslations('winery');
  const tCommon = useTranslations('common');
  const [imageToDelete, setImageToDelete] = useState<string | null>(null);

  const emptySlots = maxGalleryImages - galleryImages.length;

  return (
    <>
      {/* Cover Photo Section */}
      <section className="space-y-6">
        <SectionHeader
          icon={<Camera className="h-5 w-5" />}
          title={t('coverPhoto')}
          description={t('coverPhotoDescription')}
        />

        <div className="relative">
          {/* Large Preview Area */}
          <div
            className={cn(
              'group relative aspect-video w-full overflow-hidden rounded-xl border-2 transition-all duration-300',
              coverPhoto
                ? 'border-stone-200 hover:border-burgundy-300'
                : 'border-dashed border-stone-300 bg-gradient-to-br from-burgundy-50 via-cream-100 to-burgundy-100'
            )}
          >
            {coverPhoto ? (
              <>
                <Image
                  src={coverPhoto}
                  alt="Cover photo"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 896px"
                />
                {/* Hover Overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/40 group-hover:opacity-100">
                  <ImageUpload
                    value={null}
                    onChange={() => {}}
                    onUpload={async (file) => {
                      const url = await onImageUpload(file);
                      await onCoverPhotoChange(url);
                      return url;
                    }}
                    aspectRatio="16/9"
                    placeholder=""
                    variant="overlay"
                    className="h-full w-full"
                  />
                </div>
                {isUploadingCover && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-white border-t-transparent" />
                  </div>
                )}
              </>
            ) : (
              <ImageUpload
                value={null}
                onChange={onCoverPhotoChange}
                onUpload={onImageUpload}
                aspectRatio="16/9"
                placeholder={t('uploadCoverPhoto')}
                variant="empty"
                className="h-full w-full"
              />
            )}
          </div>

          {/* 16:9 Aspect Ratio Guidance */}
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {t('coverPhotoRecommendedFull')}
          </p>
        </div>
      </section>

      {/* Gallery Photos Section */}
      <section className="space-y-6">
        <SectionHeader
          icon={
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          }
          title={t('galleryPhotos')}
          description={t('galleryPhotosDescription', {
            count: galleryImages.length,
          })}
        />

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6">
          {/* Existing Gallery Images */}
          {galleryImages.map((image, index) => (
            <div
              key={image.id}
              className="group relative aspect-square overflow-hidden rounded-xl border-2 border-stone-200 bg-muted transition-all duration-300 hover:border-burgundy-300 hover:shadow-lg"
            >
              <Image
                src={image.url}
                alt={t('galleryImageAlt', { index: index + 1 })}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 280px"
              />
              {/* Hover Overlay with Actions */}
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/40 group-hover:opacity-100">
                {/* Remove Button */}
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-red-600 shadow-lg transition-colors hover:bg-red-50"
                  onClick={() => setImageToDelete(image.id)}
                  aria-label={t('removeGalleryImage', { index: index + 1 })}
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}

          {/* Empty Slots for Adding Photos */}
          {Array.from({ length: emptySlots }).map((_, index) => (
            <div
              key={`empty-${index}`}
              className={cn(
                'relative aspect-square overflow-hidden rounded-xl border-2 border-dashed transition-all duration-300',
                uploadingGalleryIndex === galleryImages.length + index
                  ? 'border-burgundy-400 bg-burgundy-50'
                  : 'border-stone-300 bg-stone-50 hover:border-burgundy-400 hover:bg-cream-50'
              )}
            >
              {uploadingGalleryIndex === galleryImages.length + index ? (
                <div className="flex h-full w-full flex-col items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-burgundy-600 border-t-transparent" />
                  <p className="mt-3 text-sm font-medium text-burgundy-600">
                    {t('uploading')}
                  </p>
                </div>
              ) : (
                <ImageUpload
                  value={null}
                  onChange={() => {}}
                  onUpload={(file) =>
                    onGalleryUpload(file, galleryImages.length + index)
                  }
                  aspectRatio="1/1"
                  placeholder=""
                  variant="gallery-add"
                  className="h-full w-full"
                />
              )}
            </div>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">{t('galleryHelpFull')}</p>
      </section>

      {/* Confirmation dialog for gallery image deletion */}
      <AlertDialog
        open={!!imageToDelete}
        onOpenChange={(open) => !open && setImageToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteImageTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteImageDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('buttons.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (imageToDelete) {
                  onRemoveGalleryImage(imageToDelete);
                  setImageToDelete(null);
                }
              }}
            >
              {tCommon('buttons.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
