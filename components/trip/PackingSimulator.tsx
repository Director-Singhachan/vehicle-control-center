// Packing Simulator — Core component for simulating packing arrangements
// Reuses layout logic from PackingLayoutEditor, adds visual preview + draft mode
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    Package,
    Plus,
    Minus,
    Trash2,
    ChevronDown,
    ChevronUp,
    Layers,
    Save,
    Undo2,
    Redo2,
    Weight,
    Box,
    Truck,
    MapPin,
    Calendar,
    Users,
    BarChart3,
    Sparkles,
    Check,
    AlertCircle,
    X,
    GripVertical,
    Eye,
    EyeOff,
    ToggleLeft,
    ToggleRight,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { deliveryTripService } from '../../services/deliveryTripService';
import { tripMetricsService } from '../../services/tripMetricsService';

// ==================== Types ====================
interface TripItem {
    id: string;               // delivery_trip_item_id
    product_id: string;
    product_name: string;
    product_code: string;
    category: string;
    unit: string;
    quantity: number;          // จำนวนรวม
    weight_kg: number | null;
    store_name?: string;
}

interface PositionItem {
    delivery_trip_item_id: string;
    product_id: string;
    product_name: string;
    product_code: string;
    category: string;
    unit: string;
    weight_kg: number | null;
    quantity: number;
    layer_index: number | null;
}

interface Position {
    id: string;
    position_type: 'pallet' | 'floor';
    position_index: number;
    total_layers: number;
    notes: string;
    collapsed: boolean;
    detailedMode: boolean;
    items: PositionItem[];
}

interface LayoutState {
    positions: Position[];
}

interface SimulatorProps {
    tripId: string;
    onClose: () => void;
    /** เรียกหลังบันทึกสำเร็จ (เช่น ให้ parent refetch ข้อมูลทริป) */
    onSaved?: () => void;
    /** ใช้ในหน้ารายละเอียดทริป (ปรับข้อความปุ่ม/ข้อความสำเร็จ) */
    embedInDetailView?: boolean;
}

