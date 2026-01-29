// Utility functions for validating trip capacity (pallets and weight)
import { supabase } from '../lib/supabase';

interface ProductInfo {
  id: string;
  uses_pallet?: boolean;
  pallet_id?: string | null;
  weight_kg?: number | null;
  product_pallet_configs?: Array<{
    pallet_id: string;
    layers: number;
    units_per_layer: number;
    total_units: number;
    total_weight_kg?: number | null;
    is_default: boolean;
  }>;
}

interface VehicleInfo {
  id: string;
  max_pallets?: number | null;
  max_weight_kg?: number | null;
  loading_constraints?: {
    max_pallets?: number;
    max_weight_kg?: number;
  } | null;
}

interface TripItem {
  product_id: string;
  quantity: number;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    totalPallets: number;
    totalWeightKg: number;
    vehicleMaxPallets: number | null;
    vehicleMaxWeightKg: number | null;
  };
}

/**
 * Calculate total pallets and weight for a trip
 */
export async function calculateTripCapacity(
  items: TripItem[],
  vehicleId: string
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Load vehicle info
  const { data: vehicle, error: vehicleError } = await supabase
    .from('vehicles')
    .select('id, max_pallets, max_weight_kg, loading_constraints')
    .eq('id', vehicleId)
    .single();

  if (vehicleError || !vehicle) {
    return {
      valid: false,
      errors: ['ไม่พบข้อมูลรถ'],
      warnings: [],
      summary: {
        totalPallets: 0,
        totalWeightKg: 0,
        vehicleMaxPallets: null,
        vehicleMaxWeightKg: null,
      },
    };
  }

  const vehicleInfo: VehicleInfo = vehicle;
  const maxPallets =
    vehicleInfo.loading_constraints?.max_pallets ??
    vehicleInfo.max_pallets ??
    null;
  const maxWeightKg =
    vehicleInfo.loading_constraints?.max_weight_kg ??
    vehicleInfo.max_weight_kg ??
    null;

  // Load all products
  const productIds = [...new Set(items.map(item => item.product_id))];
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select(`
      id,
      uses_pallet,
      pallet_id,
      weight_kg,
      product_pallet_configs (
        pallet_id,
        layers,
        units_per_layer,
        total_units,
        total_weight_kg,
        is_default
      )
    `)
    .in('id', productIds)
    .eq('is_active', true);

  if (productsError) {
    return {
      valid: false,
      errors: ['ไม่สามารถโหลดข้อมูลสินค้าได้'],
      warnings: [],
      summary: {
        totalPallets: 0,
        totalWeightKg: 0,
        vehicleMaxPallets: maxPallets,
        vehicleMaxWeightKg: maxWeightKg,
      },
    };
  }

  const productMap = new Map<string, ProductInfo>();
  (products || []).forEach((p: any) => {
    productMap.set(p.id, {
      id: p.id,
      uses_pallet: p.uses_pallet,
      pallet_id: p.pallet_id,
      weight_kg: p.weight_kg,
      product_pallet_configs: p.product_pallet_configs || [],
    });
  });

  // Calculate totals
  let totalPallets = 0;
  let totalWeightKg = 0;
  const missingConfigProducts: string[] = [];

  for (const item of items) {
    const product = productMap.get(item.product_id);
    if (!product) {
      errors.push(`ไม่พบข้อมูลสินค้า ID: ${item.product_id}`);
      continue;
    }

    // Skip if product doesn't use pallet
    if (!product.uses_pallet) {
      // Still calculate weight if available
      if (product.weight_kg) {
        totalWeightKg += product.weight_kg * item.quantity;
      }
      continue;
    }

    // Find default pallet config
    const defaultConfig = product.product_pallet_configs?.find(
      config => config.is_default
    );

    if (!defaultConfig && product.product_pallet_configs?.length === 0) {
      // No config found - try to estimate from pallet_id if exists
      if (product.pallet_id) {
        // Use a simple estimation: assume 1 pallet per product (conservative)
        totalPallets += item.quantity;
        warnings.push(
          `สินค้า ${product.id} ไม่มีข้อมูลการจัดเรียงบนพาเลท ใช้ค่าประมาณ 1 พาเลทต่อสินค้า`
        );
      } else {
        missingConfigProducts.push(product.id);
      }
      continue;
    }

    if (defaultConfig) {
      // Calculate pallets needed
      const unitsPerPallet = defaultConfig.total_units;
      const palletsNeeded = Math.ceil(item.quantity / unitsPerPallet);
      totalPallets += palletsNeeded;

      // Calculate weight
      if (defaultConfig.total_weight_kg) {
        // Use weight from config (includes pallet + products)
        totalWeightKg += defaultConfig.total_weight_kg * palletsNeeded;
      } else if (product.weight_kg) {
        // Fallback: estimate from product weight
        totalWeightKg += product.weight_kg * item.quantity;
        // Add pallet weight estimate (25kg per pallet)
        totalWeightKg += 25 * palletsNeeded;
      }
    }
  }

  // Check for missing configs
  if (missingConfigProducts.length > 0) {
    errors.push(
      `สินค้าบางรายการไม่มีข้อมูลการจัดเรียงบนพาเลท: ${missingConfigProducts.join(', ')}`
    );
  }

  // Validate against vehicle capacity
  if (maxPallets !== null && totalPallets > maxPallets) {
    errors.push(
      `จำนวนพาเลทเกินความจุ: ${totalPallets} พาเลท (สูงสุด ${maxPallets} พาเลท)`
    );
  } else if (maxPallets !== null && totalPallets > maxPallets * 0.9) {
    warnings.push(
      `จำนวนพาเลทใกล้เต็มความจุ: ${totalPallets}/${maxPallets} พาเลท (${Math.round((totalPallets / maxPallets) * 100)}%)`
    );
  }

  if (maxWeightKg !== null && totalWeightKg > maxWeightKg) {
    errors.push(
      `น้ำหนักรวมเกินความจุ: ${totalWeightKg.toFixed(2)} กก. (สูงสุด ${maxWeightKg} กก.)`
    );
  } else if (maxWeightKg !== null && totalWeightKg > maxWeightKg * 0.9) {
    warnings.push(
      `น้ำหนักรวมใกล้เต็มความจุ: ${totalWeightKg.toFixed(2)}/${maxWeightKg} กก. (${Math.round((totalWeightKg / maxWeightKg) * 100)}%)`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      totalPallets,
      totalWeightKg,
      vehicleMaxPallets: maxPallets,
      vehicleMaxWeightKg: maxWeightKg,
    },
  };
}

