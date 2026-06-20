'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Upload, Camera, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  value?: string | null;
  onChange: (_url: string | null) => void;
  onUpload: (_file: File) => Promise<string>;
  aspectRatio?: string;
  placeholder?: string;
  className?: string;
  variant?: 'default' | 'overlay' | 'empty' | 'gallery-add';
}

export function ImageUpload({
  value,
  onChange,
  onUpload,
  aspectRatio = '16/9',
  placeholder,
  className = '',
  variant = 'default',
}: ImageUploadProps) {
  const t = useTranslations('imageUpload');
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Callers may pass an empty string to suppress the label; only fall back to
  // the default when no placeholder prop was provided at all.
  const placeholderText = placeholder ?? t('clickToUpload');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    const ALLOWED_TYPES = ['image/jpeg', 'image/png'];

    if (file.size > MAX_SIZE) {
      setError(t('errorTooLarge'));
      return;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError(t('errorInvalidType'));
      return;
    }

    setError(null);

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    setIsUploading(true);
    try {
      const url = await onUpload(file);
      onChange(url);
      setPreview(null);
    } catch (err) {
      setError(t('errorUploadFailed'));
      setPreview(null);
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }

    // Reset input
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleRemove = () => {
    onChange(null);
    setPreview(null);
    setError(null);
  };

  const displayUrl = preview || value;

  // Overlay variant - just a clickable area for replacing existing image
  if (variant === 'overlay') {
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center',
          className
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={handleFileSelect}
          disabled={isUploading}
          aria-label={t('selectImageFile')}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          aria-label={t('changePhoto')}
          className="flex items-center gap-2 rounded-lg bg-white/95 px-6 py-3 font-medium text-foreground shadow-lg transition-all hover:scale-105 hover:bg-white"
        >
          <Camera className="h-5 w-5" aria-hidden="true" />
          {t('changePhoto')}
        </button>
      </div>
    );
  }

  // Empty variant - for empty cover photo state
  if (variant === 'empty') {
    return (
      <div className={cn('flex h-full w-full', className)}>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={handleFileSelect}
          disabled={isUploading}
          aria-label={t('selectImageFile')}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          aria-label={placeholderText}
          className="flex h-full w-full flex-col items-center justify-center transition-colors hover:bg-burgundy-50/50"
        >
          {isUploading ? (
            <>
              <div
                className="mb-3 h-12 w-12 animate-spin rounded-full border-4 border-burgundy-600 border-t-transparent"
                aria-hidden="true"
              />
              <p
                className="text-base font-medium text-burgundy-700"
                aria-live="polite"
              >
                {t('uploading')}
              </p>
            </>
          ) : (
            <>
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-burgundy-100">
                <Upload
                  className="h-8 w-8 text-burgundy-600"
                  aria-hidden="true"
                />
              </div>
              <p className="text-base font-medium text-foreground">
                {placeholderText}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('formatHint')}
              </p>
            </>
          )}
        </button>
        {error && (
          <p
            className="absolute bottom-4 left-4 text-sm text-red-600"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  }

  // Gallery add variant - compact add button for gallery slots
  if (variant === 'gallery-add') {
    return (
      <div className={cn('flex h-full w-full', className)}>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={handleFileSelect}
          disabled={isUploading}
          aria-label={t('selectImageFile')}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          aria-label={t('addPhotoToGallery')}
          className="flex h-full w-full flex-col items-center justify-center transition-all"
        >
          {isUploading ? (
            <>
              <div
                className="h-8 w-8 animate-spin rounded-full border-4 border-burgundy-600 border-t-transparent"
                aria-hidden="true"
              />
              <p
                className="mt-3 text-sm font-medium text-burgundy-600"
                aria-live="polite"
              >
                {t('uploading')}
              </p>
            </>
          ) : (
            <>
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100 transition-colors group-hover:bg-burgundy-100">
                <Plus
                  className="h-6 w-6 text-muted-foreground transition-colors group-hover:text-burgundy-600"
                  aria-hidden="true"
                />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {t('addPhoto')}
              </p>
            </>
          )}
        </button>
        {error && (
          <p
            className="absolute bottom-2 left-2 right-2 text-center text-xs text-red-600"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  }

  // Default variant - original behavior with improvements
  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={handleFileSelect}
        disabled={isUploading}
        aria-label={t('selectImageFile')}
      />

      {displayUrl ? (
        <div className="relative">
          <div
            className="relative overflow-hidden rounded-xl border-2 border-stone-200 bg-muted transition-all duration-300 hover:border-burgundy-300"
            style={{ aspectRatio }}
          >
            <Image
              src={displayUrl}
              alt={t('uploadedImageAlt')}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="flex flex-col items-center">
                  <div
                    className="h-10 w-10 animate-spin rounded-full border-4 border-white border-t-transparent"
                    aria-hidden="true"
                  />
                  <p
                    className="mt-3 text-sm font-medium text-white"
                    aria-live="polite"
                  >
                    {t('uploading')}
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="mt-3 flex gap-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
              aria-label={t('replaceImage')}
              className="gap-2"
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
              {t('replace')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={isUploading}
              aria-label={t('removeImage')}
              className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              {t('remove')}
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          aria-label={placeholderText}
          className="flex w-full items-center justify-center rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 transition-all duration-300 hover:border-burgundy-400 hover:bg-cream-50 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ aspectRatio }}
        >
          <div className="text-center">
            {isUploading ? (
              <>
                <div
                  className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-burgundy-600 border-t-transparent"
                  aria-hidden="true"
                />
                <p
                  className="text-sm font-medium text-burgundy-700"
                  aria-live="polite"
                >
                  {t('uploading')}
                </p>
              </>
            ) : (
              <>
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-stone-100">
                  <Upload
                    className="h-7 w-7 text-slate-400"
                    aria-hidden="true"
                  />
                </div>
                <p className="text-sm font-medium text-slate-700">
                  {placeholderText}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {t('formatHint')}
                </p>
              </>
            )}
          </div>
        </button>
      )}

      {error && (
        <p
          className="mt-2 flex items-center gap-1.5 text-sm text-red-600"
          role="alert"
        >
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
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}