// ==================== Helpers ====================
const uid = () => Math.random().toString(36).slice(2, 10);

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; gradient: string }> = {
    'เบียร์': { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-300', gradient: 'from-amber-400 to-amber-600' },
    'น้ำดื่ม': { bg: 'bg-sky-50 dark:bg-sky-950/30', border: 'border-sky-200 dark:border-sky-800', text: 'text-sky-700 dark:text-sky-300', gradient: 'from-sky-400 to-sky-600' },
    'น้ำอัดลม': { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-300', gradient: 'from-emerald-400 to-emerald-600' },
    'สุรา': { bg: 'bg-purple-50 dark:bg-purple-950/30', border: 'border-purple-200 dark:border-purple-800', text: 'text-purple-700 dark:text-purple-300', gradient: 'from-purple-400 to-purple-600' },
    'อาหาร': { bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-700 dark:text-orange-300', gradient: 'from-orange-400 to-orange-600' },
    'default': { bg: 'bg-slate-50 dark:bg-slate-800/50', border: 'border-slate-200 dark:border-slate-700', text: 'text-slate-600 dark:text-slate-400', gradient: 'from-slate-400 to-slate-600' },
};

const getCategoryColor = (cat: string) => CATEGORY_COLORS[cat] || CATEGORY_COLORS['default'];

// ==================== Sub-components ====================
const StatCard: React.FC<{ icon: React.ElementType; label: string; value: string | number; subtext?: string; color?: string }> = ({
    icon: Icon, label, value, subtext, color = 'text-enterprise-600 dark:text-enterprise-400',
}) => (
    <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-xl border border-slate-200/60 dark:border-slate-700/60 p-4 hover:shadow-lg transition-shadow">
        <div className="flex items-center gap-2 mb-2">
            <Icon size={16} className="text-slate-400" />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
        </div>
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
        {subtext && <div className="text-xs text-slate-400 mt-1">{subtext}</div>}
    </div>
);

// แถวใน Picker: แยกร้าน — เลือกได้ว่าต้องการเพิ่มของร้านไหน
interface PickerRow {
    itemId: string;
    product_id: string;
    product_name: string;
    product_code: string;
    category: string;
    unit: string;
    quantity: number;
    remaining: number;
    store_name: string | undefined;
}

// แถวรวมตามสินค้า (หลายร้านรวมเป็นแถวเดียว — เหมาะเมื่อมี 4–5 ร้านขึ้นไป)
interface AggregatedPickerRow {
    product_id: string;
    product_name: string;
    product_code: string;
    category: string;
    unit: string;
    totalQuantity: number;
    totalRemaining: number;
    storeCount: number;
}

// มาตรฐานการจัดเรียงต่อสินค้า (จาก product_pallet_configs)
type PackingStandard = { units_per_layer: number; layers: number; total_units: number; config_name: string | null };

// Item Picker Modal — สลับโหมด: "รวมตามสินค้า" (สั้น แจกอัตโนมัติ) | "แยกร้าน" (เลือกร้านเอง)
const ItemPicker: React.FC<{
    itemsPerStore: PickerRow[];
    itemsAggregated: AggregatedPickerRow[];
    packingStandards: Map<string, PackingStandard>;
    packingConfigs: Map<string, PackingStandard[]>;
    onAddByItem: (itemId: string, qty: number) => void;
    onAddByProduct: (productId: string, qty: number) => void;
    /** เมื่อมีค่า กด "ชั้นละ X" จะเพิ่มทั้งหมดที่เหลือแบ่งชั้น (20,20,10) แทนการเพิ่มแค่ X */
    onAddByProductWithUnitsPerLayer?: (productId: string, unitsPerLayer: number) => void;
    onAddByItemWithUnitsPerLayer?: (itemId: string, unitsPerLayer: number) => void;
    onClose: () => void;
}> = ({ itemsPerStore, itemsAggregated, packingStandards, packingConfigs, onAddByItem, onAddByProduct, onAddByProductWithUnitsPerLayer, onAddByItemWithUnitsPerLayer, onClose }) => {
    const [search, setSearch] = useState('');
    const [mode, setMode] = useState<'aggregated' | 'per-store'>('aggregated');

    const filteredPerStore = useMemo(() => {
        const q = search.toLowerCase();
        return itemsPerStore.filter(i =>
            !q || i.product_name.toLowerCase().includes(q) || i.product_code.toLowerCase().includes(q) || (i.store_name && i.store_name.toLowerCase().includes(q))
        );
    }, [itemsPerStore, search]);

    const filteredAggregated = useMemo(() => {
        const q = search.toLowerCase();
        return itemsAggregated.filter(i =>
            !q || i.product_name.toLowerCase().includes(q) || i.product_code.toLowerCase().includes(q)
        );
    }, [itemsAggregated, search]);

    const isAggregated = mode === 'aggregated';
    const list = isAggregated ? filteredAggregated : filteredPerStore;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">เพิ่มสินค้าลงตำแหน่ง</h3>
                        <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                            <X size={18} className="text-slate-400" />
                        </button>
                    </div>
                    {/* สลับโหมด: รวมตามสินค้า (เมื่อมีหลายร้าน) vs แยกร้าน */}
                    <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 mb-3">
                        <button
                            type="button"
                            onClick={() => setMode('aggregated')}
                            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${isAggregated ? 'bg-white dark:bg-slate-700 shadow text-enterprise-600 dark:text-enterprise-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                        >
                            รวมตามสินค้า ({itemsAggregated.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('per-store')}
                            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${!isAggregated ? 'bg-white dark:bg-slate-700 shadow text-enterprise-600 dark:text-enterprise-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                        >
                            แยกร้าน ({itemsPerStore.length})
                        </button>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                        {isAggregated
                            ? 'สินค้าปนกันได้ — ระบบแจกจำนวนอัตโนมัติให้แต่ละร้าน โดยจับกลุ่มร้านที่เหลือมากก่อน เศษค่อยแยก'
                            : 'เลือกของร้านที่ต้องการวาง (ของแต่ละร้านปนกันไม่ได้)'}
                    </p>
                    <input
                        type="text"
                        placeholder={isAggregated ? 'ค้นหาสินค้า...' : 'ค้นหาสินค้า หรือร้าน...'}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500"
                    />
                </div>
                <div className="overflow-y-auto flex-1 min-h-0 p-2 max-h-[55vh]">
                    {isAggregated
                        ? filteredAggregated.map(row => {
                            const catColor = getCategoryColor(row.category);
                            if (row.totalRemaining <= 0) return null;
                            const configs: PackingStandard[] = packingConfigs.get(row.product_id)?.length
                                ? packingConfigs.get(row.product_id)!
                                : packingStandards.get(row.product_id) ? [packingStandards.get(row.product_id)!] : [];
                            const uniquePerLayer = [...new Set(configs.map(c => c.units_per_layer).filter((u): u is number => u > 0))];
                            const stdQty = uniquePerLayer[0] ?? packingStandards.get(row.product_id)?.units_per_layer ?? 1;
                            const addWithQty = (qty: number) => { onAddByProduct(row.product_id, Math.min(row.totalRemaining, qty)); onClose(); };
                            return (
                                <div
                                    key={row.product_id}
                                    className="w-full text-left flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                                >
                                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${catColor.gradient} flex items-center justify-center flex-shrink-0`}>
                                        <Package className="text-white" size={16} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{row.product_name}</div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                            {row.product_code} · {row.category} · {row.unit}
                                            {row.storeCount > 1 && <span className="text-enterprise-600 dark:text-enterprise-400 ml-1">· {row.storeCount} ร้าน</span>}
                                        </div>
                                        {configs.length > 0 && (
                                            <div className="text-xs text-enterprise-600 dark:text-enterprise-400 mt-0.5">
                                                รูปแบบ: ชั้นละ {[...new Set(configs.map(c => c.units_per_layer))].join(', ')} · พาเลทละ {configs.map(c => c.total_units).join(', ')}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                                        <div className="text-sm font-semibold text-enterprise-600 dark:text-enterprise-400">เหลือ {row.totalRemaining}</div>
                                        <div className="text-xs text-slate-400">จาก {row.totalQuantity}</div>
                                        <button type="button" onClick={() => addWithQty(stdQty)} className="text-xs font-semibold px-3 py-1.5 rounded-lg border-2 border-enterprise-300 dark:border-enterprise-600 bg-enterprise-100 dark:bg-enterprise-900/50 text-enterprise-700 dark:text-enterprise-300 cursor-pointer shadow-sm hover:bg-enterprise-200 dark:hover:bg-enterprise-800/60 hover:shadow hover:border-enterprise-400 dark:hover:border-enterprise-500 active:scale-[0.98] transition-all mt-1">
                                            เพิ่ม
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                        : filteredPerStore.map(row => {
                            const catColor = getCategoryColor(row.category);
                            const configs: PackingStandard[] = packingConfigs.get(row.product_id)?.length
                                ? packingConfigs.get(row.product_id)!
                                : packingStandards.get(row.product_id) ? [packingStandards.get(row.product_id)!] : [];
                            const uniquePerLayer = [...new Set(configs.map(c => c.units_per_layer).filter((u): u is number => u > 0))];
                            const stdQty = uniquePerLayer[0] ?? packingStandards.get(row.product_id)?.units_per_layer ?? 1;
                            const addWithQty = (qty: number) => { onAddByItem(row.itemId, Math.min(row.remaining, qty)); onClose(); };
                            return (
                                <div
                                    key={row.itemId}
                                    className="w-full text-left flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                                >
                                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${catColor.gradient} flex items-center justify-center flex-shrink-0`}>
                                        <Package className="text-white" size={16} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100 break-words" title={row.store_name ? `${row.product_name} · ${row.store_name}` : row.product_name}>
                                            {row.product_name}
                                            {row.store_name && <span className="text-enterprise-600 dark:text-enterprise-400 ml-1">· {row.store_name}</span>}
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">{row.product_code} · {row.category} · {row.unit}</div>
                                        {configs.length > 0 && (
                                            <div className="text-xs text-enterprise-600 dark:text-enterprise-400 mt-0.5">
                                                รูปแบบ: ชั้นละ {[...new Set(configs.map(c => c.units_per_layer))].join(', ')} · พาเลทละ {configs.map(c => c.total_units).join(', ')}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                                        <div className="text-sm font-semibold text-enterprise-600 dark:text-enterprise-400">เหลือ {row.remaining}</div>
                                        <div className="text-xs text-slate-400">จาก {row.quantity}</div>
                                        <button type="button" onClick={() => addWithQty(stdQty)} className="text-xs font-semibold px-3 py-1.5 rounded-lg border-2 border-enterprise-300 dark:border-enterprise-600 bg-enterprise-100 dark:bg-enterprise-900/50 text-enterprise-700 dark:text-enterprise-300 cursor-pointer shadow-sm hover:bg-enterprise-200 dark:hover:bg-enterprise-800/60 hover:shadow hover:border-enterprise-400 dark:hover:border-enterprise-500 active:scale-[0.98] transition-all mt-1">
                                            เพิ่ม
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                </div>
            </div>
        </div>
    );
};

// ==================== Main Component ====================
export const PackingSimulator: React.FC<SimulatorProps> = ({ tripId, onClose, onSaved, embedInDetailView }) => {
    const [tripItems, setTripItems] = useState<TripItem[]>([]);
    const [tripData, setTripData] = useState<any>(null);
    const [layout, setLayout] = useState<LayoutState>({ positions: [] });
    const [loadingTrip, setLoadingTrip] = useState(true);
    const [showItemPicker, setShowItemPicker] = useState<string | { posId: string; layerIndex: number } | null>(null);
    const [quantityEdit, setQuantityEdit] = useState<{ posId: string; itemId: string; layerIndex: number | null; value: string } | null>(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState<string | null>(null);
    const [showAi, setShowAi] = useState(false);
    const [showSaveConfirm, setShowSaveConfirm] = useState(false);
    /** พาเลท/พื้นรถที่รอยืนยันลบ (ป้องกันกดผิดปุ่มลบ) */
    const [positionToDelete, setPositionToDelete] = useState<string | null>(null);
    const [packingStandards, setPackingStandards] = useState<Map<string, PackingStandard>>(new Map());
    /** ทุก config ต่อสินค้า (สำหรับปุ่มเต็มพาเลท 60, 75 ฯลฯ) */
    const [packingConfigs, setPackingConfigs] = useState<Map<string, PackingStandard[]>>(new Map());

    // Undo/redo
    const [history, setHistory] = useState<LayoutState[]>([]);
    const [historyIndex, setHistoryIndex] = useState<number>(-1);

    const draftKey = `packing-sim-${tripId}`;

    // Push state to history
    const push = useCallback((newLayout: LayoutState) => {
        setHistory(prev => {
            const trimmed = prev.slice(0, historyIndex + 1);
            const next = [...trimmed, newLayout];
            return next.length > 30 ? next.slice(-30) : next;
        });
        setHistoryIndex(prev => Math.min(prev + 1, 29));
        setLayout(newLayout);
    }, [historyIndex]);

    const undo = useCallback(() => {
        if (historyIndex <= 0) return;
        const prev = history[historyIndex - 1];
        if (prev) {
            setHistoryIndex(i => i - 1);
            setLayout(prev);
        }
    }, [history, historyIndex]);

    const redo = useCallback(() => {
        if (historyIndex >= history.length - 1) return;
        const next = history[historyIndex + 1];
        if (next) {
            setHistoryIndex(i => i + 1);
            setLayout(next);
        }
    }, [history, historyIndex]);

    // Load trip data
    useEffect(() => {
        const load = async () => {
            setLoadingTrip(true);
            try {
                const trip = await deliveryTripService.getById(tripId);
                if (!trip) {
                    console.error('[PackingSimulator] Trip not found');
                    return;
                }
                setTripData(trip);

                // Build aggregated items list
                const itemMap = new Map<string, TripItem>();
                const stores = trip.stores || [];
                for (const store of stores) {
                    const storeItems = store.items || [];
                    for (const item of storeItems) {
                        const product = item.product;
                        if (!product) continue;
                        const key = item.id;
                        itemMap.set(key, {
                            id: item.id,
                            product_id: product.id || item.product_id,
                            product_name: product.product_name || 'ไม่ทราบ',
                            product_code: product.product_code || '-',
                            category: product.category || 'อื่นๆ',
                            unit: product.unit || 'หน่วย',
                            quantity: Number(item.quantity) || 0,
                            weight_kg: product.weight_kg ?? null,
                            store_name: store.store?.customer_name || undefined,
                        });
                    }
                }
                setTripItems(Array.from(itemMap.values()));

                // โหลด layout ที่บันทึกไว้จาก DB ก่อน (สำคัญ: ข้อมูลจัดเรียงที่บันทึกแล้วต้องแสดงเมื่อกลับเข้าใหม่)
                let loadedLayout: LayoutState | null = null;
                try {
                    const saved = await tripMetricsService.getTripPackingLayout(tripId);
                    if (saved?.positions?.length > 0) {
                        loadedLayout = {
                            positions: saved.positions.map(pos => ({
                                id: pos.id,
                                position_type: pos.position_type,
                                position_index: pos.position_index,
                                total_layers: pos.total_layers ?? 1,
                                notes: pos.notes ?? '',
                                collapsed: false,
                                detailedMode: (pos.total_layers ?? 1) > 1 || pos.items.some(i => i.layer_index != null),
                                items: pos.items.map(it => ({
                                    delivery_trip_item_id: it.delivery_trip_item_id,
                                    product_id: it.product_id,
                                    product_name: it.product_name,
                                    product_code: it.product_code,
                                    category: it.category,
                                    unit: it.unit,
                                    weight_kg: it.weight_kg,
                                    quantity: it.quantity,
                                    layer_index: it.layer_index,
                                })),
                            })),
                        };
                    }
                } catch (e) {
                    console.warn('[PackingSimulator] Load saved layout failed, fallback to draft/empty:', e);
                }

                if (loadedLayout) {
                    setLayout(loadedLayout);
                    setHistory([loadedLayout]);
                    setHistoryIndex(0);
                } else {
                    // ไม่มีใน DB: ลอง draft จาก localStorage
                    const draft = localStorage.getItem(draftKey);
                    if (draft) {
                        try {
                            const parsed = JSON.parse(draft) as LayoutState;
                            setLayout(parsed);
                            setHistory([parsed]);
                            setHistoryIndex(0);
                        } catch { /* ignore bad draft */ }
                    } else {
                        // Initialize with 1 pallet
                        const initial: LayoutState = {
                            positions: [{
                                id: uid(),
                                position_type: 'pallet',
                                position_index: 1,
                                total_layers: 1,
                                notes: '',
                                collapsed: false,
                                detailedMode: false,
                                items: [],
                            }],
                        };
                        setLayout(initial);
                        setHistory([initial]);
                        setHistoryIndex(0);
                    }
                }
            } catch (err) {
                console.error('[PackingSimulator] Error loading trip:', err);
            } finally {
                setLoadingTrip(false);
            }
        };
        load();
    }, [tripId, draftKey]);

    // โหลดมาตรฐานการจัดเรียง (product_pallet_configs) ต่อสินค้าในทริป
    useEffect(() => {
        if (tripItems.length === 0) {
            setPackingStandards(new Map());
            setPackingConfigs(new Map());
            return;
        }
        const productIds = [...new Set(tripItems.map((i) => i.product_id))] as string[];
        tripMetricsService.getPackingStandards(productIds).then(setPackingStandards);
        tripMetricsService.getProductPackingConfigs(productIds).then(setPackingConfigs);
    }, [tripItems]);

    // Auto-save draft
    useEffect(() => {
        if (!loadingTrip && layout.positions.length > 0) {
            localStorage.setItem(draftKey, JSON.stringify(layout));
        }
    }, [layout, loadingTrip, draftKey]);

    // Compute allocation map: how many of each item are used across all positions
    const allocated = useMemo(() => {
        const map = new Map<string, number>();
        for (const pos of layout.positions) {
            for (const item of pos.items) {
                map.set(item.delivery_trip_item_id, (map.get(item.delivery_trip_item_id) || 0) + item.quantity);
            }
        }
        return map;
    }, [layout]);

    // รายการสำหรับ Picker: แยกร้าน (แต่ละแถว = สินค้า + ร้าน)
    const pickerItemsPerStore = useMemo((): PickerRow[] => {
        return tripItems
            .map(item => ({
                itemId: item.id,
                product_id: item.product_id,
                product_name: item.product_name,
                product_code: item.product_code,
                category: item.category,
                unit: item.unit,
                quantity: item.quantity,
                remaining: item.quantity - (allocated.get(item.id) || 0),
                store_name: item.store_name,
            }))
            .filter(row => row.remaining > 0)
            .sort((a, b) => a.product_name.localeCompare(b.product_name) || (a.store_name || '').localeCompare(b.store_name || ''));
    }, [tripItems, allocated]);

    // รายการรวมตามสินค้า (หนึ่งแถวต่อสินค้า — เหมาะเมื่อมี 4–5 ร้านขึ้นไป ไม่ต้องเลื่อนยาว)
    const pickerItemsAggregated = useMemo((): AggregatedPickerRow[] => {
        const byProduct = new Map<string, { name: string; code: string; category: string; unit: string; totalQty: number; totalRemaining: number; count: number }>();
        for (const item of tripItems) {
            const remaining = item.quantity - (allocated.get(item.id) || 0);
            const ex = byProduct.get(item.product_id);
            if (!ex) {
                byProduct.set(item.product_id, {
                    name: item.product_name,
                    code: item.product_code,
                    category: item.category,
                    unit: item.unit,
                    totalQty: item.quantity,
                    totalRemaining: remaining,
                    count: 1,
                });
            } else {
                ex.totalQty += item.quantity;
                ex.totalRemaining += remaining;
                ex.count += 1;
            }
        }
        return Array.from(byProduct.entries())
            .map(([product_id, v]) => ({
                product_id,
                product_name: v.name,
                product_code: v.code,
                category: v.category,
                unit: v.unit,
                totalQuantity: v.totalQty,
                totalRemaining: v.totalRemaining,
                storeCount: v.count,
            }))
            .filter(r => r.totalRemaining > 0)
            .sort((a, b) => a.product_name.localeCompare(b.product_name));
    }, [tripItems, allocated]);

    // Stats (น้ำหนักใช้ weight_kg จากรายการใน layout หรือ fallback จาก tripItem ถ้าโหลดจาก draft เก่าที่ไม่มี weight_kg)
    const stats = useMemo(() => {
        const pallets = layout.positions.filter(p => p.position_type === 'pallet').length;
        const floors = layout.positions.filter(p => p.position_type === 'floor').length;
        let totalWeight = 0;
        let totalItems = 0;
        let totalAllocated = 0;

        for (const pos of layout.positions) {
            for (const item of pos.items) {
                totalAllocated += item.quantity;
                const w = item.weight_kg ?? tripItems.find(t => t.id === item.delivery_trip_item_id)?.weight_kg ?? 0;
                totalWeight += w * item.quantity;
            }
        }

        for (const ti of tripItems) {
            totalItems += ti.quantity;
        }

        const utilizationPct = totalItems > 0 ? Math.round((totalAllocated / totalItems) * 100) : 0;

        return { pallets, floors, totalWeight, totalItems, totalAllocated, utilizationPct };
    }, [layout, tripItems]);

    // Add position
    const addPosition = useCallback((type: 'pallet' | 'floor') => {
        const existing = layout.positions.filter(p => p.position_type === type);
        const maxIdx = existing.length > 0 ? Math.max(...existing.map(p => p.position_index)) : 0;
        push({
            positions: [...layout.positions, {
                id: uid(),
                position_type: type,
                position_index: maxIdx + 1,
                total_layers: 1,
                notes: '',
                collapsed: false,
                detailedMode: false,
                items: [],
            }],
        });
    }, [layout, push]);

    // Remove position
    const removePosition = useCallback((posId: string) => {
        push({ positions: layout.positions.filter(p => p.id !== posId) });
    }, [layout, push]);

    // Toggle collapse
    const toggleCollapse = useCallback((posId: string) => {
        setLayout(prev => ({
            positions: prev.positions.map(p =>
                p.id === posId ? { ...p, collapsed: !p.collapsed } : p
            ),
        }));
    }, []);

    // Add item to position (ใช้เมื่อเลือกจาก picker แบบแยกรายการ)
    const addItemToPosition = useCallback((posId: string, itemId: string, qty: number) => {
        const tripItem = tripItems.find(i => i.id === itemId);
        if (!tripItem) return;

        const used = allocated.get(itemId) || 0;
        const remaining = tripItem.quantity - used;
        const actualQty = Math.min(qty, remaining);
        if (actualQty <= 0) return;

        push({
            positions: layout.positions.map(pos => {
                if (pos.id !== posId) return pos;
                const existingIdx = pos.items.findIndex(i => i.delivery_trip_item_id === itemId);
                if (existingIdx >= 0) {
                    const updated = [...pos.items];
                    updated[existingIdx] = { ...updated[existingIdx], quantity: updated[existingIdx].quantity + actualQty };
                    return { ...pos, items: updated };
                }
                return {
                    ...pos,
                    items: [...pos.items, {
                        delivery_trip_item_id: itemId,
                        product_id: tripItem.product_id,
                        product_name: tripItem.product_name,
                        product_code: tripItem.product_code,
                        category: tripItem.category,
                        unit: tripItem.unit,
                        weight_kg: tripItem.weight_kg,
                        quantity: actualQty,
                        layer_index: null,
                    }],
                };
            }),
        });
    }, [tripItems, layout, allocated, push]);

    // เพิ่มสินค้าตาม product (รวมหลายร้าน): แจกอัตโนมัติ โดยจับกลุ่มร้าน — ใช้จากร้านที่เหลือมากก่อน เศษค่อยแยก
    const addProductToPosition = useCallback((posId: string, productId: string, qty: number) => {
        const itemsWithProduct = tripItems
            .filter(i => i.product_id === productId)
            .map(item => ({ item, remaining: item.quantity - (allocated.get(item.id) || 0) }))
            .filter(x => x.remaining > 0)
            .sort((a, b) => b.remaining - a.remaining); // ร้านที่เหลือมากก่อน → จับกลุ่มกัน
        const toAdd: { itemId: string; addQty: number; tripItem: TripItem }[] = [];
        let left = qty;
        for (const { item, remaining } of itemsWithProduct) {
            if (left <= 0) break;
            const addQty = Math.min(left, remaining);
            if (addQty > 0) {
                toAdd.push({ itemId: item.id, addQty, tripItem: item });
                left -= addQty;
            }
        }
        if (toAdd.length === 0) return;

        push({
            positions: layout.positions.map(pos => {
                if (pos.id !== posId) return pos;
                let nextItems = [...pos.items];
                for (const { itemId, addQty, tripItem } of toAdd) {
                    const idx = nextItems.findIndex(i => i.delivery_trip_item_id === itemId && i.layer_index === null);
                    if (idx >= 0) {
                        nextItems = nextItems.map((it, i) =>
                            i === idx ? { ...it, quantity: it.quantity + addQty } : it
                        );
                    } else {
                        nextItems.push({
                            delivery_trip_item_id: itemId,
                            product_id: tripItem.product_id,
                            product_name: tripItem.product_name,
                            product_code: tripItem.product_code,
                            category: tripItem.category,
                            unit: tripItem.unit,
                            weight_kg: tripItem.weight_kg,
                            quantity: addQty,
                            layer_index: null,
                        });
                    }
                }
                return { ...pos, items: nextItems };
            }),
        });
    }, [tripItems, layout, allocated, push]);

    // Remove item from position
    const removeItemFromPosition = useCallback((posId: string, itemId: string) => {
        push({
            positions: layout.positions.map(pos =>
                pos.id !== posId ? pos : { ...pos, items: pos.items.filter(i => i.delivery_trip_item_id !== itemId) }
            ),
        });
    }, [layout, push]);

    /** ลบสินค้าทั้งกลุ่มออกจากตำแหน่ง (สินค้าชนิดเดียวกันในพาเลทเดียว = 1 กลุ่ม) */
    const removeGroupFromPosition = useCallback((posId: string, productId: string, itemId: string) => {
        push({
            positions: layout.positions.map(pos =>
                pos.id !== posId ? pos : { ...pos, items: pos.items.filter(i => !(i.product_id === productId && i.delivery_trip_item_id === itemId)) }
            ),
        });
    }, [layout, push]);

    /** ตั้งจำนวนรวมของกลุ่มสินค้าในตำแหน่ง แล้วแจกจำนวนลงแต่ละชั้นเท่าๆ กัน */
    const setGroupQuantity = useCallback((posId: string, productId: string, itemId: string, newTotal: number) => {
        const tripItem = tripItems.find(i => i.id === itemId);
        if (!tripItem) return;
        push({
            positions: layout.positions.map(pos => {
                if (pos.id !== posId) return pos;
                const groupItems = pos.items.filter(i => i.product_id === productId && i.delivery_trip_item_id === itemId);
                if (groupItems.length === 0) return pos;
                const used = allocated.get(itemId) || 0;
                const groupQty = groupItems.reduce((s, i) => s + i.quantity, 0);
                const usedElsewhere = used - groupQty;
                const maxAllowed = tripItem.quantity - usedElsewhere;
                const clamped = Math.max(0, Math.min(newTotal, maxAllowed));
                if (clamped <= 0) {
                    return { ...pos, items: pos.items.filter(i => !(i.product_id === productId && i.delivery_trip_item_id === itemId)) };
                }
                const n = groupItems.length;
                const perLayer = Math.floor(clamped / n);
                const remainder = clamped % n;
                const sorted = [...groupItems].sort((a, b) => (a.layer_index ?? 0) - (b.layer_index ?? 0));
                const newItems = pos.items.filter(i => !(i.product_id === productId && i.delivery_trip_item_id === itemId));
                sorted.forEach((it, idx) => {
                    const qty = perLayer + (idx < remainder ? 1 : 0);
                    if (qty > 0) newItems.push({ ...it, quantity: qty });
                });
                return { ...pos, items: newItems };
            }),
        });
    }, [tripItems, layout, allocated, push]);

    /** ปรับจำนวนรวมของกลุ่ม (+/-) */
    const adjustGroupQty = useCallback((posId: string, productId: string, itemId: string, delta: number) => {
        const pos = layout.positions.find(p => p.id === posId);
        if (!pos) return;
        const groupItems = pos.items.filter(i => i.product_id === productId && i.delivery_trip_item_id === itemId);
        const currentTotal = groupItems.reduce((s, i) => s + i.quantity, 0);
        setGroupQuantity(posId, productId, itemId, currentTotal + delta);
    }, [layout.positions, setGroupQuantity]);

    /** ความจุที่ใช้ไปแล้วแต่ละชั้น (สินค้าอื่น ไม่รวม productId) — ใช้ตรวจก่อนเติมว่าชั้นนั้นเหลือที่กี่หน่วย */
    const getExistingQtyPerLayer = useCallback((pos: Position, excludeProductId: string): number[] => {
        const out: number[] = [];
        for (const it of pos.items) {
            if (it.product_id === excludeProductId || it.layer_index == null) continue;
            const li = it.layer_index;
            while (out.length <= li) out.push(0);
            out[li] += it.quantity;
        }
        return out;
    }, []);

    /** เติมเต็มพาเลท: ใช้มาตรฐาน (ชั้นละ units_per_layer) — ตรวจความจุแต่ละชั้นก่อน เติมชั้นล่างครบแล้วค่อยขึ้นชั้นใหม่ */
    const fillFullPalletForGroup = useCallback((posId: string, productId: string, itemId: string, config?: PackingStandard) => {
        const pos = layout.positions.find(p => p.id === posId);
        const tripItem = tripItems.find(i => i.id === itemId);
        const std = config ?? packingStandards.get(productId);
        if (!pos || !tripItem || !std?.total_units) return;
        const groupItems = pos.items.filter(i => i.product_id === productId && i.delivery_trip_item_id === itemId);
        const currentTotal = groupItems.reduce((s, i) => s + i.quantity, 0);
        const allocatedTotal = allocated.get(itemId) || 0;
        const maxAllowed = tripItem.quantity - allocatedTotal + currentTotal;
        const toFill = Math.min(std.total_units, Math.max(0, Math.floor(maxAllowed)));
        if (toFill <= 0) return;

        const unitsPerLayer = Math.max(1, std.units_per_layer || Math.floor(toFill / Math.max(1, std.layers)));
        const existingPerLayer = getExistingQtyPerLayer(pos, productId);
        const template = groupItems[0] || {
            delivery_trip_item_id: itemId,
            product_id: tripItem.product_id,
            product_name: tripItem.product_name,
            product_code: tripItem.product_code,
            category: tripItem.category,
            unit: tripItem.unit,
            weight_kg: tripItem.weight_kg,
            quantity: 0,
            layer_index: 0,
        };

        const newLayerItems: PositionItem[] = [];
        let layerIndex = 0;
        let remainingToFill = toFill;
        while (remainingToFill > 0) {
            const usedOnLayer = existingPerLayer[layerIndex] ?? 0;
            const capacity = Math.max(0, unitsPerLayer - usedOnLayer);
            if (capacity <= 0) {
                layerIndex++;
                continue;
            }
            const qty = Math.min(capacity, remainingToFill);
            newLayerItems.push({ ...template, layer_index: layerIndex, quantity: qty });
            remainingToFill -= qty;
            layerIndex++;
        }
        const totalLayers = newLayerItems.length ? Math.max(...newLayerItems.map(i => i.layer_index)) + 1 : 0;
        const requiredMinLayers = Math.ceil(toFill / unitsPerLayer);
        const newPositionLayers = Math.max(pos.total_layers, totalLayers, requiredMinLayers);

        push({
            positions: layout.positions.map(p => {
                if (p.id !== posId) return p;
                const otherItems = p.items.filter(i => !(i.product_id === productId && i.delivery_trip_item_id === itemId));
                const needsDetailed = p.detailedMode || newPositionLayers > 1;
                return {
                    ...p,
                    detailedMode: needsDetailed || p.detailedMode,
                    total_layers: newPositionLayers,
                    items: needsDetailed
                        ? [...otherItems, ...newLayerItems]
                        : [...otherItems, { ...template, layer_index: null, quantity: toFill }],
                };
            }),
        });
    }, [layout, tripItems, packingStandards, allocated, push, getExistingQtyPerLayer]);

    /** เติมเต็มพาเลทตามมาตรฐาน (ระดับสินค้า): ตรวจความจุแต่ละชั้นก่อน — เติมชั้นล่างให้ครบตามมาตรฐานก่อนแล้วค่อยขึ้นชั้นใหม่ */
    const fillFullPalletByProduct = useCallback((posId: string, productId: string, config: PackingStandard) => {
        const pos = layout.positions.find(p => p.id === posId);
        if (!pos || !config?.total_units) return;
        const currentOnThisPos = new Map<string, number>();
        for (const it of pos.items) {
            if (it.product_id !== productId) continue;
            currentOnThisPos.set(it.delivery_trip_item_id, (currentOnThisPos.get(it.delivery_trip_item_id) || 0) + it.quantity);
        }
        const itemsWithProduct = tripItems
            .filter(i => i.product_id === productId)
            .map(item => ({
                item,
                remaining: item.quantity - (allocated.get(item.id) || 0) + (currentOnThisPos.get(item.id) || 0),
            }))
            .filter(x => x.remaining > 0)
            .sort((a, b) => b.remaining - a.remaining);
        const totalRemaining = itemsWithProduct.reduce((s, x) => s + x.remaining, 0);
        const toFill = Math.min(config.total_units, totalRemaining);
        if (toFill <= 0) return;

        const unitsPerLayer = Math.max(1, config.units_per_layer || Math.floor(toFill / Math.max(1, config.layers)));
        const existingPerLayer = getExistingQtyPerLayer(pos, productId);
        const newLayerItems: PositionItem[] = [];

        const singleStoreWithEnough = itemsWithProduct.find(x => x.remaining >= toFill);
        if (singleStoreWithEnough) {
            const oneStore = singleStoreWithEnough.item;
            let layerIndex = 0;
            let remainingToAssign = toFill;
            while (remainingToAssign > 0) {
                const usedOnLayer = existingPerLayer[layerIndex] ?? 0;
                const capacity = Math.max(0, unitsPerLayer - usedOnLayer);
                if (capacity <= 0) {
                    layerIndex++;
                    continue;
                }
                const addQty = Math.min(capacity, remainingToAssign);
                if (addQty <= 0) break;
                newLayerItems.push({
                    delivery_trip_item_id: oneStore.id,
                    product_id: oneStore.product_id,
                    product_name: oneStore.product_name,
                    product_code: oneStore.product_code,
                    category: oneStore.category,
                    unit: oneStore.unit,
                    weight_kg: oneStore.weight_kg,
                    quantity: addQty,
                    layer_index: layerIndex,
                });
                remainingToAssign -= addQty;
                layerIndex++;
            }
        } else {
            const assigned = new Map<string, number>();
            let layerIndex = 0;
            let remainingToAssign = toFill;
            while (remainingToAssign > 0) {
                const usedOnLayer = existingPerLayer[layerIndex] ?? 0;
                const capacity = Math.max(0, unitsPerLayer - usedOnLayer);
                if (capacity <= 0) {
                    layerIndex++;
                    continue;
                }
                let leftOnThisLayer = capacity;
                const sorted = [...itemsWithProduct].sort((a, b) => (b.remaining - (assigned.get(b.item.id) || 0)) - (a.remaining - (assigned.get(a.item.id) || 0)));
                for (const { item, remaining } of sorted) {
                    if (leftOnThisLayer <= 0 || remainingToAssign <= 0) break;
                    const storeRemaining = remaining - (assigned.get(item.id) || 0);
                    const addQty = Math.min(leftOnThisLayer, storeRemaining, remainingToAssign);
                    if (addQty <= 0) continue;
                    newLayerItems.push({
                        delivery_trip_item_id: item.id,
                        product_id: item.product_id,
                        product_name: item.product_name,
                        product_code: item.product_code,
                        category: item.category,
                        unit: item.unit,
                        weight_kg: item.weight_kg,
                        quantity: addQty,
                        layer_index: layerIndex,
                    });
                    assigned.set(item.id, (assigned.get(item.id) || 0) + addQty);
                    leftOnThisLayer -= addQty;
                    remainingToAssign -= addQty;
                }
                layerIndex++;
            }
        }
        const totalLayers = newLayerItems.length ? Math.max(...newLayerItems.map(i => i.layer_index)) + 1 : 0;
        const requiredMinLayers = Math.ceil(toFill / unitsPerLayer);
        const newPositionLayers = Math.max(pos.total_layers, totalLayers, requiredMinLayers);

        push({
            positions: layout.positions.map(p => {
                if (p.id !== posId) return p;
                const otherItems = p.items.filter(i => i.product_id !== productId);
                return {
                    ...p,
                    total_layers: newPositionLayers,
                    detailedMode: true,
                    items: [...otherItems, ...newLayerItems],
                };
            }),
        });
    }, [tripItems, layout, allocated, push, getExistingQtyPerLayer]);

    // Adjust item quantity (+/-)
    const adjustItemQty = useCallback((posId: string, itemId: string, delta: number, layerIndex?: number | null) => {
        const tripItem = tripItems.find(i => i.id === itemId);
        if (!tripItem) return;
        const layerKey = layerIndex ?? null;

        push({
            positions: layout.positions.map(pos => {
                if (pos.id !== posId) return pos;
                return {
                    ...pos,
                    items: pos.items.map(item => {
                        if (item.delivery_trip_item_id !== itemId || item.layer_index !== layerKey) return item;
                        const used = allocated.get(itemId) || 0;
                        const usedElsewhere = used - item.quantity;
                        const maxAllowed = tripItem.quantity - usedElsewhere;
                        const newQty = Math.max(1, Math.min(item.quantity + delta, maxAllowed));
                        return { ...item, quantity: newQty };
                    }),
                };
            }),
        });
    }, [tripItems, layout, allocated, push]);

    // Set quantity by typing (absolute value); layerIndex for detailed mode
    const setItemQuantity = useCallback((posId: string, itemId: string, newQty: number, layerIndex?: number | null) => {
        const tripItem = tripItems.find(i => i.id === itemId);
        if (!tripItem) return;
        const layerKey = layerIndex ?? null;

        push({
            positions: layout.positions.map(pos => {
                if (pos.id !== posId) return pos;
                const used = allocated.get(itemId) || 0;
                const currentRow = pos.items.find(i => i.delivery_trip_item_id === itemId && i.layer_index === layerKey);
                const usedElsewhere = currentRow ? used - currentRow.quantity : used;
                const maxAllowed = tripItem.quantity - usedElsewhere;
                const clamped = Math.max(0, Math.min(newQty, maxAllowed));

                if (clamped <= 0 && currentRow) {
                    return { ...pos, items: pos.items.filter(i => !(i.delivery_trip_item_id === itemId && i.layer_index === layerKey)) };
                }
                if (!currentRow) return pos;
                return {
                    ...pos,
                    items: pos.items.map(item =>
                        item.delivery_trip_item_id === itemId && item.layer_index === layerKey
                            ? { ...item, quantity: clamped }
                            : item
                    ),
                };
            }),
        });
    }, [tripItems, layout, allocated, push]);

    // Set number of layers for a position (pallet). If simple mode has items, auto-distribute per layer.
    const setTotalLayers = useCallback((posId: string, n: number) => {
        const num = Math.max(1, Math.min(n, 8));
        push({
            positions: layout.positions.map(pos => {
                if (pos.id !== posId) return pos;
                if (pos.detailedMode) {
                    if (num < pos.total_layers) {
                        return { ...pos, total_layers: num, items: pos.items.filter(i => i.layer_index === null || i.layer_index < num) };
                    }
                    return { ...pos, total_layers: num };
                }
                // Simple mode: if we have items and setting > 1 layer, auto-calculate and switch to detailed (จำนวนต่อชั้น)
                if (num > 1 && pos.items.length > 0) {
                    const newItems: PositionItem[] = [];
                    for (const item of pos.items) {
                        const perLayer = Math.floor(item.quantity / num);
                        const remainder = item.quantity % num;
                        for (let li = 0; li < num; li++) {
                            const qty = perLayer + (li < remainder ? 1 : 0);
                            if (qty > 0) newItems.push({ ...item, layer_index: li, quantity: qty });
                        }
                    }
                    return { ...pos, total_layers: num, detailedMode: true, items: newItems };
                }
                return { ...pos, total_layers: num };
            }),
        });
    }, [layout, push]);

    // Toggle detailed mode: per-layer assignment
    const toggleDetailedMode = useCallback((posId: string) => {
        setLayout(prev => ({
            positions: prev.positions.map(pos => {
                if (pos.id !== posId) return pos;
                if (!pos.detailedMode) {
                    if (pos.items.length === 0 || pos.total_layers <= 1) {
                        return { ...pos, detailedMode: true, items: pos.items.map(i => ({ ...i, layer_index: 0 })) };
                    }
                    const newItems: PositionItem[] = [];
                    for (const item of pos.items) {
                        const perLayer = Math.floor(item.quantity / pos.total_layers);
                        const remainder = item.quantity % pos.total_layers;
                        for (let li = 0; li < pos.total_layers; li++) {
                            const qty = perLayer + (li < remainder ? 1 : 0);
                            if (qty > 0) newItems.push({ ...item, layer_index: li, quantity: qty });
                        }
                    }
                    return { ...pos, detailedMode: true, items: newItems };
                }
                const merged = new Map<string, { item: PositionItem; qty: number }>();
                for (const i of pos.items) {
                    const key = `${i.delivery_trip_item_id}-${i.layer_index ?? 'n'}`;
                    const ex = merged.get(i.delivery_trip_item_id);
                    if (ex) ex.qty += i.quantity;
                    else merged.set(i.delivery_trip_item_id, { item: i, qty: i.quantity });
                }
                return { ...pos, detailedMode: false, items: [...merged.values()].map(({ item, qty }) => ({ ...item, quantity: qty, layer_index: null })) };
            }),
        }));
    }, []);

    // Add item to a specific layer (detailed mode)
    const addItemToLayer = useCallback((posId: string, itemId: string, qty: number, layerIndex: number) => {
        const tripItem = tripItems.find(i => i.id === itemId);
        if (!tripItem) return;
        const used = allocated.get(itemId) || 0;
        const remaining = tripItem.quantity - used;
        const actualQty = Math.min(qty, Math.max(1, remaining));
        if (actualQty <= 0) return;

        push({
            positions: layout.positions.map(pos => {
                if (pos.id !== posId) return pos;
                const existing = pos.items.find(i => i.delivery_trip_item_id === itemId && i.layer_index === layerIndex);
                if (existing) {
                    const newQty = Math.min(existing.quantity + actualQty, tripItem.quantity - (used - existing.quantity));
                    return { ...pos, items: pos.items.map(i => i === existing ? { ...i, quantity: newQty } : i) };
                }
                return {
                    ...pos,
                    items: [...pos.items, {
                        delivery_trip_item_id: itemId,
                        product_id: tripItem.product_id,
                        product_name: tripItem.product_name,
                        product_code: tripItem.product_code,
                        category: tripItem.category,
                        unit: tripItem.unit,
                        weight_kg: tripItem.weight_kg,
                        quantity: actualQty,
                        layer_index: layerIndex,
                    }],
                };
            }),
        });
    }, [tripItems, layout, allocated, push]);

    // เพิ่มสินค้าตาม product ลงชั้นที่กำหนด (โหมดละเอียด): แจกอัตโนมัติ จับกลุ่มร้าน (ร้านที่เหลือมากก่อน)
    const addProductToLayer = useCallback((posId: string, productId: string, qty: number, layerIndex: number) => {
        const itemsWithProduct = tripItems
            .filter(i => i.product_id === productId)
            .map(item => ({ item, remaining: item.quantity - (allocated.get(item.id) || 0) }))
            .filter(x => x.remaining > 0)
            .sort((a, b) => b.remaining - a.remaining);
        const toAdd: { itemId: string; addQty: number; tripItem: TripItem }[] = [];
        let left = qty;
        for (const { item, remaining } of itemsWithProduct) {
            if (left <= 0) break;
            const addQty = Math.min(left, remaining);
            if (addQty > 0) {
                toAdd.push({ itemId: item.id, addQty, tripItem: item });
                left -= addQty;
            }
        }
        if (toAdd.length === 0) return;

        push({
            positions: layout.positions.map(pos => {
                if (pos.id !== posId) return pos;
                let nextItems = [...pos.items];
                for (const { itemId, addQty, tripItem } of toAdd) {
                    const idx = nextItems.findIndex(i => i.delivery_trip_item_id === itemId && i.layer_index === layerIndex);
                    if (idx >= 0) {
                        nextItems = nextItems.map((it, i) =>
                            i === idx ? { ...it, quantity: it.quantity + addQty } : it
                        );
                    } else {
                        nextItems.push({
                            delivery_trip_item_id: itemId,
                            product_id: tripItem.product_id,
                            product_name: tripItem.product_name,
                            product_code: tripItem.product_code,
                            category: tripItem.category,
                            unit: tripItem.unit,
                            weight_kg: tripItem.weight_kg,
                            quantity: addQty,
                            layer_index: layerIndex,
                        });
                    }
                }
                return { ...pos, items: nextItems };
            }),
        });
    }, [tripItems, layout, allocated, push]);

    /** เพิ่มสินค้าทั้งหมดที่เหลือลงตำแหน่ง โดยแบ่งชั้นตาม unitsPerLayer — ตรวจความจุแต่ละชั้นก่อน เติมชั้นล่างครบแล้วค่อยขึ้นชั้นใหม่ หลายร้านอยู่ร่วมกันในชั้นเดียวกันได้ */
    const addProductToPositionWithUnitsPerLayer = useCallback((posId: string, productId: string, unitsPerLayer: number) => {
        const pos = layout.positions.find(p => p.id === posId);
        if (!pos || unitsPerLayer < 1) return;
        const itemsWithProduct = tripItems
            .filter(i => i.product_id === productId)
            .map(item => ({ item, remaining: item.quantity - (allocated.get(item.id) || 0) }))
            .filter(x => x.remaining > 0)
            .sort((a, b) => b.remaining - a.remaining);
        const totalToAdd = itemsWithProduct.reduce((s, x) => s + x.remaining, 0);
        if (totalToAdd <= 0) return;

        const existingPerLayer = getExistingQtyPerLayer(pos, productId);
        const assigned = new Map<string, number>();
        const newLayerItems: PositionItem[] = [];
        let layerIndex = 0;
        let remainingToAssign = totalToAdd;
        while (remainingToAssign > 0) {
            const usedOnLayer = existingPerLayer[layerIndex] ?? 0;
            const capacity = Math.max(0, unitsPerLayer - usedOnLayer);
            if (capacity <= 0) {
                layerIndex++;
                continue;
            }
            let leftOnThisLayer = capacity;
            const sorted = [...itemsWithProduct].sort((a, b) => (b.remaining - (assigned.get(b.item.id) || 0)) - (a.remaining - (assigned.get(a.item.id) || 0)));
            for (const { item, remaining } of sorted) {
                if (leftOnThisLayer <= 0 || remainingToAssign <= 0) break;
                const storeRemaining = remaining - (assigned.get(item.id) || 0);
                const addQty = Math.min(leftOnThisLayer, storeRemaining, remainingToAssign);
                if (addQty <= 0) continue;
                newLayerItems.push({
                    delivery_trip_item_id: item.id,
                    product_id: item.product_id,
                    product_name: item.product_name,
                    product_code: item.product_code,
                    category: item.category,
                    unit: item.unit,
                    weight_kg: item.weight_kg,
                    quantity: addQty,
                    layer_index: layerIndex,
                });
                assigned.set(item.id, (assigned.get(item.id) || 0) + addQty);
                leftOnThisLayer -= addQty;
                remainingToAssign -= addQty;
            }
            layerIndex++;
        }
        const layerCount = newLayerItems.length ? Math.max(...newLayerItems.map(i => i.layer_index)) + 1 : 0;

        push({
            positions: layout.positions.map(p => {
                if (p.id !== posId) return p;
                const otherItems = p.items.filter(i => i.product_id !== productId);
                const newPositionLayers = Math.max(p.total_layers, layerCount);
                return {
                    ...p,
                    total_layers: newPositionLayers,
                    detailedMode: true,
                    items: [...otherItems, ...newLayerItems],
                };
            }),
        });
    }, [tripItems, layout, allocated, push, getExistingQtyPerLayer]);

    /** เพิ่มสินค้า (รายการร้านเดียว) ทั้งหมดที่เหลือลงตำแหน่ง โดยแบ่งชั้นตาม unitsPerLayer — ตรวจความจุแต่ละชั้นก่อน เติมชั้นล่างครบแล้วค่อยขึ้นชั้นใหม่ */
    const addItemToPositionWithUnitsPerLayer = useCallback((posId: string, itemId: string, unitsPerLayer: number) => {
        const pos = layout.positions.find(p => p.id === posId);
        const tripItem = tripItems.find(i => i.id === itemId);
        if (!pos || !tripItem || unitsPerLayer < 1) return;
        const used = allocated.get(itemId) || 0;
        const totalToAdd = tripItem.quantity - used;
        if (totalToAdd <= 0) return;

        const existingPerLayer = getExistingQtyPerLayer(pos, tripItem.product_id);
        const newLayerItems: PositionItem[] = [];
        let layerIndex = 0;
        let remainingToAdd = totalToAdd;
        while (remainingToAdd > 0) {
            const usedOnLayer = existingPerLayer[layerIndex] ?? 0;
            const capacity = Math.max(0, unitsPerLayer - usedOnLayer);
            if (capacity <= 0) {
                layerIndex++;
                continue;
            }
            const qty = Math.min(capacity, remainingToAdd);
            newLayerItems.push({
                delivery_trip_item_id: itemId,
                product_id: tripItem.product_id,
                product_name: tripItem.product_name,
                product_code: tripItem.product_code,
                category: tripItem.category,
                unit: tripItem.unit,
                weight_kg: tripItem.weight_kg,
                quantity: qty,
                layer_index: layerIndex,
            });
            remainingToAdd -= qty;
            layerIndex++;
        }
        const layerCount = newLayerItems.length ? Math.max(...newLayerItems.map(i => i.layer_index)) + 1 : 0;

        push({
            positions: layout.positions.map(p => {
                if (p.id !== posId) return p;
                const otherItems = p.items.filter(i => i.delivery_trip_item_id !== itemId);
                const newPositionLayers = Math.max(p.total_layers, layerCount);
                return {
                    ...p,
                    total_layers: newPositionLayers,
                    detailedMode: true,
                    items: [...otherItems, ...newLayerItems],
                };
            }),
        });
    }, [tripItems, layout, allocated, push, getExistingQtyPerLayer]);

    // Remove item from a specific layer
    const removeItemFromLayer = useCallback((posId: string, itemId: string, layerIndex: number) => {
        push({
            positions: layout.positions.map(pos =>
                pos.id !== posId ? pos : { ...pos, items: pos.items.filter(i => !(i.delivery_trip_item_id === itemId && i.layer_index === layerIndex)) }
            ),
        });
    }, [layout, push]);

    /** สลับชั้น: สลับสินค้าทั้งหมดระหว่างชั้น layerA กับ layerB */
    const swapLayers = useCallback((posId: string, layerA: number, layerB: number) => {
        if (layerA === layerB) return;
        push({
            positions: layout.positions.map(pos => {
                if (pos.id !== posId) return pos;
                const items = pos.items.map(item => {
                    const idx = item.layer_index;
                    if (idx === layerA) return { ...item, layer_index: layerB };
                    if (idx === layerB) return { ...item, layer_index: layerA };
                    return item;
                });
                return { ...pos, items };
            }),
        });
    }, [layout, push]);

    // Save to DB (apply simulation) — เรียกจาก ConfirmDialog หลังกดยืนยัน
    const [saveError, setSaveError] = useState<string | null>(null);
    const handleApply = useCallback(async () => {
        if (layout.positions.length === 0) return;
        setSaving(true);
        setSaveError(null);
        setShowSaveConfirm(false);
        try {
            const payload = {
                positions: layout.positions.map(pos => ({
                    position_type: pos.position_type,
                    position_index: pos.position_index,
                    total_layers: pos.total_layers || 1,
                    notes: pos.notes || undefined,
                    items: pos.items
                        .filter(item => item.quantity > 0)
                        .map(item => ({
                            delivery_trip_item_id: item.delivery_trip_item_id,
                            quantity: item.quantity,
                            layer_index: item.layer_index ?? null,
                        })),
                })),
            };
            await tripMetricsService.saveTripPackingLayout(tripId, payload);
            localStorage.removeItem(draftKey);
            setSaved(true);
            onSaved?.();
            setTimeout(() => setSaved(false), 5000);
        } catch (err: unknown) {
            console.error('[PackingSimulator] Save error:', err);
            const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? String(err);
            const detail = (err as { error?: { message?: string }; details?: string })?.error?.message ?? (err as { details?: string })?.details;
            setSaveError(detail || msg || 'ไม่สามารถบันทึกการจัดเรียงได้');
        } finally {
            setSaving(false);
        }
    }, [layout, tripId, draftKey, onSaved]);

    // กดบันทึก: ถ้าจัดไม่ครบห้ามบันทึก; ถ้าครบแล้วให้ขึ้นเตือนยืนยัน
    const handleSaveClick = useCallback(() => {
        if (stats.totalAllocated < stats.totalItems || stats.totalItems === 0) return;
        if (layout.positions.length === 0) return;
        setShowSaveConfirm(true);
    }, [stats.totalAllocated, stats.totalItems, layout.positions.length]);

    // Load AI suggestions (pattern insights + product profiles + packing plan)
    const loadAiSuggestions = useCallback(async () => {
        if (aiSuggestions || !tripData) return;
        setShowAi(true);
        try {
            // Aggregate by product_id for suggestion API (quantity and total weight per product)
            const byProduct = new Map<string, { product_id: string; product_name: string; quantity: number; weight_kg: number }>();
            for (const i of tripItems) {
                const key = i.product_id;
                const totalWeight = (i.weight_kg || 0) * i.quantity;
                const existing = byProduct.get(key);
                if (existing) {
                    existing.quantity += i.quantity;
                    existing.weight_kg += totalWeight;
                } else {
                    byProduct.set(key, {
                        product_id: i.product_id,
                        product_name: i.product_name,
                        quantity: i.quantity,
                        weight_kg: totalWeight,
                    });
                }
            }
            const items = Array.from(byProduct.values());
            const plan = await tripMetricsService.getSimulationSuggestions({
                tripId,
                vehicleId: tripData.vehicle_id ?? null,
                items,
                vehicleMaxPallets: null,
            });
            setAiSuggestions(plan || 'ไม่มีข้อมูลแนะนำสำหรับทริปนี้');
        } catch (err) {
            console.error('[PackingSimulator] AI suggestions error:', err);
            setAiSuggestions('ไม่สามารถโหลดคำแนะนำได้');
        }
    }, [aiSuggestions, tripData, tripItems, tripId]);

    if (loadingTrip) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="w-10 h-10 border-3 border-enterprise-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-500 dark:text-slate-400">กำลังโหลดข้อมูลทริป...</p>
                </div>
            </div>
        );
    }

    if (!tripData) {
        return (
            <div className="text-center py-12">
                <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
                <p className="text-red-600 dark:text-red-400">ไม่พบข้อมูลทริป</p>
            </div>
        );
    }

    const vehicleLabel = tripData.vehicle?.plate || 'ไม่ระบุรถ';
    const driverLabel = tripData.driver?.full_name || 'ไม่ระบุคนขับ';
    const storeCount = tripData.stores?.length || 0;

    return (
        <div className="relative">
            <div className="space-y-6 pb-24">
            {/* Trip Summary Banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 shadow-xl">
                <div className="absolute inset-0 bg-gradient-to-r from-enterprise-600/10 via-blue-600/10 to-indigo-600/10" />
                <div className="relative z-10 flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-enterprise-500 to-blue-600 flex items-center justify-center shadow-lg shadow-enterprise-500/30">
                            <Truck className="text-white" size={24} />
                        </div>
                        <div>
                            <div className="text-xl font-bold text-white">
                                {tripData.trip_number || `ทริป #${tripId.substring(0, 8)}`}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-slate-400">
                                <span className="flex items-center gap-1"><Calendar size={13} />{new Date(tripData.planned_date).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' })}</span>
                                <span className="flex items-center gap-1"><Truck size={13} />{vehicleLabel}</span>
                                <span className="flex items-center gap-1"><Users size={13} />{driverLabel}</span>
                                <span className="flex items-center gap-1"><MapPin size={13} />{storeCount} ร้าน</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={Box} label="พาเลท" value={stats.pallets} subtext={stats.floors > 0 ? `+ ${stats.floors} พื้นรถ` : undefined} />
                <StatCard icon={Package} label="จัดแล้ว / ทั้งหมด" value={`${stats.totalAllocated} / ${stats.totalItems}`} subtext={`${stats.utilizationPct}% ครบถ้วน`} color={stats.utilizationPct === 100 ? 'text-green-600 dark:text-green-400' : 'text-enterprise-600 dark:text-enterprise-400'} />
                <StatCard icon={Weight} label="น้ำหนักที่จัด" value={`${stats.totalWeight.toFixed(0)} kg`} />
                <StatCard icon={Layers} label="ตำแหน่งทั้งหมด" value={layout.positions.length} />
            </div>

            {/* Unallocated items warning */}
            {stats.totalAllocated < stats.totalItems && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <AlertCircle className="text-amber-500 flex-shrink-0" size={20} />
                    <div>
                        <div className="text-sm font-medium text-amber-800 dark:text-amber-200">
                            ยังจัดไม่ครบ — เหลือ {stats.totalItems - stats.totalAllocated} หน่วย
                        </div>
                        <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                            กดปุ่ม "เพิ่มสินค้า" ในแต่ละพาเลทเพื่อจัดสินค้าที่เหลือ
                        </div>
                    </div>
                </div>
            )}

            {stats.totalAllocated === stats.totalItems && stats.totalItems > 0 && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                    <Check className="text-green-500 flex-shrink-0" size={20} />
                    <div className="text-sm font-medium text-green-800 dark:text-green-200">
                        จัดครบทุกรายการแล้ว! 🎉
                    </div>
                </div>
            )}

            {/* Save error */}
            {saveError && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                    <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-red-800 dark:text-red-200">บันทึกไม่สำเร็จ</div>
                        <div className="text-xs text-red-600 dark:text-red-300 mt-1 break-words">{saveError}</div>
                    </div>
                    <button type="button" onClick={() => setSaveError(null)} className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400">
                        <X size={18} />
                    </button>
                </div>
            )}

            {/* Save success */}
            {saved && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                    <Check className="text-green-500 flex-shrink-0" size={20} />
                    <div className="flex-1">
                        <div className="text-sm font-medium text-green-800 dark:text-green-200">บันทึกการจัดเรียงแล้ว</div>
                        {!embedInDetailView && <div className="text-xs text-green-600 dark:text-green-300 mt-0.5">ดูการจัดเรียงได้ที่หน้ารายละเอียดทริป</div>}
                    </div>
                    <Button variant="outline" size="sm" onClick={onClose} className="border-green-300 text-green-800 dark:text-green-200 hover:bg-green-100 dark:hover:bg-green-900/30">
                        {embedInDetailView ? 'ปิด' : 'กลับไปรายการทริป'}
                    </Button>
                </div>
            )}

            {/* Action Bar */}
            <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" onClick={() => addPosition('pallet')}>
                    <Plus size={16} className="mr-1" /> เพิ่มพาเลท
                </Button>
                <Button variant="outline" onClick={() => addPosition('floor')}>
                    <Plus size={16} className="mr-1" /> พื้นรถ
                </Button>
                <div className="flex-1" />
                <Button variant="outline" onClick={undo} disabled={historyIndex <= 0}>
                    <Undo2 size={16} />
                </Button>
                <Button variant="outline" onClick={redo} disabled={historyIndex >= history.length - 1}>
                    <Redo2 size={16} />
                </Button>
                <Button variant="outline" onClick={loadAiSuggestions}>
                    <Sparkles size={16} className="mr-1" /> AI แนะนำ
                </Button>
                <Button
                    variant="primary"
                    onClick={handleSaveClick}
                    isLoading={saving}
                    disabled={
                        layout.positions.length === 0 ||
                        stats.totalAllocated === 0 ||
                        stats.totalAllocated < stats.totalItems
                    }
                    title={
                        stats.totalAllocated < stats.totalItems && stats.totalItems > 0
                            ? 'จัดให้ครบทุกชิ้นก่อนจึงจะบันทึกได้'
                            : undefined
                    }
                >
                    <Save size={16} className="mr-1" />
                    {saved ? 'บันทึกแล้ว ✓' : 'บันทึกการจัดเรียง'}
                </Button>
            </div>

            <ConfirmDialog
                isOpen={showSaveConfirm}
                title="ยืนยันการบันทึก"
                message="คุณต้องการบันทึกการจัดเรียงจริงหรือไม่? กรุณาตรวจสอบให้แน่ใจว่าจัดครบทุกชิ้นแล้ว"
                confirmText="บันทึก"
                cancelText="ยกเลิก"
                variant="info"
                onConfirm={() => handleApply()}
                onCancel={() => setShowSaveConfirm(false)}
            />

            <ConfirmDialog
                isOpen={positionToDelete != null}
                title="ยืนยันการลบ"
                message={(() => {
                    const pos = layout.positions.find(p => p.id === positionToDelete);
                    if (!pos) return 'ต้องการลบตำแหน่งนี้จริงหรือไม่?';
                    const label = pos.position_type === 'pallet' ? `พาเลท #${pos.position_index}` : `พื้นรถ #${pos.position_index}`;
                    const itemCount = pos.items.reduce((s, i) => s + i.quantity, 0);
                    if (itemCount > 0) {
                        return `ต้องการลบ${label} จริงหรือไม่? ตำแหน่งนี้มีสินค้าจัดไว้แล้ว ${itemCount} ชิ้น — การลบจะนำสินค้าออกจากตำแหน่งนี้ (สามารถจัดใหม่ได้)`;
                    }
                    return `ต้องการลบ${label} จริงหรือไม่?`;
                })()}
                confirmText="ลบ"
                cancelText="ยกเลิก"
                variant="danger"
                onConfirm={() => {
                    if (positionToDelete) {
                        removePosition(positionToDelete);
                        setPositionToDelete(null);
                    }
                }}
                onCancel={() => setPositionToDelete(null)}
            />

            {/* AI Suggestions Panel */}
            {showAi && aiSuggestions && (
                <Card className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/20 dark:to-blue-950/20 border-violet-200 dark:border-violet-800">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Sparkles size={18} className="text-violet-500" />
                            <span className="font-semibold text-violet-900 dark:text-violet-200">AI แนะนำการจัดเรียง</span>
                        </div>
                        <button onClick={() => setShowAi(false)} className="p-1 rounded hover:bg-violet-100 dark:hover:bg-violet-900/30">
                            <X size={16} className="text-violet-400" />
                        </button>
                    </div>
                    <pre className="text-sm text-violet-800 dark:text-violet-200 whitespace-pre-wrap font-sans leading-relaxed">
                        {aiSuggestions}
                    </pre>
                </Card>
            )}

            {/* Pallet Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {layout.positions.map((pos) => {
                    const posWeight = pos.items.reduce((sum, i) => {
                        const w = i.weight_kg ?? tripItems.find(t => t.id === i.delivery_trip_item_id)?.weight_kg ?? 0;
                        return sum + w * i.quantity;
                    }, 0);
                    const posItemCount = pos.items.reduce((sum, i) => sum + i.quantity, 0);
                    // จัดกลุ่ม: สินค้าชนิดเดียวกันในพาเลทเดียว = 1 รายการ (ลีโอ 60 ลัง 4 ชั้น → 1 รายการ)
                    const positionGroups = (() => {
                        const byKey = new Map<string, { product_id: string; delivery_trip_item_id: string; product_name: string; product_code: string; category: string; unit: string; weight_kg: number | null; totalQty: number; layerCount: number; items: PositionItem[] }>();
                        for (const it of pos.items) {
                            const key = `${it.product_id}|${it.delivery_trip_item_id}`;
                            if (!byKey.has(key)) {
                                byKey.set(key, { product_id: it.product_id, delivery_trip_item_id: it.delivery_trip_item_id, product_name: it.product_name, product_code: it.product_code, category: it.category, unit: it.unit, weight_kg: it.weight_kg, totalQty: 0, layerCount: 0, items: [] });
                            }
                            const g = byKey.get(key)!;
                            g.totalQty += it.quantity;
                            g.layerCount += 1;
                            g.items.push(it);
                        }
                        return Array.from(byKey.values());
                    })();
                    const isPallet = pos.position_type === 'pallet';
                    const headerGradient = isPallet
                        ? 'from-enterprise-500 to-blue-600'
                        : 'from-slate-500 to-slate-600';

                    return (
                        <div
                            key={pos.id}
                            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300"
                        >
                            {/* Position Header */}
                            <div className={`bg-gradient-to-r ${headerGradient} p-4`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                            {isPallet ? <Box className="text-white" size={20} /> : <Truck className="text-white" size={20} />}
                                        </div>
                                        <div>
                                            <div className="font-bold text-white text-lg">
                                                {isPallet ? `พาเลท #${pos.position_index}` : `พื้นรถ #${pos.position_index}`}
                                                {isPallet && pos.total_layers > 1 && (
                                                    <span className="ml-2 text-white/90 text-sm font-semibold">{pos.total_layers} ชั้น</span>
                                                )}
                                            </div>
                                            <div className="text-white/70 text-xs">
                                                ทั้งหมด {posItemCount} ชิ้น · {positionGroups.length} รายการ · {posWeight.toFixed(0)} kg
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => toggleCollapse(pos.id)}
                                            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                                        >
                                            {pos.collapsed ? <Eye className="text-white" size={16} /> : <EyeOff className="text-white" size={16} />}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPositionToDelete(pos.id)}
                                            className="p-2 rounded-lg bg-white/10 hover:bg-red-500/30 transition-colors"
                                            title="ลบพาเลท"
                                        >
                                            <Trash2 className="text-white" size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Position Content: ซ่อน = แสดงแค่รายการคร่าวๆ, เปิด = แสดงเต็ม */}
                            {pos.collapsed ? (
                                <div className="p-3 border-t border-slate-100 dark:border-slate-800">
                                    {pos.items.length > 0 ? (() => {
                                        const byProduct = new Map<string, { name: string; unit: string; parts: { store: string; qty: number }[] }>();
                                        for (const it of pos.items) {
                                            const storeName = tripItems.find(t => t.id === it.delivery_trip_item_id)?.store_name || 'ไม่ระบุร้าน';
                                            const ex = byProduct.get(it.product_id);
                                            if (!ex) byProduct.set(it.product_id, { name: it.product_name, unit: it.unit, parts: [{ store: storeName, qty: it.quantity }] });
                                            else {
                                                const part = ex.parts.find(p => p.store === storeName);
                                                if (part) part.qty += it.quantity;
                                                else ex.parts.push({ store: storeName, qty: it.quantity });
                                            }
                                        }
                                        return (
                                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-600 dark:text-slate-400">
                                                {Array.from(byProduct.entries()).map(([, v]) => {
                                                    const total = v.parts.reduce((s, p) => s + p.qty, 0);
                                                    const detail = v.parts.length > 1 ? v.parts.map(p => `${p.store} ${p.qty} ${v.unit}`).join(', ') : `${total} ${v.unit}`;
                                                    return (
                                                        <span key={v.name} className="bg-slate-100 dark:bg-slate-800/60 rounded px-2 py-0.5">
                                                            {v.name}: {detail}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })() : (
                                        <p className="text-xs text-slate-400 dark:text-slate-500">ยังไม่มีสินค้าในตำแหน่งนี้</p>
                                    )}
                                </div>
                            ) : (
                                <div className="p-4 space-y-3">
                                    {/* สรุป: สินค้าแยกร้าน (เบียร์: ร้าน A 75 ลัง, ร้าน B 25 ลัง) */}
                                    {pos.items.length > 0 && (() => {
                                        const byProduct = new Map<string, { name: string; unit: string; parts: { store: string; qty: number }[] }>();
                                        for (const it of pos.items) {
                                            const storeName = tripItems.find(t => t.id === it.delivery_trip_item_id)?.store_name || 'ไม่ระบุร้าน';
                                            const ex = byProduct.get(it.product_id);
                                            if (!ex) byProduct.set(it.product_id, { name: it.product_name, unit: it.unit, parts: [{ store: storeName, qty: it.quantity }] });
                                            else {
                                                const part = ex.parts.find(p => p.store === storeName);
                                                if (part) part.qty += it.quantity;
                                                else ex.parts.push({ store: storeName, qty: it.quantity });
                                            }
                                        }
                                        return (
                                            <div className="rounded-lg bg-slate-100/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-2.5">
                                                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">ในตำแหน่งนี้</div>
                                                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-700 dark:text-slate-300">
                                                    {Array.from(byProduct.entries()).map(([, v]) => (
                                                        <span key={v.name}>
                                                            {v.name}: {v.parts.map(p => `${p.store} ${p.qty} ${v.unit}`).join(', ')}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                    {/* Layers + Detailed mode (pallets only) */}
                                    {isPallet && (
                                        <div className="flex flex-wrap items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-800">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-xs text-slate-500 dark:text-slate-400">จำนวนชั้น</span>
                                                <button type="button" onClick={() => setTotalLayers(pos.id, pos.total_layers - 1)} disabled={pos.total_layers <= 1} className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center disabled:opacity-40">
                                                    <Minus size={12} />
                                                </button>
                                                <span className="min-w-[2rem] text-center font-semibold text-sm text-slate-900 dark:text-slate-100 tabular-nums">{pos.total_layers}</span>
                                                <button type="button" onClick={() => setTotalLayers(pos.id, pos.total_layers + 1)} className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center">
                                                    <Plus size={12} />
                                                </button>
                                            </div>
                                            {pos.total_layers > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => toggleDetailedMode(pos.id)}
                                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${pos.detailedMode ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-violet-50 dark:hover:bg-violet-900/20'}`}
                                                >
                                                    {pos.detailedMode ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                                                    {pos.detailedMode ? 'โหมดละเอียด' : 'แยกตามชั้น'}
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {pos.detailedMode && isPallet ? (
                                        /* Per-layer layout */
                                        <>
                                            {Array.from({ length: pos.total_layers }, (_, li) => {
                                                const layerItems = pos.items.filter(i => i.layer_index === li);
                                                const layerLabel = li === 0 ? 'ชั้น 1 (ล่าง)' : li === pos.total_layers - 1 ? `ชั้น ${li + 1} (บน)` : `ชั้น ${li + 1}`;
                                                return (
                                                    <div key={li} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-3">
                                                        <div className="flex items-center justify-between mb-2 gap-2">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{layerLabel}</span>
                                                                {pos.total_layers > 1 && (
                                                                    <span className="flex items-center gap-0.5">
                                                                        {li > 0 && (
                                                                            <button type="button" onClick={() => swapLayers(pos.id, li, li - 1)} title="สลับกับชั้นล่าง" className="p-1 rounded bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-600 dark:text-slate-300">
                                                                                <ChevronDown size={14} />
                                                                            </button>
                                                                        )}
                                                                        {li < pos.total_layers - 1 && (
                                                                            <button type="button" onClick={() => swapLayers(pos.id, li, li + 1)} title="สลับกับชั้นบน" className="p-1 rounded bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-600 dark:text-slate-300">
                                                                                <ChevronUp size={14} />
                                                                            </button>
                                                                        )}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <button type="button" onClick={() => setShowItemPicker({ posId: pos.id, layerIndex: li })} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-enterprise-300 dark:border-enterprise-600 bg-enterprise-50 dark:bg-enterprise-900/30 text-enterprise-700 dark:text-enterprise-300 text-xs font-semibold shadow-sm hover:bg-enterprise-100 dark:hover:bg-enterprise-800/50 hover:border-enterprise-400 dark:hover:border-enterprise-500 hover:shadow active:scale-[0.98] transition-all">
                                                                <Plus size={12} /> เพิ่มสินค้า
                                                            </button>
                                                        </div>
                                                        {layerItems.length === 0 ? (
                                                            <p className="text-xs text-slate-400 dark:text-slate-500 py-2">ยังไม่มีสินค้าในชั้นนี้</p>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                {layerItems.map(item => {
                                                                    const catColor = getCategoryColor(item.category);
                                                                    const tripItem = tripItems.find(ti => ti.id === item.delivery_trip_item_id);
                                                                    const w = item.weight_kg ?? tripItem?.weight_kg ?? 0;
                                                                    const itemWeight = w * item.quantity;
                                                                    const totalQty = tripItem?.quantity || 0;
                                                                    const usedTotal = allocated.get(item.delivery_trip_item_id) || 0;
                                                                    const usedElsewhere = usedTotal - item.quantity;
                                                                    const maxCanAdd = totalQty - usedElsewhere;
                                                                    const isEditing = quantityEdit?.posId === pos.id && quantityEdit?.itemId === item.delivery_trip_item_id && quantityEdit?.layerIndex === li;
                                                                    const displayQty = isEditing ? quantityEdit!.value : String(item.quantity);
                                                                    return (
                                                                        <div key={`${item.delivery_trip_item_id}-${li}`} className={`flex flex-col sm:flex-row sm:items-center gap-2 p-2 rounded-lg ${catColor.bg} border ${catColor.border}`}>
                                                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                                                <Package className={`flex-shrink-0 ${catColor.text}`} size={14} />
                                                                                <div className="flex-1 min-w-0">
                                                                                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100 break-words" title={tripItem?.store_name ? `${item.product_name} · ${tripItem.store_name}` : item.product_name}>
                                                                                        {item.product_name}
                                                                                        {tripItem?.store_name && <span className="text-enterprise-600 dark:text-enterprise-400 ml-1">· {tripItem.store_name}</span>}
                                                                                    </div>
                                                                                    <div className="text-xs text-slate-500 dark:text-slate-400 break-words">{item.product_code} · {itemWeight} kg</div>
                                                                                </div>
                                                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                                                    <button type="button" onClick={() => adjustItemQty(pos.id, item.delivery_trip_item_id, -1, li)} disabled={item.quantity <= 1} className="w-6 h-6 rounded bg-white dark:bg-slate-800 border flex items-center justify-center disabled:opacity-40"><Minus size={10} /></button>
                                                                                    <input
                                                                                        type="number"
                                                                                        min={1}
                                                                                        max={maxCanAdd}
                                                                                        value={displayQty}
                                                                                        onChange={e => setQuantityEdit(prev => (prev?.posId === pos.id && prev?.itemId === item.delivery_trip_item_id && prev?.layerIndex === li ? { ...prev, value: e.target.value } : { posId: pos.id, itemId: item.delivery_trip_item_id, layerIndex: li, value: e.target.value }))}
                                                                                        onFocus={() => setQuantityEdit({ posId: pos.id, itemId: item.delivery_trip_item_id, layerIndex: li, value: String(item.quantity) })}
                                                                                        onBlur={e => {
                                                                                            const raw = (e.target as HTMLInputElement).value;
                                                                                            const n = parseInt(raw, 10);
                                                                                            const clamped = isNaN(n) || n < 1 ? 1 : Math.min(n, maxCanAdd);
                                                                                            setItemQuantity(pos.id, item.delivery_trip_item_id, clamped, li);
                                                                                            setQuantityEdit(null);
                                                                                        }}
                                                                                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                                                                        className="w-12 text-center py-1 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums"
                                                                                    />
                                                                                    <button type="button" onClick={() => adjustItemQty(pos.id, item.delivery_trip_item_id, 1, li)} disabled={item.quantity >= maxCanAdd} className="w-6 h-6 rounded bg-white dark:bg-slate-800 border flex items-center justify-center disabled:opacity-40"><Plus size={10} /></button>
                                                                                    <button type="button" onClick={() => removeItemFromLayer(pos.id, item.delivery_trip_item_id, li)} className="w-6 h-6 rounded border border-red-200 dark:border-red-800 text-red-500 flex items-center justify-center"><X size={10} /></button>
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex flex-wrap gap-1.5 w-full sm:w-auto sm:justify-end min-w-0">
                                                                                    {(() => {
                                                                                        const configs: PackingStandard[] = packingConfigs.get(item.product_id)?.length
                                                                                            ? packingConfigs.get(item.product_id)!
                                                                                            : packingStandards.get(item.product_id) ? [packingStandards.get(item.product_id)!] : [];
                                                                                        const uniquePerLayer = [...new Set(configs.map(c => c.units_per_layer).filter((u): u is number => u > 0))];
                                                                                        return uniquePerLayer.map((upl) => (
                                                                                            <button
                                                                                                key={upl}
                                                                                                type="button"
                                                                                                onClick={() => setItemQuantity(pos.id, item.delivery_trip_item_id, Math.min(maxCanAdd, upl), li)}
                                                                                                className="text-xs font-semibold px-2.5 py-1 rounded-lg border-2 border-enterprise-300 dark:border-enterprise-600 bg-enterprise-100 dark:bg-enterprise-900/50 text-enterprise-700 dark:text-enterprise-300 cursor-pointer shadow-sm hover:bg-enterprise-200 dark:hover:bg-enterprise-800/60 hover:shadow hover:border-enterprise-400 active:scale-[0.98] transition-all"
                                                                                            >
                                                                                                ชั้นละ {upl}
                                                                                            </button>
                                                                                        ));
                                                                                    })()}
                                                                                    {(packingConfigs.get(item.product_id)?.length
                                                                                        ? packingConfigs.get(item.product_id)!
                                                                                        : packingStandards.get(item.product_id) ? [packingStandards.get(item.product_id)!] : []
                                                                                    ).map((std) => {
                                                                                        const multiStore = tripItems.filter(t => t.product_id === item.product_id).length > 1;
                                                                                        return (
                                                                                        <button
                                                                                            key={std.total_units}
                                                                                            type="button"
                                                                                            onClick={() => multiStore ? fillFullPalletByProduct(pos.id, item.product_id, std) : fillFullPalletForGroup(pos.id, item.product_id, item.delivery_trip_item_id, std)}
                                                                                            title={multiStore ? `เต็มพาเลท ${std.total_units} (แบ่งทั้งร้าน) · ${std.layers} ชั้น · ชั้นละ ${std.units_per_layer}` : `เต็มพาเลท ${std.total_units} · ${std.layers} ชั้น · ชั้นละ ${std.units_per_layer}`}
                                                                                            className="text-xs font-semibold px-2.5 py-1 rounded-lg border-2 border-violet-300 dark:border-violet-600 bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 cursor-pointer shadow-sm hover:bg-violet-200 dark:hover:bg-violet-800/60 hover:shadow hover:border-violet-400 active:scale-[0.98] transition-all"
                                                                                        >
                                                                                            เต็มพาเลท {std.total_units}
                                                                                        </button>
                                                                                    ); })}
                                                                                </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {/* ปุ่มจำนวนชั้นซ้ำด้านล่าง — เพิ่มชั้นได้โดยไม่ต้องเลื่อนขึ้น */}
                                            <div className="sticky bottom-0 flex flex-wrap items-center gap-3 py-3 mt-2 border-t border-slate-200 dark:border-slate-700 rounded-lg bg-slate-100/80 dark:bg-slate-800/50">
                                                <span className="text-xs text-slate-500 dark:text-slate-400">จำนวนชั้น</span>
                                                <button type="button" onClick={() => setTotalLayers(pos.id, pos.total_layers - 1)} disabled={pos.total_layers <= 1} className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 flex items-center justify-center disabled:opacity-40">
                                                    <Minus size={12} />
                                                </button>
                                                <span className="min-w-[2rem] text-center font-semibold text-sm text-slate-900 dark:text-slate-100 tabular-nums">{pos.total_layers}</span>
                                                <button type="button" onClick={() => setTotalLayers(pos.id, pos.total_layers + 1)} className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 flex items-center justify-center">
                                                    <Plus size={12} />
                                                </button>
                                                <span className="text-xs text-slate-400 dark:text-slate-500">เพิ่มชั้นได้ที่นี่</span>
                                            </div>
                                        </>
                                    ) : (
                                        /* Simple list */
                                        <>
                                            {pos.items.length === 0 ? (
                                                <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                                                    <Package className="mx-auto mb-2 text-slate-300 dark:text-slate-600" size={32} />
                                                    <p className="text-sm text-slate-400 dark:text-slate-500">ยังไม่มีสินค้า</p>
                                                    <p className="text-xs text-slate-300 dark:text-slate-600">กดปุ่ม "เพิ่มสินค้า" เพื่อเริ่มจัด</p>
                                                </div>
                                            ) : (
                                                <>
                                                    {positionGroups.map((group) => {
                                                        const catColor = getCategoryColor(group.category);
                                                        const tripItem = tripItems.find(ti => ti.id === group.delivery_trip_item_id);
                                                        const groupWeight = (group.weight_kg ?? tripItem?.weight_kg ?? 0) * group.totalQty;
                                                        const totalQty = tripItem?.quantity || 0;
                                                        const usedTotal = allocated.get(group.delivery_trip_item_id) || 0;
                                                        const usedElsewhere = usedTotal - group.totalQty;
                                                        const maxCanAdd = totalQty - usedElsewhere;
                                                        const isEditingGroup = quantityEdit?.posId === pos.id && quantityEdit?.itemId === group.delivery_trip_item_id && quantityEdit?.layerIndex == null;
                                                        const displayQty = isEditingGroup ? quantityEdit!.value : String(group.totalQty);
                                                        return (
                                                            <div
                                                                key={`${group.product_id}|${group.delivery_trip_item_id}`}
                                                                className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-xl ${catColor.bg} border ${catColor.border} transition-all duration-200 hover:shadow-md`}
                                                            >
                                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                                    <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${catColor.gradient} flex items-center justify-center flex-shrink-0`}>
                                                                        <Package className="text-white" size={14} />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100 break-words" title={tripItem?.store_name ? `${group.product_name} · ${tripItem.store_name}` : group.product_name}>
                                                                            {group.product_name}
                                                                            {tripItem?.store_name && <span className="text-enterprise-600 dark:text-enterprise-400 ml-1">· {tripItem.store_name}</span>}
                                                                        </div>
                                                                        <div className="text-xs text-slate-500 dark:text-slate-400 break-words">
                                                                            {group.product_code} · {groupWeight > 0 ? `${groupWeight.toFixed(1)} kg` : group.unit}
                                                                            {group.layerCount > 1 && <span className="text-enterprise-600 dark:text-enterprise-400 ml-1">· {group.layerCount} ชั้น</span>}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                                                                    <button type="button" onClick={() => adjustGroupQty(pos.id, group.product_id, group.delivery_trip_item_id, -1)} disabled={group.totalQty <= 1} className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors">
                                                                        <Minus size={12} />
                                                                    </button>
                                                                    <input
                                                                        type="number"
                                                                        min={1}
                                                                        max={maxCanAdd}
                                                                        value={displayQty}
                                                                        onChange={e => setQuantityEdit(prev => (prev?.posId === pos.id && prev?.itemId === group.delivery_trip_item_id && prev?.layerIndex == null ? { ...prev, value: e.target.value } : { posId: pos.id, itemId: group.delivery_trip_item_id, layerIndex: null, value: e.target.value }))}
                                                                        onFocus={() => setQuantityEdit({ posId: pos.id, itemId: group.delivery_trip_item_id, layerIndex: null, value: String(group.totalQty) })}
                                                                        onBlur={e => {
                                                                            const raw = (e.target as HTMLInputElement).value;
                                                                            const n = parseInt(raw, 10);
                                                                            const clamped = isNaN(n) || n < 1 ? 1 : Math.min(n, maxCanAdd);
                                                                            setGroupQuantity(pos.id, group.product_id, group.delivery_trip_item_id, clamped);
                                                                            setQuantityEdit(null);
                                                                        }}
                                                                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                                                        className="w-14 text-center py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-enterprise-500"
                                                                    />
                                                                    <button type="button" onClick={() => adjustGroupQty(pos.id, group.product_id, group.delivery_trip_item_id, 1)} disabled={group.totalQty >= maxCanAdd} className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors">
                                                                        <Plus size={12} />
                                                                    </button>
                                                                    <button type="button" onClick={() => removeGroupFromPosition(pos.id, group.product_id, group.delivery_trip_item_id)} className="w-7 h-7 rounded-lg border border-red-200 dark:border-red-800 text-red-500 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors ml-1">
                                                                        <X size={12} />
                                                                    </button>
                                                                    {(packingConfigs.get(group.product_id)?.length
                                                                        ? packingConfigs.get(group.product_id)!
                                                                        : packingStandards.get(group.product_id) ? [packingStandards.get(group.product_id)!] : []
                                                                    ).map((std) => {
                                                                        const multiStore = tripItems.filter(t => t.product_id === group.product_id).length > 1;
                                                                        const totalRemainingProduct = tripItems.filter(t => t.product_id === group.product_id).reduce((s, t) => s + (t.quantity - (allocated.get(t.id) || 0)), 0);
                                                                        return (
                                                                        <button
                                                                            key={std.total_units}
                                                                            type="button"
                                                                            onClick={() => multiStore ? fillFullPalletByProduct(pos.id, group.product_id, std) : fillFullPalletForGroup(pos.id, group.product_id, group.delivery_trip_item_id, std)}
                                                                            disabled={multiStore ? totalRemainingProduct <= 0 : maxCanAdd <= 0}
                                                                            title={multiStore ? `เต็มพาเลท ${std.total_units} (แบ่งทั้งร้าน) · ${std.layers} ชั้น · ชั้นละ ${std.units_per_layer}` : `เต็มพาเลท ${std.total_units} ชิ้น · ${std.layers} ชั้น · ชั้นละ ${std.units_per_layer}`}
                                                                            className="ml-1 px-2.5 py-1 rounded-lg border-2 border-enterprise-300 dark:border-enterprise-600 text-xs font-semibold bg-enterprise-100 dark:bg-enterprise-900/50 text-enterprise-700 dark:text-enterprise-300 cursor-pointer shadow-sm hover:bg-enterprise-200 dark:hover:bg-enterprise-800/60 hover:shadow hover:border-enterprise-400 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
                                                                        >
                                                                            เต็มพาเลท {std.total_units}
                                                                        </button>
                                                                    ); })}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </>
                                            )}

                                            <button type="button" onClick={() => setShowItemPicker(pos.id)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-enterprise-300 dark:border-enterprise-600 bg-enterprise-50 dark:bg-enterprise-900/30 text-enterprise-700 dark:text-enterprise-300 hover:bg-enterprise-100 dark:hover:bg-enterprise-800/50 hover:border-enterprise-400 dark:hover:border-enterprise-500 hover:shadow-md transition-all text-sm font-semibold shadow-sm cursor-pointer active:scale-[0.99]">
                                                <Plus size={16} />
                                                เพิ่มสินค้า
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Empty state */}

            {layout.positions.length === 0 && (
                <div className="text-center py-16">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-enterprise-500 to-blue-600 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-enterprise-500/30">
                        <Box className="text-white" size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">เริ่มจัดเรียง</h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
                        กดปุ่ม "เพิ่มพาเลท" หรือ "พื้นรถ" เพื่อสร้างตำแหน่งจัดสินค้า
                        แล้วเพิ่มสินค้าเข้าตำแหน่งที่ต้องการ
                    </p>
                    <div className="flex items-center justify-center gap-3">
                        <Button variant="primary" onClick={() => addPosition('pallet')}>
                            <Plus size={16} className="mr-1" /> เพิ่มพาเลท
                        </Button>
                        <Button variant="outline" onClick={() => addPosition('floor')}>
                            <Plus size={16} className="mr-1" /> พื้นรถ
                        </Button>
                    </div>
                </div>
            )}
            </div>

            {/* Sticky bottom bar: เพิ่มพาเลท/พื้นรถ — ไม่ต้องเลื่อนขึ้นบนเมื่อมีหลายพาเลท */}
            {layout.positions.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-center gap-3 py-3 px-4 bg-white/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-700 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.3)] backdrop-blur-sm">
                    <Button variant="primary" size="sm" onClick={() => addPosition('pallet')}>
                        <Plus size={18} className="mr-1.5" /> เพิ่มพาเลท
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => addPosition('floor')}>
                        <Plus size={18} className="mr-1.5" /> พื้นรถ
                    </Button>
                </div>
            )}

            {/* Item Picker Modal */}
            {showItemPicker && (
                <ItemPicker
                    itemsPerStore={pickerItemsPerStore}
                    itemsAggregated={pickerItemsAggregated}
                    packingStandards={packingStandards}
                    packingConfigs={packingConfigs}
                    onAddByItem={(itemId, qty) => {
                        if (typeof showItemPicker === 'string') {
                            addItemToPosition(showItemPicker, itemId, qty);
                        } else {
                            addItemToLayer(showItemPicker.posId, itemId, qty, showItemPicker.layerIndex);
                        }
                        setShowItemPicker(null);
                    }}
                    onAddByProduct={(productId, qty) => {
                        if (typeof showItemPicker === 'string') {
                            addProductToPosition(showItemPicker, productId, qty);
                        } else {
                            addProductToLayer(showItemPicker.posId, productId, qty, showItemPicker.layerIndex);
                        }
                        setShowItemPicker(null);
                    }}
                    onAddByProductWithUnitsPerLayer={typeof showItemPicker === 'string' ? (productId, unitsPerLayer) => { addProductToPositionWithUnitsPerLayer(showItemPicker, productId, unitsPerLayer); setShowItemPicker(null); } : undefined}
                    onAddByItemWithUnitsPerLayer={typeof showItemPicker === 'string' ? (itemId, unitsPerLayer) => { addItemToPositionWithUnitsPerLayer(showItemPicker, itemId, unitsPerLayer); setShowItemPicker(null); } : undefined}
                    onClose={() => setShowItemPicker(null)}
                />
            )}
        </div>
    );
};
