import Image from 'next/image';
import { Upload, ImageIcon, Trash2, Eye } from 'lucide-react';
import { SectionHeader } from './SectionHeader';
import type { GalleryImage } from './types';

interface MediaSectionProps {
  galleryImages: GalleryImage[];
  canAddMoreImages: boolean;
  uploadingIndex: number | null;
  onGalleryUpload: (file: File, index: number) => Promise<void>;
  onRemoveGalleryImage: (imageId: string, imageUrl: string) => void;
  sectionRef: (el: HTMLElement | null) => void;
}

export function MediaSection({
  galleryImages,
  canAddMoreImages,
  uploadingIndex,
  onGalleryUpload,
  onRemoveGalleryImage,
  sectionRef,
}: MediaSectionProps) {
  return (
    <section
      ref={sectionRef}
      id="media"
      className="bg-white border border-stone-200 rounded-xl p-6 md:p-8 scroll-mt-24 shadow-sm"
    >
      <div className="flex justify-between items-center mb-6">
        <SectionHeader icon={ImageIcon} title="Media" />
        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
          Max 5MB per file
        </span>
      </div>

      {/* Upload Zone */}
      <label className="border-2 border-dashed border-stone-300 rounded-xl p-10 flex flex-col items-center justify-center text-center bg-stone-50/50 hover:bg-stone-50 hover:border-primary/50 transition-colors cursor-pointer group">
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
        <div className="bg-white p-4 rounded-full shadow-sm mb-4 group-hover:scale-110 transition-transform">
          <Upload className="text-primary h-10 w-10" aria-hidden="true" />
        </div>
        <p className="text-slate-900 font-bold mb-1">Click to upload or drag and drop</p>
        <p className="text-slate-500 text-sm">SVG, PNG, JPG or GIF (max. 800x400px)</p>
      </label>

      {/* Gallery Preview */}
      {galleryImages.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          {galleryImages.map((image, index) => (
            <div
              key={image.id}
              className="relative aspect-[4/3] rounded-lg overflow-hidden group border border-stone-200"
            >
              <Image
                src={image.url}
                alt={`Gallery image ${index + 1}`}
                fill
                className="object-cover"
                sizes="200px"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  type="button"
                  className="p-1.5 bg-white text-rose-600 rounded-full hover:bg-rose-50"
                  onClick={() => onRemoveGalleryImage(image.id, image.url)}
                  aria-label={`Remove image ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="p-1.5 bg-white text-slate-700 rounded-full hover:bg-slate-50"
                  aria-label={`Preview image ${index + 1}`}
                >
                  <Eye className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              {image.isCover && (
                <div className="absolute top-2 left-2 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
                  COVER
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
