// VehicleGroupBadge - Display owner group badge with color coding
import React from 'react';
import type { Database } from '../../types/database';

type Vehicle = Database['public']['Tables']['vehicles']['Row'];
type OwnerGroup = Vehicle['owner_group'];

interface VehicleGroupBadgeProps {
  ownerGroup: OwnerGroup | null;
  className?: string;
}

export const VehicleGroupBadge: React.FC<VehicleGroupBadgeProps> = ({
  ownerGroup,
  className = '',
}) => {
  if (!ownerGroup) {
    return null;
  }

  const config = {
    thaikit: {
      label: 'บริษัทไทยกิจ',
      className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    },
    sing_chanthaburi: {
      label: 'บริษัทสิงห์จันทบุรีจำกัด',
      className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    },
    rental: {
      label: 'รถเช่า',
      className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    },
  };

  const groupConfig = config[ownerGroup];

  if (!groupConfig) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${groupConfig.className} ${className}`}
    >
      {groupConfig.label}
    </span>
  );
};
