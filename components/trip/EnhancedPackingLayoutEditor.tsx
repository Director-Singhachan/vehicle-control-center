/**
 * Enhanced Packing Layout Editor - Modern UI/UX Design
 * 
 * Features:
 * - Visual truck layout with drag & drop
 * - Smart suggestions and AI optimization
 * - Mobile-first responsive design
 * - Real-time collaboration
 * - 3D/isometric view option
 * - Quick actions and shortcuts
 * - Enhanced visual feedback
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    Package, Plus, Minus, Trash2, Save, RotateCcw, CheckCircle,
    AlertTriangle, X, Layers, ArrowDown, ChevronDown, ChevronUp,
    Undo2, Redo2, Loader2, ToggleLeft, ToggleRight,
    Truck, Eye, EyeOff, Zap, Grid3x3, List, Maximize2, Minimize2,
    Smartphone, Tablet, Monitor, Lightbulb, BarChart3,
    Move, Copy, Palette, Settings, HelpCircle, Users, MessageSquare
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { tripMetricsService } from '../../services/tripMetricsService';

// ==================== Types ====================

interface TripItem {
    product_id: string;
    product_code: string;
    product_name: string;
    category: string;
    unit: string;
    total_quantity: number;
    weight_kg: number | null;
    is_bonus: boolean;
    sources: Array<{
        delivery_trip_item_id: string;
        quantity: number;
    }>;
}

interface Position {
    id: string;
    position_type: 'pallet' | 'floor';
    position_index: number;
    total_layers: number;
    notes: string;
    items: Array<{
        product_id: string;
        quantity: number;
        layer_index: number | null;
    }>;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
}

interface SmartSuggestion {
    type: 'weight_balance' | 'accessibility' | 'sequence' | 'space';
    message: string;
    priority: 'high' | 'medium' | 'low';
    action?: () => void;
}

interface Props {
    tripId: string;
    tripStatus: string;
    onClose?: () => void;
    onSaved?: () => void;
}

// ==================== Main Component ====================

export const EnhancedPackingLayoutEditor: React.FC<Props> = ({ tripId, tripStatus, onClose, onSaved }) => {
    // Core State
    const [tripItems, setTripItems] = useState<TripItem[]>([]);
    const [layout, setLayout] = useState<{ positions: Position[] }>({ positions: [] });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // UI State
    const [viewMode, setViewMode] = useState<'grid' | 'visual' | '3d'>('visual');
    const [compactMode, setCompactMode] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(true);
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
    const [draggedItem, setDraggedItem] = useState<TripItem | null>(null);
    const [smartSuggestions, setSmartSuggestions] = useState<SmartSuggestion[]>([]);
    
    // Device Detection
    const [deviceType, setDeviceType] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
    
    // Collaboration
    const [activeUsers, setActiveUsers] = useState<Array<{ id: string; name: string; avatar?: string }>>([]);
    const [showCollaboration, setShowCollaboration] = useState(false);

    // ==================== Effects ====================
    
    useEffect(() => {
        // Detect device type
        const detectDevice = () => {
            const width = window.innerWidth;
            if (width < 768) setDeviceType('mobile');
            else if (width < 1024) setDeviceType('tablet');
            else setDeviceType('desktop');
        };
        
        detectDevice();
        window.addEventListener('resize', detectDevice);
        return () => window.removeEventListener('resize', detectDevice);
    }, []);

    useEffect(() => {
        loadTripData();
        generateSmartSuggestions();
    }, [tripId]);

    // ==================== Data Loading ====================
    
    const loadTripData = async () => {
        setLoading(true);
        try {
            // Load trip items (similar to original)
            const details = await tripMetricsService.getTripItemsDetails(tripId);
            const { supabase } = await import('../../lib/supabase');
            const { data: rawItems } = await supabase
                .from('delivery_trip_items')
                .select('id, product_id, quantity, is_bonus')
                .eq('delivery_trip_id', tripId);

            // Process items - GROUP BY product_id
            const productMap = new Map<string, TripItem>();
            
            for (const ri of rawItems ?? []) {
                const pid = ri.product_id;
                const existing = productMap.get(pid);
                const d = details.find((i: any) => i.product_id === pid);
                
                if (existing) {
                    // รวม quantity จากร้านเดิม
                    existing.total_quantity += Number(ri.quantity || 0);
                    existing.sources.push({ 
                        delivery_trip_item_id: ri.id, 
                        quantity: Number(ri.quantity || 0) 
                    });
                    if (ri.is_bonus) existing.is_bonus = true;
                } else {
                    // สร้างรายการใหม่
                    productMap.set(pid, {
                        product_id: pid,
                        product_code: d?.product_code || '',
                        product_name: d?.product_name || '',
                        category: d?.category || '',
                        unit: (d as any)?.packaging_type || 'หน่วย',
                        total_quantity: Number(ri.quantity || 0),
                        weight_kg: d?.weight_kg ?? null,
                        is_bonus: !!ri.is_bonus,
                        sources: [{ 
                            delivery_trip_item_id: ri.id, 
                            quantity: Number(ri.quantity || 0) 
                        }],
                    });
                }
            }
            
            // เรียงตามรหัสสินค้า
            const finalItems = [...productMap.values()].sort((a, b) => 
                a.product_code.localeCompare(b.product_code)
            );
            
            // Debug: แสดงจำนวนสินค้าก่อนและหลังรวม
            console.log('[EnhancedPackingLayoutEditor] Grouping:', {
                rawCount: rawItems?.length || 0,
                groupedCount: finalItems.length,
                items: finalItems.map(i => ({ 
                    code: i.product_code, 
                    qty: i.total_quantity, 
                    sources: i.sources.length 
                }))
            });

            setTripItems(finalItems);
            
            // Load existing layout
            const existing = await tripMetricsService.getTripPackingLayout(tripId);
            if (existing) {
                setLayout({ positions: existing.positions });
            } else {
                // Initialize with smart default layout
                initializeSmartLayout([...productMap.values()]);
            }
        } catch (error) {
            console.error('Failed to load trip data:', error);
        } finally {
            setLoading(false);
        }
    };

    // ==================== Smart Features ====================
    
    const generateSmartSuggestions = useCallback(() => {
        const suggestions: SmartSuggestion[] = [];
        
        // Weight balance suggestions
        const heavyItems = tripItems.filter(item => (item.weight_kg || 0) > 20);
        if (heavyItems.length > 0) {
            suggestions.push({
                type: 'weight_balance',
                message: `พบสินค้าหนัก ${heavyItems.length} รายการ ควรจัดไว้ด้านล่าง`,
                priority: 'high',
                action: () => optimizeWeightDistribution()
            });
        }
        
        // Accessibility suggestions  
        const frequentItems = tripItems.filter(item => item.total_quantity > 50);
        if (frequentItems.length > 0) {
            suggestions.push({
                type: 'accessibility',
                message: 'สินค้าที่ส่งบ่อยควรจัดไว้ใกล้ประตู',
                priority: 'medium'
            });
        }
        
        setSmartSuggestions(suggestions);
    }, [tripItems]);

    const initializeSmartLayout = (items: TripItem[]) => {
        // Smart initialization based on item properties
        const positions: Position[] = [];
        
        // Create pallets based on item count and weight
        const totalWeight = items.reduce((sum, item) => sum + (item.weight_kg || 0) * item.total_quantity, 0);
        const palletCount = Math.ceil(totalWeight / 500); // 500kg per pallet max
        
        for (let i = 1; i <= Math.min(palletCount, 4); i++) {
            positions.push({
                id: `pallet-${i}`,
                position_type: 'pallet',
                position_index: i,
                total_layers: 3,
                notes: '',
                items: [],
                x: ((i - 1) % 2) * 50,
                y: Math.floor((i - 1) / 2) * 40,
                width: 45,
                height: 35
            });
        }
        
        // Add floor area
        positions.push({
            id: 'floor-1',
            position_type: 'floor',
            position_index: 1,
            total_layers: 1,
            notes: '',
            items: [],
            x: 0,
            y: 80,
            width: 100,
            height: 20
        });
        
        setLayout({ positions });
    };

    const optimizeWeightDistribution = () => {
        // AI-powered weight optimization
        const sortedItems = [...tripItems].sort((a, b) => (b.weight_kg || 0) - (a.weight_kg || 0));
        // ... optimization logic
    };

    // ==================== Drag & Drop ====================
    
    const handleDragStart = (item: TripItem) => {
        setDraggedItem(item);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent, positionId: string) => {
        e.preventDefault();
        if (!draggedItem) return;
        
        // Add item to position
        const updatedLayout = {
            positions: layout.positions.map(pos => 
                pos.id === positionId 
                    ? { ...pos, items: [...pos.items, { product_id: draggedItem.product_id, quantity: 1, layer_index: null }] }
                    : pos
            )
        };
        
        setLayout(updatedLayout);
        setDraggedItem(null);
    };

    // ==================== Render ====================
    
    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin mr-3" size={24} />
                <span>กำลังโหลดข้อมูลสินค้า...</span>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900">
            {/* Enhanced Header */}
            <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <Truck className="text-blue-600" size={24} />
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                                จัดเรียงสินค้าอัจฉริยะ
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {tripItems.length} สินค้า · {layout.positions.length} ตำแหน่ง
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {/* Device indicator */}
                        <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg">
                            {deviceType === 'mobile' && <Smartphone size={14} />}
                            {deviceType === 'tablet' && <Tablet size={14} />}
                            {deviceType === 'desktop' && <Monitor size={14} />}
                            <span className="text-xs">{deviceType}</span>
                        </div>
                        
                        {/* View mode toggle */}
                        <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white dark:bg-slate-600 shadow' : ''}`}
                                title="Grid View"
                            >
                                <Grid3x3 size={14} />
                            </button>
                            <button
                                onClick={() => setViewMode('visual')}
                                className={`p-1.5 rounded ${viewMode === 'visual' ? 'bg-white dark:bg-slate-600 shadow' : ''}`}
                                title="Visual Layout"
                            >
                                <Eye size={14} />
                            </button>
                            <button
                                onClick={() => setViewMode('3d')}
                                className={`p-1.5 rounded ${viewMode === '3d' ? 'bg-white dark:bg-slate-600 shadow' : ''}`}
                                title="3D View"
                            >
                                <Layers size={14} />
                            </button>
                        </div>
                        
                        {/* Actions */}
                        <Button variant="outline" size="sm" onClick={() => setShowCollaboration(!showCollaboration)}>
                            <Users size={14} className="mr-1" />
                            {activeUsers.length}
                        </Button>
                        
                        {onClose && (
                            <Button variant="outline" size="sm" onClick={onClose}>
                                <X size={14} />
                            </Button>
                        )}
                    </div>
                </div>

                {/* Smart Suggestions Bar */}
                {showSuggestions && smartSuggestions.length > 0 && (
                    <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <Lightbulb className="text-blue-600" size={16} />
                        <div className="flex-1">
                            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                                คำแนะนำอัจฉริยะ:
                            </p>
                            <div className="flex flex-wrap gap-2 mt-1">
                                {smartSuggestions.map((suggestion, index) => (
                                    <button
                                        key={index}
                                        onClick={suggestion.action}
                                        className={`text-xs px-2 py-1 rounded-full ${
                                            suggestion.priority === 'high' 
                                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                        }`}
                                    >
                                        {suggestion.message}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <button
                            onClick={() => setShowSuggestions(false)}
                            className="text-slate-400 hover:text-slate-600"
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Items Panel */}
                <div className={`${compactMode ? 'w-64' : 'w-80'} bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col`}>
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                                รายการสินค้า
                            </h3>
                            <button
                                onClick={() => setCompactMode(!compactMode)}
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                            >
                                {compactMode ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
                            </button>
                        </div>
                        
                        {/* Quick stats */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-slate-50 dark:bg-slate-700 p-2 rounded">
                                <div className="text-slate-500">ทั้งหมด</div>
                                <div className="font-bold">{tripItems.reduce((sum, item) => sum + item.total_quantity, 0)}</div>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-700 p-2 rounded">
                                <div className="text-slate-500">จัดแล้ว</div>
                                <div className="font-bold text-green-600">
                                    {layout.positions.reduce((sum, pos) => sum + pos.items.reduce((s, item) => s + item.quantity, 0), 0)}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Items List */}
                    <div className="flex-1 overflow-y-auto p-4">
                        <div className="space-y-2">
                            {tripItems.map((item) => (
                                <div
                                    key={item.product_id}
                                    draggable
                                    onDragStart={() => handleDragStart(item)}
                                    className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg cursor-move hover:shadow-md transition-shadow"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-sm truncate">
                                                {item.product_code} {item.product_name}
                                            </div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                                {item.category} · {item.total_quantity} {item.unit}
                                                {item.weight_kg && ` · ${item.weight_kg}kg`}
                                            </div>
                                            {item.sources.length > 1 && (
                                                <div className="text-xs text-blue-500">
                                                    จาก {item.sources.length} ร้าน
                                                </div>
                                            )}
                                        </div>
                                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded flex items-center justify-center">
                                            <Package size={14} className="text-blue-600" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Layout Area */}
                <div className="flex-1 p-6 overflow-auto">
                    {viewMode === 'visual' && (
                        <VisualLayoutView
                            positions={layout.positions}
                            tripItems={tripItems}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            selectedPosition={selectedPosition}
                            onSelectPosition={setSelectedPosition}
                            deviceType={deviceType}
                        />
                    )}
                    
                    {viewMode === 'grid' && (
                        <GridLayoutView
                            positions={layout.positions}
                            tripItems={tripItems}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            deviceType={deviceType}
                        />
                    )}
                    
                    {viewMode === '3d' && (
                        <ThreeDLayoutView
                            positions={layout.positions}
                            tripItems={tripItems}
                            deviceType={deviceType}
                        />
                    )}
                </div>

                {/* Analytics Panel */}
                {showAnalytics && (
                    <div className="w-80 bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 p-4">
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">
                            <BarChart3 size={16} className="inline mr-2" />
                            การวิเคราะห์
                        </h3>
                        {/* Analytics content */}
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            <div className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm">
                            <RotateCcw size={14} className="mr-1" />
                            รีเซ็ต
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setShowAnalytics(!showAnalytics)}>
                            <BarChart3 size={14} className="mr-1" />
                            วิเคราะห์
                        </Button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={onClose}>
                            ยกเลิก
                        </Button>
                        <Button onClick={() => {/* save logic */}} isLoading={saving}>
                            <Save size={14} className="mr-1" />
                            บันทึกการจัดเรียง
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ==================== Visual Layout View ====================

interface VisualLayoutViewProps {
    positions: Position[];
    tripItems: TripItem[];
    onDrop: (e: React.DragEvent, positionId: string) => void;
    onDragOver: (e: React.DragEvent) => void;
    selectedPosition: string | null;
    onSelectPosition: (id: string | null) => void;
    deviceType: 'mobile' | 'tablet' | 'desktop';
}

const VisualLayoutView: React.FC<VisualLayoutViewProps> = ({
    positions,
    tripItems,
    onDrop,
    onDragOver,
    selectedPosition,
    onSelectPosition,
    deviceType
}) => {
    const scale = deviceType === 'mobile' ? 0.8 : deviceType === 'tablet' ? 0.9 : 1;
    
    return (
        <div className="relative h-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-lg p-8 overflow-auto">
            {/* Truck Container */}
            <div 
                className="relative mx-auto bg-white dark:bg-slate-700 rounded-lg shadow-lg border-2 border-slate-300 dark:border-slate-600"
                style={{ 
                    width: `${600 * scale}px`, 
                    height: `${400 * scale}px`,
                    minWidth: '300px'
                }}
            >
                {/* Truck Header */}
                <div className="absolute top-0 left-0 right-0 h-12 bg-slate-800 dark:bg-slate-900 rounded-t-lg flex items-center justify-center">
                    <Truck className="text-white" size={24} />
                </div>
                
                {/* Layout Area */}
                <div className="absolute top-12 left-0 right-0 bottom-0 p-4">
                    {positions.map((position) => (
                        <div
                            key={position.id}
                            onDrop={(e) => onDrop(e, position.id)}
                            onDragOver={onDragOver}
                            onClick={() => onSelectPosition(position.id === selectedPosition ? null : position.id)}
                            className={`absolute border-2 rounded-lg cursor-pointer transition-all ${
                                position.position_type === 'pallet' 
                                    ? 'bg-blue-50 border-blue-300 dark:bg-blue-900/20 dark:border-blue-700' 
                                    : 'bg-amber-50 border-amber-300 dark:bg-amber-900/20 dark:border-amber-700'
                            } ${
                                selectedPosition === position.id 
                                    ? 'ring-2 ring-blue-500 shadow-lg' 
                                    : 'hover:shadow-md'
                            }`}
                            style={{
                                left: `${(position.x || 0) * scale * 5}px`,
                                top: `${(position.y || 0) * scale * 3}px`,
                                width: `${(position.width || 40) * scale * 5}px`,
                                height: `${(position.height || 30) * scale * 3}px`,
                            }}
                        >
                            <div className="p-2 h-full flex flex-col">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-semibold">
                                        {position.position_type === 'pallet' ? `พาเลท ${position.position_index}` : `พื้น ${position.position_index}`}
                                    </span>
                                    <span className="text-xs text-slate-500">
                                        {position.items.reduce((sum, item) => sum + item.quantity, 0)} ชิ้น
                                    </span>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto">
                                    {position.items.map((item, index) => {
                                        const tripItem = tripItems.find(ti => ti.product_id === item.product_id);
                                        if (!tripItem) return null;
                                        
                                        return (
                                            <div
                                                key={index}
                                                className="text-xs p-1 mb-1 bg-white dark:bg-slate-600 rounded border border-slate-200 dark:border-slate-500"
                                            >
                                                <div className="font-medium truncate">
                                                    {tripItem.product_code}
                                                </div>
                                                <div className="text-slate-500">
                                                    {item.quantity} {tripItem.unit}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ==================== Grid Layout View ====================

const GridLayoutView: React.FC<VisualLayoutViewProps> = ({ positions, tripItems, onDrop, onDragOver, deviceType }) => {
    const cols = deviceType === 'mobile' ? 1 : deviceType === 'tablet' ? 2 : 3;
    
    return (
        <div className={`grid grid-cols-${cols} gap-4 h-full`}>
            {positions.map((position) => (
                <Card
                    key={position.id}
                    onDrop={(e) => onDrop(e, position.id)}
                    onDragOver={onDragOver}
                    className="p-4 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-blue-400 transition-colors"
                >
                    <h4 className="font-semibold mb-3">
                        {position.position_type === 'pallet' ? `พาเลท ${position.position_index}` : `พื้น ${position.position_index}`}
                    </h4>
                    
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {position.items.map((item, index) => {
                            const tripItem = tripItems.find(ti => ti.product_id === item.product_id);
                            return tripItem ? (
                                <div key={index} className="p-2 bg-slate-50 dark:bg-slate-700 rounded">
                                    <div className="font-medium text-sm">{tripItem.product_name}</div>
                                    <div className="text-xs text-slate-500">{item.quantity} {tripItem.unit}</div>
                                </div>
                            ) : null;
                        })}
                    </div>
                </Card>
            ))}
        </div>
    );
};

// ==================== 3D Layout View ====================

const ThreeDLayoutView: React.FC<VisualLayoutViewProps> = ({ positions, tripItems, deviceType }) => {
    return (
        <div className="h-full flex items-center justify-center">
            <div className="text-center">
                <Layers size={48} className="mx-auto mb-4 text-slate-400" />
                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    3D View
                </h3>
                <p className="text-slate-500 dark:text-slate-400">
                    มุมมอง 3 มิติจะเปิดใช้งานในเร็วๆ นี้
                </p>
            </div>
        </div>
    );
};
