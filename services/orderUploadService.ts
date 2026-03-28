import { supabase } from '../lib/supabase';
import * as readXlsxFile from 'xlsx';

export interface UploadedOrderItem {
  product_code: string;
  product_name: string;
  product_id?: string;
  unit: string;
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
  required_date: string;
  error?: string;
}

export interface UploadedOrder {
  order_date: string;
  doc_no: string;
  time: string;
  customer_name: string;
  customer_code?: string;
  store_id?: string;
  store_branch?: string;
  warehouse_id?: string;
  doc_type: string;
  status: string;
  tax_exempt: number;
  tax_rate: number;
  vat: number;
  tax_type: string;
  net_value: number;
  items: UploadedOrderItem[];
  error?: string; // e.g. Store not found
  action?: 'new' | 'update' | 'skip' | 'locked'; // To track if this order should be created, updated, skipped, or locked
}

export const orderUploadService = {
  /**
   * Parse the SML Excel Export and transform it into a list of Orders with their Items.
   */
  async parseExcel(file: File): Promise<UploadedOrder[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = readXlsxFile.read(data, { type: 'binary', cellDates: true });
          
          // Assuming the data is in the first sheet (or "SMLExportExcel")
          const sheetName = workbook.SheetNames.includes("SMLExportExcel") ? "SMLExportExcel" : workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];

          // Convert sheet to JSON array of arrays, skipping the first 5 rows (Header is 6th row, index 5)
          const jsonData = readXlsxFile.utils.sheet_to_json<any[]>(sheet, { header: 1, blankrows: false });
          
          // Row index 5 is the header
          if (jsonData.length <= 5) {
            throw new Error('ไม่พบข้อมูลในไฟล์ Excel (รูปแบบไม่ถูกต้อง)');
          }

          const headers = jsonData[5] as string[];
          const rows = jsonData.slice(6);
          
          const ordersMap = new Map<string, UploadedOrder>();
          let currentHeaderRow: any = null;

          // Helper to safely get cell by header name
          const getCell = (row: any[], headerName: string) => {
             const idx = headers.indexOf(headerName);
             return idx >= 0 ? row[idx] : null;
          };

          const formatADDate = (dateVal: any): string => {
            if (dateVal instanceof Date) {
              let year = dateVal.getFullYear();
              if (year > 2400) year -= 543;
              const month = String(dateVal.getMonth() + 1).padStart(2, '0');
              const day = String(dateVal.getDate()).padStart(2, '0');
              return `${year}-${month}-${day}`;
            }
            
            const dateStr = String(dateVal || '').trim();
            if (!dateStr) return '';
            
            // Handle various formats if it's a string
            // Format: DD/MM/YYYY or YYYY-MM-DD
            let day, month, year;
            
            if (dateStr.includes('/')) {
              const parts = dateStr.split('/');
              if (parts.length === 3) {
                day = parts[0];
                month = parts[1];
                year = parseInt(parts[2]);
              }
            } else if (dateStr.includes('-')) {
              const parts = dateStr.split('-');
              if (parts.length === 3) {
                if (parts[0].length === 4) { // YYYY-MM-DD
                  year = parseInt(parts[0]);
                  month = parts[1];
                  day = parts[2];
                } else { // DD-MM-YYYY
                  day = parts[0];
                  month = parts[1];
                  year = parseInt(parts[2]);
                }
              }
            }
            
            if (year && month && day) {
              if (year > 2400) year -= 543;
              return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            }
            
            return dateStr;
          };

          for (const row of rows) {
            const docDate = getCell(row, 'เอกสารวันที่');
            const docNo = getCell(row, 'เอกสารเลขที่');

            // If Document Date is present, it's a Header row
            if (docDate !== undefined && docDate !== null && String(docDate).trim() !== '') {
               let rawCustomerName = String(getCell(row, 'ชื่อลูกหนี้') || '').trim();
               let tempCustomerCode: string | undefined = undefined;
               
               if (rawCustomerName) {
                 const lastOpenParen = rawCustomerName.lastIndexOf('(');
                 const lastCloseParen = rawCustomerName.lastIndexOf(')');
                 if (lastOpenParen !== -1 && lastCloseParen !== -1 && lastCloseParen > lastOpenParen) {
                     tempCustomerCode = rawCustomerName.substring(lastOpenParen + 1, lastCloseParen).trim();
                     rawCustomerName = rawCustomerName.substring(0, lastOpenParen).trim();
                 }
               }

               currentHeaderRow = {
                 order_date: formatADDate(docDate),
                 doc_no: docNo,
                 time: getCell(row, 'เวลา'),
                 customer_name: rawCustomerName,
                 customer_code: tempCustomerCode,
                 doc_type: getCell(row, 'ประเภทรายการ'),
                 status: getCell(row, 'สถานะ'),
                 tax_exempt: Number(getCell(row, 'มูลค่ายกเว้นภาษี')) || 0,
                 tax_rate: Number(getCell(row, 'อัตราภาษี')) || 0,
                 vat: Number(getCell(row, 'ภาษีมูลค่าเพิ่ม')) || 0,
                 tax_type: getCell(row, 'ประเภทภาษี'),
                 net_value: Number(getCell(row, 'มูลค่าสุทธิ')) || 0,
               };
            } 
            // Otherwise, it's an item row (if it doesn't have "รหัสสินค้า" in the docNo col)
            else if (currentHeaderRow && docNo !== 'รหัสสินค้า') {
                // Column names shifted due to structure:
                // "เอกสารเลขที่" -> Product Code
                // "เวลา" -> Product Name
                // "ชื่อลูกหนี้" -> Unit
                // "ประเภทรายการ" -> Required Date
                // "แผนก" -> Quantity
                // "กลุ่มเอกสาร" -> Price
                // "ผู้ขออนุมัติ" -> Discount
                // "กลุ่มผู้อนุมัติ" -> Total Value
                
                const productCode = String(getCell(row, 'เอกสารเลขที่') || '').trim();
                if (!productCode) continue;

                const rawUnit = String(getCell(row, 'ชื่อลูกหนี้') || '');
                // Split unit by '~'
                const unitParts = rawUnit.split('~');
                const cleanUnit = unitParts.length > 1 ? unitParts[1].trim() : rawUnit.trim(); // take Thai name or use raw if no tilde
                const qtyVal = Number(getCell(row, 'แผนก')) || 0;
                
                // Only include if qty > 0
                if (qtyVal > 0) {
                    const item: UploadedOrderItem = {
                        product_code: productCode,
                        product_name: String(getCell(row, 'เวลา') || ''),
                        unit: cleanUnit,
                        required_date: String(getCell(row, 'ประเภทรายการ') || ''),
                        quantity: qtyVal,
                        unit_price: Number(getCell(row, 'กลุ่มเอกสาร')) || 0,
                        discount: Number(getCell(row, 'ผู้ขออนุมัติ')) || 0,
                        total: Number(getCell(row, 'กลุ่มผู้อนุมัติ')) || 0,
                    };

                    const orderKey = currentHeaderRow.doc_no;
                    if (!ordersMap.has(orderKey)) {
                        ordersMap.set(orderKey, { ...currentHeaderRow, items: [] });
                    }
                    ordersMap.get(orderKey)!.items.push(item);
                }
            }
          }

          resolve(Array.from(ordersMap.values()));
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = (err) => reject(err);
      reader.readAsBinaryString(file);
    });
  },

  /**
   * Validate the extracted orders against the DB (stores and products)
   */
  async validateOrders(orders: UploadedOrder[]): Promise<UploadedOrder[]> {
    if (orders.length === 0) return orders;

    // 1. Gather all unique customer codes for filtering
    const uniqueCustomerCodes = [...new Set(orders.map(o => o.customer_code).filter(Boolean))] as string[];
    
    // Fetch ONLY stores that match the codes from Excel
    // This bypasses the 1000-row limit issue
    const { data: stores, error: storesError } = await supabase
       .from('stores')
       .select('id, customer_name, customer_code, branch')
       .in('customer_code', uniqueCustomerCodes) as { data: any[] | null, error: any };
       
    if (storesError) {
        console.error('Error fetching stores for validation:', storesError);
    }
    
    // Normalize string for comparison (Lowercase, remove all spaces, remove non-alphanumeric if needed)
    const normalize = (str: string | null | undefined) => (str || '').replace(/\s+/g, '').toLowerCase();
    const normalizeCode = (c: string | null | undefined) => (c || '').trim().toUpperCase();
    
    // 2. Gather all unique product codes
    const productCodes = new Set<string>();
    orders.forEach(o => o.items.forEach(i => {
        if (i.product_code) productCodes.add(i.product_code);
    }));

    // Fetch products
    const { data: products, error: productsError } = await supabase
       .from('products')
       .select('id, product_code, product_name, unit')
       .in('product_code', Array.from(productCodes)) as { data: any[] | null, error: any };
       
    if (productsError) {
        console.error('Error fetching products for validation:', productsError);
    }
    
    const productMap = new Map((products ?? []).map(p => [p.product_code, p]));

    // 2.5 Fetch existing orders by sml_doc_no for diff checking
    const docNos = [...new Set(orders.map(o => o.doc_no).filter(Boolean))];
    const { data: existingOrders } = docNos.length > 0 ? await supabase
        .from('orders')
        .select('id, sml_doc_no, delivery_trip_id')
        .in('sml_doc_no', docNos) : { data: [] };
    
    // Fetch trip statuses for orders that have a trip
    let tripStatusMap = new Map<string, string>();
    if (existingOrders && existingOrders.length > 0) {
        const tripIds = [...new Set(existingOrders.map(o => o.delivery_trip_id).filter(Boolean))];
        if (tripIds.length > 0) {
            const { data: trips } = await supabase
                .from('delivery_trips')
                .select('id, status')
                .in('id', tripIds);
            for (const t of trips ?? []) {
                tripStatusMap.set(t.id, t.status);
            }
        }
    }
        
    let existingItems: any[] = [];
    if (existingOrders && existingOrders.length > 0) {
        const orderIds = existingOrders.map(o => o.id);
        const { data: items } = await supabase
            .from('order_items')
            .select('order_id, product_id, quantity, unit_price')
            .in('order_id', orderIds);
        existingItems = items || [];
    }

    // 3. Apply validation and diff checking
    return orders.map(order => {
        const validatedOrder = { ...order };
        
        // Find store
        if (stores) {
            const searchCode = normalizeCode(order.customer_code);
            const matchedStore = searchCode ? stores.find(s => normalizeCode(s.customer_code) === searchCode) : undefined;

            if (matchedStore) {
               validatedOrder.store_id = matchedStore.id;
               validatedOrder.store_branch = matchedStore.branch;
            } else {
               validatedOrder.error = `ไม่พบรหัสร้านค้า "${order.customer_code || '-'}" ในระบบ (ตรวจสอบจากวงเล็บสุดท้ายในชื่อ)`;
            }
        } else {
            validatedOrder.error = 'ไม่สามารถดึงข้อมูลร้านค้าเพื่อตรวจสอบได้';
        }

        // Validate items
        validatedOrder.items = order.items.map(item => {
           const validatedItem = { ...item };
           const matchedProduct = productMap.get(item.product_code);
           if (matchedProduct) {
               validatedItem.product_id = matchedProduct.id;
           } else {
               validatedItem.error = `ไม่พบรหัสสินค้าในระบบ`;
           }
           return validatedItem;
        });
        
        // Check if order has item errors
        if (!validatedOrder.error && validatedOrder.items.some(i => i.error)) {
            validatedOrder.error = 'มีรายการสินค้าที่ไม่ถูกต้อง';
        }

        // If no errors, determine action (new, update, skip, locked)
        if (!validatedOrder.error) {
            const existingOrder = existingOrders?.find(o => o.sml_doc_no === validatedOrder.doc_no);
            
            if (!existingOrder) {
                validatedOrder.action = 'new';
            } else {
                // Check if the order's trip has departed (in_progress or completed)
                if (existingOrder.delivery_trip_id) {
                    const tripStatus = tripStatusMap.get(existingOrder.delivery_trip_id);
                    if (tripStatus === 'in_progress' || tripStatus === 'completed') {
                        validatedOrder.action = 'locked';
                        validatedOrder.error = `ออเดอร์นี้อยู่ในทริปที่ออกรถแล้ว (สถานะ: ${tripStatus === 'in_progress' ? 'กำลังจัดส่ง' : 'เสร็จสิ้น'}) ไม่สามารถอัพเดตได้`;
                        return validatedOrder;
                    }
                }

                // Order exists but trip is editable, check items for differences
                const orderExistingItems = existingItems.filter(i => i.order_id === existingOrder.id);
                
                let isIdentical = true;
                if (orderExistingItems.length !== validatedOrder.items.length) {
                    isIdentical = false;
                } else {
                    for (const vItem of validatedOrder.items) {
                        const actualUnitPrice = vItem.unit_price === 0 ? 0 : vItem.unit_price;
                        const matchingDbItem = orderExistingItems.find(dbItem => 
                            dbItem.product_id === vItem.product_id && 
                            Number(dbItem.quantity) === Number(vItem.quantity) &&
                            Number(dbItem.unit_price) === Number(actualUnitPrice)
                        );
                        if (!matchingDbItem) {
                            isIdentical = false;
                            break;
                        }
                    }
                }
                
                validatedOrder.action = isIdentical ? 'skip' : 'update';
            }
        }
        
        return validatedOrder;
    });
  }
};
