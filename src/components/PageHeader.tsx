import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  meta?: string;
  actions?: ReactNode;
}

const PageHeader = ({ eyebrow, title, subtitle, meta, actions }: PageHeaderProps) => {
  return (
    <header
      className="fixed left-64 right-0 z-20 border-b border-slate-800 bg-canvas/90 backdrop-blur app-no-drag"
      style={{ top: 'var(--titlebar-height)', height: 'var(--header-height)' }}
    >
      <div className="flex h-full items-center justify-between px-8 py-3">
        <div>
          {eyebrow ? <p className="text-xs uppercase tracking-[0.3em] text-muted">{eyebrow}</p> : null}
          <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
          {subtitle ? <p className="mt-1 text-xs text-muted">{subtitle}</p> : null}
          {meta ? <p className="mt-1 text-xs text-muted">{meta}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </header>
  );
};

export default PageHeader;
export type { PageHeaderProps };
