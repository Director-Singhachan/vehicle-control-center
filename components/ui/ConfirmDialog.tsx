// Confirm Dialog Component - Custom confirmation dialog that works on all devices
import React from 'react';
import { Gauge, X } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string | React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    variant?: 'warning' | 'danger' | 'info';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    title,
    message,
    confirmText = 'ตกลง',
    cancelText = 'ยกเลิก',
    onConfirm,
    onCancel,
    variant = 'warning',
}) => {
    if (!isOpen) return null;

    const variantStyles = {
        warning: {
            iconBg: 'bg-gradient-to-br from-amber-400 to-orange-500',
            iconColor: 'text-white',
            title: 'text-slate-900 dark:text-white',
            message: 'text-slate-600 dark:text-slate-300',
        },
        danger: {
            iconBg: 'bg-gradient-to-br from-red-500 to-rose-600',
            iconColor: 'text-white',
            title: 'text-slate-900 dark:text-white',
            message: 'text-slate-600 dark:text-slate-300',
        },
        info: {
            iconBg: 'bg-gradient-to-br from-blue-500 to-indigo-600',
            iconColor: 'text-white',
            title: 'text-slate-900 dark:text-white',
            message: 'text-slate-600 dark:text-slate-300',
        },
    };

    const styles = variantStyles[variant];

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onCancel}
        >
            <Card
                className="max-w-md w-full bg-white dark:bg-slate-800 shadow-2xl border-0 animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 sm:p-8">
                    {/* Icon */}
                    <div className="flex justify-center mb-6">
                        <div className={`${styles.iconBg} ${styles.iconColor} w-16 h-16 rounded-full flex items-center justify-center shadow-lg`}>
                            <Gauge size={32} className="animate-pulse" />
                        </div>
                    </div>

                    {/* Header */}
                    <div className="text-center mb-6">
                        <h3 className={`text-2xl font-bold ${styles.title} mb-3`}>
                            {title}
                        </h3>
                        <div className={`text-base leading-relaxed ${styles.message} whitespace-pre-line`}>
                            {message}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <Button
                            onClick={onCancel}
                            variant="outline"
                            className="flex-1 py-3 text-base font-medium"
                        >
                            {cancelText}
                        </Button>
                        <Button
                            onClick={onConfirm}
                            className="flex-1 py-3 text-base font-medium bg-gradient-to-r from-enterprise-600 to-enterprise-700 hover:from-enterprise-700 hover:to-enterprise-800"
                        >
                            {confirmText}
                        </Button>
                    </div>
                </div>

                {/* Close button */}
                <button
                    onClick={onCancel}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                    <X size={24} />
                </button>
            </Card>
        </div>
    );
};
