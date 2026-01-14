'use client';

import { useState } from 'react';
import Image, { type ImageProps } from 'next/image';
import { Wine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IMAGE_PLACEHOLDERS } from '@/lib/image-placeholder';

interface ImageWithFallbackProps extends Omit<ImageProps, 'onError'> {
  /** Fallback image URL (optional - defaults to wine icon placeholder) */
  fallbackSrc?: string;
  /** Whether to show the wine icon fallback instead of an image */
  showIconFallback?: boolean;
  /** Additional classes for the fallback container */
  fallbackClassName?: string;
}

/**
 * Image component with built-in error handling and fallback
 * Falls back to a wine icon placeholder when the image fails to load
 */
export function ImageWithFallback({
  src,
  alt,
  fallbackSrc,
  showIconFallback = true,
  fallbackClassName,
  className,
  ...props
}: ImageWithFallbackProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // If there's an error and we want to show icon fallback
  if (hasError && showIconFallback && !fallbackSrc) {
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center bg-gradient-to-br from-burgundy-100 to-burgundy-200',
          fallbackClassName
        )}
        role="img"
        aria-label={alt}
      >
        <Wine className="h-12 w-12 text-burgundy-300" aria-hidden="true" />
      </div>
    );
  }

  // Use fallback URL if provided and there's an error
  const imageSrc = hasError && fallbackSrc ? fallbackSrc : src;

  return (
    <>
      {isLoading && (
        <div
          className={cn(
            'absolute inset-0 animate-pulse bg-slate-200',
            className
          )}
          aria-hidden="true"
        />
      )}
      <Image
        src={imageSrc}
        alt={alt}
        className={cn(
          'transition-opacity duration-300',
          isLoading ? 'opacity-0' : 'opacity-100',
          className
        )}
        onError={() => {
          if (!hasError) {
            setHasError(true);
            setIsLoading(false);
          }
        }}
        onLoad={() => setIsLoading(false)}
        placeholder="blur"
        blurDataURL={IMAGE_PLACEHOLDERS.card}
        {...props}
      />
    </>
  );
}
