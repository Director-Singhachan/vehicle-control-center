import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type CustomerTier = Database['public']['Tables']['customer_tiers']['Row'];
type CustomerTierInsert = Database['public']['Tables']['customer_tiers']['Insert'];
type CustomerTierUpdate = Database['public']['Tables']['customer_tiers']['Update'];

type ProductTierPrice = Database['public']['Tables']['product_tier_prices']['Row'];
type ProductTierPriceInsert = Database['public']['Tables']['product_tier_prices']['Insert'];
type ProductTierPriceUpdate = Database['public']['Tables']['product_tier_prices']['Update'];

// ========================================
// Customer Tiers Service
// ========================================

export const customerTierService = {
  /**
   * ดึงระดับลูกค้าทั้งหมด
   */
  async getAll() {
    const { data, error } = await supabase
      .from('customer_tiers')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (error) throw error;
    return data as CustomerTier[];
  },

  /**
   * ดึงระดับลูกค้าตาม ID
   */
  async getById(id: string) {
    const { data, error } = await supabase
      .from('customer_tiers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as CustomerTier;
  },

  /**
   * ดึงระดับลูกค้าตาม tier_code
   */
  async getByCode(tierCode: string) {
    const { data, error } = await supabase
      .from('customer_tiers')
      .select('*')
      .eq('tier_code', tierCode)
      .single();

    if (error) throw error;
    return data as CustomerTier;
  },

  /**
   * สร้างระดับลูกค้าใหม่
   */
  async create(tier: CustomerTierInsert) {
    const { data, error } = await supabase
      .from('customer_tiers')
      .insert(tier)
      .select()
      .single();

    if (error) throw error;
    return data as CustomerTier;
  },

  /**
   * อัพเดทระดับลูกค้า
   */
  async update(id: string, updates: CustomerTierUpdate) {
    const { data, error } = await supabase
      .from('customer_tiers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as CustomerTier;
  },

  /**
   * ลบระดับลูกค้า (soft delete)
   */
  async delete(id: string) {
    const { error } = await supabase
      .from('customer_tiers')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * นับจำนวนลูกค้าในแต่ละระดับ
   */
  async getCustomerCountByTier() {
    const { data, error } = await supabase
      .from('stores')
      .select(`
        tier_id,
        customer_tiers!inner(tier_code, tier_name, color)
      `);

    if (error) throw error;

    // นับจำนวนลูกค้าในแต่ละ tier
    const counts = data.reduce((acc: any, store: any) => {
      const tierId = store.tier_id;
      if (!tierId) return acc;

      if (!acc[tierId]) {
        acc[tierId] = {
          tier_id: tierId,
          tier_code: store.customer_tiers.tier_code,
          tier_name: store.customer_tiers.tier_name,
          color: store.customer_tiers.color,
          count: 0,
        };
      }
      acc[tierId].count += 1;
      return acc;
    }, {});

    return Object.values(counts);
  },
};

// ========================================
// Product Tier Prices Service
// ========================================

export const productTierPriceService = {
  /**
   * ดึงราคาของสินค้าตามระดับลูกค้า
   */
  async getByProduct(productId: string) {
    const { data, error } = await supabase
      .from('product_tier_prices')
      .select(`
        *,
        tier:customer_tiers(*)
      `)
      .eq('product_id', productId)
      .eq('is_active', true)
      .order('min_quantity');

    if (error) throw error;
    return data;
  },

  /**
   * ดึงราคาของหลายสินค้าพร้อมกัน
   */
  async getByProducts(productIds: string[]) {
    const { data, error } = await supabase
      .from('product_tier_prices')
      .select(`
        *,
        tier:customer_tiers(*),
        product:products(product_code, product_name)
      `)
      .in('product_id', productIds)
      .eq('is_active', true)
      .order('product_id')
      .order('min_quantity');

    if (error) throw error;
    return data;
  },

  /**
   * ดึงราคาทั้งหมดของระดับลูกค้าหนึ่ง
   */
  async getByTier(tierId: string) {
    const { data, error } = await supabase
      .from('product_tier_prices')
      .select(`
        *,
        product:products(*)
      `)
      .eq('tier_id', tierId)
      .eq('is_active', true)
      .order('product_id');

    if (error) throw error;
    return data;
  },

  /**
   * คำนวณราคาสำหรับลูกค้า
   */
  async calculatePriceForStore(
    productId: string,
    storeId: string,
    quantity: number = 1,
    date?: string
  ): Promise<number> {
    const effectiveDate = date || new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .rpc('get_product_price_for_store', {
        p_product_id: productId,
        p_store_id: storeId,
        p_quantity: quantity,
        p_date: effectiveDate,
      });

    if (error) throw error;
    return data || 0;
  },

  /**
   * สร้างราคาสินค้าสำหรับ tier
   */
  async create(price: ProductTierPriceInsert) {
    const { data, error } = await supabase
      .from('product_tier_prices')
      .insert(price)
      .select(`
        *,
        tier:customer_tiers(*)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * สร้างราคาหลายรายการพร้อมกัน (Bulk insert)
   */
  async createBulk(prices: ProductTierPriceInsert[]) {
    const { data, error } = await supabase
      .from('product_tier_prices')
      .insert(prices)
      .select();

    if (error) throw error;
    return data;
  },

  /**
   * อัพเดทราคา
   */
  async update(id: string, updates: ProductTierPriceUpdate) {
    // บันทึกประวัติการเปลี่ยนราคา
    if (updates.price) {
      const { data: current } = await supabase
        .from('product_tier_prices')
        .select('product_id, tier_id, price')
        .eq('id', id)
        .single();

      if (current && current.price !== updates.price) {
        await this.recordPriceChange(
          current.product_id,
          current.tier_id,
          current.price,
          updates.price,
          updates.created_by || null
        );
      }
    }

    const { data, error } = await supabase
      .from('product_tier_prices')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        tier:customer_tiers(*)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * ลบราคา (soft delete)
   */
  async delete(id: string) {
    const { error } = await supabase
      .from('product_tier_prices')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * บันทึกประวัติการเปลี่ยนราคา
   */
  async recordPriceChange(
    productId: string,
    tierId: string | null,
    oldPrice: number,
    newPrice: number,
    changedBy: string | null,
    reason?: string
  ) {
    const { error } = await supabase
      .from('price_change_history')
      .insert({
        product_id: productId,
        tier_id: tierId,
        old_price: oldPrice,
        new_price: newPrice,
        change_reason: reason || null,
        effective_date: new Date().toISOString().split('T')[0],
        changed_by: changedBy,
      });

    if (error) throw error;
  },

  /**
   * ดึงประวัติการเปลี่ยนราคา
   */
  async getPriceHistory(productId?: string, tierId?: string) {
    let query = supabase
      .from('price_change_history')
      .select(`
        *,
        product:products(product_code, product_name),
        tier:customer_tiers(tier_code, tier_name),
        changer:profiles(full_name, email)
      `)
      .order('created_at', { ascending: false });

    if (productId) {
      query = query.eq('product_id', productId);
    }
    if (tierId) {
      query = query.eq('tier_id', tierId);
    }

    const { data, error } = await query.limit(100);
    if (error) throw error;
    return data;
  },

  /**
   * คัดลอกราคาจาก tier หนึ่งไปยังอีก tier
   */
  async copyPricesFromTier(sourceTierId: string, targetTierId: string, userId: string) {
    // ดึงราคาจาก source tier
    const { data: sourcePrices, error: fetchError } = await supabase
      .from('product_tier_prices')
      .select('product_id, price, min_quantity')
      .eq('tier_id', sourceTierId)
      .eq('is_active', true);

    if (fetchError) throw fetchError;
    if (!sourcePrices || sourcePrices.length === 0) {
      throw new Error('ไม่พบราคาใน tier ต้นทาง');
    }

    // สร้างราคาใหม่สำหรับ target tier
    const newPrices = sourcePrices.map((sp) => ({
      product_id: sp.product_id,
      tier_id: targetTierId,
      price: sp.price,
      min_quantity: sp.min_quantity,
      created_by: userId,
    }));

    return this.createBulk(newPrices);
  },

  /**
   * ปรับราคาทั้งหมดใน tier ด้วยเปอร์เซ็นต์
   */
  async adjustTierPricesByPercent(
    tierId: string,
    adjustmentPercent: number,
    userId: string
  ) {
    // ดึงราคาปัจจุบัน
    const { data: currentPrices, error: fetchError } = await supabase
      .from('product_tier_prices')
      .select('*')
      .eq('tier_id', tierId)
      .eq('is_active', true);

    if (fetchError) throw fetchError;
    if (!currentPrices || currentPrices.length === 0) {
      throw new Error('ไม่พบราคาใน tier นี้');
    }

    // อัพเดทราคาแต่ละรายการ
    const updates = currentPrices.map(async (price) => {
      const newPrice = price.price * (1 + adjustmentPercent / 100);
      return this.update(price.id, {
        price: Math.round(newPrice * 100) / 100, // ปัดเศษ 2 ตำแหน่ง
        created_by: userId,
      });
    });

    return Promise.all(updates);
  },
};

// ========================================
// Summary/Report Functions
// ========================================

export const pricingReportService = {
  /**
   * สรุปราคาสินค้าทั้งหมด
   */
  async getProductPricesSummary() {
    const { data, error } = await supabase
      .from('product_prices_summary')
      .select('*')
      .order('product_code')
      .order('tier_code');

    if (error) throw error;
    return data;
  },

  /**
   * เปรียบเทียบราคาสินค้าระหว่าง tiers
   */
  async comparePricesAcrossTiers(productId: string) {
    const prices = await productTierPriceService.getByProduct(productId);
    
    // จัดกลุ่มตาม tier
    const pricesByTier = prices.reduce((acc: any, price: any) => {
      if (!acc[price.tier_id]) {
        acc[price.tier_id] = {
          tier: price.tier,
          prices: [],
        };
      }
      acc[price.tier_id].prices.push(price);
      return acc;
    }, {});

    return Object.values(pricesByTier);
  },
};

