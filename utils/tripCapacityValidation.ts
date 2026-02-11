// Utility functions for validating trip capacity (pallets and weight)
import { supabase } from '../lib/supabase';

interface ProductData {
  id: string;
  uses_pallet?: boolean | null;
  pallet_id?: string | null;
  weight_kg?: number | null;
  height_cm?: number | null;
    product_pallet_configs?: Array<{
    id: string; // Added for Phase 0 - config selection
    pallet_id: string;
    layers: number;
    units_per_layer: number;
    total_units: number;
    total_weight_kg?: number | null;
    total_height_cm?: number | null;
    is_default: boolean;
  }> | null;
}

interface VehicleInfo {
  id: string;
  max_weight_kg?: number | null;
  cargo_height_cm?: number | null;
  loading_constraints?: {
    max_pallets?: number;
    max_weight_kg?: number;
    max_height_cm?: number;
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
    totalHeightCm: number;
    vehicleMaxPallets: number | null;
    vehicleMaxWeightKg: number | null;
    vehicleMaxHeightCm: number | null;
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
    .select('id, max_weight_kg, cargo_height_cm, loading_constraints')
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
        totalHeightCm: 0,
        vehicleMaxPallets: null,
        vehicleMaxWeightKg: null,
        vehicleMaxHeightCm: null,
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

  // อ่านความสูงสูงสุดจาก column โดยตรง หรือจาก loading_constraints
  const maxHeightCm =
    vehicleInfo.cargo_height_cm ??
    vehicleInfo.loading_constraints?.max_height_cm ??
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
        totalHeightCm: 0,
        vehicleMaxPallets: maxPallets,
        vehicleMaxWeightKg: maxWeightKg,
        vehicleMaxHeightCm: maxHeightCm,
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
      height_cm,
      product_pallet_configs (
        id,
        pallet_id,
        layers,
        units_per_layer,
        total_units,
        total_weight_kg,
        total_height_cm,
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
        totalHeightCm: 0,
        vehicleMaxPallets: maxPallets,
        vehicleMaxWeightKg: maxWeightKg,
        vehicleMaxHeightCm: maxHeightCm,
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
        totalHeightCm: 0,
        vehicleMaxPallets: maxPallets,
        vehicleMaxWeightKg: maxWeightKg,
        vehicleMaxHeightCm: maxHeightCm,
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
      height_cm: p.height_cm,
      product_pallet_configs: p.product_pallet_configs || [],
    });
  });

  // รวม quantity ต่อ product (และต่อ config ถ้ามี) — สินค้าเดียวกันจากหลายออเดอร์/ร้านนับเป็นจำนวนรวมแล้วค่อยคำนวณพาเลท
  // หมายเหตุ: totalPallets ที่ได้เป็น "แยกตามชนิดสินค้า" — การจัดเรียงจริงอาจใช้พาเลทน้อยกว่าถ้านำหลายชนิดมาวางรวม/ซ้อนบนพาเลทเดียวกัน
  const aggregatedMap = new Map<string, { product_id: string; quantity: number; selected_pallet_config_id?: string }>();
  for (const item of items) {
    const key = `${item.product_id}|${item.selected_pallet_config_id ?? ''}`;
    const existing = aggregatedMap.get(key);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      aggregatedMap.set(key, {
        product_id: item.product_id,
        quantity: item.quantity,
        selected_pallet_config_id: item.selected_pallet_config_id,
      });
    }
  }
  const aggregatedItems = Array.from(aggregatedMap.values());

  // Calculate totals
  let totalPallets = 0;
  let totalWeightKg = 0;
  let totalHeightCm = 0;
  const missingConfigProducts: string[] = [];

  for (const item of aggregatedItems) {
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
      // Calculate pallets needed from standard arrangement (จำนวนชั้น × ต่อชั้น)
      const unitsPerPallet = configToUse.total_units;
      const palletsNeeded = Math.ceil(item.quantity / unitsPerPallet);
      totalPallets += palletsNeeded;

      // น้ำหนักรวมทริป = น้ำหนักสินค้าจริง (น้ำหนักต่อหน่วย × จำนวน) + น้ำหนักพาเลทประมาณ
      // ไม่ใช้ config.total_weight_kg × palletsNeeded เพราะจะไม่ตรงกับน้ำหนักจริงเมื่อ config เก็บค่าอื่น
      const productWeight = (product.weight_kg ?? 0) * item.quantity;
      const palletWeightEstimate = 25 * palletsNeeded; // กก. ต่อพาเลทประมาณ
      totalWeightKg += productWeight + palletWeightEstimate;

      // ความสูงรวม = ยึดหลักความสูงมาตรฐานการจัดเรียงที่กำหนด (config) เท่านั้น
      if (configToUse.total_height_cm != null && configToUse.total_height_cm > 0) {
        totalHeightCm += configToUse.total_height_cm * palletsNeeded;
      } else if (configToUse.layers != null && configToUse.layers > 0 && product.height_cm != null) {
        // Fallback: ความสูงมาตรฐาน = จำนวนชั้น × ความสูงต่อหน่วย ต่อพาเลท
        totalHeightCm += configToUse.layers * product.height_cm * palletsNeeded;
      }

      // Already warned about config selection issues above if needed
      continue;
    }

    // Case 2: Product uses pallet but has no configs - ใช้ค่าประมาณเท่านั้น
    if (product.uses_pallet) {
      // ประมาณจำนวนพาเลท: ไม่ทราบหน่วยต่อพาเลท จึงใช้ประมาณ 50 หน่วย/พาเลท (แนะนำให้ตั้ง Pallet Config)
      const estimatedPallets = Math.max(1, Math.ceil(item.quantity / 50));
      totalPallets += estimatedPallets;

      // น้ำหนัก = น้ำหนักสินค้าจริง + น้ำหนักพาเลทประมาณ
      if (product.weight_kg) {
        totalWeightKg += product.weight_kg * item.quantity + 25 * estimatedPallets;
      }

      // ไม่มี config จึงไม่ทราบความสูงมาตรฐานจัดเรียง - ไม่บวกความสูง (หลีกเลี่ยงค่าผิด)
      // แนะนำให้ตั้งค่า Pallet Configuration เพื่อได้ความสูงรวมที่ถูกต้อง

      warnings.push(
        `สินค้า ${product.id} ไม่มีข้อมูลการจัดเรียงบนพาเลท ใช้ค่าประมาณ (แนะนำให้ตั้งค่า Pallet Configuration)`
      );
      continue;
    }

    // Case 3: Product doesn't use pallet - only calculate weight and height
    if (product.weight_kg) {
      totalWeightKg += product.weight_kg * item.quantity;
    }
    if (product.height_cm) {
      totalHeightCm += product.height_cm * item.quantity;
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

  // หมายเหตุ: ความสูงรวมจะไม่ block การสร้างทริปแล้ว (ให้เป็นแค่คำเตือน)
  if (maxHeightCm !== null && totalHeightCm > maxHeightCm) {
    warnings.push(
      `ความสูงรวมเกินความจุ: ${totalHeightCm.toFixed(1)} ซม. (สูงสุด ${maxHeightCm} ซม.)`
    );
  } else if (maxHeightCm !== null && totalHeightCm > maxHeightCm * 0.9) {
    warnings.push(
      `ความสูงรวมใกล้เต็มความจุ: ${totalHeightCm.toFixed(1)}/${maxHeightCm} ซม. (${Math.round((totalHeightCm / maxHeightCm) * 100)}%)`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      totalPallets,
      totalWeightKg,
      totalHeightCm,
      vehicleMaxPallets: maxPallets,
      vehicleMaxWeightKg: maxWeightKg,
      vehicleMaxHeightCm: maxHeightCm,
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
  totalHeightCm: number,
  vehicleMaxPallets: number | null,
  vehicleMaxWeightKg: number | null,
  vehicleMaxHeightCm: number | null
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

  // สูงเกินให้เป็น warning เท่านั้น ไม่ block
  if (vehicleMaxHeightCm !== null && totalHeightCm > vehicleMaxHeightCm) {
    warnings.push(
      `ความสูงรวมเกินความจุ: ${totalHeightCm.toFixed(1)} ซม. (สูงสุด ${vehicleMaxHeightCm} ซม.)`
    );
  } else if (vehicleMaxHeightCm !== null && totalHeightCm > vehicleMaxHeightCm * 0.9) {
    warnings.push(
      `ความสูงรวมใกล้เต็มความจุ: ${totalHeightCm.toFixed(1)}/${vehicleMaxHeightCm} ซม.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
