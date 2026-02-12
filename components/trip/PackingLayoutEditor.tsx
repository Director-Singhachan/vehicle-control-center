/**
 * PackingLayoutEditor - บันทึกการจัดเรียงสินค้าจริงหลังจบทริป
 * 
 * Features:
 * - ดึงรายการสินค้าจริงในทริปจาก delivery_trip_items
 * - จัดเรียงลงพาเลท / บนพื้น ด้วย Click-to-Add
 * - แบ่งจำนวนสินค้าไปหลายตำแหน่งได้
 * - Real-time validation: ผลรวมจำนวนที่วาง ≤ จำนวนที่ส่งจริง
 * - Progress indicator: จัดเรียงแล้ว X/Y รายการ
 * - Auto-save draft ลง localStorage
 * - แสดง LayoutPreview (read-only) เมื่อมี layout เดิม
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    Package,
    Plus,
    Minus,
    Trash2,
    Save,
    RotateCcw,
    CheckCircle,
    AlertTriangle,
    X,
    Layers,
    ArrowDown,
    ChevronDown,
    ChevronUp,
    Undo2,
    Redo2,
    Loader2,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import {
    tripMetricsService,
    type PackingLayoutPosition,
    type PackingLayoutSavePayload,
    type PackingLayoutResult,
    type PackingLayoutResultPosition,
} from '../../services/tripMetricsService';

// ==================== Types ====================

interface TripItem {
    id: string; // delivery_trip_item_id
    product_id: string;
    product_code: string;
    product_name: string;
    category: string;
    unit: string;
    quantity: number; // จำนวนทั้งหมดในทริป
    weight_kg: number | null;
    is_bonus: boolean;
}

interface PositionItem {
    delivery_trip_item_id: string;
    quantity: number;
}

interface Position {
    id: string; // client-side uuid
    position_type: 'pallet' | 'floor';
    position_index: number;
    layer_index: number;
    notes: string;
    items: PositionItem[];
    collapsed: boolean;
}

interface LayoutState {
    positions: Position[];
}

interface Props {
    tripId: string;
    tripStatus: string;
    onClose?: () => void;
    onSaved?: () => void;
}

// Simple UUID generator
const generateId = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });

const DRAFT_KEY_PREFIX = 'packing-layout-draft-';

// ==================== Component ====================

export const PackingLayoutEditor: React.FC<Props> = ({
    tripId,
    tripStatus,
    onClose,
    onSaved,
}) => {
    // Data
    const [tripItems, setTripItems] = useState<TripItem[]>([]);
    const [loadingItems, setLoadingItems] = useState(true);
    const [existingLayout, setExistingLayout] = useState<PackingLayoutResult | null>(null);

    // State
    const [layout, setLayout] = useState<LayoutState>({ positions: [] });
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Undo/Redo
    const [history, setHistory] = useState<LayoutState[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // UI
    const [addItemModalOpen, setAddItemModalOpen] = useState(false);
    const [addItemTargetPositionId, setAddItemTargetPositionId] = useState<string | null>(null);
    const [showConfirmSave, setShowConfirmSave] = useState(false);
    const [isReadOnly, setIsReadOnly] = useState(false);

    // Auto-save timer
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const draftKey = `${DRAFT_KEY_PREFIX}${tripId}`;

    // ==================== Load trip items ====================
    useEffect(() => {
        const load = async () => {
            setLoadingItems(true);
            try {
                const items = await tripMetricsService.getTripItemsDetails(tripId);
                const mappedItems: TripItem[] = items.map((item) => ({
                    id: item.product_id, // We'll map via the actual delivery_trip_item_id below
                    product_id: item.product_id,
                    product_code: item.product_code,
                    product_name: item.product_name,
                    category: item.category,
                    unit: 'หน่วย',
                    quantity: item.quantity,
                    weight_kg: item.weight_kg,
                    is_bonus: item.is_bonus,
                }));

                // We need the actual delivery_trip_item IDs
                // getTripItemsDetails doesn't return the delivery_trip_item id directly
                // So we fetch them separately
                const { supabase } = await import('../../lib/supabase');
                const { data: rawItems } = await supabase
                    .from('delivery_trip_items')
                    .select('id, product_id, quantity, is_bonus')
                    .eq('delivery_trip_id', tripId);

                const finalItems: TripItem[] = (rawItems ?? []).map((ri: any) => {
                    const detail = items.find((i) => i.product_id === ri.product_id);
                    return {
                        id: ri.id,
                        product_id: ri.product_id,
                        product_code: detail?.product_code || '',
                        product_name: detail?.product_name || '',
                        category: detail?.category || '',
                        unit: detail?.packaging_type || 'หน่วย',
                        quantity: Number(ri.quantity || 0),
                        weight_kg: detail?.weight_kg ?? null,
                        is_bonus: !!ri.is_bonus,
                    };
                });

                setTripItems(finalItems);

                // Load existing layout
                const existingData = await tripMetricsService.getTripPackingLayout(tripId);
                setExistingLayout(existingData);

                if (existingData && existingData.positions.length > 0) {
                    // Convert existing layout to editable state
                    const editablePositions: Position[] = existingData.positions.map((pos) => ({
                        id: generateId(),
                        position_type: pos.position_type,
                        position_index: pos.position_index,
                        layer_index: pos.layer_index,
                        notes: pos.notes || '',
                        items: pos.items.map((item) => ({
                            delivery_trip_item_id: item.delivery_trip_item_id,
                            quantity: item.quantity,
                        })),
                        collapsed: false,
                    }));
                    const initialState = { positions: editablePositions };
                    setLayout(initialState);
                    setHistory([initialState]);
                    setHistoryIndex(0);
                    setIsReadOnly(true);
                } else {
                    // Check for draft
                    try {
                        const draft = localStorage.getItem(draftKey);
                        if (draft) {
                            const parsed = JSON.parse(draft) as LayoutState;
                            setLayout(parsed);
                            setHistory([parsed]);
                            setHistoryIndex(0);
                        } else {
                            // Start with 1 pallet
                            const initial: LayoutState = {
                                positions: [
                                    {
                                        id: generateId(),
                                        position_type: 'pallet',
                                        position_index: 1,
                                        layer_index: 0,
                                        notes: '',
                                        items: [],
                                        collapsed: false,
                                    },
                                ],
                            };
                            setLayout(initial);
                            setHistory([initial]);
                            setHistoryIndex(0);
                        }
                    } catch {
                        const initial: LayoutState = {
                            positions: [
                                {
                                    id: generateId(),
                                    position_type: 'pallet',
                                    position_index: 1,
                                    layer_index: 0,
                                    notes: '',
                                    items: [],
                                    collapsed: false,
                                },
                            ],
                        };
                        setLayout(initial);
                        setHistory([initial]);
                        setHistoryIndex(0);
                    }
                }
            } catch (err: any) {
                console.error('[PackingLayoutEditor] Load error:', err);
            } finally {
                setLoadingItems(false);
            }
        };
        load();
    }, [tripId]);

    // ==================== Auto-save draft ====================
    useEffect(() => {
        if (isReadOnly) return;
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(() => {
            try {
                localStorage.setItem(draftKey, JSON.stringify(layout));
            } catch { /* ignore */ }
        }, 2000);
        return () => {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        };
    }, [layout, isReadOnly, draftKey]);

    // ==================== History helpers ====================
    const pushHistory = useCallback(
        (newState: LayoutState) => {
            setHistory((prev) => {
                const newHist = prev.slice(0, historyIndex + 1);
                newHist.push(newState);
                // Limit history
                if (newHist.length > 50) newHist.shift();
                return newHist;
            });
            setHistoryIndex((prev) => prev + 1);
            setLayout(newState);
        },
        [historyIndex]
    );

    const undo = useCallback(() => {
        if (historyIndex > 0) {
            const newIdx = historyIndex - 1;
            setHistoryIndex(newIdx);
            setLayout(history[newIdx]);
        }
    }, [history, historyIndex]);

    const redo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            const newIdx = historyIndex + 1;
            setHistoryIndex(newIdx);
            setLayout(history[newIdx]);
        }
    }, [history, historyIndex]);

    // ==================== Validation ====================
    const allocatedQuantities = useMemo(() => {
        const map = new Map<string, number>();
        for (const pos of layout.positions) {
            for (const item of pos.items) {
                map.set(item.delivery_trip_item_id, (map.get(item.delivery_trip_item_id) || 0) + item.quantity);
            }
        }
        return map;
    }, [layout]);

    const validationErrors = useMemo(() => {
        const errors: string[] = [];
        for (const tripItem of tripItems) {
            const allocated = allocatedQuantities.get(tripItem.id) || 0;
            if (allocated > tripItem.quantity) {
                errors.push(
                    `${tripItem.product_name}: จัดเกิน (มี ${tripItem.quantity} แต่จัด ${allocated})`
                );
            }
        }
        return errors;
    }, [tripItems, allocatedQuantities]);

    const unallocatedItems = useMemo(() => {
        return tripItems.filter((ti) => {
            const allocated = allocatedQuantities.get(ti.id) || 0;
            return allocated < ti.quantity;
        });
    }, [tripItems, allocatedQuantities]);

    const totalAllocatedItems = useMemo(() => {
        let count = 0;
        allocatedQuantities.forEach((v) => (count += v));
        return count;
    }, [allocatedQuantities]);

    const totalItemsInTrip = useMemo(() => {
        return tripItems.reduce((sum, ti) => sum + ti.quantity, 0);
    }, [tripItems]);

    const progressPercent = useMemo(() => {
        if (totalItemsInTrip === 0) return 0;
        return Math.min(100, Math.round((totalAllocatedItems / totalItemsInTrip) * 100));
    }, [totalAllocatedItems, totalItemsInTrip]);

    // ==================== Actions ====================

    const addPallet = useCallback(() => {
        const palletCount = layout.positions.filter((p) => p.position_type === 'pallet').length;
        const newPos: Position = {
            id: generateId(),
            position_type: 'pallet',
            position_index: palletCount + 1,
            layer_index: 0,
            notes: '',
            items: [],
            collapsed: false,
        };
        pushHistory({ positions: [...layout.positions, newPos] });
    }, [layout, pushHistory]);

    const addFloor = useCallback(() => {
        const floorCount = layout.positions.filter((p) => p.position_type === 'floor').length;
        const newPos: Position = {
            id: generateId(),
            position_type: 'floor',
            position_index: floorCount + 1,
            layer_index: 0,
            notes: '',
            items: [],
            collapsed: false,
        };
        pushHistory({ positions: [...layout.positions, newPos] });
    }, [layout, pushHistory]);

    const removePosition = useCallback(
        (posId: string) => {
            pushHistory({
                positions: layout.positions.filter((p) => p.id !== posId),
            });
        },
        [layout, pushHistory]
    );

    const toggleCollapse = useCallback(
        (posId: string) => {
            setLayout((prev) => ({
                positions: prev.positions.map((p) =>
                    p.id === posId ? { ...p, collapsed: !p.collapsed } : p
                ),
            }));
        },
        []
    );

    const addItemToPosition = useCallback(
        (posId: string, tripItemId: string, qty: number) => {
            if (qty <= 0) return;
            const newPositions = layout.positions.map((pos) => {
                if (pos.id !== posId) return pos;
                const existing = pos.items.find((i) => i.delivery_trip_item_id === tripItemId);
                if (existing) {
                    return {
                        ...pos,
                        items: pos.items.map((i) =>
                            i.delivery_trip_item_id === tripItemId
                                ? { ...i, quantity: i.quantity + qty }
                                : i
                        ),
                    };
                }
                return {
                    ...pos,
                    items: [...pos.items, { delivery_trip_item_id: tripItemId, quantity: qty }],
                };
            });
            pushHistory({ positions: newPositions });
        },
        [layout, pushHistory]
    );

    const updateItemQuantity = useCallback(
        (posId: string, tripItemId: string, newQty: number) => {
            if (newQty <= 0) {
                // Remove item
                const newPositions = layout.positions.map((pos) => {
                    if (pos.id !== posId) return pos;
                    return {
                        ...pos,
                        items: pos.items.filter((i) => i.delivery_trip_item_id !== tripItemId),
                    };
                });
                pushHistory({ positions: newPositions });
                return;
            }
            const newPositions = layout.positions.map((pos) => {
                if (pos.id !== posId) return pos;
                return {
                    ...pos,
                    items: pos.items.map((i) =>
                        i.delivery_trip_item_id === tripItemId ? { ...i, quantity: newQty } : i
                    ),
                };
            });
            pushHistory({ positions: newPositions });
        },
        [layout, pushHistory]
    );

    const removeItemFromPosition = useCallback(
        (posId: string, tripItemId: string) => {
            const newPositions = layout.positions.map((pos) => {
                if (pos.id !== posId) return pos;
                return {
                    ...pos,
                    items: pos.items.filter((i) => i.delivery_trip_item_id !== tripItemId),
                };
            });
            pushHistory({ positions: newPositions });
        },
        [layout, pushHistory]
    );

    const clearAll = useCallback(() => {
        const cleared: LayoutState = {
            positions: layout.positions.map((p) => ({ ...p, items: [] })),
        };
        pushHistory(cleared);
    }, [layout, pushHistory]);

    // ==================== Save ====================
    const handleSave = useCallback(async () => {
        if (validationErrors.length > 0) return;
        setSaving(true);
        setSaveError(null);
        setSaveSuccess(false);

        try {
            const payload: PackingLayoutSavePayload = {
                positions: layout.positions
                    .filter((p) => p.items.length > 0)
                    .map((p) => ({
                        position_type: p.position_type,
                        position_index: p.position_index,
                        layer_index: p.layer_index,
                        notes: p.notes || undefined,
                        items: p.items.map((i) => ({
                            delivery_trip_item_id: i.delivery_trip_item_id,
                            quantity: i.quantity,
                        })),
                    })),
            };

            await tripMetricsService.saveTripPackingLayout(tripId, payload);

            // Clear draft
            try { localStorage.removeItem(draftKey); } catch { /* ignore */ }

            setSaveSuccess(true);
            setIsReadOnly(true);
            setTimeout(() => {
                onSaved?.();
            }, 1000);
        } catch (err: any) {
            console.error('[PackingLayoutEditor] Save error:', err);
            setSaveError(err?.message || 'บันทึกไม่สำเร็จ');
        } finally {
            setSaving(false);
            setShowConfirmSave(false);
        }
    }, [layout, tripId, validationErrors, draftKey, onSaved]);

    const handleEdit = useCallback(() => {
        setIsReadOnly(false);
        setSaveSuccess(false);
    }, []);

    // ==================== Helper: get trip item info ====================
    const getTripItemById = useCallback(
        (id: string): TripItem | undefined => tripItems.find((ti) => ti.id === id),
        [tripItems]
    );

    const getRemainingQuantity = useCallback(
        (tripItemId: string): number => {
            const tripItem = getTripItemById(tripItemId);
            if (!tripItem) return 0;
            const allocated = allocatedQuantities.get(tripItemId) || 0;
            return tripItem.quantity - allocated;
        },
        [getTripItemById, allocatedQuantities]
    );

    // ==================== Render ====================
    if (loadingItems) {
        return (
            <Card className="p-8">
                <div className="flex items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
                    <Loader2 className="animate-spin" size={24} />
                    <span>กำลังโหลดรายการสินค้า...</span>
                </div>
            </Card>
        );
    }

    if (tripItems.length === 0) {
        return (
            <Card className="p-8 text-center">
                <Package className="mx-auto mb-3 text-slate-400" size={40} />
                <p className="text-slate-500 dark:text-slate-400">ไม่มีสินค้าในทริปนี้</p>
            </Card>
        );
    }

    const palletPositions = layout.positions.filter((p) => p.position_type === 'pallet');
    const floorPositions = layout.positions.filter((p) => p.position_type === 'floor');

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <Layers size={20} />
                        บันทึกการจัดเรียงสินค้า
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        จัดสินค้าลงพาเลทหรือบนพื้นรถ
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {!isReadOnly && (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={undo}
                                disabled={historyIndex <= 0}
                                title="Undo"
                            >
                                <Undo2 size={16} />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={redo}
                                disabled={historyIndex >= history.length - 1}
                                title="Redo"
                            >
                                <Redo2 size={16} />
                            </Button>
                            <Button variant="outline" size="sm" onClick={clearAll} title="ล้างทั้งหมด">
                                <RotateCcw size={16} className="mr-1" />
                                ล้าง
                            </Button>
                        </>
                    )}
                    {isReadOnly && !saveSuccess && (
                        <Button variant="outline" size="sm" onClick={handleEdit}>
                            แก้ไข
                        </Button>
                    )}
                    {onClose && (
                        <Button variant="outline" size="sm" onClick={onClose}>
                            <X size={16} className="mr-1" />
                            ปิด
                        </Button>
                    )}
                </div>
            </div>

            {/* Progress Bar */}
            <Card className="p-3">
                <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-slate-600 dark:text-slate-400">
                        จัดเรียงแล้ว{' '}
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {totalAllocatedItems}
                        </span>
                        /{totalItemsInTrip} ชิ้น
                    </span>
                    <span
                        className={`font-semibold ${progressPercent === 100
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-blue-600 dark:text-blue-400'
                            }`}
                    >
                        {progressPercent}%
                    </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                    <div
                        className={`h-2.5 rounded-full transition-all duration-300 ${progressPercent === 100
                                ? 'bg-green-500'
                                : progressPercent > 50
                                    ? 'bg-blue-500'
                                    : 'bg-amber-500'
                            }`}
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            </Card>

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-medium text-sm mb-1">
                        <AlertTriangle size={16} />
                        ข้อผิดพลาด
                    </div>
                    {validationErrors.map((err, i) => (
                        <p key={i} className="text-sm text-red-600 dark:text-red-400 ml-6">
                            • {err}
                        </p>
                    ))}
                </div>
            )}

            {/* Unallocated Items Warning */}
            {unallocatedItems.length > 0 && !isReadOnly && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium text-sm mb-1">
                        <AlertTriangle size={16} />
                        สินค้าที่ยังไม่ได้จัดเรียง ({unallocatedItems.length} รายการ)
                    </div>
                    <div className="mt-2 space-y-1 max-h-32 overflow-auto">
                        {unallocatedItems.map((item) => {
                            const remaining = getRemainingQuantity(item.id);
                            return (
                                <div
                                    key={item.id}
                                    className="text-sm text-amber-600 dark:text-amber-400 ml-6 flex items-center justify-between"
                                >
                                    <span>
                                        • {item.product_code} - {item.product_name}
                                    </span>
                                    <span className="text-xs font-medium ml-2">
                                        เหลือ {remaining}/{item.quantity}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Success Message */}
            {saveSuccess && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-2">
                    <CheckCircle size={18} className="text-green-600 dark:text-green-400" />
                    <span className="text-green-700 dark:text-green-400 font-medium text-sm">
                        บันทึกการจัดเรียงเรียบร้อยแล้ว!
                    </span>
                </div>
            )}

            {/* Save Error */}
            {saveError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-center gap-2">
                    <AlertTriangle size={18} className="text-red-600 dark:text-red-400" />
                    <span className="text-red-700 dark:text-red-400 font-medium text-sm">
                        {saveError}
                    </span>
                </div>
            )}

            {/* Positions Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Pallets */}
                {palletPositions.map((pos) => (
                    <PositionCard
                        key={pos.id}
                        position={pos}
                        tripItems={tripItems}
                        getTripItemById={getTripItemById}
                        getRemainingQuantity={getRemainingQuantity}
                        allocatedQuantities={allocatedQuantities}
                        isReadOnly={isReadOnly}
                        onRemovePosition={removePosition}
                        onToggleCollapse={toggleCollapse}
                        onAddItem={(tripItemId, qty) => addItemToPosition(pos.id, tripItemId, qty)}
                        onUpdateItemQuantity={(tripItemId, newQty) => updateItemQuantity(pos.id, tripItemId, newQty)}
                        onRemoveItem={(tripItemId) => removeItemFromPosition(pos.id, tripItemId)}
                    />
                ))}

                {/* Floor zones */}
                {floorPositions.map((pos) => (
                    <PositionCard
                        key={pos.id}
                        position={pos}
                        tripItems={tripItems}
                        getTripItemById={getTripItemById}
                        getRemainingQuantity={getRemainingQuantity}
                        allocatedQuantities={allocatedQuantities}
                        isReadOnly={isReadOnly}
                        onRemovePosition={removePosition}
                        onToggleCollapse={toggleCollapse}
                        onAddItem={(tripItemId, qty) => addItemToPosition(pos.id, tripItemId, qty)}
                        onUpdateItemQuantity={(tripItemId, newQty) => updateItemQuantity(pos.id, tripItemId, newQty)}
                        onRemoveItem={(tripItemId) => removeItemFromPosition(pos.id, tripItemId)}
                    />
                ))}
            </div>

            {/* Add Pallet / Floor buttons */}
            {!isReadOnly && (
                <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={addPallet} className="flex-1">
                        <Plus size={16} className="mr-2" />
                        เพิ่มพาเลท
                    </Button>
                    <Button variant="outline" onClick={addFloor} className="flex-1">
                        <Plus size={16} className="mr-2" />
                        เพิ่มโซนบนพื้น
                    </Button>
                </div>
            )}

            {/* Save Button */}
            {!isReadOnly && (
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                    {unallocatedItems.length > 0 && (
                        <span className="text-xs text-amber-600 dark:text-amber-400">
                            ⚠️ ยังมีสินค้าที่ไม่ได้จัดเรียง (สามารถบันทึกได้)
                        </span>
                    )}
                    <Button
                        variant="primary"
                        onClick={() => setShowConfirmSave(true)}
                        disabled={saving || validationErrors.length > 0 || layout.positions.every((p) => p.items.length === 0)}
                        isLoading={saving}
                    >
                        <Save size={16} className="mr-2" />
                        บันทึกการจัดเรียง
                    </Button>
                </div>
            )}

            {/* Confirm Save Dialog */}
            {showConfirmSave && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6">
                        <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
                            ยืนยันบันทึกการจัดเรียง
                        </h4>
                        <div className="space-y-2 mb-4 text-sm text-slate-600 dark:text-slate-400">
                            <p>
                                <span className="font-medium">จำนวนพาเลท:</span>{' '}
                                {palletPositions.filter((p) => p.items.length > 0).length} พาเลท
                            </p>
                            <p>
                                <span className="font-medium">จำนวนโซนบนพื้น:</span>{' '}
                                {floorPositions.filter((p) => p.items.length > 0).length} โซน
                            </p>
                            <p>
                                <span className="font-medium">สินค้าที่จัดเรียง:</span>{' '}
                                {totalAllocatedItems}/{totalItemsInTrip} ชิ้น ({progressPercent}%)
                            </p>
                            {unallocatedItems.length > 0 && (
                                <p className="text-amber-600 dark:text-amber-400">
                                    ⚠️ มีสินค้า {unallocatedItems.length} รายการที่ยังไม่ได้จัดเรียง
                                </p>
                            )}
                        </div>
                        <div className="flex items-center justify-end gap-3">
                            <Button variant="outline" onClick={() => setShowConfirmSave(false)}>
                                ยกเลิก
                            </Button>
                            <Button variant="primary" onClick={handleSave} isLoading={saving}>
                                <CheckCircle size={16} className="mr-2" />
                                ยืนยันบันทึก
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ==================== PositionCard Sub-Component ====================

interface PositionCardProps {
    position: Position;
    tripItems: TripItem[];
    getTripItemById: (id: string) => TripItem | undefined;
    getRemainingQuantity: (tripItemId: string) => number;
    allocatedQuantities: Map<string, number>;
    isReadOnly: boolean;
    onRemovePosition: (posId: string) => void;
    onToggleCollapse: (posId: string) => void;
    onAddItem: (tripItemId: string, qty: number) => void;
    onUpdateItemQuantity: (tripItemId: string, newQty: number) => void;
    onRemoveItem: (tripItemId: string) => void;
}

const PositionCard: React.FC<PositionCardProps> = ({
    position,
    tripItems,
    getTripItemById,
    getRemainingQuantity,
    allocatedQuantities,
    isReadOnly,
    onRemovePosition,
    onToggleCollapse,
    onAddItem,
    onUpdateItemQuantity,
    onRemoveItem,
}) => {
    const [showItemPicker, setShowItemPicker] = useState(false);
    const [addQuantity, setAddQuantity] = useState<number>(0);
    const [selectedItemId, setSelectedItemId] = useState<string>('');

    const isPallet = position.position_type === 'pallet';
    const label = isPallet
        ? `พาเลท ${position.position_index}`
        : `บนพื้น ${position.position_index}`;

    const bgColor = isPallet
        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
        : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800';

    const headerColor = isPallet
        ? 'text-blue-700 dark:text-blue-400'
        : 'text-amber-700 dark:text-amber-400';

    const iconBg = isPallet
        ? 'bg-blue-100 dark:bg-blue-900'
        : 'bg-amber-100 dark:bg-amber-900';

    // Calculate total weight for this position
    const totalWeight = position.items.reduce((sum, item) => {
        const tripItem = getTripItemById(item.delivery_trip_item_id);
        return sum + (tripItem?.weight_kg ? tripItem.weight_kg * item.quantity : 0);
    }, 0);

    const totalItemCount = position.items.reduce((sum, item) => sum + item.quantity, 0);

    // Available items to add (not yet maxed out)
    const availableItems = tripItems.filter((ti) => {
        const remaining = getRemainingQuantity(ti.id);
        return remaining > 0;
    });

    const handlePickItem = (itemId: string) => {
        setSelectedItemId(itemId);
        const remaining = getRemainingQuantity(itemId);
        setAddQuantity(remaining);
    };

    const handleConfirmAdd = () => {
        if (selectedItemId && addQuantity > 0) {
            onAddItem(selectedItemId, addQuantity);
            setSelectedItemId('');
            setAddQuantity(0);
            setShowItemPicker(false);
        }
    };

    return (
        <div className={`rounded-xl border ${bgColor} overflow-hidden`}>
            {/* Header */}
            <div
                className={`flex items-center justify-between px-4 py-3 cursor-pointer select-none`}
                onClick={() => onToggleCollapse(position.id)}
            >
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
                        {isPallet ? (
                            <Package size={20} className={headerColor} />
                        ) : (
                            <ArrowDown size={20} className={headerColor} />
                        )}
                    </div>
                    <div>
                        <div className={`font-semibold ${headerColor}`}>{label}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                            {position.items.length} รายการ · {totalItemCount} ชิ้น
                            {totalWeight > 0 && ` · ${totalWeight.toFixed(1)} kg`}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {!isReadOnly && (
                        <button
                            className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 dark:text-red-400 transition-colors"
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemovePosition(position.id);
                            }}
                            title="ลบตำแหน่ง"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                    {position.collapsed ? (
                        <ChevronDown size={20} className="text-slate-400" />
                    ) : (
                        <ChevronUp size={20} className="text-slate-400" />
                    )}
                </div>
            </div>

            {/* Items */}
            {!position.collapsed && (
                <div className="px-4 pb-4 space-y-2">
                    {position.items.length === 0 && (
                        <div className="text-sm text-slate-400 dark:text-slate-500 py-3 text-center italic">
                            ยังไม่มีสินค้า — กดเพิ่มสินค้าด้านล่าง
                        </div>
                    )}

                    {position.items.map((item) => {
                        const tripItem = getTripItemById(item.delivery_trip_item_id);
                        if (!tripItem) return null;

                        const allocated = allocatedQuantities.get(item.delivery_trip_item_id) || 0;
                        const isOver = allocated > tripItem.quantity;

                        return (
                            <div
                                key={item.delivery_trip_item_id}
                                className={`flex items-center gap-3 p-2.5 rounded-lg bg-white dark:bg-slate-800 border ${isOver
                                        ? 'border-red-300 dark:border-red-700'
                                        : 'border-slate-200 dark:border-slate-700'
                                    }`}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                        {tripItem.product_code} - {tripItem.product_name}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                        {tripItem.category}
                                        {tripItem.weight_kg && ` · ${tripItem.weight_kg} kg/หน่วย`}
                                        {tripItem.is_bonus && (
                                            <span className="ml-1 text-green-600 dark:text-green-400">(ของแถม)</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {!isReadOnly && (
                                        <button
                                            className="w-7 h-7 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center transition-colors"
                                            onClick={() => onUpdateItemQuantity(item.delivery_trip_item_id, item.quantity - 1)}
                                        >
                                            <Minus size={14} />
                                        </button>
                                    )}
                                    <span
                                        className={`min-w-[3rem] text-center font-bold text-sm ${isOver ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'
                                            }`}
                                    >
                                        {item.quantity}
                                    </span>
                                    {!isReadOnly && (
                                        <button
                                            className="w-7 h-7 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center transition-colors"
                                            onClick={() => {
                                                const remaining = getRemainingQuantity(item.delivery_trip_item_id);
                                                if (remaining > 0) {
                                                    onUpdateItemQuantity(item.delivery_trip_item_id, item.quantity + 1);
                                                }
                                            }}
                                        >
                                            <Plus size={14} />
                                        </button>
                                    )}
                                    {!isReadOnly && (
                                        <button
                                            className="w-7 h-7 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 flex items-center justify-center transition-colors ml-1"
                                            onClick={() => onRemoveItem(item.delivery_trip_item_id)}
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {/* Add Item section */}
                    {!isReadOnly && (
                        <>
                            {!showItemPicker ? (
                                <button
                                    className="w-full py-2.5 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-500 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-colors text-sm flex items-center justify-center gap-2"
                                    onClick={() => setShowItemPicker(true)}
                                    disabled={availableItems.length === 0}
                                >
                                    <Plus size={16} />
                                    {availableItems.length > 0
                                        ? 'เพิ่มสินค้า'
                                        : 'จัดสินค้าครบแล้ว'}
                                </button>
                            ) : (
                                <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-white dark:bg-slate-800 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                            เลือกสินค้า
                                        </span>
                                        <button
                                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                            onClick={() => {
                                                setShowItemPicker(false);
                                                setSelectedItemId('');
                                            }}
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>

                                    <div className="max-h-40 overflow-auto space-y-1">
                                        {availableItems.map((ai) => {
                                            const remaining = getRemainingQuantity(ai.id);
                                            return (
                                                <button
                                                    key={ai.id}
                                                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${selectedItemId === ai.id
                                                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-1 ring-blue-400'
                                                            : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                                                        }`}
                                                    onClick={() => handlePickItem(ai.id)}
                                                >
                                                    <div className="font-medium truncate">
                                                        {ai.product_code} - {ai.product_name}
                                                    </div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                                        เหลือ {remaining}/{ai.quantity} · {ai.category}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {selectedItemId && (
                                        <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                            <label className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">จำนวน:</label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={getRemainingQuantity(selectedItemId)}
                                                value={addQuantity}
                                                onChange={(e) => setAddQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                                className="w-20 px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                            />
                                            <span className="text-xs text-slate-400">
                                                / {getRemainingQuantity(selectedItemId)}
                                            </span>
                                            <Button size="sm" variant="primary" onClick={handleConfirmAdd} className="ml-auto">
                                                <Plus size={14} className="mr-1" />
                                                เพิ่ม
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
