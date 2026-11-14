import type { Pagination as PaginationInfo } from '../api/types';

interface PaginationProps {
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
}

/** "Showing 1 to 12 of 12" with Previous and Next. Hidden when everything fits on one page. */
export function Pagination({ pagination, onPageChange }: PaginationProps) {
  const { page, page_size, total } = pagination;
  if (total === 0) {
    return null;
  }
  const first = (page - 1) * page_size + 1;
  const last = Math.min(page * page_size, total);
  const lastPage = Math.ceil(total / page_size);

  return (
    <div className="pagination">
      <p>
        Showing {first} to {last} of {total}
      </p>
      {lastPage > 1 && (
        <div className="pagination-buttons">
          <button type="button" className="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            Previous
          </button>
          <button type="button" className="button" disabled={page >= lastPage} onClick={() => onPageChange(page + 1)}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}
