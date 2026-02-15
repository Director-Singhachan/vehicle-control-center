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

// Item Picker Modal
const ItemPicker: React.FC<{
    items: TripItem[];
    allocated: Map<string, number>;
    onAdd: (itemId: string, qty: number) => void;
    onClose: () => void;
}> = ({ items, allocated, onAdd, onClose }) => {
    const [search, setSearch] = useState('');
    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return items.filter(i =>
            !q || i.product_name.toLowerCase().includes(q) || i.product_code.toLowerCase().includes(q)
        );
    }, [items, search]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">เพิ่มสินค้าลงตำแหน่ง</h3>
                        <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                            <X size={18} className="text-slate-400" />
                        </button>
                    </div>
                    <input
                        type="text"
                        placeholder="ค้นหาสินค้า..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500"
                        autoFocus
                    />
                </div>
                <div className="overflow-y-auto max-h-[60vh] p-2">
                    {filtered.map(item => {
                        const used = allocated.get(item.id) || 0;
                        const remaining = item.quantity - used;
                        const catColor = getCategoryColor(item.category);
                        if (remaining <= 0) return null;

                        return (
                            <button
                                key={item.id}
                                onClick={() => { onAdd(item.id, Math.min(remaining, 1)); onClose(); }}
                                className="w-full text-left flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                            >
                                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${catColor.gradient} flex items-center justify-center flex-shrink-0`}>
                                    <Package className="text-white" size={16} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                        {item.product_name}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                        {item.product_code} · {item.category} · {item.unit}
                                    </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <div className="text-sm font-semibold text-enterprise-600 dark:text-enterprise-400">
                                        เหลือ {remaining}
                                    </div>
                                    <div className="text-xs text-slate-400">
                                        จาก {item.quantity}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// ==================== Main Component ====================
export const PackingSimulator: React.FC<SimulatorProps> = ({ tripId, onClose }) => {
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
                            weight_kg: (product as any).weight_kg ?? null,
                            store_name: store.store?.customer_name || undefined,
                        });
                    }
                }
                setTripItems(Array.from(itemMap.values()));

                // Try to load draft from localStorage
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
            } catch (err) {
                console.error('[PackingSimulator] Error loading trip:', err);
            } finally {
                setLoadingTrip(false);
            }
        };
        load();
    }, [tripId, draftKey]);

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

    // Stats
    const stats = useMemo(() => {
        const pallets = layout.positions.filter(p => p.position_type === 'pallet').length;
        const floors = layout.positions.filter(p => p.position_type === 'floor').length;
        let totalWeight = 0;
        let totalItems = 0;
        let totalAllocated = 0;

        for (const pos of layout.positions) {
            for (const item of pos.items) {
                totalAllocated += item.quantity;
                if (item.weight_kg) {
                    totalWeight += item.weight_kg * item.quantity;
                }
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

    // Add item to position
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
                // Check if this item already exists in this position
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

    // Remove item from position
    const removeItemFromPosition = useCallback((posId: string, itemId: string) => {
        push({
            positions: layout.positions.map(pos =>
                pos.id !== posId ? pos : { ...pos, items: pos.items.filter(i => i.delivery_trip_item_id !== itemId) }
            ),
        });
    }, [layout, push]);

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

    // Remove item from a specific layer
    const removeItemFromLayer = useCallback((posId: string, itemId: string, layerIndex: number) => {
        push({
            positions: layout.positions.map(pos =>
                pos.id !== posId ? pos : { ...pos, items: pos.items.filter(i => !(i.delivery_trip_item_id === itemId && i.layer_index === layerIndex)) }
            ),
        });
    }, [layout, push]);

    // Save to DB (apply simulation)
    const [saveError, setSaveError] = useState<string | null>(null);
    const handleApply = useCallback(async () => {
        if (layout.positions.length === 0) return;
        setSaving(true);
        setSaveError(null);
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
            setTimeout(() => setSaved(false), 5000);
        } catch (err: unknown) {
            console.error('[PackingSimulator] Save error:', err);
            const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? String(err);
            const detail = (err as { error?: { message?: string }; details?: string })?.error?.message ?? (err as { details?: string })?.details;
            setSaveError(detail || msg || 'ไม่สามารถบันทึกการจัดเรียงได้');
        } finally {
            setSaving(false);
        }
    }, [layout, tripId, draftKey]);

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
        <div className="space-y-6">
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
                        <div className="text-xs text-green-600 dark:text-green-300 mt-0.5">ดูการจัดเรียงได้ที่หน้ารายละเอียดทริป</div>
                    </div>
                    <Button variant="outline" size="sm" onClick={onClose} className="border-green-300 text-green-800 dark:text-green-200 hover:bg-green-100 dark:hover:bg-green-900/30">
                        กลับไปรายการทริป
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
                    onClick={handleApply}
                    isLoading={saving}
                    disabled={layout.positions.length === 0 || stats.totalAllocated === 0}
                >
                    <Save size={16} className="mr-1" />
                    {saved ? 'บันทึกแล้ว ✓' : 'บันทึกการจัดเรียง'}
                </Button>
            </div>

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
                {layout.positions.map(pos => {
                    const posWeight = pos.items.reduce((sum, i) => sum + (i.weight_kg || 0) * i.quantity, 0);
                    const posItemCount = pos.items.reduce((sum, i) => sum + i.quantity, 0);
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
                                                {posItemCount} รายการ · {posWeight.toFixed(0)} kg
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
                                            onClick={() => removePosition(pos.id)}
                                            className="p-2 rounded-lg bg-white/10 hover:bg-red-500/30 transition-colors"
                                        >
                                            <Trash2 className="text-white" size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Position Content */}
                            {!pos.collapsed && (
                                <div className="p-4 space-y-3">
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
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{layerLabel}</span>
                                                            <button type="button" onClick={() => setShowItemPicker({ posId: pos.id, layerIndex: li })} className="text-xs text-enterprise-600 dark:text-enterprise-400 hover:underline flex items-center gap-1">
                                                                <Plus size={12} /> เพิ่มสินค้า
                                                            </button>
                                                        </div>
                                                        {layerItems.length === 0 ? (
                                                            <p className="text-xs text-slate-400 dark:text-slate-500 py-2">ยังไม่มีสินค้าในชั้นนี้</p>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                {layerItems.map(item => {
                                                                    const catColor = getCategoryColor(item.category);
                                                                    const itemWeight = (item.weight_kg || 0) * item.quantity;
                                                                    const tripItem = tripItems.find(ti => ti.id === item.delivery_trip_item_id);
                                                                    const totalQty = tripItem?.quantity || 0;
                                                                    const usedTotal = allocated.get(item.delivery_trip_item_id) || 0;
                                                                    const usedElsewhere = usedTotal - item.quantity;
                                                                    const maxCanAdd = totalQty - usedElsewhere;
                                                                    const isEditing = quantityEdit?.posId === pos.id && quantityEdit?.itemId === item.delivery_trip_item_id && quantityEdit?.layerIndex === li;
                                                                    const displayQty = isEditing ? quantityEdit!.value : String(item.quantity);
                                                                    return (
                                                                        <div key={`${item.delivery_trip_item_id}-${li}`} className={`flex items-center gap-2 p-2 rounded-lg ${catColor.bg} border ${catColor.border}`}>
                                                                            <Package className={`flex-shrink-0 ${catColor.text}`} size={14} />
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{item.product_name}</div>
                                                                                <div className="text-xs text-slate-500 dark:text-slate-400">{item.product_code} · {(item.weight_kg || 0) * item.quantity} kg</div>
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
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
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
                                                    {pos.items.map(item => {
                                                        const catColor = getCategoryColor(item.category);
                                                        const itemWeight = (item.weight_kg || 0) * item.quantity;
                                                        const tripItem = tripItems.find(ti => ti.id === item.delivery_trip_item_id);
                                                        const totalQty = tripItem?.quantity || 0;
                                                        const usedTotal = allocated.get(item.delivery_trip_item_id) || 0;
                                                        const usedElsewhere = usedTotal - item.quantity;
                                                        const maxCanAdd = totalQty - usedElsewhere;
                                                        const layerKey = item.layer_index ?? null;
                                                        const isEditing = quantityEdit?.posId === pos.id && quantityEdit?.itemId === item.delivery_trip_item_id && quantityEdit?.layerIndex === layerKey;
                                                        const displayQty = isEditing ? quantityEdit!.value : String(item.quantity);
                                                        return (
                                                            <div
                                                                key={item.delivery_trip_item_id + (item.layer_index ?? 'n')}
                                                                className={`flex items-center gap-3 p-3 rounded-xl ${catColor.bg} border ${catColor.border} transition-all duration-200 hover:shadow-md`}
                                                            >
                                                                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${catColor.gradient} flex items-center justify-center flex-shrink-0`}>
                                                                    <Package className="text-white" size={14} />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{item.product_name}</div>
                                                                    <div className="text-xs text-slate-500 dark:text-slate-400">{item.product_code} · {itemWeight > 0 ? `${itemWeight.toFixed(1)} kg` : item.unit}</div>
                                                                    {isPallet && pos.total_layers > 1 && !pos.detailedMode && (
                                                                        <div className="text-xs text-enterprise-600 dark:text-enterprise-400 mt-0.5 font-medium">
                                                                            ชั้น 1–{pos.total_layers} · ชั้นละ {Math.round(item.quantity / pos.total_layers)} ชิ้น
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                                                    <button type="button" onClick={() => adjustItemQty(pos.id, item.delivery_trip_item_id, -1, layerKey)} disabled={item.quantity <= 1} className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors">
                                                                        <Minus size={12} />
                                                                    </button>
                                                                    <input
                                                                        type="number"
                                                                        min={1}
                                                                        max={maxCanAdd}
                                                                        value={displayQty}
                                                                        onChange={e => setQuantityEdit(prev => (prev?.posId === pos.id && prev?.itemId === item.delivery_trip_item_id && prev?.layerIndex === layerKey ? { ...prev, value: e.target.value } : { posId: pos.id, itemId: item.delivery_trip_item_id, layerIndex: layerKey, value: e.target.value }))}
                                                                        onFocus={() => setQuantityEdit({ posId: pos.id, itemId: item.delivery_trip_item_id, layerIndex: layerKey, value: String(item.quantity) })}
                                                                        onBlur={e => {
                                                                            const raw = (e.target as HTMLInputElement).value;
                                                                            const n = parseInt(raw, 10);
                                                                            const clamped = isNaN(n) || n < 1 ? 1 : Math.min(n, maxCanAdd);
                                                                            setItemQuantity(pos.id, item.delivery_trip_item_id, clamped, layerKey ?? undefined);
                                                                            setQuantityEdit(null);
                                                                        }}
                                                                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                                                        className="w-14 text-center py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-enterprise-500"
                                                                    />
                                                                    <button type="button" onClick={() => adjustItemQty(pos.id, item.delivery_trip_item_id, 1, layerKey)} disabled={item.quantity >= maxCanAdd} className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors">
                                                                        <Plus size={12} />
                                                                    </button>
                                                                    <button type="button" onClick={() => pos.detailedMode ? removeItemFromLayer(pos.id, item.delivery_trip_item_id, item.layer_index!) : removeItemFromPosition(pos.id, item.delivery_trip_item_id)} className="w-7 h-7 rounded-lg border border-red-200 dark:border-red-800 text-red-500 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors ml-1">
                                                                        <X size={12} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </>
                                            )}

                                            <button type="button" onClick={() => setShowItemPicker(pos.id)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-enterprise-200 dark:border-enterprise-800 text-enterprise-600 dark:text-enterprise-400 hover:bg-enterprise-50 dark:hover:bg-enterprise-950/20 hover:border-enterprise-400 dark:hover:border-enterprise-600 transition-all text-sm font-medium">
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

            {/* Item Picker Modal */}
            {showItemPicker && (
                <ItemPicker
                    items={tripItems}
                    allocated={allocated}
                    onAdd={(itemId, qty) => {
                        if (typeof showItemPicker === 'string') {
                            addItemToPosition(showItemPicker, itemId, qty);
                        } else {
                            addItemToLayer(showItemPicker.posId, itemId, qty, showItemPicker.layerIndex);
                        }
                        setShowItemPicker(null);
                    }}
                    onClose={() => setShowItemPicker(null)}
                />
            )}
        </div>
    );
};
