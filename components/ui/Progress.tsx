import React from 'react';

interface ProgressProps {
    value: number;
    label?: string;
    className?: string;
    showValue?: boolean;
}

export const Progress: React.FC<ProgressProps> = ({
    value,
    label,
    className = '',
    showValue = true,
}) => {
    // Clamp value between 0 and 100
    const clampedValue = Math.min(100, Math.max(0, value));

    return (
        <div className={`w-full ${className}`}>
            <div className="flex justify-between items-center mb-2">
                {label && (
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {label}
                    </span>
                )}
                {showValue && (
                    <span className="text-sm font-bold text-enterprise-600 dark:text-enterprise-400">
                        {Math.round(clampedValue)}%
                    </span>
                )}
            </div>
            <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 shadow-inner">
                <div
                    className="h-full bg-gradient-to-r from-enterprise-600 to-enterprise-400 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(124,58,237,0.3)]"
                    style={{ width: `${clampedValue}%` }}
                />
            </div>
        </div>
    );
};
