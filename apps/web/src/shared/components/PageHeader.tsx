import type { ReactNode } from "react";

/**
 * Props of {@link PageHeader}.
 */
interface PageHeaderProps {
  /** Title of the page; the only `h1` of the page. */
  title: string;
  /** Sentence that explains what the page is for. */
  description?: ReactNode;
  /** Main actions of the page, aligned to the right on wide screens. */
  actions?: ReactNode;
}

/**
 * Title, purpose and main actions of an app page.
 *
 * @param props - Title, description and actions.
 * @returns The header.
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-wide text-2xl font-bold text-fg sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-prose text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
