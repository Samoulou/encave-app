'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface FadeInProps {
  children: React.ReactNode;
  className?: string;
  /** Delay in ms before animation starts */
  delay?: number;
  /** Direction the element slides in from */
  direction?: 'up' | 'down' | 'left' | 'right';
  /** Animation duration in ms */
  duration?: number;
  /** Only animate once (default: true) */
  once?: boolean;
}

/**
 * Scroll-triggered fade-in reveal component.
 * Uses IntersectionObserver for performance and respects prefers-reduced-motion.
 */
export function FadeIn({
  children,
  className,
  delay = 0,
  direction = 'up',
  duration = 600,
  once = true,
}: FadeInProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    if (prefersReducedMotion) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [once]);

  const translateClass = {
    up: 'translate-y-6',
    down: '-translate-y-6',
    left: 'translate-x-6',
    right: '-translate-x-6',
  }[direction];

  return (
    <div
      ref={ref}
      className={cn(
        isVisible
          ? 'translate-x-0 translate-y-0 opacity-100'
          : `opacity-0 ${translateClass}`,
        className
      )}
      style={{
        transitionProperty: 'opacity, transform',
        transitionDuration: `${duration}ms`,
        transitionDelay: `${delay}ms`,
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {children}
    </div>
  );
}
