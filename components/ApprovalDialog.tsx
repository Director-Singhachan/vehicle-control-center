import React, { useState } from 'react';
import { X, Lock, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

interface ApprovalDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (password: string, comment: string) => Promise<void>;
    title?: string;
    message?: string;
    isLoading?: boolean;
}

export const ApprovalDialog: React.FC<ApprovalDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title = 'ยืนยันการอนุมัติ',
    message = 'กรุณาระบุรหัสผ่านเพื่อยืนยันการอนุมัติรายการนี้',
    isLoading = false,
}) => {
    const [password, setPassword] = useState('');
    const [comment, setComment] = useState('');
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!password) {
            setError('กรุณาระบุรหัสผ่าน');
            return;
        }

        try {
            await onConfirm(password, comment);
            // Reset form on success (parent will close dialog)
            setPassword('');
            setComment('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'รหัสผ่านไม่ถูกต้อง หรือเกิดข้อผิดพลาด');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-charcoal-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700 animate-fade-in">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-charcoal-950">
                    <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-enterprise-100 dark:bg-enterprise-900/30 rounded-full flex items-center justify-center">
                            <Lock className="w-4 h-4 text-enterprise-600 dark:text-enterprise-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                            {title}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 transition-colors"
                        disabled={isLoading}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        {message}
                    </p>

                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start space-x-2">
                            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                            รหัสผ่านยืนยัน <span className="text-red-500">*</span>
                        </label>
                        <Input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="ระบุรหัสผ่านของคุณ"
                            className="w-full"
                            autoFocus
                            disabled={isLoading}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                            ความเห็นเพิ่มเติม (ถ้ามี)
                        </label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="ระบุเหตุผลหรือหมายเหตุ..."
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-enterprise-500 focus:border-transparent min-h-[80px] resize-none"
                            disabled={isLoading}
                        />
                    </div>

                    <div className="flex items-center justify-end space-x-3 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={isLoading}
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            type="submit"
                            isLoading={isLoading}
                            className="bg-enterprise-600 hover:bg-enterprise-700 text-white"
                        >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            ยืนยันการอนุมัติ
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
