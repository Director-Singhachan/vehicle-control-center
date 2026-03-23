import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Split,
    Search,
    MapPin,
    Calendar,
    Building2,
    ChevronDown,
    CheckCircle2,
    AlertCircle,
    Truck,
    Package,
    Info,
    User,
    ClipboardCheck,
    Printer,
    CircleCheck,
    History
} from 'lucide-react';
import { ordersService, type PickupPendingItem } from '../services/ordersService';
import { pdfService } from '../services/pdfService';
import { useAuth } from '../hooks/useAuth';
import { PageLayout } from '../components/ui/PageLayout';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ui/Toast';
import { OrderSplitModal } from '../components/order/OrderSplitModal';
import { BRANCH_ALL_LABEL, BRANCH_ALL_VALUE, getBranchLabel } from '../utils/branchLabels';

export const ConfirmOrderView: React.FC = () => {
    const { profile } = useAuth();
    const { toasts, dismissToast, success, error } = useToast();
    
    // Tab State
    const [currentTab, setCurrentTab] = useState<'delivery' | 'pickup'>('delivery');
    const [pickupSubTab, setPickupSubTab] = useState<'pending' | 'history'>('pending');

    // Delivery Tab States
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [branchFilter, setBranchFilter] = useState('ALL');
    const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
    const [splittingItem, setSplittingItem] = useState<any | null>(null);
    const [processingOrderIds, setProcessingOrderIds] = useState<Set<string>>(new Set());
    
    // Multi-selection State
    const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
    const [isBulkProcessing, setIsBulkProcessing] = useState(false);

    // Pickup Tab States
    const [pickupItems, setPickupItems] = useState<PickupPendingItem[]>([]);
    const [pickupHistory, setPickupHistory] = useState<any[]>([]);
    const [confirmingPickupOrderId, setConfirmingPickupOrderId] = useState<string | null>(null);

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const data = await ordersService.getAwaitingDispatchOrders({
                branch: branchFilter === 'ALL' || branchFilter === BRANCH_ALL_VALUE ? undefined : branchFilter
            });
            setOrders(Array.isArray(data) ? data : []);
        } catch (err: any) {
            console.error('[ConfirmOrderView] Fetch orders error:', err);
            error('ไม่สามารถโหลดข้อมูลออเดอร์ได้: ' + (err.message || 'Unknown error'));
        } finally {
            setLoading(false);
        }
    }, [branchFilter, error]);

    const fetchPickupItems = useCallback(async () => {
        try {
            setLoading(true);
            const data = await ordersService.getPickupPendingItems(
                branchFilter && branchFilter !== 'ALL' && branchFilter !== BRANCH_ALL_VALUE ? { branch: branchFilter } : undefined
            );
            setPickupItems(data);
        } catch (err: any) {
            error(err?.message || 'โหลดรายการรอรับเองล้มเหลว');
        } finally {
            setLoading(false);
        }
    }, [branchFilter, error]);

    const fetchPickupHistory = useCallback(async () => {
        try {
            setLoading(true);
            const data = await ordersService.getPickupFulfilledOrders(
                branchFilter && branchFilter !== 'ALL' && branchFilter !== BRANCH_ALL_VALUE ? { branch: branchFilter } : undefined
            );
            setPickupHistory(data);
        } catch (err: any) {
            error(err?.message || 'โหลดประวัติรับเองล้มเหลว');
        } finally {
            setLoading(false);
        }
    }, [branchFilter, error]);

    useEffect(() => {
        if (currentTab === 'delivery') {
            fetchOrders();
        } else {
            if (pickupSubTab === 'pending') fetchPickupItems();
            else fetchPickupHistory();
        }
    }, [currentTab, pickupSubTab, fetchOrders, fetchPickupItems, fetchPickupHistory]);

    const toggleOrderExpansion = (orderId: string) => {
        if (!orderId) return;
        const newExpanded = new Set(expandedOrders);
        if (newExpanded.has(orderId)) {
            newExpanded.delete(orderId);
        } else {
            newExpanded.add(orderId);
        }
        setExpandedOrders(newExpanded);
    };

    const handleConfirmOrder = async (orderId: string) => {
        if (!orderId) return;
        setProcessingOrderIds(prev => new Set(prev).add(orderId));
        try {
            await ordersService.markAsReady(orderId, profile?.id || ''); 
            success('ยืนยันออเดอร์เรียบร้อยแล้ว');
            fetchOrders();
        } catch (err: any) {
            error('ไม่สามารถยืนยันออเดอร์ได้: ' + (err.message || 'Unknown error'));
        } finally {
            setProcessingOrderIds(prev => {
                const next = new Set(prev);
                next.delete(orderId);
                return next;
            });
        }
    };

    const filteredOrders = Array.isArray(orders) ? orders.filter(order => {
        if (!order) return false;
        const orderNum = (order.order_number || '').toLowerCase();
        const custName = (order.customer_name || '').toLowerCase();
        const storeName = (order.store_name || '').toLowerCase();
        const search = searchTerm.toLowerCase();
        
        return orderNum.includes(search) || custName.includes(search) || storeName.includes(search);
    }) : [];

    const toggleOrderSelection = (orderId: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const newSelected = new Set(selectedOrderIds);
        if (newSelected.has(orderId)) {
            newSelected.delete(orderId);
        } else {
            newSelected.add(orderId);
        }
        setSelectedOrderIds(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedOrderIds.size === filteredOrders.length) {
            setSelectedOrderIds(new Set());
        } else {
            setSelectedOrderIds(new Set(filteredOrders.map(o => o.id)));
        }
    };

    const handleBulkMarkAsReady = async () => {
        if (selectedOrderIds.size === 0) return;
        setIsBulkProcessing(true);
        try {
            const { updated } = await ordersService.markMultipleAsReady(Array.from(selectedOrderIds), profile?.id || '');
            success(`ยืนยันสำเร็จ ${updated} ออเดอร์`);
            setSelectedOrderIds(new Set());
            fetchOrders();
        } catch (err: any) {
            error('ไม่สามารถยืนยันออเดอร์ได้: ' + (err.message || 'Unknown error'));
        } finally {
            setIsBulkProcessing(false);
        }
    };

    const handleBulkUpdateFulfillment = async (method: 'delivery' | 'pickup') => {
        if (selectedOrderIds.size === 0) return;
        setIsBulkProcessing(true);
        try {
            const { updated } = await ordersService.updateMultipleFulfillmentMethods(Array.from(selectedOrderIds), method);
            success(`อัปเดตวิธีรับสินค้าสำเร็จ ${updated} รายการ`);
            fetchOrders();
        } catch (err: any) {
            error('ไม่สามารถอัปเดตออเดอร์ได้: ' + (err.message || 'Unknown error'));
        } finally {
            setIsBulkProcessing(false);
        }
    };

    const handleUpdateOrderFulfillment = async (orderId: string, method: 'delivery' | 'pickup', e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setProcessingOrderIds(prev => new Set(prev).add(orderId));
        try {
            const { updated } = await ordersService.updateMultipleFulfillmentMethods([orderId], method);
            success(`อัปเดตวิธีรับสินค้าสำเร็จ ${updated} รายการ`);
            fetchOrders();
        } catch (err: any) {
            error('ไม่สามารถอัปเดตออเดอร์ได้: ' + (err.message || 'Unknown error'));
        } finally {
            setProcessingOrderIds(prev => {
                const next = new Set(prev);
                next.delete(orderId);
                return next;
            });
        }
    };

    const formatDate = (dateStr: any) => {
        if (!dateStr) return '-';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return '-';
            return date.toLocaleDateString('th-TH');
        } catch {
            return '-';
        }
    };

    // Pickup Grouping Logic
    const groupedPickupItems = useMemo(() => {
        const map = new Map<string, any>();
        for (const item of pickupItems) {
            const existing = map.get(item.order_id);
            if (existing) {
                existing.items.push(item);
            } else {
                map.set(item.order_id, {
                    orderId: item.order_id,
                    orderNumber: item.order.order_number,
                    orderDate: item.order.order_date,
                    store: item.order.store,
                    items: [item],
                });
            }
        }
        return Array.from(map.values()).sort(
            (a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime()
        );
    }, [pickupItems]);

    const handlePrintPickupSlip = async (group: any) => {
        try {
            const orderPayload = {
                order_number: group.orderNumber,
                order_date: group.orderDate,
                customer_name: group.store.customer_name,
                customer_code: group.store.customer_code,
                store_address: group.store.address,
            };
            const itemsPayload = group.items.map((i: any) => ({
                quantity: i.quantity_remaining,
                product: {
                    product_code: i.product.product_code,
                    product_name: i.product.product_name,
                    category: i.product.category,
                    unit: i.product.unit,
                },
            }));
            await pdfService.generateOrderPickupSlipPDF(orderPayload, itemsPayload);
            success('พิมพ์ใบเบิกสำเร็จ');
        } catch (err: any) {
            error(err?.message || 'พิมพ์ใบเบิกล้มเหลว');
        }
    };

    const handleConfirmPickupReceived = async (orderId: string) => {
        try {
            setConfirmingPickupOrderId(orderId);
            const { updated, orderStatus } = await ordersService.markPickupItemsFulfilled(
                orderId,
                undefined,
                profile?.id
            );
            if (updated > 0) {
                success(
                    orderStatus === 'delivered'
                        ? 'ยืนยันรับแล้ว และออเดอร์ครบทุกรายการแล้ว'
                        : `ยืนยันรับแล้ว ${updated} รายการ`
                );
                fetchPickupItems();
                fetchPickupHistory();
            }
        } catch (err: any) {
            error(err?.message || 'ยืนยันรับแล้วล้มเหลว');
        } finally {
            setConfirmingPickupOrderId(null);
        }
    };

    return (
        <PageLayout title="ยืนยันและแบ่งส่งออเดอร์">
            <div className="space-y-6 max-w-7xl mx-auto pb-20">
                {/* Tab Switcher */}
                <div className="flex p-1.5 bg-slate-100 dark:bg-charcoal-800 rounded-3xl w-fit mx-auto shadow-inner border border-slate-200 dark:border-slate-800">
                    <button
                        onClick={() => setCurrentTab('delivery')}
                        className={`px-8 py-3 rounded-2xl text-sm font-black transition-all duration-300 flex items-center gap-2 ${currentTab === 'delivery'
                                ? 'bg-white dark:bg-charcoal-700 text-blue-600 shadow-md transform scale-[1.02]'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                    >
                        <Truck size={18} />
                        รอคอนเฟิร์ม / แบ่งส่ง
                    </button>
                    <button
                        onClick={() => setCurrentTab('pickup')}
                        className={`px-8 py-3 rounded-2xl text-sm font-black transition-all duration-300 flex items-center gap-2 ${currentTab === 'pickup'
                                ? 'bg-white dark:bg-charcoal-700 text-blue-600 shadow-md transform scale-[1.02]'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                    >
                        <Package size={18} />
                        รายการรอรับเอง
                    </button>
                </div>
                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-charcoal-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="ค้นหาเลขที่ออเดอร์, ชื่อลูกค้า, หรือร้านค้า..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-charcoal-800 border-none focus:ring-2 focus:ring-blue-500/20 text-sm font-bold outline-none transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <Building2 className="w-5 h-5 text-slate-400" />
                        <select
                            value={branchFilter}
                            onChange={(e) => setBranchFilter(e.target.value)}
                            className="px-4 py-3 rounded-2xl bg-slate-50 dark:bg-charcoal-800 border-none focus:ring-2 focus:ring-blue-500/20 text-sm font-bold outline-none cursor-pointer"
                        >
                            <option value={BRANCH_ALL_VALUE}>{BRANCH_ALL_LABEL}</option>
                            <option value="HQ">{getBranchLabel('HQ')}</option>
                            <option value="SD">{getBranchLabel('SD')}</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-3 pl-2">
                        <input
                            type="checkbox"
                            checked={filteredOrders.length > 0 && selectedOrderIds.size === filteredOrders.length}
                            onChange={toggleSelectAll}
                            className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="text-xs font-black text-slate-500 uppercase tracking-wider">เลือกทั้งหมด</span>
                    </div>
                    <Button
                        variant="outline"
                        onClick={currentTab === 'delivery' ? fetchOrders : (pickupSubTab === 'pending' ? fetchPickupItems : fetchPickupHistory)}
                        className="rounded-2xl shrink-0"
                    >
                        รีเฟรช
                    </Button>
                </div>

                {/* Delivery Tab Content */}
                {currentTab === 'delivery' ? (
                    <>
                        {/* Info Box */}
                        <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-3xl p-6 flex items-start gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-white dark:bg-charcoal-800 shadow-sm flex items-center justify-center text-blue-500 shrink-0">
                                <Info className="w-6 h-6" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-sm font-black text-blue-900 dark:text-blue-300 uppercase tracking-wider">คำแนะนำการใช้งาน</h4>
                                <p className="text-sm font-medium text-blue-700/80 dark:text-blue-400/80 leading-relaxed">
                                    หน้านี้รวบรวมออเดอร์ทั้งหมดที่เริมต้นบันทึกเข้าระบบ (ฉบับร่าง/รอการส่งมอบ) <br />
                                    ท่านสามารถตรวจสอบรายการ แบ่งยอดส่ง (Split) หรือกำหนดให้ลูกค้ามารับเอง และกดปุ่ม <span className="font-black text-blue-600">"ยืนยันออเดอร์"</span> เพื่อส่งให้ฝ่ายขนส่งดำเนินการต่อ
                                </p>
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <LoadingSpinner size={32} />
                                <p className="text-sm font-bold text-slate-500 animate-pulse">กำลังโหลดข้อมูลออเดอร์...</p>
                            </div>
                        ) : filteredOrders.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-charcoal-900 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                                <div className="w-20 h-20 rounded-full bg-slate-50 dark:b                                            {/* Order Header */}
                                            <div
                                                className="p-3 cursor-pointer select-none"
                                                onClick={() => toggleOrderExpansion(order.id)}
                                            >
                                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className="" onClick={(e) => e.stopPropagation()}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedOrderIds.has(order.id)}
                                                                    onChange={() => toggleOrderSelection(order.id)}
                                                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                                />
                                                            </div>
                                                            <div className={`p-1.5 rounded-lg shadow-sm transition-colors ${isExpanded ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-charcoal-800 text-slate-400'
                                                                }`}>
                                                                <Package className="w-4 h-4" />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">{order.order_number || 'ไม่มีเลขที่ออเดอร์'}</h3>
                                                                <Badge variant="info" className="rounded-lg px-2 py-0 text-[8px] font-black uppercase">
                                                                    รอการยืนยัน
                                                                </Badge>
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0 mt-0.5">
                                                                <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                                                    <Building2 className="w-3 h-3 text-slate-400" />
                                                                    {order.store_name || '-'}
                                                                </div>
                                                                <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                                                                    <User className="w-3 h-3 text-slate-400" />
                                                                    {order.customer_name || '-'}
                                                                </div>
                                                                <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                                                                    <MapPin className="w-3 h-3 text-slate-400" />
                                                                    {order.district || '-'}, {order.province || '-'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between lg:justify-end gap-4">
                                                        {/* Single Order Bulk Actions */}
                                                        {order.items?.length > 1 && (
                                                            <div className="flex items-center gap-1 p-1 bg-slate-50 dark:bg-charcoal-800 rounded-xl border border-slate-100 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
                                                                <button
                                                                    onClick={(e) => handleUpdateOrderFulfillment(order.id, 'pickup', e)}
                                                                    disabled={processingOrderIds.has(order.id)}
                                                                    className="px-3 py-1.5 rounded-lg text-[10px] font-black flex items-center gap-1.5 text-amber-600 hover:bg-amber-50 transition-colors"
                                                                >
                                                                    <Package className="w-3 h-3" />
                                                                    รับเองทั้งหมด
                                                                </button>
                                                                <div className="w-px h-3 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                                                                <button
                                                                    onClick={(e) => handleUpdateOrderFulfillment(order.id, 'delivery', e)}
                                                                    disabled={processingOrderIds.has(order.id)}
                                                                    className="px-3 py-1.5 rounded-lg text-[10px] font-black flex items-center gap-1.5 text-blue-600 hover:bg-blue-50 transition-colors"
                                                                >
                                                                    <Truck className="w-3 h-3" />
                                                                    ส่งทั้งหมด
                                                                </button>
                                                            </div>
                                                        )}

                                                        <div className="flex items-center gap-6">
                                                            <div className="hidden sm:block text-right">
                                                                <div className="flex items-center justify-end gap-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                                    <Calendar className="w-2.5 h-2.5" />
                                                                    วันที่
                                                                </div>
                                                                <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                                                    {formatDate(order.order_date)}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <div className="flex flex-col items-end">
                                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">รายการ</span>
                                                                    <span className="text-xs font-black text-slate-900 dark:text-white">{(order.items?.length || order.total_items || 0)}</span>
                                                                </div>
                                                                <div className="p-1 rounded-md bg-slate-50 dark:bg-charcoal-800 text-slate-400 transition-transform duration-300" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}>
                                                                    <ChevronDown className="w-3.5 h-3.5" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
��
                                                            </div>
                                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                                {formatDate(order.order_date)}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">รายการ</span>
                                                                <span className="text-xs font-black text-slate-900 dark:text-white">{(order.items?.length || order.total_items || 0)}</span>
                                                            </div>
                                                            <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-charcoal-800 text-slate-400 transition-transform duration-300" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}>
                                                                <ChevronDown className="w-4 h-4" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Expanded Details */}
                                            {isExpanded && (
                                                <div className="border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-4 duration-300">
                                                    <div className="p-6 bg-slate-50/30 dark:bg-charcoal-900/40">
                                                        <div className="flex items-center justify-between mb-6">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
                                                                <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">ตรวจสอบและยืนยันรายการ</h4>
                                                            </div>
                                                            <Button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleConfirmOrder(order.id);
                                                                }}
                                                                disabled={processingOrderIds.has(order.id)}
                                                                className="bg-enterprise-600 hover:bg-enterprise-700 text-white rounded-2xl px-6 py-2.5 shadow-lg shadow-enterprise-500/20 active:scale-95 transition-all font-black text-sm flex items-center gap-2"
                                                            >
                                                                {processingOrderIds.has(order.id) ? (
                                                                    <LoadingSpinner size={16} className="text-white" />
                                                                ) : (
                                                                    <>
                                                                        <CheckCircle2 className="w-4 h-4" />
                                                                        ยืนยันรายการและส่งต่อฝ่ายขนส่ง
                                                                    </>
                                                                )}
                                                            </Button>
                                                        </div>

                                                        <div className="overflow-x-auto rounded-[1.5rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-charcoal-900 overflow-hidden">
                                                            <table className="w-full text-left text-sm">
                                                                <thead className="bg-slate-50/50 dark:bg-charcoal-800/50 border-b border-slate-200 dark:border-slate-800">
                                                                    <tr>
                                                                        <th className="px-6 py-4 font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[10px]">ลำดับ</th>
                                                                        <th className="px-6 py-4 font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[10px]">สินค้า</th>
                                                                        <th className="px-6 py-4 font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[10px] text-center">จำนวน</th>
                                                                        <th className="px-6 py-4 font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[10px]">วิธีรับสินค้า</th>
                                                                        <th className="px-6 py-4 font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[10px]">หมายเหตุ</th>
                                                                        <th className="px-6 py-4 font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[10px] text-right">จัดการ</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                                    {Array.isArray(order.items) && order.items.length > 0 ? (
                                                                        order.items.map((item: any, idx: number) => {
                                                                            if (!item) return null;
                                                                            return (
                                                                                <tr key={item.id || idx} className="group hover:bg-slate-50/50 dark:hover:bg-charcoal-800/30 transition-colors">
                                                                                    <td className="px-6 py-4 font-bold text-slate-400">{idx + 1}</td>
                                                                                    <td className="px-6 py-4">
                                                                                        <div className="font-black text-slate-900 dark:text-white leading-tight">{item.product_name || 'Unknown Product'}</div>
                                                                                        <div className="text-[10px] text-slate-400 mt-1 font-bold">{item.product_code || 'No Code'}</div>
                                                                                    </td>
                                                                                    <td className="px-6 py-4 text-center">
                                                                                        <span className="inline-flex items-center justify-center min-w-[3rem] px-2 py-1 rounded-lg bg-slate-100 dark:bg-charcoal-800 font-black text-slate-900 dark:text-white">
                                                                                            {item.quantity || 0}
                                                                                        </span>
                                                                                        <span className="text-xs font-bold text-slate-400 ml-1.5">{item.unit_name || 'ชิ้น'}</span>
                                                                                    </td>
                                                                                    <td className="px-6 py-4">
                                                                                        {item.fulfillment_method === 'pickup' ? (
                                                                                            <Badge variant="warning" className="rounded-lg gap-1.5 px-2 py-1 ">
                                                                                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                                                                                                ลูกค้ามารับเอง
                                                                                            </Badge>
                                                                                        ) : (
                                                                                            <Badge variant="info" className="rounded-lg gap-1.5 px-2 py-1">
                                                                                                <Truck className="w-3.5 h-3.5" />
                                                                                                จัดส่งโดยบริษัท
                                                                                            </Badge>
                                                                                        )}
                                                                                    </td>
                                                                                    <td className="px-6 py-4 text-slate-500 font-medium text-xs max-w-[200px] truncate">
                                                                                        {item.notes || '-'}
                                                                                    </td>
                                                                                    <td className="px-6 py-4 text-right">
                                                                                        <button
                                                                                            onClick={() => setSplittingItem({
                                                                                                ...item,
                                                                                                customer_name: order.customer_name,
                                                                                                order_number: order.order_number
                                                                                            })}
                                                                                            className="p-2 rounded-xl text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group/btn flex items-center gap-2 ml-auto"
                                                                                        >
                                                                                            <Split className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                                                                                            <span className="text-xs font-black uppercase tracking-tighter">แบ่งยอด</span>
                                                                                        </button>
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })
                                                                    ) : (
                                                                        <tr>
                                                                            <td colSpan={6} className="px-6 py-10 text-center text-slate-400 font-bold">
                                                                                <div className="flex flex-col items-center gap-2">
                                                                                    <Package className="w-8 h-8 opacity-20" />
                                                                                    ไม่มีรายการสินค้าในออเดอร์นี้
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    )}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </>
                ) : (
                    /* Pickup Tab Content */
                    <div className="space-y-6">
                        <div className="flex gap-2 p-1 bg-slate-100 dark:bg-charcoal-800 rounded-2xl w-fit">
                            <button
                                onClick={() => setPickupSubTab('pending')}
                                className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${pickupSubTab === 'pending'
                                        ? 'bg-white dark:bg-charcoal-700 text-blue-600 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                            >
                                รอรับ ({groupedPickupItems.length})
                            </button>
                            <button
                                onClick={() => setPickupSubTab('history')}
                                className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${pickupSubTab === 'history'
                                        ? 'bg-white dark:bg-charcoal-700 text-blue-600 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                            >
                                ประวัติที่รับแล้ว
                            </button>
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-20">
                                <LoadingSpinner />
                            </div>
                        ) : pickupSubTab === 'history' ? (
                            pickupHistory.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-charcoal-900 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                                    <History className="w-16 h-16 text-slate-300 mb-4" />
                                    <p className="text-slate-600 dark:text-slate-400 font-black">ยังไม่มีประวัติรับเอง</p>
                                    <p className="text-sm text-slate-500 mt-1">ออเดอร์ที่ลูกค้ามารับครบแล้วจะแสดงที่นี่</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {pickupHistory.map((order: any) => (
                                        <Card key={order.id} className="overflow-hidden border-slate-100 dark:border-slate-800">
                                            <div className="p-6">
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <div className="flex items-center gap-4">
                                                        <div className="p-3 rounded-2xl bg-green-50 dark:bg-green-900/10 text-green-600 dark:text-green-500">
                                                            <CircleCheck className="w-6 h-6" />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-lg font-black text-slate-900 dark:text-white">
                                                                {order.order_number || `#${order.id?.slice(0, 8)}`}
                                                            </h3>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <Building2 className="w-4 h-4 text-slate-400" />
                                                                <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
                                                                    {order.customer_code} — {order.customer_name}
                                                                </p>
                                                            </div>
                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 flex items-center gap-1.5">
                                                                <Calendar size={12} />
                                                                รับแล้วเมื่อ {new Date(order.pickup_fulfilled_at || order.updated_at).toLocaleDateString('th-TH', {
                                                                    year: 'numeric',
                                                                    month: 'short',
                                                                    day: 'numeric',
                                                                    hour: '2-digit',
                                                                    minute: '2-digit',
                                                                })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <Badge variant="success" className="rounded-xl px-4 py-1.5 font-black uppercase tracking-wider text-[10px]">
                                                        รับสินค้าแล้ว
                                                    </Badge>
                                                </div>
                                                {order.pickup_items?.length > 0 && (
                                                    <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">รายการสินค้า:</div>
                                                        <div className="space-y-2">
                                                            {order.pickup_items.map((item: any, idx: number) => (
                                                                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-charcoal-800/50">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                                                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                                                            {item.product_code} — {item.product_name}
                                                                        </span>
                                                                        {item.is_bonus && (
                                                                            <Badge variant="success" className="text-[10px] px-1.5 py-0">ของแถม</Badge>
                                                                        )}
                                                                    </div>
                                                                    <span className="text-sm font-black text-slate-900 dark:text-white">
                                                                        {item.quantity.toLocaleString('th-TH')} {item.unit}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            )
                        ) : groupedPickupItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-charcoal-900 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                                <Package className="w-16 h-16 text-slate-300 mb-4" />
                                <p className="text-slate-600 dark:text-slate-400 font-black">ไม่มีรายการรอรับเอง</p>
                                <p className="text-sm text-slate-500 mt-1">ออเดอร์ที่เลือกลูกค้ามารับเองจะแสดงที่นี่</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {groupedPickupItems.map((group: any) => (
                                    <Card key={group.orderId} className="overflow-hidden border-slate-100 dark:border-slate-800">
                                        <div className="p-6">
                                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                                                <div className="flex items-start gap-4 flex-1">
                                                    <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-900/10 text-amber-600 dark:text-amber-500">
                                                        <Package className="w-6 h-6" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-3">
                                                            <h3 className="text-xl font-black text-slate-900 dark:text-white">
                                                                {group.orderNumber || group.orderId.slice(0, 8)}
                                                            </h3>
                                                            {group.store.branch && (
                                                                <Badge variant="info" className="text-[10px] uppercase font-black">
                                                                    {getBranchLabel(group.store.branch)}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Building2 className="w-4 h-4 text-slate-400" />
                                                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                                                {group.store.customer_code} — {group.store.customer_name}
                                                            </p>
                                                        </div>
                                                        <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5 pt-1">
                                                            <Calendar size={12} />
                                                            {new Date(group.orderDate).toLocaleDateString('th-TH', {
                                                                year: 'numeric',
                                                                month: 'short',
                                                                day: 'numeric',
                                                            })}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap gap-3">
                                                    <Button
                                                        variant="outline"
                                                        onClick={() => handlePrintPickupSlip(group)}
                                                        className="rounded-2xl flex items-center gap-2 font-black text-xs h-11 px-5"
                                                    >
                                                        <Printer size={16} />
                                                        พิมพ์ใบเบิก
                                                    </Button>
                                                    <Button
                                                        onClick={() => handleConfirmPickupReceived(group.orderId)}
                                                        disabled={confirmingPickupOrderId === group.orderId}
                                                        className="bg-green-600 hover:bg-green-700 text-white rounded-2xl flex items-center gap-2 font-black text-xs h-11 px-6 shadow-lg shadow-green-500/20 active:scale-95 transition-all"
                                                    >
                                                        {confirmingPickupOrderId === group.orderId ? (
                                                            <LoadingSpinner size={16} />
                                                        ) : (
                                                            <CircleCheck size={16} />
                                                        )}
                                                        ยืนยันรับสินค้าแล้ว
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="mt-8 overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800">
                                                <table className="w-full text-left text-sm">
                                                    <thead className="bg-slate-50 dark:bg-charcoal-800/50">
                                                        <tr>
                                                            <th className="px-5 py-4 font-black text-slate-400 uppercase tracking-widest text-[9px]">รหัสสินค้า</th>
                                                            <th className="px-5 py-4 font-black text-slate-400 uppercase tracking-widest text-[9px]">ชื่อสินค้า</th>
                                                            <th className="px-5 py-4 font-black text-slate-400 uppercase tracking-widest text-[9px] text-right">จำนวน</th>
                                                            <th className="px-5 py-4 font-black text-slate-400 uppercase tracking-widest text-[9px]">หน่วย</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                                        {group.items.map((item: any) => (
                                                            <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-charcoal-800/20 transition-colors">
                                                                <td className="px-5 py-4 font-black text-slate-900 dark:text-white transition-all">
                                                                    {item.product.product_code}
                                                                </td>
                                                                <td className="px-5 py-4 font-bold text-slate-600 dark:text-slate-400">
                                                                    {item.product.product_name}
                                                                </td>
                                                                <td className="px-5 py-4 text-right font-black text-blue-600 dark:text-blue-400 text-base">
                                                                    {item.quantity_remaining.toLocaleString()}
                                                                </td>
                                                                <td className="px-5 py-4 text-xs font-black text-slate-400 uppercase">
                                                                    {item.product.unit}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <ToastContainer toasts={toasts} onDismiss={dismissToast} />

            {/* Bulk Action Bar */}
            {selectedOrderIds.size > 0 && currentTab === 'delivery' && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-8 duration-300">
                    <div className="bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] px-8 py-4 shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex items-center gap-6">
                        <div className="flex items-center gap-3 pr-6 border-r border-slate-100 dark:border-slate-800">
                            <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-lg shadow-blue-500/30">
                                {selectedOrderIds.size}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">เลือกอยู่</span>
                                <span className="text-sm font-black text-slate-900 dark:text-white leading-none">ออเดอร์</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <Button
                                onClick={handleBulkMarkAsReady}
                                disabled={isBulkProcessing}
                                className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-8 h-12 text-xs font-black flex items-center gap-2 shadow-lg shadow-blue-500/20"
                            >
                                {isBulkProcessing ? (
                                    <LoadingSpinner size={16} className="text-white" />
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-4 h-4" />
                                        ยืนยันที่เลือก
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {splittingItem && (
                <OrderSplitModal
                    isOpen={!!splittingItem}
                    onClose={() => setSplittingItem(null)}
                    onSuccess={() => {
                        success('แบ่งรายการออเดอร์สำเร็จ');
                        fetchOrders();
                    }}
                    item={splittingItem}
                />
            )}
        </PageLayout>
    );
};
