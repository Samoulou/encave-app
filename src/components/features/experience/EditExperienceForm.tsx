'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import Image from 'next/image';
import {
  X,
  Camera,
  Wine,
  Clock,
  Users,
  Banknote,
  HelpCircle,
} from 'lucide-react';
import {
  createExperienceSchema,
  type CreateExperienceInput,
  DURATION_OPTIONS,
  EXPERIENCE_TYPE_OPTIONS,
} from '@/lib/validators/experience';
import {
  updateExperience,
  uploadExperienceImage,
  deleteUploadedImage,
} from '@/server/actions/experience';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ExperienceType } from '@prisma/client';

interface GalleryImage {
  id: string;
  url: string;
  order: number;
}

interface EditExperienceFormProps {
  experience: {
    id: string;
    title: string;
    type: ExperienceType;
    description: string;
    duration: number;
    price: number;
    minCapacity: number;
    maxCapacity: number;
    coverPhoto: string;
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

export function EditExperienceForm({ experience }: EditExperienceFormProps) {
  const t = useTranslations('experience');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coverPhoto, setCoverPhoto] = useState<string>(experience.coverPhoto);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>(
    experience.galleryImages
  );
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [uploadingGalleryIndex, setUploadingGalleryIndex] = useState<
    number | null
  >(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const form = useForm<CreateExperienceInput>({
    resolver: zodResolver(createExperienceSchema),
    defaultValues: {
      title: experience.title,
      type: experience.type,
      description: experience.description,
      duration: experience.duration,
      price: experience.price,
      minCapacity: experience.minCapacity,
      maxCapacity: experience.maxCapacity,
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

  const handleImageUpload = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    const result = await uploadExperienceImage(formData);

    if (!result.success) {
      throw new Error(result.error.message);
    }

    return result.data.url;
  };

  const handleCoverPhotoChange = useCallback(async (url: string | null) => {
    if (url) {
      setCoverPhoto(url);
      setHasUnsavedChanges(true);
    }
  }, []);

  const handleGalleryUpload = async (
    file: File,
    index: number
  ): Promise<string> => {
    setUploadingGalleryIndex(index);
    const url = await handleImageUpload(file);

    setGalleryImages((prev) => [
      ...prev,
      { id: `temp-${Date.now()}`, url, order: prev.length },
    ]);
    setHasUnsavedChanges(true);

    setUploadingGalleryIndex(null);
    return url;
  };

  const handleRemoveGalleryImage = async (
    imageId: string,
    imageUrl: string
  ) => {
    // Only delete from storage if it's a new upload (temp id)
    if (imageId.startsWith('temp-')) {
      await deleteUploadedImage(imageUrl);
    }
    setGalleryImages((prev) => prev.filter((img) => img.id !== imageId));
    setHasUnsavedChanges(true);
  };

  const onSubmit = useCallback(
    async (data: CreateExperienceInput) => {
      if (!coverPhoto) {
        toast.error(t('pleaseUploadCover'));
        return;
      }

      setIsSubmitting(true);

      try {
        const galleryUrls = galleryImages.map((img) => img.url);
        const result = await updateExperience(
          experience.id,
          data,
          coverPhoto,
          galleryUrls
        );

        if (result.success) {
          toast.success(t('updatedSuccess'), {
            description: t('updatedDescription'),
            className: 'bg-cream-50 border-gold-200',
          });
          setHasUnsavedChanges(false);
          router.push('/dashboard/experiences');
          router.refresh();
        } else {
          toast.error(result.error.message);
        }
      } catch {
        toast.error(tCommon('errors.somethingWentWrong'));
      } finally {
        setIsSubmitting(false);
      }
    },
    [coverPhoto, galleryImages, experience.id, router, t, tCommon]
  );

  // Calculate description character count
  const descriptionValue = form.watch('description');
  const descriptionLength = descriptionValue?.length || 0;

  // Calculate empty slots for gallery (max 8)
  const maxGalleryImages = 8;
  const emptySlots = Math.min(maxGalleryImages - galleryImages.length, 3);

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
                  alt={t('coverPhoto')}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 896px"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/40 group-hover:opacity-100">
                  <ImageUpload
                    value={null}
                    onChange={() => {}}
                    onUpload={async (file) => {
                      setIsUploadingCover(true);
                      const url = await handleImageUpload(file);
                      await handleCoverPhotoChange(url);
                      setIsUploadingCover(false);
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
                onUpload={async (file) => {
                  setIsUploadingCover(true);
                  const url = await handleImageUpload(file);
                  handleCoverPhotoChange(url);
                  setIsUploadingCover(false);
                  return url;
                }}
                aspectRatio="16/9"
                placeholder={t('uploadCoverPhoto')}
                variant="empty"
                className="h-full w-full"
              />
            )}
          </div>

          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
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
            {t('coverPhotoRecommended')}
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
            max: maxGalleryImages,
          })}
        />

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
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
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 25vw, 200px"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/40 group-hover:opacity-100">
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-red-600 shadow-lg transition-colors hover:bg-red-50"
                  onClick={() => handleRemoveGalleryImage(image.id, image.url)}
                  aria-label={t('removeGalleryImage', { index: index + 1 })}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))}

          {galleryImages.length < maxGalleryImages &&
            Array.from({ length: emptySlots }).map((_, index) => (
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
                      handleGalleryUpload(file, galleryImages.length + index)
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

        <p className="text-sm text-muted-foreground">{t('galleryHelp')}</p>
      </section>

      {/* Experience Details Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
          {/* Basic Information */}
          <section className="space-y-6">
            <SectionHeader
              icon={<Wine className="h-5 w-5" />}
              title={t('experienceDetails')}
              description={t('tellVisitors')}
            />

            <div className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-medium">
                      {t('title')}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('titlePlaceholder')}
                        maxLength={100}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>{t('titleHelp')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-medium">
                      {t('experienceType')}
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('selectType')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EXPERIENCE_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {t(`types.${option.value}`)}
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
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-medium">
                      {t('description')}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('descriptionPlaceholder')}
                        className="min-h-[180px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="flex justify-between">
                      <span>{t('descriptionMinRecommended')}</span>
                      <span
                        className={cn(
                          descriptionLength < 20
                            ? 'text-amber-600'
                            : 'text-green-600'
                        )}
                      >
                        {t('characters', { count: descriptionLength })}
                      </span>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          {/* Duration & Capacity */}
          <section className="space-y-6">
            <SectionHeader
              icon={<Clock className="h-5 w-5" />}
              title={t('durationAndCapacity')}
              description={t('durationCapacityDescription')}
            />

            <div className="grid gap-6 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-medium">
                      {t('duration')}
                    </FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('selectDuration')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DURATION_OPTIONS.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={option.value.toString()}
                          >
                            {t(`durationOptions.${option.value}`)}
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
                name="minCapacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 text-base font-medium">
                      <Users className="h-4 w-4" />
                      {t('minBookingSize')}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 cursor-help text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>{t('minBookingSizeTooltip')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value) || 1)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="maxCapacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 text-base font-medium">
                      <Users className="h-4 w-4" />
                      {t('maxGuestsLabel')}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value) || 1)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          {/* Pricing */}
          <section className="space-y-6">
            <SectionHeader
              icon={<Banknote className="h-5 w-5" />}
              title={t('pricing')}
              description={t('pricingDescription')}
            />

            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem className="max-w-xs">
                  <FormLabel className="text-base font-medium">
                    {t('pricePerPerson')}
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                        CHF
                      </span>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        placeholder="0"
                        className="pl-14"
                        {...field}
                        onChange={(e) =>
                          field.onChange(
                            parseFloat(e.target.value) || undefined
                          )
                        }
                      />
                    </div>
                  </FormControl>
                  <FormDescription>{t('priceMustBePositive')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </section>

          {/* Form Actions */}
          <div className="flex items-center justify-between border-t border-stone-200 pt-8">
            <div className="text-sm text-muted-foreground">
              {hasUnsavedChanges && (
                <span className="flex items-center gap-2 text-amber-600">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                  {t('unsavedChanges')}
                </span>
              )}
            </div>
            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isSubmitting}
              >
                {tCommon('buttons.cancel')}
              </Button>
              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting || !coverPhoto}
                className="min-w-[180px]"
              >
                {isSubmitting ? (
                  <>
                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    {tCommon('saving')}
                  </>
                ) : (
                  tCommon('buttons.saveChanges')
                )}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
