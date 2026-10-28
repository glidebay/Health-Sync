'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { MoreHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button-1';

const Pagination = ({ className, ...props }: React.ComponentProps<'nav'>) => (
  <nav
    data-slot="pagination"
    role="navigation"
    aria-label="pagination"
    className={cn('mx-auto flex w-full justify-center', className)}
    {...props}
  />
);

function PaginationContent({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn('flex flex-row items-center gap-1', className)}
      {...props}
    />
  );
}

function PaginationItem({ className, ...props }: React.ComponentProps<'li'>) {
  return <li data-slot="pagination-item" className={cn('', className)} {...props} />;
}

const PaginationEllipsis = ({ className, ...props }: React.ComponentProps<'span'>) => (
  <span
    data-slot="pagination-ellipsis"
    aria-hidden
    className={cn('flex h-9 w-9 items-center justify-center text-[#8A909D]', className)}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More pages</span>
  </span>
);

export interface NumberedPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  totalItems?: number;
  itemsPerPage?: number;
  itemName?: string;
}

export function NumberedPagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
  totalItems,
  itemsPerPage,
  itemName = 'items',
}: NumberedPaginationProps) {
  if (totalPages <= 1 && (totalItems === undefined || totalItems <= 0)) {
    return null;
  }

  const getPageNumbers = () => {
    const pages: (number | 'ellipsis-start' | 'ellipsis-end')[] = [];

    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, 'ellipsis-end', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, 'ellipsis-start', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(
          1,
          'ellipsis-start',
          currentPage - 1,
          currentPage,
          currentPage + 1,
          'ellipsis-end',
          totalPages
        );
      }
    }

    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div
      className={cn(
        'flex items-center justify-center pt-3 mt-2 border-t border-[#ECEEF2]/80 w-full',
        className
      )}
    >
      <Pagination className="mx-auto w-auto flex justify-center">
        <PaginationContent className="flex flex-row items-center justify-center gap-1">
          <PaginationItem>
            <Button
              variant="ghost"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              aria-label="Previous page"
              className="text-xs font-semibold"
            >
              <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
              <span className="hidden xs:inline">Previous</span>
            </Button>
          </PaginationItem>

          {pages.map((p, idx) => {
            if (p === 'ellipsis-start' || p === 'ellipsis-end') {
              return (
                <PaginationItem key={`ellipsis-${idx}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              );
            }

            const isCurrent = p === currentPage;
            return (
              <PaginationItem key={p}>
                <Button
                  variant={isCurrent ? 'outline' : 'ghost'}
                  mode="icon"
                  onClick={() => onPageChange(p)}
                  aria-label={`Page ${p}`}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={cn(
                    'text-xs font-semibold rounded-xl',
                    isCurrent && 'border-[#2563EB] bg-blue-50 text-[#2563EB] shadow-2xs font-bold'
                  )}
                >
                  {p}
                </Button>
              </PaginationItem>
            );
          })}

          <PaginationItem>
            <Button
              variant="ghost"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              aria-label="Next page"
              className="text-xs font-semibold"
            >
              <span className="hidden xs:inline">Next</span>
              <ChevronRight className="w-4 h-4 rtl:rotate-180" />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

export { Pagination, PaginationContent, PaginationEllipsis, PaginationItem };
