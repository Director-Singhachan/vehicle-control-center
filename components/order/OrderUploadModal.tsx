import React, { useState, useRef } from 'react';
import { Upload, X, FileText, CheckCircle2, AlertCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useToast } from '../../hooks';
import { orderUploadService, UploadedOrder } from '../../services/orderUploadService';
import { ordersService } from '../../services/ordersService';
import { useAuth } from '../../hooks';

interface OrderUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedWarehouse: any;
}

export function OrderUploadModal({ isOpen, onClose, onSuccess, selectedWarehouse }: OrderUploadModalProps) {
  const { profile } = useAuth();
  const { success, error, warning } = useToast();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedOrders, setParsedOrders] = useState<UploadedOrder[]>([]);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      error('กรุณาอัพโหลดไฟล์ Excel (.xlsx, .xls)');
      return;
    }

    setIsProcessing(true);
    setParsedOrders([]);
    
    try {
      // 1. Parse Excel
      const rawOrders = await orderUploadService.parseExcel(file);
      
      // 2. Validate against DB
      const validatedOrders = await orderUploadService.validateOrders(rawOrders);
      
      setParsedOrders(validatedOrders);
      
      const invalidCount = validatedOrders.filter(o => o.error).length;
      if (invalidCount > 0) {
          warning(`พบออเดอร์ที่ไม่ถูกต้อง ${invalidCount} รายการ กรุณาตรวจสอบก่อนบันทึก`);
      } else {
          success(`ตรวจสอบไฟล์สำเร็จ พบ ${validatedOrders.length} ออเดอร์`);
      }
      
    } catch (err: any) {
      error(err.message || 'เกิดข้อผิดพลาดในการประมวลผลไฟล์');
    } finally {
      setIsProcessing(false);
      // reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleConfirmUpload = async () => {
    if (!selectedWarehouse) {
      error('กรุณาเลือกคลังสินค้าในหน้าหลักก่อนอัพโหลด');
      return;
    }

    const validOrders = parsedOrders.filter(o => !o.error);
    if (validOrders.length === 0) {
      error('ไม่มีออเดอร์ที่สามารถบันทึกได้');
      return;
    }

    setIsProcessing(true);
    try {
      // Batch create orders
      let successCount = 0;
      for (const order of validOrders) {
        
        const orderInsert = {
          store_id: order.store_id!, // known valid since not error
          order_date: order.order_date,
          status: 'awaiting_dispatch',
          notes: `(อัพโหลดจาก SML / ${order.doc_no})`,
          created_by: profile?.id,
          warehouse_id: selectedWarehouse.id,
        };

        const itemsToSubmit = order.items.map(item => ({
          product_id: item.product_id!, // known valid
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: Math.round((item.discount / item.total) * 100) || 0, // Approx
          is_bonus: item.unit_price === 0,
          fulfillment_method: 'delivery' as const,
        }));

        await ordersService.createWithItems(orderInsert, itemsToSubmit, null, null);
        successCount++;
      }
      
      success(`อัพโหลดสำเร็จ ${successCount} ออเดอร์`);
      onSuccess();
      onClose();
    } catch (err: any) {
      error(err.message || 'เกิดข้อผิดพลาดขณะบันทึกข้อมูล');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetUpload = () => {
    setParsedOrders([]);
  };

  const toggleExpand = (docNo: string) => {
    setExpandedOrderId(expandedOrderId === docNo ? null : docNo);
  };

  const validCount = parsedOrders.filter(o => !o.error).length;
  const invalidCount = parsedOrders.filter(o => o.error).length;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 shadow-2xl overflow-hidden rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">อัพโหลดใบขาย (SML Export)</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                รองรับไฟล์ Excel (.xlsx) ที่ Export จากหน้ารายงาน SML
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50 dark:bg-slate-900/50">
          
          {/* Step 1: Upload Input */}
          {parsedOrders.length === 0 && !isProcessing && (
             <div className="border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-12 text-center hover:border-blue-500 dark:hover:border-blue-400 transition-colors bg-white dark:bg-slate-800">
                 <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                 <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">ลากไฟล์ลงที่นี่ หรือคลิกเพื่อเลือกไฟล์</h3>
                 <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">รูปแบบไฟล์ที่รองรับ: .xlsx, .xls</p>
                 <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".xlsx, .xls"
                    className="hidden"
                  />
                 <Button onClick={() => fileInputRef.current?.click()} className="mx-auto flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    เลือกไฟล์ Excel
                 </Button>
             </div>
          )}

          {/* Processing State */}
          {isProcessing && (
              <div className="flex flex-col items-center justify-center p-12">
                  <LoadingSpinner className="w-12 h-12 mb-4 text-blue-600" />
                  <p className="text-lg font-medium text-gray-900 dark:text-white">กำลังประมวลผลข้อมูล...</p>
                  <p className="text-sm text-gray-500 mt-2">โปรดรอสักครู่ ระบบกำลังตรวจสอบข้อมูลกับฐานข้อมูล</p>
              </div>
          )}

          {/* Step 2: Verification */}
          {parsedOrders.length > 0 && !isProcessing && (
              <div className="space-y-6">
                 {/* Summary Cards */}
                 <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                        <p className="text-sm text-gray-500 dark:text-gray-400">ออเดอร์ทั้งหมด</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{parsedOrders.length}</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-200 dark:border-green-800/50">
                        <p className="text-sm text-green-600 dark:text-green-400">พร้อมบันทึก</p>
                        <p className="text-2xl font-bold text-green-700 dark:text-green-300">{validCount}</p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-200 dark:border-red-800/50">
                        <p className="text-sm text-red-600 dark:text-red-400">พบข้อผิดพลาด</p>
                        <p className="text-2xl font-bold text-red-700 dark:text-red-300">{invalidCount}</p>
                    </div>
                 </div>

                 {/* Order List */}
                 <div className="space-y-3">
                    {parsedOrders.map((order, index) => (
                        <div key={index} className={`bg-white dark:bg-slate-800 border rounded-xl overflow-hidden transition-colors ${order.error ? 'border-red-300 dark:border-red-800/50' : 'border-gray-200 dark:border-slate-700'}`}>
                           {/* Order Header / Accordion trigger */}
                           <div 
                              onClick={() => toggleExpand(order.doc_no)}
                              className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/80"
                            >
                               <div className="flex items-center gap-4">
                                   {order.error ? (
                                       <AlertCircle className="w-5 h-5 text-red-500" />
                                   ) : (
                                       <CheckCircle2 className="w-5 h-5 text-green-500" />
                                   )}
                                   <div>
                                       <div className="flex items-center gap-2">
                                           <span className="font-semibold text-gray-900 dark:text-white">{order.customer_name}</span>
                                           <Badge className="text-xs bg-gray-100 dark:bg-slate-700">
                                               {order.doc_no}
                                           </Badge>
                                       </div>
                                       {order.error && (
                                           <p className="text-xs text-red-500 mt-1">{order.error}</p>
                                       )}
                                   </div>
                               </div>
                               
                               <div className="flex items-center gap-4">
                                   <div className="text-right">
                                       <p className="text-sm font-medium text-gray-900 dark:text-white">{order.items.length} รายการ</p>
                                       <p className="text-xs text-gray-500 dark:text-gray-400">฿{order.net_value.toLocaleString()}</p>
                                   </div>
                                   {expandedOrderId === order.doc_no ? (
                                       <ChevronUp className="w-5 h-5 text-gray-400" />
                                   ) : (
                                       <ChevronDown className="w-5 h-5 text-gray-400" />
                                   )}
                               </div>
                           </div>
                           
                           {/* Order Items Details */}
                           {expandedOrderId === order.doc_no && (
                               <div className="p-4 border-t border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50">
                                   <div className="space-y-2">
                                       {order.items.map((item, idx) => (
                                           <div key={idx} className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-lg border border-gray-100 dark:border-slate-700">
                                              <div className="flex-1">
                                                  <div className="flex items-center gap-2">
                                                      <span className="text-sm font-medium text-gray-900 dark:text-white">{item.product_name}</span>
                                                      {item.error && <Badge className="bg-red-100 text-red-700 text-[10px]">{item.error}</Badge>}
                                                  </div>
                                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                                      รหัส {item.product_code} | ราคา ฿{item.unit_price}
                                                  </p>
                                              </div>
                                              <div className="text-right">
                                                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                      {item.quantity} {item.unit}
                                                  </p>
                                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                                      รวม ฿{item.total.toLocaleString()}
                                                  </p>
                                              </div>
                                           </div>
                                       ))}
                                   </div>
                               </div>
                           )}
                        </div>
                    ))}
                 </div>
              </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 flex items-center justify-between">
           {parsedOrders.length > 0 ? (
               <>
                  <Button variant="outline" onClick={resetUpload} disabled={isProcessing}>
                      อัพโหลดไฟล์ใหม่
                  </Button>
                  <Button 
                      onClick={handleConfirmUpload} 
                      disabled={isProcessing || validCount === 0}
                      className="flex items-center gap-2"
                  >
                      <CheckCircle2 className="w-4 h-4" />
                      บันทึก {validCount} ออเดอร์
                  </Button>
               </>
           ) : (
               <div className="w-full flex justify-end">
                  <Button variant="outline" onClick={onClose}>
                      ปิดหน้าต่าง
                  </Button>
               </div>
           )}
        </div>
      </Card>
    </div>
  );
}
