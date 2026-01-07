'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

interface ImageUploadProps {
  value?: string | null;
  onChange: (_url: string | null) => void;
  onUpload: (_file: File) => Promise<string>;
  aspectRatio?: string;
  placeholder?: string;
  className?: string;
}

export function ImageUpload({
  value,
  onChange,
  onUpload,
  aspectRatio = '16/9',
  placeholder = 'Click to upload image',
  className = '',
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
            className="relative overflow-hidden rounded-lg border bg-slate-100"
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
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
              </div>
            )}
          </div>
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
            >
              Replace
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRemove}
              disabled={isUploading}
              className="text-red-600 hover:text-red-700"
            >
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="flex w-full items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 transition-colors hover:border-burgundy-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ aspectRatio }}
        >
          <div className="text-center">
            {isUploading ? (
              <>
                <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-4 border-burgundy-600 border-t-transparent" />
                <p className="text-sm text-slate-600">Uploading...</p>
              </>
            ) : (
              <>
                <svg
                  className="mx-auto mb-2 h-10 w-10 text-slate-400"
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
                <p className="text-sm text-slate-600">{placeholder}</p>
                <p className="mt-1 text-xs text-slate-500">
                  JPEG or PNG, max 5MB
                </p>
              </>
            )}
          </div>
        </button>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
