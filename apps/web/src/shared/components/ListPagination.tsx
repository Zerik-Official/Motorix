import {
  Pagination,
  PaginationButton,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/Pagination";
import { pageEntries } from "@shared/api/pagination";

/**
 * Props of {@link ListPagination}.
 */
interface ListPaginationProps {
  /** Current page, starting at 1. */
  page: number;
  /** Rows matching the filters, across every page. */
  total: number;
  /** Rows per page. */
  pageSize: number;
  /** Moves to another page. */
  onChange: (page: number) => void;
}

/**
 * Page row of an offset paginated list, hidden when everything fits in one page.
 *
 * @param props - Current page, total, page size and change callback.
 * @returns The pagination, or nothing.
 */
export function ListPagination({ page, total, pageSize, onChange }: ListPaginationProps) {
  const count: number = Math.max(1, Math.ceil(total / pageSize));
  if (count <= 1) {
    return null;
  }
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious onClick={() => onChange(page - 1)} disabled={page <= 1} />
        </PaginationItem>
        {pageEntries(page, count).map((entry, index) => (
          <PaginationItem key={entry === "gap" ? `gap-${index}` : entry}>
            {entry === "gap" ? (
              <PaginationEllipsis />
            ) : (
              <PaginationButton isActive={entry === page} onClick={() => onChange(entry)} aria-label={`Página ${entry}`}>
                {entry}
              </PaginationButton>
            )}
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext onClick={() => onChange(page + 1)} disabled={page >= count} />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
