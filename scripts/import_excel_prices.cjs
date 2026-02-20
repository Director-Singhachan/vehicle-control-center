const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 1. Load Environment Variables from .env.local
const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim();
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Supabase credentials not found in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 2. Unit Mapping
const UNIT_MAP = {
    'BT': 'ขวด',
    'CA': 'คาร์ตั้น',
    'CN': 'กระป๋อง',
    'TR': 'ถาด',
    'CV': 'ลัง',
    'PA': 'แพ็ค'
};

async function importExcel() {
    try {
        const filePath = path.resolve(__dirname, '../_old_version/Step pricing Alcohol.xlsx');
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Get Printed Date from cell (Assuming it's in a specific cell, e.g., A6 or similar)
        // For now, let's use today if not found, or try to find "Printed Date" in the sheet
        let printedDate = new Date().toISOString().split('T')[0];

        // Convert to JSON starting from row 8 (index 7)
        // header: 1 means it will return an array of arrays
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 7 });

        // Header row is index 0 of data
        const headers = data[0];
        console.log('Headers found:', headers);

        // Find indices for key columns
        const colIndices = {
            code: headers.findIndex(h => h && h.includes('รหัส')),
            name: headers.findIndex(h => h && h.includes('สินค้า')),
            unit: headers.findIndex(h => h && h.includes('หน่วย')),
            prices: []
        };

        // Find Price 1 to 9
        for (let i = 1; i <= 9; i++) {
            const idx = headers.findIndex(h => h && h.includes(`ราคา ${i}`));
            if (idx !== -1) colIndices.prices.push({ level: i.toString(), index: idx });
        }

        console.log('Column Indices:', colIndices);

        // Process from Row 9 (index 1 of data)
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row || !row[colIndices.code]) continue;

            const productCode = row[colIndices.code].toString().trim();
            const productName = row[colIndices.name] ? row[colIndices.name].toString().trim() : '';
            const rawUnit = row[colIndices.unit] ? row[colIndices.unit].toString().trim() : '';
            const unit = UNIT_MAP[rawUnit] || rawUnit;

            console.log(`Processing ${productCode}: ${productName}`);

            // 1. Upsert Product
            let { data: product, error: pError } = await supabase
                .from('products')
                .select('id, base_price, unit')
                .eq('product_code', productCode)
                .maybeSingle();

            const basePrice = parseFloat(row[colIndices.prices[0]?.index] || 0); // Use Price 1 as base if needed

            if (!product) {
                console.log(`-> Creating new product: ${productCode}`);
                const { data: newP, error: insertError } = await supabase
                    .from('products')
                    .insert({
                        product_code: productCode,
                        product_name: productName,
                        unit: unit,
                        base_price: basePrice,
                        is_active: true
                    })
                    .select()
                    .single();

                if (insertError) {
                    console.error(`Error inserting product ${productCode}:`, insertError.message);
                    continue;
                }
                product = newP;

                // Log "Created"
                await logImport(printedDate, productCode, productName, unit, 'created', { initial_prices: row });
            } else {
                // Log "Updated" if changes found
                const changes = {};
                if (product.unit !== unit) changes.unit = { old: product.unit, new: unit };
                if (product.base_price !== basePrice) changes.base_price = { old: product.base_price, new: basePrice };

                if (Object.keys(changes).length > 0) {
                    await supabase.from('products').update({ unit, base_price: basePrice }).eq('id', product.id);
                }

                // Detailed price changes will be logged below
            }

            // 2. Upsert Tier Prices
            const tierChanges = {};
            for (const pInfo of colIndices.prices) {
                const price = parseFloat(row[pInfo.index] || 0);
                if (isNaN(price) || price === 0) continue;

                // Get current tier price
                const { data: currentTP } = await supabase
                    .from('product_tier_prices')
                    .select('price_per_unit')
                    .eq('product_id', product.id)
                    .eq('tier_code', pInfo.level)
                    .maybeSingle();

                if (!currentTP || currentTP.price_per_unit !== price) {
                    tierChanges[`ราคา ${pInfo.level}`] = { old: currentTP?.price_per_unit || null, new: price };

                    await supabase
                        .from('product_tier_prices')
                        .upsert({
                            product_id: product.id,
                            tier_code: pInfo.level,
                            price_per_unit: price,
                            effective_from: printedDate
                        }, { onConflict: 'product_id, tier_code' });
                }
            }

            if (Object.keys(tierChanges).length > 0) {
                await logImport(printedDate, productCode, productName, unit, 'updated', tierChanges);
            }
        }

        console.log('Import completed successfully!');

    } catch (error) {
        console.error('Import failed:', error.message);
    }
}

async function logImport(date, code, name, unit, type, changes) {
    const { error } = await supabase
        .from('product_import_logs')
        .insert({
            import_date: date,
            product_code: code,
            product_name: name,
            unit: unit,
            action_type: type,
            changes: changes
        });
    if (error) console.error('Logging failed:', error.message);
}

importExcel();
