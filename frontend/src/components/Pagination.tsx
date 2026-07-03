import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalItems, itemsPerPage, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-white/20 dark:border-navy-700/30">
      <span className="text-sm text-surface-600 dark:text-navy-500">
        Mostrando {startItem}-{endItem} de {totalItems} resultado(s)
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-lg text-surface-500 dark:text-navy-500 hover:text-brand-600 dark:hover:text-brand-dark-400 hover:bg-brand-50 dark:hover:bg-brand-dark-600/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={16} />
        </button>
        {getPageNumbers().map((page, idx) =>
          typeof page === 'string' ? (
            <span key={`ellipsis-${idx}`} className="px-1 text-surface-400 dark:text-navy-500 text-sm">...</span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`min-w-[32px] h-8 rounded-lg text-sm font-medium transition-colors ${
                page === currentPage
                  ? 'bg-brand-600 dark:bg-brand-dark-500 text-white'
                  : 'text-surface-600 dark:text-navy-400 hover:bg-brand-50 dark:hover:bg-brand-dark-600/20'
              }`}
            >
              {page}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg text-surface-500 dark:text-navy-500 hover:text-brand-600 dark:hover:text-brand-dark-400 hover:bg-brand-50 dark:hover:bg-brand-dark-600/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
