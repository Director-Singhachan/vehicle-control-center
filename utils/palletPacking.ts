/**
 * Pallet bin packing: คำนวณจำนวนพาเลทและจัดสรรสินค้าหลายชนิด onto พาเลทเดียวกัน
 * ให้จำนวนพาเลทใกล้เคียงการใช้งานจริง (รวม/ซ้อนหลายชนิดบนพาเลทเดียว)
 */
import { supabase } from '../lib/supabase';

export interface TripItemInput {
  product_id: string;
  quantity: number;
}

interface ProductForPacking {
  id: string;
  product_code: string | null;
  product_name: string | null;
  unit: string | null;
  weight_kg: number;
  volume_liter: number;
}

export interface PalletAllocationItem {
  product_id: string;
  product_name: string | null;
  product_code: string | null;
  quantity: number;
  weight_kg: number;
  volume_liter: number;
}

export interface PalletAllocation {
  pallet_index: number;
  items: PalletAllocationItem[];
  total_weight_kg: number;
  total_volume_liter: number;
}

export interface PalletPackingResult {
  totalPallets: number;
  totalWeightKg: number;
  totalVolumeLiter: number;
  palletAllocations: PalletAllocation[];
  errors: string[];
  warnings: string[];
}

/** ค่าเริ่มต้นต่อพาเลท (ถ้าไม่มีข้อมูลจากตาราง pallets) */
const DEFAULT_MAX_WEIGHT_PER_PALLET_KG = 1000;
const DEFAULT_MAX_VOLUME_LITER = 2000; // ประมาณ 120x100x170 cm

/**
 * โหลดข้อจำกัดพาเลทจาก DB (ใช้พาเลทแรกที่ active)
 */
async function getPalletLimits(): Promise<{ maxWeightKg: number; maxVolumeLiter: number }> {
  const { data, error } = await supabase
    .from('pallets')
    .select('length_cm, width_cm, max_stack_height_cm, max_weight_per_pallet_kg')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return {
      maxWeightKg: DEFAULT_MAX_WEIGHT_PER_PALLET_KG,
      maxVolumeLiter: DEFAULT_MAX_VOLUME_LITER,
    };
  }

  const maxWeightKg =
    data.max_weight_per_pallet_kg != null && data.max_weight_per_pallet_kg > 0
      ? Number(data.max_weight_per_pallet_kg)
      : DEFAULT_MAX_WEIGHT_PER_PALLET_KG;

  const length = Number(data.length_cm) || 120;
  const width = Number(data.width_cm) || 100;
  const height = Number(data.max_stack_height_cm) || 170;
  const maxVolumeLiter = (length * width * height) / 1000;

  return { maxWeightKg, maxVolumeLiter };
}

/**
 * คำนวณการจัดสรรพาเลทแบบ bin packing (รวมหลายชนิดสินค้าบนพาเลทเดียวกันได้)
 * คืนจำนวนพาเลทที่ใกล้เคียงการใช้งานจริง + รายการว่าพาเลทแต่ละใบมีสินค้าอะไรบ้าง
 */
