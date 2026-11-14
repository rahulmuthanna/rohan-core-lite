import type { ReactNode } from 'react';
import { Link } from 'react-router';

interface PageHeaderProps {
  title: string;
  /** A link back to the list this page belongs to. */
  back?: { to: string; label: string };
  /** Buttons shown on the right. The main action of the screen always goes here. */
  actions?: ReactNode;
  /** Small text or a status tag shown beside the title. */
  aside?: ReactNode;
}

/** The top of every screen: where you are, and the one main thing you can do here. */
export function PageHeader({ title, back, actions, aside }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div>
        {back && (
          <Link to={back.to} className="back-link">
            Back to {back.label}
          </Link>
        )}
        <div className="page-title-row">
          <h1>{title}</h1>
          {aside}
        </div>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
