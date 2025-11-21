import React from 'react';
import { componentStyles } from '../../theme/designTokens';
import { MoreHorizontal, RefreshCw } from 'lucide-react';

interface PageLayoutProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}

/**
 * PageLayout - Layout wrapper สำหรับทุกหน้า
 * ใช้เพื่อให้ทุกหน้ามีโครงสร้างและสไตล์ที่สอดคล้องกัน
 */
export const PageLayout: React.FC<PageLayoutProps> = ({
  title,
  subtitle,
  actions,
  children,
  loading = false,
  error = false,
  onRetry,
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400">
        <RefreshCw className="animate-spin mr-2" /> Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-red-400">
        <p>Failed to load data.</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-4 px-4 py-2 bg-enterprise-600 text-white rounded-lg hover:bg-enterprise-700"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className={componentStyles.pageHeader.title}>{title}</h2>
          {subtitle && (
            <p className={componentStyles.pageHeader.subtitle}>{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex space-x-3">{actions}</div>}
      </div>

      {/* Page Content */}
      {children}
    </div>
  );
};

