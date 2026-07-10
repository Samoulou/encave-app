import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Upload, ImageIcon, Trash2 } from 'lucide-react';
import { SectionHeader } from './SectionHeader';
import type { GalleryImage } from './types';

interface MediaSectionProps {
  galleryImages: GalleryImage[];
  canAddMoreImages: boolean;
  uploadingIndex: number | null;
  onGalleryUpload: (_file: File, _index: number) => Promise<void>;
  onRemoveGalleryImage: (_imageId: string, _imageUrl: string) => void;
  sectionRef: (_el: HTMLElement | null) => void;
}

export function MediaSection({
  galleryImages,
  canAddMoreImages,
  uploadingIndex,
  onGalleryUpload,
  onRemoveGalleryImage,
  sectionRef,
}: MediaSectionProps) {
  const t = useTranslations('experience');

  return (
    <section
      ref={sectionRef}
      id="media"
      className="scroll-mt-24 rounded-xl border border-stone-200 bg-white p-6 shadow-sm md:p-8"
    >
      <div className="mb-6 flex items-center justify-between">
        <SectionHeader icon={ImageIcon} title={t('media')} />
        <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-500">
          {t('maxFileSize')}
        </span>
      </div>

      {/* Upload Zone */}
      <label className="group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-300 bg-stone-50/50 p-10 text-center transition-colors hover:border-primary/50 hover:bg-stone-50">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={!canAddMoreImages || uploadingIndex !== null}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) {
              await onGalleryUpload(file, galleryImages.length);
            }
            e.target.value = '';
          }}
        />
        <div className="mb-4 rounded-full bg-white p-4 shadow-sm transition-transform group-hover:scale-110">
          <Upload className="h-10 w-10 text-primary" aria-hidden="true" />
        </div>
        <p className="mb-1 font-bold text-foreground">{t('uploadDropzone')}</p>
        <p className="text-sm text-muted-foreground">{t('uploadFormats')}</p>
      </label>

      {/* Gallery Preview */}
      {galleryImages.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {galleryImages.map((image, index) => (
            <div
              key={image.id}
              className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-stone-200"
            >
              <Image
                src={image.url}
                alt={t('galleryImageAlt', { index: index + 1 })}
                fill
                className="object-cover"
                sizes="200px"
              />
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  className="rounded-full bg-white p-1.5 text-rose-600 hover:bg-rose-50"
                  onClick={() => onRemoveGalleryImage(image.id, image.url)}
                  aria-label={t('removeGalleryImage', { index: index + 1 })}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              {image.isCover && (
                <div className="absolute left-2 top-2 rounded bg-primary px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                  {t('coverBadge')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
