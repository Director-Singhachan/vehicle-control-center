import * as XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Copying logic from ExcelImportView.tsx
const UNIT_MAP = {
    'BT': 'ขวด',
    'CN': 'กระป๋อง',
    'TR': 'ถาด',
    'CV': 'ลัง',
    'PA': 'แพ็ค',
    'CA': 'คาร์ตั้น',
};

const CATEGORY_RULES = [
    { name: 'เบียร์สิงห์', required: ['เบียร์', 'สิงห์'] },
    { name: 'เบียร์ลีโอ', keywords: ['ลีโอ', 'LEO'] },
    { name: 'เบียร์คาร์ลสเบิร์ก', keywords: ['คาร์ลสเบิร์ก', 'Carlsberg'] },
    { name: 'เบียร์โคโรน่า', keywords: ['โคโรน่า', 'Corona'] },
    { name: 'เบียร์มาย', keywords: ['มาย', 'MY Beer', 'MYBEER'] },
    { name: 'เบียร์สโนวี่', keywords: ['สโนวี่', 'Snowy'] },
    { name: 'เบียร์อาซาฮี', keywords: ['อาซาฮี', 'Asahi'] },
    { name: 'น้ำดื่ม', keywords: ['น้ำดื่ม'] },
    { name: 'โซดา', keywords: ['โซดา'] },
    { name: 'อิชิตัน', keywords: ['อิชิตัน'] },
    { name: 'เลม่อน', keywords: ['เลม่อน'] },
    { name: 'เหล้าอื่นๆ', keywords: ['เหล้า', 'ไวน์', 'วิสกี้', 'Spirit', 'บรั่นดี'] },
    { name: 'เบียร์อื่นๆ', keywords: ['เบียร์'] },
];

function getCategoryFromProductName(name) {
    if (!name) return 'อื่นๆ';
    const upperName = name.toUpperCase();

    for (const rule of CATEGORY_RULES) {
        if (rule.required) {
            if (rule.required.every(k => upperName.includes(k.toUpperCase()))) {
                return rule.name;
            }
        } else if (rule.keywords) {
            if (rule.keywords.some(k => upperName.includes(k.toUpperCase()))) {
                return rule.name;
            }
        }
    }
    return 'อื่นๆ';
}

async function verify() {
    const filePath = 'd:/Golf/005_Scalyst/001_SinghaChan/001_GIT/vehicle-control-center/_old_version/Step pricing Alcohol.xlsx';
    console.log(`Reading file: ${filePath}`);

    try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Read from Row 8 (range: 7)
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 7 });

        if (jsonData.length === 0) {
            console.error('No data found in file');
            return;
        }

        const headers = jsonData[0].map(h => h?.toString().trim());
        const items = jsonData.slice(1).filter(row => row[0]);

        const colIndices = {
            code: headers.findIndex(h => h && h.includes('รหัส')),
            name: headers.findIndex(h => h && h.includes('สินค้า')),
            unit: headers.findIndex(h => h && h.includes('หน่วย')),
        };

        console.log('Column Indices:', colIndices);
        console.log('Headers found:', headers.filter(Boolean).join(' | '));

        const results = items.map(row => {
            const name = row[colIndices.name]?.toString().trim() || '';
            const code = row[colIndices.code]?.toString().trim() || '';
            const unit = row[colIndices.unit]?.toString().trim() || '';
            const category = getCategoryFromProductName(name);
            return { code, name, unit, category };
        });

        console.log('\n--- Categorization Results (Top 20) ---');
        results.slice(0, 20).forEach(r => {
            console.log(`[${r.code}] ${r.name.padEnd(40)} | Unit: ${r.unit.padEnd(5)} | Category: ${r.category}`);
        });

        const stats = results.reduce((acc, curr) => {
            acc[curr.category] = (acc[curr.category] || 0) + 1;
            return acc;
        }, {});

        console.log('\n--- Category Distribution ---');
        Object.entries(stats).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
            console.log(`${cat.padEnd(20)}: ${count}`);
        });

        console.log(`\nTotal items: ${results.length}`);

    } catch (err) {
        console.error('Error:', err.message);
    }
}

verify();
