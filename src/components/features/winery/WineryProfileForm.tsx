'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  wineryProfileSchema,
  type WineryProfileInput,
} from '@/lib/validators/winery';
import {
  updateWineryProfile,
  uploadWineryImage,
  updateWineryCoverPhoto,
  addGalleryImage,
  removeGalleryImage,
} from '@/server/actions/winery';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { useTranslations } from 'next-intl';
import { WineryMediaSection } from './WineryMediaSection';
import { WineryBasicInfoSection } from './WineryBasicInfoSection';
import { WineryContactSection } from './WineryContactSection';

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

export function WineryProfileForm({ winery }: WineryProfileFormProps) {
  const router = useRouter();
  const t = useTranslations('winery');
  const tCommon = useTranslations('common');
  const [isSaving, setIsSaving] = useState(false);
  const [coverPhoto, setCoverPhoto] = useState<string | null>(
    winery.coverPhoto
  );
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>(
    winery.galleryImages
  );
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [uploadingGalleryIndex, setUploadingGalleryIndex] = useState<
    number | null
  >(null);
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

  const onSubmit = useCallback(
    async (data: WineryProfileInput) => {
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
    },
    [router, t, tCommon]
  );

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

  async function handleGalleryUpload(
    file: File,
    index: number
  ): Promise<string> {
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

  const maxGalleryImages = 6;

  return (
    <div className="space-y-10">
      {/* ENC-027: deep-link target for "Add photos" criterion */}
      <div id="media" className="scroll-mt-24">
        <WineryMediaSection
          coverPhoto={coverPhoto}
          galleryImages={galleryImages}
          isUploadingCover={isUploadingCover}
          uploadingGalleryIndex={uploadingGalleryIndex}
          maxGalleryImages={maxGalleryImages}
          onImageUpload={handleImageUpload}
          onCoverPhotoChange={handleCoverPhotoChange}
          onGalleryUpload={handleGalleryUpload}
          onRemoveGalleryImage={handleRemoveGalleryImage}
        />
      </div>

      {/* Winery Information Section */}
      <section className="space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* ENC-027: deep-link target for "Add description" criterion */}
            <div id="description" className="scroll-mt-24">
              <WineryBasicInfoSection control={form.control} />
            </div>

            {/* Contact Details Section */}
            {/* ENC-027: deep-link target for "Add address" criterion */}
            <div id="location" className="scroll-mt-24">
              <WineryContactSection control={form.control} />
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
