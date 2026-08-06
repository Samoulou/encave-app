'use client';

import { useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ExperiencesPaginationProps {
  currentPage: number;
  totalPages: number;
}

export function ExperiencesPagination({
  currentPage,
  totalPages,
}: ExperiencesPaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSearchParams = searchParams ?? new URLSearchParams();
  const [isPending, startTransition] = useTransition();

  const goToPage = (page: number) => {
    const params = new URLSearchParams(currentSearchParams);
    if (page > 1) {
      params.set('page', String(page));
    } else {
      params.delete('page');
    }
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false });
    });
  };

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];

    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage > 3) {
        pages.push('ellipsis');
      }

      // Show pages around current
      for (
        let i = Math.max(2, currentPage - 1);
        i <= Math.min(totalPages - 1, currentPage + 1);
        i++
      ) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('ellipsis');
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div
      className={cn(
        'flex justify-center py-6 transition-opacity',
        isPending && 'opacity-50'
      )}
    >
      <nav className="flex items-center gap-1" aria-label="Pagination">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground disabled:opacity-50"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1 || isPending}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        {getPageNumbers().map((pageNum, idx) =>
          pageNum === 'ellipsis' ? (
            <span
              key={`ellipsis-${idx}`}
              className="flex h-9 w-9 items-center justify-center text-muted-foreground"
            >
              ...
            </span>
          ) : (
            <Button
              key={pageNum}
              variant="ghost"
              size="icon"
              className={cn(
                'h-9 w-9 text-sm font-bold',
                currentPage === pageNum
                  ? 'bg-primary text-white shadow-md shadow-primary/20 hover:bg-primary hover:text-white'
                  : 'text-muted-foreground hover:bg-muted'
              )}
              onClick={() => goToPage(pageNum)}
              disabled={isPending}
              aria-label={`Page ${pageNum}`}
              aria-current={currentPage === pageNum ? 'page' : undefined}
            >
              {pageNum}
            </Button>
          )
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground disabled:opacity-50"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage === totalPages || isPending}
          aria-label="Next page"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </nav>
    </div>
  );
}
