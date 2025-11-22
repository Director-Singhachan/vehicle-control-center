import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatusCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  icon: LucideIcon;
  trend?: number;
  trendLabel?: string;
  alert?: boolean;
}

export const StatusCard: React.FC<StatusCardProps> = ({ 
  title, 
  value, 
  subValue, 
  icon: Icon, 
  trend, 
  trendLabel,
  alert = false 
}) => {
  return (
    <div className={`relative overflow-hidden rounded-xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg
      ${alert 
        ? 'bg-white dark:bg-charcoal-800 border-l-4 border-neon-alert' 
        : 'bg-white dark:bg-charcoal-800 border border-slate-200 dark:border-slate-700'
      }
    `}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <h3 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{value}</h3>
          {subValue && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subValue}</p>}
        </div>
        <div className={`p-3 rounded-lg ${alert ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'bg-blue-50 dark:bg-slate-700 text-enterprise-600 dark:text-neon-blue'}`}>
          <Icon size={24} />
        </div>
      </div>
      
      {trend !== undefined && (
        <div className="mt-4 flex items-center text-sm">
          <span className={`font-semibold ${trend >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
          <span className="ml-2 text-slate-500 dark:text-slate-400">{trendLabel || 'เทียบกับเมื่อวาน'}</span>
        </div>
      )}
    </div>
  );
};