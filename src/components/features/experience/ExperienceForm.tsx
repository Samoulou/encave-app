'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import Image from 'next/image';
import { X, Camera, Wine, Clock, Users, Banknote } from 'lucide-react';
import {
  createExperienceSchema,
  type CreateExperienceInput,
  DURATION_OPTIONS,
  EXPERIENCE_TYPE_OPTIONS,
} from '@/lib/validators/experience';
import {
  createExperience,
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
import { cn } from '@/lib/utils';

interface GalleryImage {
  id: string;
  url: string;
  order: number;
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

export function ExperienceForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coverPhoto, setCoverPhoto] = useState<string | null>(null);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [uploadingGalleryIndex, setUploadingGalleryIndex] = useState<number | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const form = useForm<CreateExperienceInput>({
    resolver: zodResolver(createExperienceSchema),
    defaultValues: {
      title: '',
      type: undefined,
      description: '',
      duration: 60,
      price: undefined,
      minCapacity: 1,
      maxCapacity: 10,
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

  // Cleanup uploaded images on unmount if form was cancelled
  useEffect(() => {
    return () => {
      // Only clean up if there are images but form wasn't submitted
      if (!isSubmitting && (coverPhoto || galleryImages.length > 0)) {
        // Note: This cleanup happens on navigation away - images will be orphaned
        // In a production app, you'd want a scheduled cleanup job
      }
    };
  }, [isSubmitting, coverPhoto, galleryImages.length]);

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
    // If removing and there was a previous photo, delete it
    if (!url && coverPhoto) {
      await deleteUploadedImage(coverPhoto);
    }
    setCoverPhoto(url);
    setHasUnsavedChanges(true);
  }, [coverPhoto]);

  const handleGalleryUpload = async (file: File, index: number): Promise<string> => {
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

  const handleRemoveGalleryImage = async (imageId: string, imageUrl: string) => {
    // Delete from storage
    await deleteUploadedImage(imageUrl);
    setGalleryImages((prev) => prev.filter((img) => img.id !== imageId));
    setHasUnsavedChanges(true);
  };

  const onSubmit = useCallback(async (data: CreateExperienceInput) => {
    // Validate cover photo (AC 7)
    if (!coverPhoto) {
      toast.error('Please upload a cover photo');
      return;
    }

    setIsSubmitting(true);

    try {
      const galleryUrls = galleryImages.map((img) => img.url);
      const result = await createExperience(data, coverPhoto, galleryUrls);

      if (result.success) {
        toast.success('Experience created successfully', {
          description: 'Your experience has been saved as a draft.',
          className: 'bg-cream-50 border-gold-200',
        });
        setHasUnsavedChanges(false);
        // Redirect to dashboard on success (AC 11)
        router.push('/dashboard/experiences');
      } else {
        toast.error(result.error.message);
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [coverPhoto, galleryImages, router]);

  // Calculate description character count
  const descriptionValue = form.watch('description');
  const descriptionLength = descriptionValue?.length || 0;

  // Calculate empty slots for gallery (max 8 per AC 8)
  const maxGalleryImages = 8;
  const emptySlots = Math.min(maxGalleryImages - galleryImages.length, 3);

  return (
    <div className="space-y-10">
      {/* Cover Photo Section (AC 7) */}
      <section className="space-y-6">
        <SectionHeader
          icon={<Camera className="h-5 w-5" />}
          title="Cover Photo"
          description="This image will be the main visual for your experience"
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
                  alt="Cover photo"
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
                {/* Remove button */}
                <button
                  type="button"
                  className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-red-600 shadow-lg opacity-0 transition-all hover:bg-red-50 group-hover:opacity-100"
                  onClick={() => handleCoverPhotoChange(null)}
                  aria-label="Remove cover photo"
                >
                  <X className="h-5 w-5" />
                </button>
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
                placeholder="Upload cover photo"
                variant="empty"
                className="h-full w-full"
              />
            )}
          </div>

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
            Required. Recommended: 1920 x 1080 pixels (16:9 aspect ratio). Max 5MB, JPEG or PNG.
          </p>
        </div>
      </section>

      {/* Gallery Photos Section (AC 8) */}
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
          title="Gallery Photos"
          description={`Add more photos to showcase your experience (${galleryImages.length}/${maxGalleryImages})`}
        />

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
          {galleryImages.map((image, index) => (
            <div
              key={image.id}
              className="group relative aspect-square overflow-hidden rounded-xl border-2 border-stone-200 bg-slate-100 transition-all duration-300 hover:border-burgundy-300 hover:shadow-lg"
            >
              <Image
                src={image.url}
                alt={`Gallery image ${index + 1}`}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 25vw, 200px"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/40 group-hover:opacity-100">
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-red-600 shadow-lg transition-colors hover:bg-red-50"
                  onClick={() => handleRemoveGalleryImage(image.id, image.url)}
                  aria-label={`Remove gallery image ${index + 1}`}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))}

          {galleryImages.length < maxGalleryImages && Array.from({ length: emptySlots }).map((_, index) => (
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
                  <p className="mt-3 text-sm font-medium text-burgundy-600">Uploading...</p>
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
          Optional. Square images work best. Up to 8 photos allowed.
        </p>
      </section>

      {/* Experience Details Form (AC 5) */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
          {/* Basic Information */}
          <section className="space-y-6">
            <SectionHeader
              icon={<Wine className="h-5 w-5" />}
              title="Experience Details"
              description="Tell visitors about your wine experience"
            />

            <div className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-medium">Title</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Grand Cru Wine Tasting Experience"
                        maxLength={100}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Maximum 100 characters. Make it descriptive and appealing.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-medium">Experience Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select experience type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EXPERIENCE_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
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
                    <FormLabel className="text-base font-medium">Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe your experience in detail. What will visitors see, taste, and learn? What makes this experience special?"
                        className="min-h-[180px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="flex justify-between">
                      <span>Minimum 100 characters required</span>
                      <span className={cn(
                        descriptionLength < 100 ? 'text-amber-600' : 'text-green-600'
                      )}>
                        {descriptionLength} / 100 min
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
              title="Duration & Capacity"
              description="Set the timing and group size for your experience"
            />

            <div className="grid gap-6 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-medium">Duration</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      defaultValue={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select duration" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DURATION_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value.toString()}>
                            {option.label}
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
                    <FormLabel className="text-base font-medium flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Min Guests
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
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
                    <FormLabel className="text-base font-medium flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Max Guests
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
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
              title="Pricing"
              description="Set the price per person for your experience"
            />

            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem className="max-w-xs">
                  <FormLabel className="text-base font-medium">Price per Person (CHF)</FormLabel>
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
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Price must be greater than 0
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </section>

          {/* Form Actions */}
          <div className="flex items-center justify-between border-t border-stone-200 pt-8">
            <div className="text-sm text-slate-500">
              {hasUnsavedChanges && (
                <span className="flex items-center gap-2 text-amber-600">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                  Unsaved changes
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
                Cancel
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
                    Creating...
                  </>
                ) : (
                  'Create Experience'
                )}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
