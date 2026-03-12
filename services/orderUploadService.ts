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
  store_id?: string;
  doc_type: string;
  status: string;
  tax_exempt: number;
  tax_rate: number;
  vat: number;
  tax_type: string;
  net_value: number;
  items: UploadedOrderItem[];
  error?: string; // e.g. Store not found
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

          for (const row of rows) {
            const docDate = getCell(row, 'เอกสารวันที่');
            const docNo = getCell(row, 'เอกสารเลขที่');

            // If Document Date is present, it's a Header row
            if (docDate !== undefined && docDate !== null && String(docDate).trim() !== '') {
               currentHeaderRow = {
                 order_date: docDate instanceof Date ? docDate.toISOString().split('T')[0] : String(docDate),
                 doc_no: docNo,
                 time: getCell(row, 'เวลา'),
                 customer_name: getCell(row, 'ชื่อลูกหนี้'),
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

    // 1. Gather all unique customer names
    const customerNames = [...new Set(orders.map(o => o.customer_name).filter(Boolean))];
    
    // Fetch stores matching exactly or closely (we will try ilike or exact)
    const { data: stores, error: storesError } = await supabase
       .from('stores')
       .select('id, customer_name, customer_code') as { data: any[] | null, error: any };
       
    if (storesError) {
        console.error('Error fetching stores for validation:', storesError);
    }
    
    // Normalize string for comparison
    const normalize = (str: string) => str.replace(/\s+/g, '').toLowerCase();
    
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

    // 3. Apply validation
    return orders.map(order => {
        const validatedOrder = { ...order };
        
        // Find store
        if (stores) {
            const rawName = normalize(order.customer_name);
            const matchedStore = stores.find(s => normalize(s.customer_name) === rawName || s.customer_code === order.customer_name);
            if (matchedStore) {
               validatedOrder.store_id = matchedStore.id;
            } else {
               validatedOrder.error = `ไม่พบข้อมูลร้านค้า: ${order.customer_name}`;
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
        
        return validatedOrder;
    });
  }
};
