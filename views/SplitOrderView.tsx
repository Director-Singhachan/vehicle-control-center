import React, { useState, useEffect, useCallback } from 'react';
import {
    Split,
    Search,
    MapPin,
    Calendar,
    Building2,
    ChevronDown,
    ChevronRight,
    CheckCircle2,
    Clock,
    AlertCircle,
    Truck,
    Package,
    ArrowRight,
    Info,
    User
} from 'lucide-react';
import { ordersService } from '../services/ordersService';
import { PageLayout } from '../components/ui/PageLayout';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ui/Toast';
import { OrderSplitModal } from '../components/order/OrderSplitModal';

export const SplitOrderView: React.FC = () => {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [branchFilter, setBranchFilter] = useState('ALL');
    const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
    const [splittingItem, setSplittingItem] = useState<any | null>(null);
    const [processingOrderIds, setProcessingOrderIds] = useState<Set<string>>(new Set());
    const { success, error } = useToast();

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const data = await ordersService.getAwaitingDispatchOrders({
                branch: branchFilter === 'ALL' ? undefined : branchFilter
            });
            setOrders(data);
        } catch (err: any) {
            error('ไม่สามารถโหลดข้อมูลออเดอร์ได้: ' + err.message);
        } finally {
            setLoading(false);
        }
    }, [branchFilter, error]);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    const toggleOrderExpansion = (orderId: string) => {
        const newExpanded = new Set(expandedOrders);
        if (newExpanded.has(orderId)) {
            newExpanded.delete(orderId);
        } else {
            newExpanded.add(orderId);
        }
        setExpandedOrders(newExpanded);
    };

    const handleMarkAsReady = async (orderId: string) => {
        setProcessingOrderIds(prev => new Set(prev).add(orderId));
        try {
            await ordersService.markAsReady(orderId, 'SYSTEM'); // In real app, use actual user
            success('ยืนยันออเดอร์เรียบร้อยแล้ว');
            fetchOrders();
        } catch (err: any) {
            error('ไม่สามารถยืนยันออเดอร์ได้: ' + err.message);
        } finally {
            setProcessingOrderIds(prev => {
                const next = new Set(prev);
                next.delete(orderId);
                return next;
            });
        }
    };

    const filteredOrders = orders.filter(order =>
        (order.order_number?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (order.customer_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (order.store_name?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    return (
        <PageLayout
            title="แบ่งยอดส่ง (Dispatch Board)"
        >
            <div className="space-y-6 max-w-7xl mx-auto">
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
                            <option value="ALL">ทุกสาขา</option>
                            {/* Add more branches if available */}
                            <option value="สำนักงานใหญ่">สำนักงานใหญ่</option>
                        </select>
                    </div>
                    <Button
                        variant="outline"
                        onClick={fetchOrders}
                        className="rounded-2xl shrink-0"
                    >
                        รีเฟรช
                    </Button>
                </div>

                {/* Info Box */}
                <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-3xl p-6 flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white dark:bg-charcoal-800 shadow-sm flex items-center justify-center text-blue-500 shrink-0">
                        <Info className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                        <h4 className="text-sm font-black text-blue-900 dark:text-blue-300 uppercase tracking-wider">คำแนะนำการใช้งาน</h4>
                        <p className="text-sm font-medium text-blue-700/80 dark:text-blue-400/80 leading-relaxed">
                            ออเดอร์ในหน้า นี้คือออเดอร์ใหม่ที่รอการตรวจสอบวิธีส่ง คุณสามารถแบ่งรายการสินค้าออกเป็นหลายส่วน (Split) เพื่อแยกส่งแบบ Delivery หรือให้ลูกค้ามารับเอง (Pickup) <br />
                            เมื่อจัดการเสร็จแล้วให้กดปุ่ม <span className="font-black">"ยืนยันออเดอร์"</span> เพื่อส่งต่อให้ฝ่ายจัดทริปดำเนินการต่อไป
                        </p>
                    </div>
                </div>

                {/* Orders List */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <LoadingSpinner size={32} />
                        <p className="text-sm font-bold text-slate-500 animate-pulse">กำลังโหลดข้อมูลออเดอร์...</p>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-charcoal-900 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                        <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-charcoal-800 flex items-center justify-center text-slate-300 mb-4">
                            <Package className="w-10 h-10" />
                        </div>
                        <h3 className="text-lg font-black text-slate-900 dark:text-white">ไม่พบออเดอร์ที่รอจัดสรร</h3>
                        <p className="text-sm font-medium text-slate-500 mt-1">ออเดอร์ใหม่ทั้งหมดที่ยังไม่มีทริปจะแสดงที่นี่</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {filteredOrders.map(order => (
                            <Card
                                key={order.id}
                                className={`overflow-hidden transition-all duration-300 border-2 ${expandedOrders.has(order.id)
                                    ? 'border-blue-500/50 shadow-xl shadow-blue-500/5 ring-1 ring-blue-500/10'
                                    : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                                    }`}
                            >
                                {/* Order Header */}
                                <div
                                    className="p-6 cursor-pointer select-none"
                                    onClick={() => toggleOrderExpansion(order.id)}
                                >
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-start gap-4">
                                            <div className={`p-3 rounded-2xl shadow-sm transition-colors ${expandedOrders.has(order.id) ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-charcoal-800 text-slate-400'
                                                }`}>
                                                <Package className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-3">
                                                    <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">{order.order_number}</h3>
                                                    <Badge variant="info" className="rounded-lg px-2 py-0.5 text-[10px] font-black uppercase">
                                                        New Order
                                                    </Badge>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                                                    <div className="flex items-center gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-300">
                                                        <Building2 className="w-4 h-4 text-slate-400" />
                                                        {order.store_name}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-sm font-medium text-slate-500">
                                                        <User className="w-4 h-4 text-slate-400" />
                                                        {order.customer_name}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-sm font-medium text-slate-500">
                                                        <MapPin className="w-4 h-4 text-slate-400" />
                                                        {order.district}, {order.province}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6 md:text-right">
                                            <div className="hidden sm:block">
                                                <div className="flex items-center gap-1.5 text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    วันที่ออเดอร์
                                                </div>
                                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                                    {new Date(order.order_date).toLocaleDateString('th-TH')}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">จำนวนรายการ</span>
                                                    <span className="text-sm font-black text-slate-900 dark:text-white">{order.total_items} รายการ</span>
                                                </div>
                                                <div className="p-2 rounded-xl bg-slate-50 dark:bg-charcoal-800 text-slate-400 transition-transform duration-300" style={{ transform: expandedOrders.has(order.id) ? 'rotate(180deg)' : 'none' }}>
                                                    <ChevronDown className="w-5 h-5" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                {expandedOrders.has(order.id) && (
                                    <div className="border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-4 duration-300">
                                        <div className="p-6 bg-slate-50/30 dark:bg-charcoal-900/40">
                                            <div className="flex items-center justify-between mb-6">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
                                                    <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">รายการสินค้าที่จะจัดสรร</h4>
                                                </div>
                                                <Button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleMarkAsReady(order.id);
                                                    }}
                                                    disabled={processingOrderIds.has(order.id)}
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl px-6 py-2.5 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all font-black text-sm flex items-center gap-2"
                                                >
                                                    {processingOrderIds.has(order.id) ? (
                                                        <LoadingSpinner size={16} className="text-white" />
                                                    ) : (
                                                        <>
                                                            <CheckCircle2 className="w-4 h-4" />
                                                            ยืนยันออเดอร์พร้อมจัดส่ง
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
                                                        {order.items?.map((item: any, idx: number) => (
                                                            <tr key={item.id} className="group hover:bg-slate-50/50 dark:hover:bg-charcoal-800/30 transition-colors">
                                                                <td className="px-6 py-4 font-bold text-slate-400">{idx + 1}</td>
                                                                <td className="px-6 py-4">
                                                                    <div className="font-black text-slate-900 dark:text-white leading-tight">{item.product_name}</div>
                                                                    <div className="text-[10px] text-slate-400 mt-1 font-bold">{item.product_code || 'No Code'}</div>
                                                                </td>
                                                                <td className="px-6 py-4 text-center">
                                                                    <span className="inline-flex items-center justify-center min-w-[3rem] px-2 py-1 rounded-lg bg-slate-100 dark:bg-charcoal-800 font-black text-slate-900 dark:text-white">
                                                                        {item.quantity}
                                                                    </span>
                                                                    <span className="text-xs font-bold text-slate-400 ml-1.5">{item.unit_name}</span>
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
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </Card>
                        ))}
                    </div>
                )}

                {/* Footnote */}
                <div className="text-center py-10">
                    <p className="text-xs font-bold text-slate-400 flex items-center justify-center gap-2">
                        <Clock className="w-4 h-4" />
                        ข้อมูลอัปเดตล่าสุด: {new Date().toLocaleTimeString('th-TH')}
                    </p>
                </div>
            </div>

            <ToastContainer />

            {/* Split Modal */}
            {
                splittingItem && (
                    <OrderSplitModal
                        isOpen={!!splittingItem}
                        onClose={() => setSplittingItem(null)}
                        onSuccess={() => {
                            success('แบ่งรายการออเดอร์สำเร็จ');
                            fetchOrders();
                        }}
                        item={splittingItem}
                    />
                )
            }
        </PageLayout >
    );
};
