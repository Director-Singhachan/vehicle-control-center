import React from 'react';

interface PageLayoutProps {
  title?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageLayout({ title, children, actions }: PageLayoutProps) {
  return (
    <div className="space-y-6">
      {title && (
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
          {actions && <div>{actions}</div>}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}

