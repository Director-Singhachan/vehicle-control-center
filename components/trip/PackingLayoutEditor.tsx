/**
 * PackingLayoutEditor - บันทึกการจัดเรียงสินค้าจริงหลังจบทริป
 *
 * รองรับ 2 โหมดต่อพาเลท:
 * 1) โหมดง่าย (default): สินค้า + จำนวนชั้น → เช่น "เบียร์ 60 ลัง, 4 ชั้น"
 * 2) โหมดละเอียด (toggle): ระบุสินค้าทีละชั้น → เช่น "ชั้น 1: เบียร์ 15 + น้ำ 10"
 *
 * Features: Undo/Redo, Auto-save draft, Read-only mode, Progress bar, Validation
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    Package, Plus, Minus, Trash2, Save, RotateCcw, CheckCircle,
    AlertTriangle, X, Layers, ArrowDown, ChevronDown, ChevronUp,
    Undo2, Redo2, Loader2, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import {
    tripMetricsService,
    type PackingLayoutSavePayload,
} from '../../services/tripMetricsService';

// ==================== Types ====================

interface TripItem {
    id: string;
    product_id: string;
    product_code: string;
    product_name: string;
    category: string;
    unit: string;
    quantity: number;
    weight_kg: number | null;
    is_bonus: boolean;
}

interface PositionItem {
    delivery_trip_item_id: string;
    quantity: number;
    layer_index: number | null; // null = โหมดง่าย, 0+ = โหมดละเอียด
}

interface Position {
    id: string;
    position_type: 'pallet' | 'floor';
    position_index: number;
    total_layers: number;
    notes: string;
    items: PositionItem[];
    detailedMode: boolean; // true = แยกตามชั้น
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

const uid = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });

const DRAFT_KEY = 'packing-layout-draft-v4-';

// ==================== Main Component ====================

export const PackingLayoutEditor: React.FC<Props> = ({ tripId, tripStatus, onClose, onSaved }) => {
    const [tripItems, setTripItems] = useState<TripItem[]>([]);
    const [loadingItems, setLoadingItems] = useState(true);
    const [layout, setLayout] = useState<LayoutState>({ positions: [] });
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [history, setHistory] = useState<LayoutState[]>([]);
    const [historyIdx, setHistoryIdx] = useState(-1);
    const [showConfirm, setShowConfirm] = useState(false);
    const [isReadOnly, setIsReadOnly] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const draftKey = `${DRAFT_KEY}${tripId}`;

    // ==================== Load ====================
    useEffect(() => {
        const load = async () => {
            setLoadingItems(true);
            try {
                const items = await tripMetricsService.getTripItemsDetails(tripId);
                const { supabase } = await import('../../lib/supabase');
                const { data: rawItems } = await supabase
                    .from('delivery_trip_items')
                    .select('id, product_id, quantity, is_bonus')
                    .eq('delivery_trip_id', tripId);

                const finalItems: TripItem[] = (rawItems ?? []).map((ri: any) => {
                    const d = items.find((i) => i.product_id === ri.product_id);
                    return {
                        id: ri.id,
                        product_id: ri.product_id,
                        product_code: d?.product_code || '',
                        product_name: d?.product_name || '',
                        category: d?.category || '',
                        unit: (d as any)?.packaging_type || 'หน่วย',
                        quantity: Number(ri.quantity || 0),
                        weight_kg: d?.weight_kg ?? null,
                        is_bonus: !!ri.is_bonus,
                    };
                });
                setTripItems(finalItems);

                // Load existing from DB
                const existing = await tripMetricsService.getTripPackingLayout(tripId);
                if (existing && existing.positions.length > 0) {
                    const positions: Position[] = existing.positions.map((pos) => {
                        const isDetailed = pos.items.some((i) => i.layer_index !== null && i.layer_index !== undefined);
                        return {
                            id: uid(),
                            position_type: pos.position_type,
                            position_index: pos.position_index,
                            total_layers: pos.total_layers || 1,
                            notes: pos.notes || '',
                            collapsed: false,
                            detailedMode: isDetailed,
                            items: pos.items.map((item) => ({
                                delivery_trip_item_id: item.delivery_trip_item_id,
                                quantity: item.quantity,
                                layer_index: item.layer_index ?? null,
                            })),
                        };
                    });
                    const s: LayoutState = { positions };
                    setLayout(s); setHistory([s]); setHistoryIdx(0); setIsReadOnly(true);
                } else {
                    // Check draft
                    try {
                        const draft = localStorage.getItem(draftKey);
                        if (draft) {
                            const p = JSON.parse(draft) as LayoutState;
                            if (p.positions) { setLayout(p); setHistory([p]); setHistoryIdx(0); }
                            else throw new Error();
                        } else throw new Error();
                    } catch {
                        const initial: LayoutState = {
                            positions: [{
                                id: uid(), position_type: 'pallet', position_index: 1,
                                total_layers: 1, notes: '', collapsed: false, detailedMode: false, items: [],
                            }],
                        };
                        setLayout(initial); setHistory([initial]); setHistoryIdx(0);
                    }
                }
            } catch (err) { console.error('[PackingLayoutEditor] Load:', err); }
            finally { setLoadingItems(false); }
        };
        load();
    }, [tripId]);

    // Auto-save draft
    useEffect(() => {
        if (isReadOnly) return;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            try { localStorage.setItem(draftKey, JSON.stringify(layout)); } catch { /**/ }
        }, 2000);
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [layout, isReadOnly, draftKey]);

    // ==================== History ====================
    const push = useCallback((s: LayoutState) => {
        setHistory((prev) => { const h = prev.slice(0, historyIdx + 1); h.push(s); if (h.length > 50) h.shift(); return h; });
        setHistoryIdx((i) => i + 1);
        setLayout(s);
    }, [historyIdx]);

    const undo = useCallback(() => {
        if (historyIdx > 0) { setHistoryIdx(historyIdx - 1); setLayout(history[historyIdx - 1]); }
    }, [history, historyIdx]);

    const redo = useCallback(() => {
        if (historyIdx < history.length - 1) { setHistoryIdx(historyIdx + 1); setLayout(history[historyIdx + 1]); }
    }, [history, historyIdx]);

    // ==================== Computed ====================
    const allocated = useMemo(() => {
        const m = new Map<string, number>();
        for (const p of layout.positions)
            for (const i of p.items)
                m.set(i.delivery_trip_item_id, (m.get(i.delivery_trip_item_id) || 0) + i.quantity);
        return m;
    }, [layout]);

    const errors = useMemo(() => {
        const e: string[] = [];
        for (const ti of tripItems) {
            const a = allocated.get(ti.id) || 0;
            if (a > ti.quantity) e.push(`${ti.product_name}: จัดเกิน (มี ${ti.quantity} แต่จัด ${a})`);
        }
        return e;
    }, [tripItems, allocated]);

    const unalloc = useMemo(() => tripItems.filter((ti) => (allocated.get(ti.id) || 0) < ti.quantity), [tripItems, allocated]);
    const totalAlloc = useMemo(() => { let c = 0; allocated.forEach((v) => c += v); return c; }, [allocated]);
    const totalTrip = useMemo(() => tripItems.reduce((s, t) => s + t.quantity, 0), [tripItems]);
    const pct = useMemo(() => totalTrip === 0 ? 0 : Math.min(100, Math.round((totalAlloc / totalTrip) * 100)), [totalAlloc, totalTrip]);

    const remaining = useCallback((id: string) => {
        const ti = tripItems.find((t) => t.id === id);
        return ti ? ti.quantity - (allocated.get(id) || 0) : 0;
    }, [tripItems, allocated]);

    const getItem = useCallback((id: string) => tripItems.find((t) => t.id === id), [tripItems]);

    // ==================== Actions ====================
    const addPos = useCallback((type: 'pallet' | 'floor') => {
        const mx = layout.positions.filter((p) => p.position_type === type).reduce((m, p) => Math.max(m, p.position_index), 0);
        push({
            positions: [...layout.positions, {
                id: uid(), position_type: type, position_index: mx + 1,
                total_layers: 1, notes: '', collapsed: false, detailedMode: false, items: [],
            }],
        });
    }, [layout, push]);

    const removePos = useCallback((id: string) => {
        push({ positions: layout.positions.filter((p) => p.id !== id) });
    }, [layout, push]);

    const setLayers = useCallback((posId: string, n: number) => {
        const newN = Math.max(1, n);
        push({
            positions: layout.positions.map((p) => {
                if (p.id !== posId) return p;
                // ถ้าลดชั้น ลบ items ที่อยู่ชั้นที่เกินออก (detailed mode)
                if (p.detailedMode && newN < p.total_layers) {
                    return { ...p, total_layers: newN, items: p.items.filter((i) => i.layer_index === null || i.layer_index < newN) };
                }
                return { ...p, total_layers: newN };
            }),
        });
    }, [layout, push]);

    const toggleCollapse = useCallback((posId: string) => {
        setLayout((prev) => ({
            positions: prev.positions.map((p) => p.id === posId ? { ...p, collapsed: !p.collapsed } : p),
        }));
    }, []);

    /** สลับโหมดง่าย ↔ ละเอียด */
    const toggleDetailed = useCallback((posId: string) => {
        push({
            positions: layout.positions.map((p) => {
                if (p.id !== posId) return p;
                if (!p.detailedMode) {
                    // ง่าย → ละเอียด: กระจายสินค้าลงทุกชั้นเท่าๆ กัน
                    if (p.items.length === 0 || p.total_layers <= 1) {
                        return { ...p, detailedMode: true, items: p.items.map((i) => ({ ...i, layer_index: 0 })) };
                    }
                    const newItems: PositionItem[] = [];
                    for (const item of p.items) {
                        const perLayer = Math.floor(item.quantity / p.total_layers);
                        const remainder = item.quantity % p.total_layers;
                        for (let li = 0; li < p.total_layers; li++) {
                            const qty = perLayer + (li < remainder ? 1 : 0);
                            if (qty > 0) newItems.push({ ...item, layer_index: li, quantity: qty });
                        }
                    }
                    return { ...p, detailedMode: true, items: newItems };
                } else {
                    // ละเอียด → ง่าย: merge สินค้ากลับ
                    const merged = new Map<string, number>();
                    for (const i of p.items) merged.set(i.delivery_trip_item_id, (merged.get(i.delivery_trip_item_id) || 0) + i.quantity);
                    const items: PositionItem[] = [...merged.entries()].map(([id, qty]) => ({ delivery_trip_item_id: id, quantity: qty, layer_index: null }));
                    return { ...p, detailedMode: false, items };
                }
            }),
        });
    }, [layout, push]);

    /** เพิ่มสินค้า — โหมดง่าย */
    const addItem = useCallback((posId: string, itemId: string, qty: number) => {
        if (qty <= 0) return;
        push({
            positions: layout.positions.map((pos) => {
                if (pos.id !== posId) return pos;
                const ex = pos.items.find((i) => i.delivery_trip_item_id === itemId && i.layer_index === null);
                if (ex) return { ...pos, items: pos.items.map((i) => i === ex ? { ...i, quantity: i.quantity + qty } : i) };
                return { ...pos, items: [...pos.items, { delivery_trip_item_id: itemId, quantity: qty, layer_index: null }] };
            }),
        });
    }, [layout, push]);

    /** เพิ่มสินค้า — โหมดละเอียด (ระบุชั้น) */
    const addItemToLayer = useCallback((posId: string, itemId: string, qty: number, layerIdx: number) => {
        if (qty <= 0) return;
        push({
            positions: layout.positions.map((pos) => {
                if (pos.id !== posId) return pos;
                const ex = pos.items.find((i) => i.delivery_trip_item_id === itemId && i.layer_index === layerIdx);
                if (ex) return { ...pos, items: pos.items.map((i) => i === ex ? { ...i, quantity: i.quantity + qty } : i) };
                return { ...pos, items: [...pos.items, { delivery_trip_item_id: itemId, quantity: qty, layer_index: layerIdx }] };
            }),
        });
    }, [layout, push]);

    const updateQty = useCallback((posId: string, itemId: string, layerIdx: number | null, newQty: number) => {
        push({
            positions: layout.positions.map((pos) => {
                if (pos.id !== posId) return pos;
                if (newQty <= 0) return { ...pos, items: pos.items.filter((i) => !(i.delivery_trip_item_id === itemId && i.layer_index === layerIdx)) };
                return { ...pos, items: pos.items.map((i) => (i.delivery_trip_item_id === itemId && i.layer_index === layerIdx) ? { ...i, quantity: newQty } : i) };
            }),
        });
    }, [layout, push]);

    const removeItem = useCallback((posId: string, itemId: string, layerIdx: number | null) => {
        push({
            positions: layout.positions.map((pos) => pos.id !== posId ? pos : {
                ...pos, items: pos.items.filter((i) => !(i.delivery_trip_item_id === itemId && i.layer_index === layerIdx)),
            }),
        });
    }, [layout, push]);

    const clearAll = useCallback(() => push({ positions: layout.positions.map((p) => ({ ...p, items: [] })) }), [layout, push]);

    // ==================== Save ====================
    const handleSave = useCallback(async () => {
        if (errors.length > 0) return;
        setSaving(true); setSaveError(null); setSaveSuccess(false);
        try {
            const payload: PackingLayoutSavePayload = {
                positions: layout.positions.filter((p) => p.items.length > 0).map((p) => ({
                    position_type: p.position_type,
                    position_index: p.position_index,
                    total_layers: p.total_layers,
                    notes: p.notes || undefined,
                    items: p.items.map((i) => ({
                        delivery_trip_item_id: i.delivery_trip_item_id,
                        quantity: i.quantity,
                        layer_index: i.layer_index,
                    })),
                })),
            };
            await tripMetricsService.saveTripPackingLayout(tripId, payload);
            try { localStorage.removeItem(draftKey); } catch { /**/ }
            setSaveSuccess(true); setIsReadOnly(true);
            setTimeout(() => onSaved?.(), 1000);
        } catch (err: any) {
            setSaveError(err?.message || 'บันทึกไม่สำเร็จ');
        } finally { setSaving(false); setShowConfirm(false); }
    }, [layout, tripId, errors, draftKey, onSaved]);

    // ==================== Render ====================
    if (loadingItems) {
        return <Card className="p-8"><div className="flex items-center justify-center gap-3 text-slate-500 dark:text-slate-400"><Loader2 className="animate-spin" size={24} /><span>กำลังโหลดรายการสินค้า...</span></div></Card>;
    }
    if (tripItems.length === 0) {
        return <Card className="p-8 text-center"><Package className="mx-auto mb-3 text-slate-400" size={40} /><p className="text-slate-500 dark:text-slate-400">ไม่มีสินค้าในทริปนี้</p></Card>;
    }

    const pallets = layout.positions.filter((p) => p.position_type === 'pallet');
    const floors = layout.positions.filter((p) => p.position_type === 'floor');

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2"><Layers size={20} />บันทึกการจัดเรียงสินค้า</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">จัดสินค้าลงพาเลท/บนพื้นรถ · รองรับโหมดง่ายและละเอียด</p>
                </div>
                <div className="flex items-center gap-2">
                    {!isReadOnly && (
                        <>
                            <Button variant="outline" size="sm" onClick={undo} disabled={historyIdx <= 0} title="Undo"><Undo2 size={16} /></Button>
                            <Button variant="outline" size="sm" onClick={redo} disabled={historyIdx >= history.length - 1} title="Redo"><Redo2 size={16} /></Button>
                            <Button variant="outline" size="sm" onClick={clearAll}><RotateCcw size={16} className="mr-1" />ล้าง</Button>
                        </>
                    )}
                    {isReadOnly && !saveSuccess && <Button variant="outline" size="sm" onClick={() => { setIsReadOnly(false); setSaveSuccess(false); }}>แก้ไข</Button>}
                    {onClose && <Button variant="outline" size="sm" onClick={onClose}><X size={16} className="mr-1" />ปิด</Button>}
                </div>
            </div>

            {/* Progress */}
            <Card className="p-3">
                <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-slate-600 dark:text-slate-400">จัดเรียงแล้ว <span className="font-semibold text-slate-900 dark:text-slate-100">{totalAlloc}</span>/{totalTrip} ชิ้น</span>
                    <span className={`font-semibold ${pct === 100 ? 'text-green-600' : 'text-blue-600'}`}>{pct}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                    <div className={`h-2.5 rounded-full transition-all ${pct === 100 ? 'bg-green-500' : pct > 50 ? 'bg-blue-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
                </div>
            </Card>

            {/* Errors */}
            {errors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-medium text-sm mb-1"><AlertTriangle size={16} />ข้อผิดพลาด</div>
                    {errors.map((e, i) => <p key={i} className="text-sm text-red-600 dark:text-red-400 ml-6">• {e}</p>)}
                </div>
            )}

            {/* Unallocated */}
            {unalloc.length > 0 && !isReadOnly && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium text-sm mb-1"><AlertTriangle size={16} />สินค้าที่ยังไม่ได้จัดเรียง ({unalloc.length})</div>
                    <div className="mt-2 space-y-1 max-h-32 overflow-auto">
                        {unalloc.map((item) => (
                            <div key={item.id} className="text-sm text-amber-600 dark:text-amber-400 ml-6 flex justify-between">
                                <span>• {item.product_code} - {item.product_name}</span>
                                <span className="text-xs font-medium ml-2">เหลือ {remaining(item.id)}/{item.quantity}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {saveSuccess && <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-2"><CheckCircle size={18} className="text-green-600" /><span className="text-green-700 dark:text-green-400 font-medium text-sm">บันทึกเรียบร้อยแล้ว!</span></div>}
            {saveError && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-center gap-2"><AlertTriangle size={18} className="text-red-600" /><span className="text-red-700 dark:text-red-400 font-medium text-sm">{saveError}</span></div>}

            {/* Pallet Cards — 2 columns (1|2, 3|4, 5|6) */}
            {pallets.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Package size={16} className="text-blue-600 dark:text-blue-400" />
                        <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">พาเลท ({pallets.length})</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {pallets.map((pos) => (
                            <PosCard
                                key={pos.id} pos={pos} tripItems={tripItems} getItem={getItem}
                                remaining={remaining} allocated={allocated} isReadOnly={isReadOnly}
                                onToggleCollapse={() => toggleCollapse(pos.id)}
                                onRemove={() => removePos(pos.id)}
                                onSetLayers={(n) => setLayers(pos.id, n)}
                                onToggleDetailed={() => toggleDetailed(pos.id)}
                                onAddItem={(iid, q) => addItem(pos.id, iid, q)}
                                onAddItemToLayer={(iid, q, li) => addItemToLayer(pos.id, iid, q, li)}
                                onUpdateQty={(iid, li, q) => updateQty(pos.id, iid, li, q)}
                                onRemoveItem={(iid, li) => removeItem(pos.id, iid, li)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Floor Zone Cards — 2 columns */}
            {floors.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <ArrowDown size={16} className="text-amber-600 dark:text-amber-400" />
                        <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">บนพื้นรถ ({floors.length})</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {floors.map((pos) => (
                            <PosCard
                                key={pos.id} pos={pos} tripItems={tripItems} getItem={getItem}
                                remaining={remaining} allocated={allocated} isReadOnly={isReadOnly}
                                onToggleCollapse={() => toggleCollapse(pos.id)}
                                onRemove={() => removePos(pos.id)}
                                onSetLayers={(n) => setLayers(pos.id, n)}
                                onToggleDetailed={() => toggleDetailed(pos.id)}
                                onAddItem={(iid, q) => addItem(pos.id, iid, q)}
                                onAddItemToLayer={(iid, q, li) => addItemToLayer(pos.id, iid, q, li)}
                                onUpdateQty={(iid, li, q) => updateQty(pos.id, iid, li, q)}
                                onRemoveItem={(iid, li) => removeItem(pos.id, iid, li)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Add buttons */}
            {!isReadOnly && (
                <div className="flex gap-3">
                    <Button variant="outline" onClick={() => addPos('pallet')} className="flex-1"><Plus size={16} className="mr-2" />เพิ่มพาเลท</Button>
                    <Button variant="outline" onClick={() => addPos('floor')} className="flex-1"><Plus size={16} className="mr-2" />เพิ่มโซนบนพื้น</Button>
                </div>
            )}

            {/* Save */}
            {!isReadOnly && (
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                    {unalloc.length > 0 && <span className="text-xs text-amber-600">⚠️ ยังมีสินค้าที่ไม่ได้จัดเรียง</span>}
                    <Button variant="primary" onClick={() => setShowConfirm(true)}
                        disabled={saving || errors.length > 0 || layout.positions.every((p) => p.items.length === 0)} isLoading={saving}>
                        <Save size={16} className="mr-2" />บันทึกการจัดเรียง
                    </Button>
                </div>
            )}

            {/* Confirm */}
            {showConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6">
                        <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">ยืนยันบันทึก</h4>
                        <div className="space-y-2 mb-4 text-sm text-slate-600 dark:text-slate-400">
                            <p><b>พาเลท:</b> {pallets.filter((p) => p.items.length > 0).length}</p>
                            <p><b>โซนบนพื้น:</b> {floors.filter((p) => p.items.length > 0).length}</p>
                            <p><b>สินค้า:</b> {totalAlloc}/{totalTrip} ชิ้น ({pct}%)</p>
                            <p><b>โหมดละเอียด:</b> {layout.positions.filter((p) => p.detailedMode).length} ตำแหน่ง</p>
                            {unalloc.length > 0 && <p className="text-amber-600">⚠️ มี {unalloc.length} รายการที่ยังไม่จัด</p>}
                        </div>
                        <div className="flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setShowConfirm(false)}>ยกเลิก</Button>
                            <Button variant="primary" onClick={handleSave} isLoading={saving}><CheckCircle size={16} className="mr-2" />ยืนยัน</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ==================== Position Card ====================

interface PosCardProps {
    pos: Position;
    tripItems: TripItem[];
    getItem: (id: string) => TripItem | undefined;
    remaining: (id: string) => number;
    allocated: Map<string, number>;
    isReadOnly: boolean;
    onToggleCollapse: () => void;
    onRemove: () => void;
    onSetLayers: (n: number) => void;
    onToggleDetailed: () => void;
    onAddItem: (itemId: string, qty: number) => void;
    onAddItemToLayer: (itemId: string, qty: number, layerIdx: number) => void;
    onUpdateQty: (itemId: string, layerIdx: number | null, newQty: number) => void;
    onRemoveItem: (itemId: string, layerIdx: number | null) => void;
}

const PosCard: React.FC<PosCardProps> = ({
    pos, tripItems, getItem, remaining, allocated, isReadOnly,
    onToggleCollapse, onRemove, onSetLayers, onToggleDetailed,
    onAddItem, onAddItemToLayer, onUpdateQty, onRemoveItem,
}) => {
    const isPallet = pos.position_type === 'pallet';
    const label = isPallet ? `พาเลท ${pos.position_index}` : `บนพื้น ${pos.position_index}`;
    const bg = isPallet ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800';
    const hc = isPallet ? 'text-blue-700 dark:text-blue-400' : 'text-amber-700 dark:text-amber-400';
    const ib = isPallet ? 'bg-blue-100 dark:bg-blue-900' : 'bg-amber-100 dark:bg-amber-900';

    const tw = pos.items.reduce((s, i) => { const ti = getItem(i.delivery_trip_item_id); return s + (ti?.weight_kg ? ti.weight_kg * i.quantity : 0); }, 0);
    const tq = pos.items.reduce((s, i) => s + i.quantity, 0);

    return (
        <div className={`rounded-xl border ${bg} overflow-hidden`}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 cursor-pointer select-none" onClick={onToggleCollapse}>
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${ib}`}>
                        {isPallet ? <Package size={20} className={hc} /> : <ArrowDown size={20} className={hc} />}
                    </div>
                    <div>
                        <div className={`font-semibold ${hc} flex items-center gap-2`}>
                            {label}
                            {pos.total_layers > 1 && <span className="text-xs font-normal px-1.5 py-0.5 rounded-full bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400">{pos.total_layers} ชั้น</span>}
                            {pos.detailedMode && <span className="text-xs font-normal px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400">ละเอียด</span>}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                            {pos.items.length} รายการ · {tq} ชิ้น{tw > 0 && ` · ${tw.toFixed(1)} kg`}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {!isReadOnly && <button className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors" onClick={(e) => { e.stopPropagation(); onRemove(); }}><Trash2 size={16} /></button>}
                    {pos.collapsed ? <ChevronDown size={20} className="text-slate-400" /> : <ChevronUp size={20} className="text-slate-400" />}
                </div>
            </div>

            {/* Body */}
            {!pos.collapsed && (
                <div className="px-4 pb-4 space-y-3">
                    {/* Layers + Mode toggle */}
                    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex-wrap">
                        <Layers size={16} className="text-slate-500 flex-shrink-0" />
                        <span className="text-sm text-slate-600 dark:text-slate-400">จำนวนชั้น:</span>
                        {!isReadOnly ? (
                            <div className="flex items-center gap-1">
                                <button className="w-7 h-7 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center" onClick={() => onSetLayers(pos.total_layers - 1)} disabled={pos.total_layers <= 1}><Minus size={12} /></button>
                                <span className="min-w-[2rem] text-center font-bold text-sm text-slate-900 dark:text-slate-100">{pos.total_layers}</span>
                                <button className="w-7 h-7 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center" onClick={() => onSetLayers(pos.total_layers + 1)}><Plus size={12} /></button>
                            </div>
                        ) : (
                            <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{pos.total_layers}</span>
                        )}

                        {/* Mode toggle */}
                        {!isReadOnly && pos.total_layers > 1 && (
                            <button
                                className={`ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${pos.detailedMode ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-600'}`}
                                onClick={onToggleDetailed}
                            >
                                {pos.detailedMode ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                                {pos.detailedMode ? 'โหมดละเอียด' : 'แยกตามชั้น'}
                            </button>
                        )}
                        {isReadOnly && pos.detailedMode && (
                            <span className="ml-auto text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1"><ToggleRight size={14} />โหมดละเอียด</span>
                        )}
                    </div>

                    {/* Content: Simple or Detailed */}
                    {pos.detailedMode ? (
                        <DetailedContent pos={pos} tripItems={tripItems} getItem={getItem} remaining={remaining} allocated={allocated} isReadOnly={isReadOnly}
                            onAddItemToLayer={onAddItemToLayer} onUpdateQty={onUpdateQty} onRemoveItem={onRemoveItem} />
                    ) : (
                        <SimpleContent pos={pos} tripItems={tripItems} getItem={getItem} remaining={remaining} allocated={allocated} isReadOnly={isReadOnly}
                            onAddItem={onAddItem} onUpdateQty={onUpdateQty} onRemoveItem={onRemoveItem} />
                    )}
                </div>
            )}
        </div>
    );
};

