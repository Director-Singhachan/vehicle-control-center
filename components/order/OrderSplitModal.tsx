import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Split, AlertCircle } from 'lucide-react';
import { ordersService } from '../../services/ordersService';
import { LoadingSpinner } from '../ui/LoadingSpinner';

interface OrderSplitModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    item: {
        id: string;
        product_name: string;
        quantity: number;
        unit_name: string;
        fulfillment_method: string;
    };
}

interface SplitItem {
    id: string;
    quantity: number;
    fulfillment_method: 'delivery' | 'pickup';
    notes: string;
}

export const OrderSplitModal: React.FC<OrderSplitModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    item
}) => {
    const [splits, setSplits] = useState<SplitItem[]>([
        {
            id: '1',
            quantity: item.quantity,
            fulfillment_method: (item.fulfillment_method as any) || 'delivery',
            notes: ''
        }
    ]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setSplits([
                {
                    id: Math.random().toString(36).substr(2, 9),
                    quantity: item.quantity,
                    fulfillment_method: (item.fulfillment_method as any) || 'delivery',
                    notes: ''
                }
            ]);
            setError(null);
        }
    }, [isOpen, item]);

    const totalSplitQuantity = splits.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
    const isQuantityValid = totalSplitQuantity === item.quantity;

    const handleAddSplit = () => {
        setSplits([
            ...splits,
            {
                id: Math.random().toString(36).substr(2, 9),
                quantity: 0,
                fulfillment_method: 'delivery',
                notes: ''
            }
        ]);
    };

    const handleRemoveSplit = (id: string) => {
        if (splits.length > 1) {
            setSplits(splits.filter(s => s.id !== id));
        }
    };

    const handleUpdateSplit = (id: string, updates: Partial<SplitItem>) => {
        setSplits(splits.map(s => s.id === id ? { ...s, ...updates } : s));
    };

    const handleSave = async () => {
        if (!isQuantityValid) {
            setError(`จำนวนรวมไม่ถูกต้อง (รวมได้ ${totalSplitQuantity}, ต้องเป็น ${item.quantity})`);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await ordersService.splitItem(item.id, splits.map(s => ({
                quantity: s.quantity,
                fulfillment_method: s.fulfillment_method,
                notes: s.notes
            })));
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'เกิดข้อผิดพลาดในการแบ่งยอด');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-charcoal-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                            <Split className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight">แบ่งยอดส่งสินค้า</h3>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                {item.product_name} ({item.quantity} {item.unit_name})
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 rounded-2xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="px-8 py-6 max-h-[60vh] overflow-y-auto space-y-4">
                    {error && (
                        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30 flex items-start gap-3 animate-in slide-in-from-top-2">
                            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
                            <p className="text-sm font-bold text-rose-700 dark:text-rose-300">{error}</p>
                        </div>
                    )}

                    <div className="space-y-4">
                        {splits.map((split, index) => (
                            <div
                                key={split.id}
                                className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-charcoal-800/50 space-y-4 transition-all"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">ชุดที่ {index + 1}</span>
                                    {splits.length > 1 && (
                                        <button
                                            onClick={() => handleRemoveSplit(split.id)}
                                            className="p-2 rounded-xl text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase ml-1">จำนวนที่แบ่ง</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={split.quantity === 0 ? '' : split.quantity}
                                                onChange={(e) => handleUpdateSplit(split.id, { quantity: Number(e.target.value) })}
                                                placeholder="0.00"
                                                className="w-full pl-4 pr-12 py-3 rounded-xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-slate-700 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{item.unit_name}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase ml-1">วิธีรับสินค้า</label>
                                        <div className="grid grid-cols-2 gap-2 p-1 bg-white dark:bg-charcoal-900 rounded-xl border border-slate-200 dark:border-slate-700">
                                            <button
                                                onClick={() => handleUpdateSplit(split.id, { fulfillment_method: 'delivery' })}
                                                className={`py-2 rounded-lg text-xs font-bold transition-all ${split.fulfillment_method === 'delivery'
                                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                                                    : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-charcoal-800'
                                                    }`}
                                            >
                                                จัดส่ง (Delivery)
                                            </button>
                                            <button
                                                onClick={() => handleUpdateSplit(split.id, { fulfillment_method: 'pickup' })}
                                                className={`py-2 rounded-lg text-xs font-bold transition-all ${split.fulfillment_method === 'pickup'
                                                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/30'
                                                    : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-charcoal-800'
                                                    }`}
                                            >
                                                รับเอง (Pickup)
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase ml-1">หมายเหตุชุดนี้ (ถ้ามี)</label>
                                    <input
                                        type="text"
                                        value={split.notes}
                                        onChange={(e) => handleUpdateSplit(split.id, { notes: e.target.value })}
                                        placeholder="ระบุหมายเหตุเฉพาะชุดนี้ เช่น ส่งที่สาขา 2..."
                                        className="w-full px-4 py-3 rounded-xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-slate-700 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={handleAddSplit}
                        className="w-full py-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 hover:text-blue-500 hover:border-blue-200 dark:hover:border-blue-900/50 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 flex items-center justify-center gap-2 transition-all font-bold group"
                    >
                        <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        เพิ่มชุดแบ่งยอดอีก
                    </button>
                </div>

                {/* Footer */}
                <div className="px-8 py-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-charcoal-900/50 flex flex-col gap-4">
                    <div className="flex items-center justify-between px-2">
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-400">จำนวนรวมทั้งหมด:</span>
                        <div className="flex items-center gap-2">
                            <span className={`text-lg font-black ${isQuantityValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {totalSplitQuantity} / {item.quantity}
                            </span>
                            <span className="text-sm font-bold text-slate-400">{item.unit_name}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-4 px-6 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-black hover:bg-white dark:hover:bg-charcoal-800 transition-all active:scale-95"
                        >
                            ยกเลิก
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading || !isQuantityValid}
                            className={`flex-[2] py-4 px-6 rounded-2xl font-black text-white shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 ${loading || !isQuantityValid
                                ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed shadow-none'
                                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/25'
                                }`}
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Split className="w-5 h-5" />
                                    ยืนยันการแบ่งยอด
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