/**
 * Quick validation (synchronous) - for real-time feedback
 * This is a lighter version that doesn't fetch from DB
 */
export function quickValidateCapacity(
  totalPallets: number,
  totalWeightKg: number,
  vehicleMaxPallets: number | null,
  vehicleMaxWeightKg: number | null
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (vehicleMaxPallets !== null && totalPallets > vehicleMaxPallets) {
    errors.push(
      `จำนวนพาเลทเกินความจุ: ${totalPallets} พาเลท (สูงสุด ${vehicleMaxPallets} พาเลท)`
    );
  } else if (vehicleMaxPallets !== null && totalPallets > vehicleMaxPallets * 0.9) {
    warnings.push(
      `จำนวนพาเลทใกล้เต็มความจุ: ${totalPallets}/${vehicleMaxPallets} พาเลท`
    );
  }

  if (vehicleMaxWeightKg !== null && totalWeightKg > vehicleMaxWeightKg) {
    errors.push(
      `น้ำหนักรวมเกินความจุ: ${totalWeightKg.toFixed(2)} กก. (สูงสุด ${vehicleMaxWeightKg} กก.)`
    );
  } else if (vehicleMaxWeightKg !== null && totalWeightKg > vehicleMaxWeightKg * 0.9) {
    warnings.push(
      `น้ำหนักรวมใกล้เต็มความจุ: ${totalWeightKg.toFixed(2)}/${vehicleMaxWeightKg} กก.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