// ==================== Simple Content (โหมดง่าย) ====================

interface SimpleProps {
    pos: Position;
    tripItems: TripItem[];
    getItem: (id: string) => TripItem | undefined;
    remaining: (id: string) => number;
    allocated: Map<string, number>;
    isReadOnly: boolean;
    onAddItem: (itemId: string, qty: number) => void;
    onUpdateQty: (itemId: string, layerIdx: number | null, newQty: number) => void;
    onRemoveItem: (itemId: string, layerIdx: number | null) => void;
}

const SimpleContent: React.FC<SimpleProps> = ({ pos, tripItems, getItem, remaining, allocated, isReadOnly, onAddItem, onUpdateQty, onRemoveItem }) => {
    return (
        <>
            {pos.items.length === 0 && <div className="text-xs text-slate-400 py-3 text-center italic">ยังไม่มีสินค้า</div>}

            {pos.items.map((item) => (
                <ItemRow key={`${item.delivery_trip_item_id}-s`} item={item} getItem={getItem} allocated={allocated} isReadOnly={isReadOnly}
                    remaining={remaining} onUpdateQty={(q) => onUpdateQty(item.delivery_trip_item_id, null, q)} onRemove={() => onRemoveItem(item.delivery_trip_item_id, null)} />
            ))}

            {!isReadOnly && (
                <ItemPicker tripItems={tripItems} remaining={remaining} onAdd={(id, q) => onAddItem(id, q)} />
            )}

            {/* Per-layer hint */}
            {pos.items.length === 1 && pos.total_layers > 1 && (
                <div className="text-xs text-slate-400 text-center">≈ ชั้นละ {Math.round(pos.items[0].quantity / pos.total_layers)} ชิ้น</div>
            )}
        </>
    );
};