export async function calculatePalletAllocation(
  items: TripItemInput[]
): Promise<PalletPackingResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const productIds = [...new Set(items.map((i) => i.product_id))];
  if (productIds.length === 0) {
    return {
      totalPallets: 0,
      totalWeightKg: 0,
      totalVolumeLiter: 0,
      palletAllocations: [],
      errors: [],
      warnings: [],
    };
  }

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, product_code, product_name, unit, weight_kg, volume_liter, length_cm, width_cm, height_cm')
    .in('id', productIds)
    .eq('is_active', true);

  if (productsError) {
    return {
      totalPallets: 0,
      totalWeightKg: 0,
      totalVolumeLiter: 0,
      palletAllocations: [],
      errors: ['ไม่สามารถโหลดข้อมูลสินค้าได้'],
      warnings: [],
    };
  }

  const productMap = new Map<string, ProductForPacking>();
  for (const p of products || []) {
    const weight = Number(p.weight_kg) || 0;
    let volume = Number(p.volume_liter) || 0;
    if (volume <= 0 && p.length_cm != null && p.width_cm != null && p.height_cm != null) {
      volume = (Number(p.length_cm) * Number(p.width_cm) * Number(p.height_cm)) / 1000;
    }
    if (volume <= 0) volume = 1; // ป้องกันการหารศูนย์
    productMap.set(p.id, {
      id: p.id,
      product_code: p.product_code ?? null,
      product_name: p.product_name ?? null,
      unit: p.unit ?? null,
      weight_kg: weight,
      volume_liter: volume,
    });
  }

  const aggregated = new Map<string, number>();
  for (const item of items) {
    const q = aggregated.get(item.product_id) || 0;
    aggregated.set(item.product_id, q + item.quantity);
  }

  type Line = { product_id: string; quantity: number; weightPerUnit: number; volumePerUnit: number; product: ProductForPacking };
  const lines: Line[] = [];
  for (const [productId, quantity] of aggregated) {
    const product = productMap.get(productId);
    if (!product) {
      errors.push(`ไม่พบสินค้า ID: ${productId}`);
      continue;
    }
    if (quantity <= 0) continue;
    lines.push({
      product_id: productId,
      quantity,
      weightPerUnit: product.weight_kg,
      volumePerUnit: product.volume_liter,
      product,
    });
  }

  if (lines.length === 0) {
    return {
      totalPallets: 0,
      totalWeightKg: 0,
      totalVolumeLiter: 0,
      palletAllocations: [],
      errors,
      warnings: [],
    };
  }

  const { maxWeightKg, maxVolumeLiter } = await getPalletLimits();

  // เรียงตามปริมาตรรวมมากไปน้อย (ใส่ของใหญ่ก่อน)
  lines.sort((a, b) => b.quantity * b.volumePerUnit - a.quantity * a.volumePerUnit);

  const pallets: Array<{
    weightKg: number;
    volumeLiter: number;
    items: PalletAllocationItem[];
  }> = [];

  for (const line of lines) {
    let remaining = line.quantity;
    const { product_id, weightPerUnit, volumePerUnit, product } = line;

    while (remaining > 0) {
      let currentPallet = pallets[pallets.length - 1];
      if (
        !currentPallet ||
        currentPallet.weightKg + weightPerUnit > maxWeightKg ||
        currentPallet.volumeLiter + volumePerUnit > maxVolumeLiter
      ) {
        currentPallet = {
          weightKg: 0,
          volumeLiter: 0,
          items: [],
        };
        pallets.push(currentPallet);
      }

      const spaceWeight = maxWeightKg - currentPallet.weightKg;
      const spaceVolume = maxVolumeLiter - currentPallet.volumeLiter;
      const fitByWeight = weightPerUnit > 0 ? Math.floor(spaceWeight / weightPerUnit) : remaining;
      const fitByVolume = volumePerUnit > 0 ? Math.floor(spaceVolume / volumePerUnit) : remaining;
      const canAdd = Math.min(remaining, fitByWeight, fitByVolume);
      const addQty = canAdd > 0 ? canAdd : 1;
      currentPallet.items.push({
        product_id,
        product_name: product.product_name,
        product_code: product.product_code,
        quantity: addQty,
        weight_kg: addQty * weightPerUnit,
        volume_liter: addQty * volumePerUnit,
      });
      currentPallet.weightKg += addQty * weightPerUnit;
      currentPallet.volumeLiter += addQty * volumePerUnit;
      remaining -= addQty;
    }
  }

  const totalWeightKg = pallets.reduce((s, p) => s + p.weightKg, 0);
  const totalVolumeLiter = pallets.reduce((s, p) => s + p.volumeLiter, 0);

  const palletAllocations: PalletAllocation[] = pallets.map((p, i) => ({
    pallet_index: i + 1,
    items: p.items,
    total_weight_kg: p.weightKg,
    total_volume_liter: p.volumeLiter,
  }));

  return {
    totalPallets: pallets.length,
    totalWeightKg,
    totalVolumeLiter,
    palletAllocations,
    errors,
    warnings,
  };
}
