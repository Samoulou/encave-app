'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import Image from 'next/image';
import { GripVertical, X, Camera } from 'lucide-react';
import {
  wineryProfileSchema,
  type WineryProfileInput,
} from '@/lib/validators/winery';
import { VALAIS_COMMUNES } from '@/lib/constants/communes';
import {
  updateWineryProfile,
  uploadWineryImage,
  updateWineryCoverPhoto,
  addGalleryImage,
  removeGalleryImage,
} from '@/server/actions/winery';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ImageUpload } from '@/components/shared/ImageUpload';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

interface GalleryImage {
  id: string;
  url: string;
  order: number;
}

interface WineryProfileFormProps {
  winery: {
    id: string;
    name: string;
    slug: string;
    description: string;
    address: string;
    commune: string;
    phone: string;
    coverPhoto: string | null;
    galleryImages: GalleryImage[];
  };
}

// Section Header Component
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
    <div className="flex items-start gap-4 pb-6 border-b border-stone-200">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-burgundy-100 text-burgundy-600">
        {icon}
      </div>
      <div>
        <h2 className="font-display text-xl font-semibold text-slate-900">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        )}
      </div>
    </div>
  );
}

export function WineryProfileForm({ winery }: WineryProfileFormProps) {
  const router = useRouter();
  const t = useTranslations('winery');
  const tCommon = useTranslations('common');
  const [isSaving, setIsSaving] = useState(false);
  const [coverPhoto, setCoverPhoto] = useState<string | null>(winery.coverPhoto);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>(
    winery.galleryImages
  );
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [uploadingGalleryIndex, setUploadingGalleryIndex] = useState<number | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const form = useForm<WineryProfileInput>({
    resolver: zodResolver(wineryProfileSchema),
    defaultValues: {
      description: winery.description,
      address: winery.address,
      commune: winery.commune,
      phone: winery.phone,
    },
  });

  // Track form changes
  useEffect(() => {
    const subscription = form.watch(() => {
      setHasUnsavedChanges(true);
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const onSubmit = useCallback(async (data: WineryProfileInput) => {
    setIsSaving(true);

    try {
      const result = await updateWineryProfile(data);

      if (result.success) {
        toast.success(t('profileUpdated'), {
          description: t('changesSaved'),
          className: 'bg-cream-50 border-gold-200',
        });
        setHasUnsavedChanges(false);
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    } catch {
      toast.error(tCommon('errors.somethingWentWrong'));
    } finally {
      setIsSaving(false);
    }
  }, [router, t, tCommon]);

  async function handleImageUpload(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);

    const result = await uploadWineryImage(formData);

    if (!result.success) {
      throw new Error(result.error.message);
    }

    return result.data.url;
  }

  async function handleCoverPhotoChange(url: string | null) {
    setIsUploadingCover(true);
    setCoverPhoto(url);
    const result = await updateWineryCoverPhoto(url);

    if (result.success) {
      toast.success(url ? t('coverPhotoUpdated') : t('coverPhotoRemoved'), {
        className: 'bg-cream-50 border-gold-200',
      });
      router.refresh();
    } else {
      toast.error(result.error.message);
      setCoverPhoto(winery.coverPhoto); // Revert on error
    }
    setIsUploadingCover(false);
  }

  async function handleGalleryUpload(file: File, index: number): Promise<string> {
    setUploadingGalleryIndex(index);
    const url = await handleImageUpload(file);

    const result = await addGalleryImage(url);

    if (result.success) {
      setGalleryImages((prev) => [
        ...prev,
        { id: result.data.id, url, order: result.data.order },
      ]);
      toast.success(t('galleryImageAdded'), {
        className: 'bg-cream-50 border-gold-200',
      });
      router.refresh();
    } else {
      toast.error(result.error.message);
      throw new Error(result.error.message);
    }

    setUploadingGalleryIndex(null);
    return url;
  }

  async function handleRemoveGalleryImage(imageId: string) {
    const result = await removeGalleryImage(imageId);

    if (result.success) {
      setGalleryImages((prev) => prev.filter((img) => img.id !== imageId));
      toast.success(t('galleryImageRemoved'), {
        className: 'bg-cream-50 border-gold-200',
      });
      router.refresh();
    } else {
      toast.error(result.error.message);
    }
  }

  // Calculate empty slots for gallery
  const maxGalleryImages = 6;
  const emptySlots = maxGalleryImages - galleryImages.length;

  return (
    <div className="space-y-10">
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
                      const url = await handleImageUpload(file);
                      await handleCoverPhotoChange(url);
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
                onChange={handleCoverPhotoChange}
                onUpload={handleImageUpload}
                aspectRatio="16/9"
                placeholder={t('uploadCoverPhoto')}
                variant="empty"
                className="h-full w-full"
              />
            )}
          </div>

          {/* 16:9 Aspect Ratio Guidance */}
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
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
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          }
          title={t('galleryPhotos')}
          description={t('galleryPhotosDescription', { count: galleryImages.length })}
        />

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6">
          {/* Existing Gallery Images */}
          {galleryImages.map((image, index) => (
            <div
              key={image.id}
              className="group relative aspect-square overflow-hidden rounded-xl border-2 border-stone-200 bg-slate-100 transition-all duration-300 hover:border-burgundy-300 hover:shadow-lg"
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
                {/* Drag Handle for Future Reordering */}
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow-lg transition-colors hover:bg-white"
                  aria-label={t('dragToReorder')}
                  disabled
                >
                  <GripVertical className="h-5 w-5" aria-hidden="true" />
                </button>
                {/* Remove Button */}
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-red-600 shadow-lg transition-colors hover:bg-red-50"
                  onClick={() => handleRemoveGalleryImage(image.id)}
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
                  <p className="mt-3 text-sm font-medium text-burgundy-600">{t('uploading')}</p>
                </div>
              ) : (
                <ImageUpload
                  value={null}
                  onChange={() => {}}
                  onUpload={(file) => handleGalleryUpload(file, galleryImages.length + index)}
                  aspectRatio="1/1"
                  placeholder=""
                  variant="gallery-add"
                  className="h-full w-full"
                />
              )}
            </div>
          ))}
        </div>

        <p className="text-sm text-slate-500">
          {t('galleryHelpFull')}
        </p>
      </section>

      {/* Winery Information Section */}
      <section className="space-y-6">
        <SectionHeader
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          }
          title={t('wineryInformation')}
          description={t('tellVisitors')}
        />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-medium">{t('description')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('descriptionPlaceholder')}
                      className="min-h-[180px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('descriptionMinLength')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Contact Details Section */}
            <div className="space-y-6 pt-4">
              <div className="flex items-start gap-4 pb-6 border-b border-stone-200">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-burgundy-100 text-burgundy-600">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="font-display text-xl font-semibold text-slate-900">
                    {t('contactDetails')}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {t('contactDetailsDescription')}
                  </p>
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel className="text-base font-medium">{t('address')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('addressPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="commune"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium">{t('commune')}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('communePlaceholder')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {VALAIS_COMMUNES.map((commune) => (
                            <SelectItem key={commune} value={commune}>
                              {commune}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium">{t('contactPhone')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('phonePlaceholder')} {...field} />
                      </FormControl>
                      <FormDescription>
                        {t('swissFormatShort')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Save Actions */}
            <div className="flex items-center justify-between border-t border-stone-200 pt-8">
              <div className="text-sm text-slate-500">
                {hasUnsavedChanges && (
                  <span className="flex items-center gap-2 text-amber-600">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                    {t('unsavedChanges')}
                  </span>
                )}
              </div>
              <Button
                type="submit"
                size="lg"
                disabled={isSaving}
                className="min-w-[160px]"
              >
                {isSaving ? (
                  <>
                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    {t('saving')}
                  </>
                ) : (
                  t('saveChanges')
                )}
              </Button>
            </div>
          </form>
        </Form>
      </section>
    </div>
  );
}