// ==================== Detailed Content (โหมดละเอียด) ====================

interface DetailedProps {
    pos: Position;
    tripItems: TripItem[];
    getItem: (id: string) => TripItem | undefined;
    remaining: (id: string) => number;
    allocated: Map<string, number>;
    isReadOnly: boolean;
    onAddItemToLayer: (itemId: string, qty: number, layerIdx: number) => void;
    onUpdateQty: (itemId: string, layerIdx: number | null, newQty: number) => void;
    onRemoveItem: (itemId: string, layerIdx: number | null) => void;
}

const DetailedContent: React.FC<DetailedProps> = ({ pos, tripItems, getItem, remaining, allocated, isReadOnly, onAddItemToLayer, onUpdateQty, onRemoveItem }) => {
    const getLayerLabel = (li: number) => {
        if (li === 0) return `ชั้น 1 (ล่างสุด)`;
        if (li === pos.total_layers - 1) return `ชั้น ${li + 1} (บนสุด)`;
        return `ชั้น ${li + 1}`;
    };

    return (
        <div className="space-y-2">
            {Array.from({ length: pos.total_layers }, (_, li) => {
                const layerItems = pos.items.filter((i) => i.layer_index === li);
                const layerWeight = layerItems.reduce((s, i) => { const ti = getItem(i.delivery_trip_item_id); return s + (ti?.weight_kg ? ti.weight_kg * i.quantity : 0); }, 0);

                return (
                    <div key={li} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
                        {/* Layer header */}
                        <div className="flex items-center justify-between px-3 py-1.5 bg-gradient-to-r from-purple-50 to-transparent dark:from-purple-900/20 dark:to-transparent">
                            <div className="flex items-center gap-2">
                                <Layers size={13} className="text-purple-500 dark:text-purple-400" />
                                <span className="text-xs font-medium text-purple-700 dark:text-purple-300">{getLayerLabel(li)}</span>
                            </div>
                            <span className="text-xs text-slate-400">
                                {layerItems.length} รายการ{layerWeight > 0 && ` · ${layerWeight.toFixed(1)} kg`}
                            </span>
                        </div>

                        <div className="px-3 pb-2 pt-1 space-y-1.5">
                            {layerItems.length === 0 && <div className="text-xs text-slate-400 py-1.5 text-center italic">ว่าง</div>}

                            {layerItems.map((item) => (
                                <ItemRow key={`${item.delivery_trip_item_id}-${li}`} item={item} getItem={getItem} allocated={allocated} isReadOnly={isReadOnly}
                                    remaining={remaining} onUpdateQty={(q) => onUpdateQty(item.delivery_trip_item_id, li, q)} onRemove={() => onRemoveItem(item.delivery_trip_item_id, li)} />
                            ))}

                            {!isReadOnly && (
                                <ItemPicker tripItems={tripItems} remaining={remaining} onAdd={(id, q) => onAddItemToLayer(id, q, li)} compact />
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// ==================== Item Row ====================

interface ItemRowProps {
    item: PositionItem;
    getItem: (id: string) => TripItem | undefined;
    allocated: Map<string, number>;
    remaining: (id: string) => number;
    isReadOnly: boolean;
    onUpdateQty: (newQty: number) => void;
    onRemove: () => void;
}

const ItemRow: React.FC<ItemRowProps> = ({ item, getItem, allocated, remaining, isReadOnly, onUpdateQty, onRemove }) => {
    const ti = getItem(item.delivery_trip_item_id);
    if (!ti) return null;
    const a = allocated.get(item.delivery_trip_item_id) || 0;
    const over = a > ti.quantity;

    return (
        <div className={`flex items-center gap-2 p-2 rounded-md border ${over ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-700'}`}>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{ti.product_code} - {ti.product_name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                    {ti.category}{ti.weight_kg && ` · ${ti.weight_kg} kg`}{ti.is_bonus && <span className="ml-1 text-green-600">(แถม)</span>}
                </div>
            </div>
            <div className="flex items-center gap-1">
                {!isReadOnly && <button className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center" onClick={() => onUpdateQty(item.quantity - 1)}><Minus size={12} /></button>}
                <span className={`min-w-[2.5rem] text-center font-bold text-sm ${over ? 'text-red-600' : 'text-slate-900 dark:text-slate-100'}`}>{item.quantity}</span>
                {!isReadOnly && <button className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center"
                    onClick={() => { if (remaining(item.delivery_trip_item_id) > 0) onUpdateQty(item.quantity + 1); }}><Plus size={12} /></button>}
                {!isReadOnly && <button className="w-6 h-6 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 flex items-center justify-center ml-0.5" onClick={onRemove}><X size={12} /></button>}
            </div>
        </div>
    );
};

// ==================== Item Picker ====================

interface ItemPickerProps {
    tripItems: TripItem[];
    remaining: (id: string) => number;
    onAdd: (itemId: string, qty: number) => void;
    compact?: boolean;
}

const ItemPicker: React.FC<ItemPickerProps> = ({ tripItems, remaining, onAdd, compact }) => {
    const [open, setOpen] = useState(false);
    const [sel, setSel] = useState('');
    const [qty, setQty] = useState(0);

    const avail = tripItems.filter((ti) => remaining(ti.id) > 0);

    const pick = (id: string) => { setSel(id); setQty(remaining(id)); };

    const confirm = () => {
        if (sel && qty > 0) { onAdd(sel, qty); setSel(''); setQty(0); setOpen(false); }
    };

    if (!open) {
        return (
            <button
                className={`w-full ${compact ? 'py-1.5 text-xs' : 'py-2.5 text-sm'} rounded-md border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 hover:border-blue-400 hover:text-blue-500 transition-colors flex items-center justify-center gap-1.5`}
                onClick={() => setOpen(true)} disabled={avail.length === 0}
            >
                <Plus size={compact ? 12 : 14} />
                {avail.length > 0 ? 'เพิ่มสินค้า' : 'ครบแล้ว'}
            </button>
        );
    }

    return (
        <div className="border border-slate-200 dark:border-slate-700 rounded-md p-2.5 bg-white dark:bg-slate-800 space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">เลือกสินค้า</span>
                <button className="text-slate-400 hover:text-slate-600" onClick={() => { setOpen(false); setSel(''); }}><X size={14} /></button>
            </div>
            <div className="max-h-36 overflow-auto space-y-1">
                {avail.map((ai) => (
                    <button key={ai.id}
                        className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors ${sel === ai.id ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 ring-1 ring-blue-400' : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'}`}
                        onClick={() => pick(ai.id)}>
                        <div className="font-medium truncate">{ai.product_code} - {ai.product_name}</div>
                        <div className="text-slate-500">เหลือ {remaining(ai.id)}/{ai.quantity} · {ai.category}</div>
                    </button>
                ))}
            </div>
            {sel && (
                <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <label className="text-xs text-slate-500 whitespace-nowrap">จำนวน:</label>
                    <input type="number" min={1} max={remaining(sel)} value={qty}
                        onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-16 px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
                    <span className="text-xs text-slate-400">/ {remaining(sel)}</span>
                    <Button size="sm" variant="primary" onClick={confirm} className="ml-auto"><Plus size={12} className="mr-1" />เพิ่ม</Button>
                </div>
            )}
        </div>
    );
};
