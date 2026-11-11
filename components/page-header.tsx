import type { ReactNode } from "react";

/**
 * The one page heading every view uses, so titles sit at the same height on
 * every page (subpages included): the title first, then a subpage's breadcrumb,
 * an optional description, and optional actions on the right.
 */
export default function PageHeader({ breadcrumbs, title, description, actions }: {
  breadcrumbs?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        <h1>{title}</h1>
        {breadcrumbs}
        {description && <p className="page-header-description">{description}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}
