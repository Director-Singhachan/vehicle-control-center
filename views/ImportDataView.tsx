// Import Data View - Import stores and products from CSV/Excel
import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  Package,
  Store,
  CheckCircle,
  AlertCircle,
  X,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';
import { storeService } from '../services/storeService';
import { productService } from '../services/productService';
import { useStores, useProducts } from '../hooks';

export const ImportDataView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'stores' | 'products'>('stores');
  const [storesFile, setStoresFile] = useState<File | null>(null);
  const [productsFile, setProductsFile] = useState<File | null>(null);
  const [importingStores, setImportingStores] = useState(false);
  const [importingProducts, setImportingProducts] = useState(false);
  const [storesResult, setStoresResult] = useState<{
    success: number;
    errors: string[];
  } | null>(null);
  const [productsResult, setProductsResult] = useState<{
    success: number;
    errors: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const storesFileInputRef = useRef<HTMLInputElement>(null);
  const productsFileInputRef = useRef<HTMLInputElement>(null);

  const { refetch: refetchStores } = useStores();
  const { refetch: refetchProducts } = useProducts();

  // Parse CSV file
  const parseCSV = (text: string): string[][] => {
    const lines: string[][] = [];
    let currentLine: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentField += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        currentLine.push(currentField.trim());
        currentField = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (currentField || currentLine.length > 0) {
          currentLine.push(currentField.trim());
          currentField = '';
          if (currentLine.length > 0) {
            lines.push(currentLine);
            currentLine = [];
          }
        }
        if (char === '\r' && nextChar === '\n') {
          i++; // Skip \n after \r
        }
      } else {
        currentField += char;
      }
    }

    // Add last field and line
    if (currentField || currentLine.length > 0) {
      currentLine.push(currentField.trim());
    }
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    return lines;
  };

  // Import Stores
  const handleImportStores = async () => {
    if (!storesFile) {
      setError('กรุณาเลือกไฟล์');
      return;
    }

    try {
      setImportingStores(true);
      setError(null);
      setStoresResult(null);

      const text = await storesFile.text();
      const lines = parseCSV(text);

      if (lines.length < 2) {
        throw new Error('ไฟล์ต้องมี header และข้อมูลอย่างน้อย 1 แถว');
      }

      // Find header indices
      const header = lines[0].map(h => h.toLowerCase().trim());
      const customerCodeIndex = header.findIndex(h =>
        h.includes('customer') && h.includes('code')
      );
      const customerNameIndex = header.findIndex(h =>
        h.includes('customer') && h.includes('name')
      );

      if (customerCodeIndex === -1 || customerNameIndex === -1) {
        throw new Error('ไม่พบคอลัมน์ Customer Code หรือ Customer Name ในไฟล์');
      }

      // Parse data
      const storesData = [];
      const errors: string[] = [];
      const seenCodes = new Set<string>(); // Track duplicate codes in file

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.length === 0) continue;

        const customerCode = line[customerCodeIndex]?.trim();
        const customerName = line[customerNameIndex]?.trim();

        if (!customerCode || !customerName) {
          errors.push(`แถว ${i + 1}: ขาด Customer Code หรือ Customer Name`);
          continue;
        }

        // Check for duplicate in file
        if (seenCodes.has(customerCode)) {
          errors.push(`แถว ${i + 1}: Customer Code "${customerCode}" ซ้ำในไฟล์`);
          continue;
        }

        seenCodes.add(customerCode);
        storesData.push({
          customer_code: customerCode,
          customer_name: customerName,
          is_active: true,
        });
      }

      if (storesData.length === 0) {
        throw new Error('ไม่มีข้อมูลที่ถูกต้องสำหรับ import');
      }

      // Check for existing stores in database before import
      const existingStores = await storeService.getAll({});
      const existingCodes = new Set(existingStores.map(s => s.customer_code));
      const newStoresData = [];
      const skippedStores: string[] = [];

      for (const store of storesData) {
        if (existingCodes.has(store.customer_code)) {
          skippedStores.push(`Customer Code "${store.customer_code}" มีอยู่ในระบบแล้ว (ข้าม)`);
        } else {
          newStoresData.push(store);
        }
      }

      if (newStoresData.length === 0) {
        throw new Error('ร้านค้าทั้งหมดมีอยู่ในระบบแล้ว ไม่มีข้อมูลใหม่ที่จะ import');
      }

      // Import to database (only new stores)
      // Note: bulkImport will skip duplicates automatically, so we can pass all stores
      // But we've already filtered them above for better UX
      try {
        const imported = await storeService.bulkImport(newStoresData);
        
        // Add skipped stores to errors/warnings
        if (skippedStores.length > 0) {
          errors.push(...skippedStores);
        }

        setStoresResult({
          success: imported.length,
          errors,
        });
      } catch (err: any) {
        // If bulkImport throws, it means no stores were imported at all
        // But we've already filtered duplicates, so this shouldn't happen
        // Still, handle it gracefully
        console.error('[ImportDataView] Error in bulkImport:', err);
        setStoresResult({
          success: 0,
          errors: [...errors, ...skippedStores, err.message || 'ไม่สามารถ import ข้อมูลได้'],
        });
      }

      // Reset file input
      if (storesFileInputRef.current) {
        storesFileInputRef.current.value = '';
      }
      setStoresFile(null);

      // Refetch stores
      await refetchStores();
    } catch (err: any) {
      console.error('[ImportDataView] Error importing stores:', err);
      setError(err.message || 'ไม่สามารถ import ข้อมูลร้านค้าได้');
    } finally {
      setImportingStores(false);
    }
  };

  // Import Products
  const handleImportProducts = async () => {
    if (!productsFile) {
      setError('กรุณาเลือกไฟล์');
      return;
    }

    try {
      setImportingProducts(true);
      setError(null);
      setProductsResult(null);

      const text = await productsFile.text();
      const lines = parseCSV(text);

      if (lines.length < 2) {
        throw new Error('ไฟล์ต้องมี header และข้อมูลอย่างน้อย 1 แถว');
      }

      // Find header indices
      const header = lines[0].map(h => h.toLowerCase().trim());
      const categoryIndex = header.findIndex(h => h.includes('หมวดหมู่') || h.includes('category'));
      const productCodeIndex = header.findIndex(h =>
        h.includes('รหัส') && h.includes('สินค้า') || h.includes('product') && h.includes('code')
      );
      const productNameIndex = header.findIndex(h =>
        h.includes('ชื่อ') && h.includes('สินค้า') || h.includes('product') && h.includes('name')
      );
      const unitIndex = header.findIndex(h => h.includes('หน่วย') || h.includes('unit'));

      if (categoryIndex === -1 || productCodeIndex === -1 || productNameIndex === -1 || unitIndex === -1) {
        throw new Error('ไม่พบคอลัมน์ที่จำเป็น (หมวดหมู่, รหัสสินค้า, ชื่อสินค้า, หน่วย) ในไฟล์');
      }

      // Parse data
      const productsData = [];
      const errors: string[] = [];
      const seenCodeUnitPairs = new Set<string>(); // Track duplicate (code, unit) pairs in file

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.length === 0) continue;

        const category = line[categoryIndex]?.trim();
        const productCode = line[productCodeIndex]?.trim();
        const productName = line[productNameIndex]?.trim();
        const unit = line[unitIndex]?.trim();

        if (!category || !productCode || !productName || !unit) {
          errors.push(`แถว ${i + 1}: ขาดข้อมูลบางส่วน`);
          continue;
        }

        // Check for duplicate (product_code, unit) pair in file
        // Same product_code can have different units (e.g., ถาด, กระป๋อง, ลัง)
        const codeUnitKey = `${productCode}|${unit}`;
        if (seenCodeUnitPairs.has(codeUnitKey)) {
          errors.push(`แถว ${i + 1}: รหัสสินค้า "${productCode}" หน่วย "${unit}" ซ้ำในไฟล์`);
          continue;
        }

        seenCodeUnitPairs.add(codeUnitKey);
        productsData.push({
          category,
          product_code: productCode,
          product_name: productName,
          unit,
          is_active: true,
        });
      }

      if (productsData.length === 0) {
        throw new Error('ไม่มีข้อมูลที่ถูกต้องสำหรับ import');
      }

      // Check for existing products in database before import
      // Check by (product_code, unit) combination, not just product_code
      const existingProducts = await productService.getAll({});
      const existingCodeUnitPairs = new Set(
        existingProducts.map(p => `${p.product_code}|${p.unit}`)
      );
      const newProductsData = [];
      const skippedProducts: string[] = [];

      for (const product of productsData) {
        const codeUnitKey = `${product.product_code}|${product.unit}`;
        if (existingCodeUnitPairs.has(codeUnitKey)) {
          skippedProducts.push(`รหัสสินค้า "${product.product_code}" หน่วย "${product.unit}" มีอยู่ในระบบแล้ว (ข้าม)`);
        } else {
          newProductsData.push(product);
        }
      }

      if (newProductsData.length === 0) {
        throw new Error('สินค้าทั้งหมดมีอยู่ในระบบแล้ว ไม่มีข้อมูลใหม่ที่จะ import');
      }

      // Import to database (only new products)
      // Note: bulkImport will skip duplicates automatically, so we can pass all products
      // But we've already filtered them above for better UX
      try {
        const imported = await productService.bulkImport(newProductsData);
        
        // Add skipped products to errors/warnings
        if (skippedProducts.length > 0) {
          errors.push(...skippedProducts);
        }

        setProductsResult({
          success: imported.length,
          errors,
        });
      } catch (err: any) {
        // If bulkImport throws, it means no products were imported at all
        // But we've already filtered duplicates, so this shouldn't happen
        // Still, handle it gracefully
        console.error('[ImportDataView] Error in bulkImport:', err);
        setProductsResult({
          success: 0,
          errors: [...errors, ...skippedProducts, err.message || 'ไม่สามารถ import ข้อมูลได้'],
        });
      }

      // Reset file input
      if (productsFileInputRef.current) {
        productsFileInputRef.current.value = '';
      }
      setProductsFile(null);

      // Refetch products
      await refetchProducts();
    } catch (err: any) {
      console.error('[ImportDataView] Error importing products:', err);
      setError(err.message || 'ไม่สามารถ import ข้อมูลสินค้าได้');
    } finally {
      setImportingProducts(false);
    }
  };

  // Download template
  const downloadTemplate = (type: 'stores' | 'products') => {
    let csvContent = '';
    let filename = '';

    if (type === 'stores') {
      csvContent = 'Customer Code,Customer Name\nCUST001,ร้านค้าตัวอย่าง 1\nCUST002,ร้านค้าตัวอย่าง 2';
      filename = 'template-stores.csv';
    } else {
      csvContent = 'หมวดหมู่,รหัสสินค้า,ชื่อสินค้า,หน่วย\nอาหาร,PROD001,สินค้าตัวอย่าง 1,ชิ้น\nเครื่องดื่ม,PROD002,สินค้าตัวอย่าง 2,ขวด';
      filename = 'template-products.csv';
    }

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <PageLayout
      title="Import ข้อมูล"
      subtitle="นำเข้าข้อมูลร้านค้าและสินค้าจากไฟล์ CSV"
    >
      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('stores')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'stores'
                ? 'border-enterprise-600 text-enterprise-600 dark:text-enterprise-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <Store size={18} />
              Import ร้านค้า
            </div>
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'products'
                ? 'border-enterprise-600 text-enterprise-600 dark:text-enterprise-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <Package size={18} />
              Import สินค้า
            </div>
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <Card className="p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          </Card>
        )}

        {/* Import Stores */}
        {activeTab === 'stores' && (
          <Card>
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                <Store size={20} />
                Import ร้านค้า
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                นำเข้าข้อมูลร้านค้าจากไฟล์ CSV โดยต้องมีคอลัมน์: Customer Code, Customer Name
              </p>
            </div>

            <div className="space-y-4">
              {/* Instructions */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">วิธีใช้งาน:</h4>
                <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 dark:text-blue-300">
                  <li>ดาวน์โหลดไฟล์ Template ด้านล่าง</li>
                  <li>กรอกข้อมูลร้านค้าในไฟล์ CSV (Customer Code, Customer Name)</li>
                  <li>เลือกไฟล์ CSV ที่ต้องการ import</li>
                  <li>กดปุ่ม "Import ข้อมูล"</li>
                </ol>
              </div>

              {/* Download Template */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => downloadTemplate('stores')}
                  className="flex items-center gap-2"
                >
                  <Download size={18} />
                  ดาวน์โหลด Template
                </Button>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  ไฟล์ CSV ต้องมี header: Customer Code, Customer Name
                </span>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  เลือกไฟล์ CSV
                </label>
                <div className="flex items-center gap-4">
                  <input
                    ref={storesFileInputRef}
                    type="file"
                    accept=".csv,.txt"
                    onChange={(e) => setStoresFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-slate-500 dark:text-slate-400
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-semibold
                      file:bg-enterprise-50 file:text-enterprise-700
                      hover:file:bg-enterprise-100
                      dark:file:bg-enterprise-900 dark:file:text-enterprise-300"
                  />
                  {storesFile && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <FileText size={18} />
                      <span>{storesFile.name}</span>
                      <button
                        onClick={() => {
                          setStoresFile(null);
                          if (storesFileInputRef.current) {
                            storesFileInputRef.current.value = '';
                          }
                        }}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Import Button */}
              <Button
                onClick={handleImportStores}
                isLoading={importingStores}
                disabled={!storesFile || importingStores}
                className="flex items-center gap-2"
              >
                <Upload size={18} />
                Import ข้อมูล
              </Button>

              {/* Result */}
              {storesResult && (
                <div className={`p-4 rounded-lg ${
                  storesResult.errors.length > 0
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                    : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {storesResult.errors.length === 0 ? (
                      <CheckCircle className="text-green-600 dark:text-green-400" size={20} />
                    ) : (
                      <AlertCircle className="text-yellow-600 dark:text-yellow-400" size={20} />
                    )}
                    <span className={`font-medium ${
                      storesResult.errors.length === 0
                        ? 'text-green-800 dark:text-green-200'
                        : 'text-yellow-800 dark:text-yellow-200'
                    }`}>
                      Import สำเร็จ {storesResult.success} รายการ
                    </span>
                  </div>
                  {storesResult.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                        ข้อผิดพลาด ({storesResult.errors.length} รายการ):
                      </p>
                      <ul className="list-disc list-inside text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                        {storesResult.errors.map((err, index) => (
                          <li key={index}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Import Products */}
        {activeTab === 'products' && (
          <Card>
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                <Package size={20} />
                Import สินค้า
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                นำเข้าข้อมูลสินค้าจากไฟล์ CSV โดยต้องมีคอลัมน์: หมวดหมู่, รหัสสินค้า, ชื่อสินค้า, หน่วย
              </p>
            </div>

            <div className="space-y-4">
              {/* Instructions */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">วิธีใช้งาน:</h4>
                <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 dark:text-blue-300">
                  <li>ดาวน์โหลดไฟล์ Template ด้านล่าง</li>
                  <li>กรอกข้อมูลสินค้าในไฟล์ CSV (หมวดหมู่, รหัสสินค้า, ชื่อสินค้า, หน่วย)</li>
                  <li>เลือกไฟล์ CSV ที่ต้องการ import</li>
                  <li>กดปุ่ม "Import ข้อมูล"</li>
                </ol>
              </div>

              {/* Download Template */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => downloadTemplate('products')}
                  className="flex items-center gap-2"
                >
                  <Download size={18} />
                  ดาวน์โหลด Template
                </Button>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  ไฟล์ CSV ต้องมี header: หมวดหมู่, รหัสสินค้า, ชื่อสินค้า, หน่วย
                </span>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  เลือกไฟล์ CSV
                </label>
                <div className="flex items-center gap-4">
                  <input
                    ref={productsFileInputRef}
                    type="file"
                    accept=".csv,.txt"
                    onChange={(e) => setProductsFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-slate-500 dark:text-slate-400
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-semibold
                      file:bg-enterprise-50 file:text-enterprise-700
                      hover:file:bg-enterprise-100
                      dark:file:bg-enterprise-900 dark:file:text-enterprise-300"
                  />
                  {productsFile && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <FileText size={18} />
                      <span>{productsFile.name}</span>
                      <button
                        onClick={() => {
                          setProductsFile(null);
                          if (productsFileInputRef.current) {
                            productsFileInputRef.current.value = '';
                          }
                        }}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Import Button */}
              <Button
                onClick={handleImportProducts}
                isLoading={importingProducts}
                disabled={!productsFile || importingProducts}
                className="flex items-center gap-2"
              >
                <Upload size={18} />
                Import ข้อมูล
              </Button>

              {/* Result */}
              {productsResult && (
                <div className={`p-4 rounded-lg ${
                  productsResult.errors.length > 0
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                    : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {productsResult.errors.length === 0 ? (
                      <CheckCircle className="text-green-600 dark:text-green-400" size={20} />
                    ) : (
                      <AlertCircle className="text-yellow-600 dark:text-yellow-400" size={20} />
                    )}
                    <span className={`font-medium ${
                      productsResult.errors.length === 0
                        ? 'text-green-800 dark:text-green-200'
                        : 'text-yellow-800 dark:text-yellow-200'
                    }`}>
                      Import สำเร็จ {productsResult.success} รายการ
                    </span>
                  </div>
                  {productsResult.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                        ข้อผิดพลาด ({productsResult.errors.length} รายการ):
                      </p>
                      <ul className="list-disc list-inside text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                        {productsResult.errors.map((err, index) => (
                          <li key={index}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </PageLayout>
  );
};

