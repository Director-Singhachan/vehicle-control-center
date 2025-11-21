import React from 'react';
import { componentStyles } from '../../theme/designTokens';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

/**
 * PageHeader - Header component สำหรับทุกหน้า
 * ใช้เพื่อให้ header ของทุกหน้าสอดคล้องกัน
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
}) => {
  return (
    <div className="flex justify-between items-center mb-6">
      <div>
        <h2 className={componentStyles.pageHeader.title}>{title}</h2>
        {subtitle && (
          <p className={componentStyles.pageHeader.subtitle}>{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex space-x-3">{actions}</div>}
    </div>
  );
};

