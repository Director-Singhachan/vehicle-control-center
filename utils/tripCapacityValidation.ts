// Utility functions for validating trip capacity (pallets and weight)
import { supabase } from '../lib/supabase';

interface ProductData {
  id: string;
  uses_pallet?: boolean | null;
  pallet_id?: string | null;
  weight_kg?: number | null;
  product_pallet_configs?: Array<{
    id: string; // Added for Phase 0 - config selection
    pallet_id: string;
    layers: number;
    units_per_layer: number;
    total_units: number;
    total_weight_kg?: number | null;
    is_default: boolean;
  }> | null;
}

interface VehicleInfo {
  id: string;
  max_weight_kg?: number | null;
  loading_constraints?: {
    max_pallets?: number;
    max_weight_kg?: number;
  } | null;
}

interface TripItem {
  product_id: string;
  quantity: number;
  selected_pallet_config_id?: string; // Phase 0: User-selected pallet config
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
  // Note: max_pallets เก็บไว้ใน loading_constraints JSON (ไม่ใช่ column โดยตรง)
  const { data: vehicle, error: vehicleError } = await supabase
    .from('vehicles')
    .select('id, max_weight_kg, loading_constraints')
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

  // อ่าน max_pallets จาก loading_constraints JSON (ไม่ใช่ column โดยตรง)
  // เพราะ frontend เก็บ max_pallets ไว้ใน loading_constraints.max_pallets
  const maxPallets = vehicleInfo.loading_constraints?.max_pallets ?? null;

  // อ่าน max_weight_kg จาก column โดยตรง หรือจาก loading_constraints
  const maxWeightKg =
    vehicleInfo.max_weight_kg ??
    vehicleInfo.loading_constraints?.max_weight_kg ??
    null;

  // Load all products
  const productIds = [...new Set(items.map(item => item.product_id))];

  if (productIds.length === 0) {
    return {
      valid: true,
      errors: [],
      warnings: [],
      summary: {
        totalPallets: 0,
        totalWeightKg: 0,
        vehicleMaxPallets: maxPallets,
        vehicleMaxWeightKg: maxWeightKg,
      },
    };
  }

  // Add timeout wrapper
  // ใช้ left join (ไม่ใส่ !inner) เพื่อให้ได้สินค้าทั้งหมด แม้ไม่มี configs
  const queryPromise = supabase
    .from('products')
    .select(`
      id,
      uses_pallet,
      pallet_id,
      weight_kg,
      product_pallet_configs (
        id,
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

  // Add timeout (10 seconds)
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Timeout: การคำนวณความจุใช้เวลานานเกินไป')), 10000);
  });

  let products, productsError;
  try {
    const result = await Promise.race([queryPromise, timeoutPromise]) as any;
    products = result.data;
    productsError = result.error;
  } catch (err: any) {
    console.error('[calculateTripCapacity] Query timeout or error:', err);
    return {
      valid: false,
      errors: [err.message || 'ไม่สามารถโหลดข้อมูลสินค้าได้ (timeout)'],
      warnings: [],
      summary: {
        totalPallets: 0,
        totalWeightKg: 0,
        vehicleMaxPallets: maxPallets,
        vehicleMaxWeightKg: maxWeightKg,
      },
    };
  }

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

  // Fetch all requested products from database
  const productMap = new Map<string, ProductData>();
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

    // NEW LOGIC: Prioritize pallet configs over uses_pallet flag
    // If product has pallet configs, calculate pallets regardless of uses_pallet
    const hasValidPalletConfigs = product.product_pallet_configs && product.product_pallet_configs.length > 0;

    // PHASE 0: Priority order for config selection:
    // 1. User-selected config (from selected_pallet_config_id)
    // 2. Default config (is_default = true)
    // 3. First available config
    let configToUse = null;

    // 1. Check if user selected a specific config
    if (item.selected_pallet_config_id && hasValidPalletConfigs) {
      configToUse = product.product_pallet_configs.find(
        c => c.id === item.selected_pallet_config_id
      );
      if (!configToUse) {
        warnings.push(
          `สินค้า ${product.id}: config ที่เลือกไว้ไม่พบ จะใช้ default แทน`
        );
      }
    }

    // 2. Fallback to default config
    if (!configToUse && hasValidPalletConfigs) {
      configToUse = product.product_pallet_configs.find(
        config => config.is_default
      );
    }

    // 3. Fallback to first available config
    if (!configToUse && hasValidPalletConfigs) {
      configToUse = product.product_pallet_configs[0];
      warnings.push(
        `สินค้า ${product.id} ไม่มี default Pallet Config - ใช้ config แรกในการคำนวณ (แนะนำให้เลือก default)`
      );
    }

    // Case 1: Product has valid pallet configs - use them!
    if (hasValidPalletConfigs && configToUse) {
      // Calculate pallets needed
      const unitsPerPallet = configToUse.total_units;
      const palletsNeeded = Math.ceil(item.quantity / unitsPerPallet);
      totalPallets += palletsNeeded;

      // Calculate weight
      if (configToUse.total_weight_kg) {
        // Use weight from config (includes pallet + products)
        totalWeightKg += configToUse.total_weight_kg * palletsNeeded;
      } else if (product.weight_kg) {
        // Fallback: estimate from product weight
        totalWeightKg += product.weight_kg * item.quantity;
        // Add pallet weight estimate (25kg per pallet)
        totalWeightKg += 25 * palletsNeeded;
      }

      // Already warned about config selection issues above if needed
      continue;
    }

    // Case 2: Product explicitly uses pallet but has no configs
    if (product.uses_pallet) {
      // ใช้ค่าประมาณแบบ conservative: 1 พาเลทต่อ product
      // (ไม่ว่าจะมี pallet_id หรือไม่ก็ตาม)
      totalPallets += item.quantity;

      // Calculate weight if available
      if (product.weight_kg) {
        totalWeightKg += product.weight_kg * item.quantity;
        // Add estimated pallet weight (25kg per pallet)
        totalWeightKg += 25 * item.quantity;
      }

      warnings.push(
        `สินค้า ${product.id} ไม่มีข้อมูลการจัดเรียงบนพาเลท ใช้ค่าประมาณ 1 พาเลทต่อสินค้า (แนะนำให้ตั้งค่า Pallet Configuration)`
      );
      continue;
    }

    // Case 3: Product doesn't use pallet - only calculate weight
    if (product.weight_kg) {
      totalWeightKg += product.weight_kg * item.quantity;
    }
  }

  // Check for missing configs - now just informational, not blocking
  // (เปลี่ยนจาก error เป็น info เพราะตอนนี้ระบบสามารถประมาณค่าได้)
  if (missingConfigProducts.length > 0) {
    // ไม่ใส่ใน errors อีกต่อไป เพราะไม่ได้ block การสร้างทริป
    // แค่แจ้งเตือนว่าควรตั้งค่า config ให้ดีกว่า
    console.warn('[tripCapacityValidation] Products without pallet config:', missingConfigProducts);
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
