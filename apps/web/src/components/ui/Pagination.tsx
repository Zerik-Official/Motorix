import type { ComponentProps } from "react";
import { LuChevronLeft, LuChevronRight, LuEllipsis } from "react-icons/lu";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/**
 * Navigation landmark of a paginated list.
 *
 * @param props - Class names and every native nav prop.
 * @returns The navigation.
 */
function Pagination({ className, ...props }: ComponentProps<"nav">) {
  return <nav aria-label="Paginación" data-slot="pagination" className={cn("flex w-full justify-center", className)} {...props} />;
}

/**
 * List of page controls.
 *
 * @param props - Class names and every native ul prop.
 * @returns The list.
 */
function PaginationContent({ className, ...props }: ComponentProps<"ul">) {
  return <ul data-slot="pagination-content" className={cn("flex items-center gap-1", className)} {...props} />;
}

/**
 * One entry of {@link PaginationContent}.
 *
 * @param props - Every native li prop.
 * @returns The entry.
 */
function PaginationItem(props: ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />;
}

/**
 * Props of {@link PaginationButton}.
 */
type PaginationButtonProps = {
  /** Marks the current page. */
  isActive?: boolean;
} & Omit<ComponentProps<typeof Button>, "variant">;

/**
 * Button that moves to a page; the current page is announced with `aria-current`.
 *
 * @param props - Active state, size, class names and every button prop.
 * @returns The button.
 */
function PaginationButton({ className, isActive, size = "icon-sm", ...props }: PaginationButtonProps) {
  return (
    <Button
      variant={isActive ? "outline" : "ghost"}
      size={size}
      aria-current={isActive ? "page" : undefined}
      className={cn("tabular text-fg-muted hover:text-fg", isActive && "text-fg", className)}
      {...props}
    />
  );
}

/**
 * Button to the previous page.
 *
 * @param props - Class names and every button prop.
 * @returns The button.
 */
function PaginationPrevious({ className, ...props }: ComponentProps<typeof PaginationButton>) {
  return (
    <PaginationButton aria-label="Página anterior" size="sm" className={cn("pl-2", className)} {...props}>
      <LuChevronLeft aria-hidden />
      <span className="hidden sm:block">Anterior</span>
    </PaginationButton>
  );
}

/**
 * Button to the next page.
 *
 * @param props - Class names and every button prop.
 * @returns The button.
 */
function PaginationNext({ className, ...props }: ComponentProps<typeof PaginationButton>) {
  return (
    <PaginationButton aria-label="Página siguiente" size="sm" className={cn("pr-2", className)} {...props}>
      <span className="hidden sm:block">Siguiente</span>
      <LuChevronRight aria-hidden />
    </PaginationButton>
  );
}

/**
 * Gap between page numbers that are far apart.
 *
 * @param props - Class names and every native span prop.
 * @returns The gap marker.
 */
function PaginationEllipsis({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn("flex size-8 items-center justify-center text-fg-subtle", className)}
      {...props}
    >
      <LuEllipsis className="size-4" />
    </span>
  );
}

export {
  Pagination,
  PaginationButton,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
};
