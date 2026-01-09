'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
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
  placeholder = 'Click to upload image',
  className = '',
  variant = 'default',
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    const ALLOWED_TYPES = ['image/jpeg', 'image/png'];

    if (file.size > MAX_SIZE) {
      setError('Image must be less than 5MB');
      return;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Only JPEG and PNG images are allowed');
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
      setError('Failed to upload image. Please try again.');
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
      <div className={cn('flex h-full w-full items-center justify-center', className)}>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={handleFileSelect}
          disabled={isUploading}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="flex items-center gap-2 rounded-lg bg-white/95 px-6 py-3 font-medium text-slate-900 shadow-lg transition-all hover:bg-white hover:scale-105"
        >
          <Camera className="h-5 w-5" />
          Change photo
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
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="flex h-full w-full flex-col items-center justify-center transition-colors hover:bg-burgundy-50/50"
        >
          {isUploading ? (
            <>
              <div className="mb-3 h-12 w-12 animate-spin rounded-full border-4 border-burgundy-600 border-t-transparent" />
              <p className="text-base font-medium text-burgundy-700">Uploading...</p>
            </>
          ) : (
            <>
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-burgundy-100">
                <Upload className="h-8 w-8 text-burgundy-600" />
              </div>
              <p className="text-base font-medium text-slate-700">{placeholder}</p>
              <p className="mt-1 text-sm text-slate-500">JPEG or PNG, max 5MB</p>
            </>
          )}
        </button>
        {error && <p className="absolute bottom-4 left-4 text-sm text-red-600">{error}</p>}
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
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="flex h-full w-full flex-col items-center justify-center transition-all"
        >
          {isUploading ? (
            <>
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-burgundy-600 border-t-transparent" />
              <p className="mt-3 text-sm font-medium text-burgundy-600">Uploading...</p>
            </>
          ) : (
            <>
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100 transition-colors group-hover:bg-burgundy-100">
                <Plus className="h-6 w-6 text-slate-400 transition-colors group-hover:text-burgundy-600" />
              </div>
              <p className="text-sm font-medium text-slate-500">Add photo</p>
            </>
          )}
        </button>
        {error && <p className="absolute bottom-2 left-2 right-2 text-center text-xs text-red-600">{error}</p>}
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
      />

      {displayUrl ? (
        <div className="relative">
          <div
            className="relative overflow-hidden rounded-xl border-2 border-stone-200 bg-slate-100 transition-all duration-300 hover:border-burgundy-300"
            style={{ aspectRatio }}
          >
            <Image
              src={displayUrl}
              alt="Uploaded image"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="flex flex-col items-center">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-white border-t-transparent" />
                  <p className="mt-3 text-sm font-medium text-white">Uploading...</p>
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
              className="gap-2"
            >
              <Camera className="h-4 w-4" />
              Replace
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={isUploading}
              className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <X className="h-4 w-4" />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="flex w-full items-center justify-center rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 transition-all duration-300 hover:border-burgundy-400 hover:bg-cream-50 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ aspectRatio }}
        >
          <div className="text-center">
            {isUploading ? (
              <>
                <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-burgundy-600 border-t-transparent" />
                <p className="text-sm font-medium text-burgundy-700">Uploading...</p>
              </>
            ) : (
              <>
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-stone-100">
                  <Upload className="h-7 w-7 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-700">{placeholder}</p>
                <p className="mt-1 text-xs text-slate-500">JPEG or PNG, max 5MB</p>
              </>
            )}
          </div>
        </button>
      )}

      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-red-600">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
