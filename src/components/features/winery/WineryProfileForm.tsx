'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import Link from 'next/link';
import Image from 'next/image';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageUpload } from '@/components/shared/ImageUpload';

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
  const [isSaving, setIsSaving] = useState(false);
  const [coverPhoto, setCoverPhoto] = useState<string | null>(winery.coverPhoto);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>(
    winery.galleryImages
  );

  const form = useForm<WineryProfileInput>({
    resolver: zodResolver(wineryProfileSchema),
    defaultValues: {
      description: winery.description,
      address: winery.address,
      commune: winery.commune,
      phone: winery.phone,
    },
  });

  async function onSubmit(data: WineryProfileInput) {
    setIsSaving(true);

    try {
      const result = await updateWineryProfile(data);

      if (result.success) {
        toast.success('Profile updated successfully');
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

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
    setCoverPhoto(url);
    const result = await updateWineryCoverPhoto(url);

    if (result.success) {
      toast.success(url ? 'Cover photo updated' : 'Cover photo removed');
      router.refresh();
    } else {
      toast.error(result.error.message);
      setCoverPhoto(winery.coverPhoto); // Revert on error
    }
  }

  async function handleGalleryUpload(file: File): Promise<string> {
    const url = await handleImageUpload(file);

    const result = await addGalleryImage(url);

    if (result.success) {
      setGalleryImages((prev) => [
        ...prev,
        { id: result.data.id, url, order: result.data.order },
      ]);
      toast.success('Gallery image added');
      router.refresh();
    } else {
      toast.error(result.error.message);
      throw new Error(result.error.message);
    }

    return url;
  }

  async function handleRemoveGalleryImage(imageId: string) {
    const result = await removeGalleryImage(imageId);

    if (result.success) {
      setGalleryImages((prev) => prev.filter((img) => img.id !== imageId));
      toast.success('Gallery image removed');
      router.refresh();
    } else {
      toast.error(result.error.message);
    }
  }

  return (
    <div className="space-y-8">
      {/* Public Preview Link */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{winery.name}</h2>
          <p className="text-sm text-slate-500">/{winery.slug}</p>
        </div>
        <Button asChild variant="outline">
          <Link
            href={`/wineries/${winery.slug}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg
              className="mr-2 h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
            View Public Profile
          </Link>
        </Button>
      </div>

      {/* Cover Photo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cover Photo</CardTitle>
        </CardHeader>
        <CardContent>
          <ImageUpload
            value={coverPhoto}
            onChange={handleCoverPhotoChange}
            onUpload={handleImageUpload}
            aspectRatio="16/9"
            placeholder="Upload cover photo (16:9 recommended)"
          />
          <p className="mt-2 text-sm text-slate-500">
            Recommended: 1920x1080 pixels, 16:9 aspect ratio
          </p>
        </CardContent>
      </Card>

      {/* Gallery Photos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Gallery Photos ({galleryImages.length}/6)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {galleryImages.map((image) => (
              <div key={image.id} className="relative">
                <div className="relative aspect-square overflow-hidden rounded-lg border bg-slate-100">
                  <Image
                    src={image.url}
                    alt={`Gallery image ${image.order}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, 33vw"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="absolute right-2 top-2 h-8 w-8 rounded-full bg-white/90 p-0 hover:bg-white"
                  onClick={() => handleRemoveGalleryImage(image.id)}
                >
                  <svg
                    className="h-4 w-4 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </Button>
              </div>
            ))}
            {galleryImages.length < 6 && (
              <ImageUpload
                value={null}
                onChange={() => {}}
                onUpload={handleGalleryUpload}
                aspectRatio="1/1"
                placeholder="Add photo"
              />
            )}
          </div>
          <p className="mt-4 text-sm text-slate-500">
            Upload up to 6 photos to showcase your winery. Square images work
            best.
          </p>
        </CardContent>
      </Card>

      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Profile Information</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Tell visitors about your winery, your history, and what makes your wines special..."
                        className="min-h-[150px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Minimum 50 characters. Describe your winery, wines, and
                      what visitors can expect. Plain text only for now.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input placeholder="Rue du Vignoble 12" {...field} />
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
                    <FormLabel>Commune</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select your commune" />
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
                    <FormLabel>Contact Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+41 27 123 45 67" {...field} />
                    </FormControl>
                    <FormDescription>
                      Swiss phone format: +41 XX XXX XX XX or 0XX XXX XX XX
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
