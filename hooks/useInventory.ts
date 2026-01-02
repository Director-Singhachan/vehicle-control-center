import { useState, useEffect } from 'react';
import { 
  productCategoryService, 
  productService, 
  warehouseService, 
  inventoryService,
  tripItemService 
} from '../services/inventoryService';
import type { Database } from '../types/database';

type ProductCategory = Database['public']['Tables']['product_categories']['Row'];
type Product = Database['public']['Tables']['products']['Row'];
type Warehouse = Database['public']['Tables']['warehouses']['Row'];
type InventoryWithDetails = Database['public']['Views']['inventory_with_details']['Row'];
type InventoryTransaction = Database['public']['Tables']['inventory_transactions']['Row'];

// ========================================
// Product Categories Hooks
// ========================================

export function useProductCategories() {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const data = await productCategoryService.getAll();
      setCategories(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  return { categories, loading, error, refetch: fetchCategories };
}

// ========================================
// Products Hooks
// ========================================

export function useProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await productService.getAll();
      setProducts(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  return { products, loading, error, refetch: fetchProducts };
}

export function useProduct(id: string | null) {
  const [product, setProduct] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id) {
      setProduct(null);
      setLoading(false);
      return;
    }

    const fetchProduct = async () => {
      try {
        setLoading(true);
        const data = await productService.getById(id);
        setProduct(data);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  return { product, loading, error };
}

export function useProductSearch() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const search = async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    try {
      setLoading(true);
      const data = await productService.search(query);
      setResults(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  return { results, loading, error, search };
}

// ========================================
// Warehouses Hooks
// ========================================

export function useWarehouses() {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchWarehouses = async () => {
    try {
      setLoading(true);
      const data = await warehouseService.getAll();
      setWarehouses(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  return { warehouses, loading, error, refetch: fetchWarehouses };
}

export function useWarehouse(id: string | null) {
  const [warehouse, setWarehouse] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id) {
      setWarehouse(null);
      setLoading(false);
      return;
    }

    const fetchWarehouse = async () => {
      try {
        setLoading(true);
        const data = await warehouseService.getById(id);
        setWarehouse(data);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchWarehouse();
  }, [id]);

  return { warehouse, loading, error };
}

// ========================================
// Inventory Hooks
// ========================================

export function useInventory(warehouseId?: string) {
  const [inventory, setInventory] = useState<InventoryWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const data = warehouseId
        ? await inventoryService.getByWarehouse(warehouseId)
        : await inventoryService.getAll();
      setInventory(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [warehouseId]);

  return { inventory, loading, error, refetch: fetchInventory };
}

export function useLowStockItems() {
  const [lowStock, setLowStock] = useState<InventoryWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchLowStock = async () => {
    try {
      setLoading(true);
      const data = await inventoryService.getLowStock();
      setLowStock(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLowStock();
  }, []);

  return { lowStock, loading, error, refetch: fetchLowStock };
}

export function useProductInventory(productId: string | null) {
  const [inventory, setInventory] = useState<InventoryWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!productId) {
      setInventory([]);
      setLoading(false);
      return;
    }

    const fetchInventory = async () => {
      try {
        setLoading(true);
        const data = await inventoryService.getByProduct(productId);
        setInventory(data);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchInventory();
  }, [productId]);

  return { inventory, loading, error };
}

// ========================================
// Inventory Transactions Hooks
// ========================================

export function useInventoryTransactions(filters?: {
  warehouseId?: string;
  productId?: string;
  startDate?: string;
  endDate?: string;
}) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const data = await inventoryService.getTransactions(filters);
      setTransactions(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [filters?.warehouseId, filters?.productId, filters?.startDate, filters?.endDate]);

  return { transactions, loading, error, refetch: fetchTransactions };
}

// ========================================
// Trip Items Hooks
// ========================================

export function useTripItems(tripId: string | null) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchItems = async () => {
    if (!tripId) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await tripItemService.getByTripId(tripId);
      setItems(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [tripId]);

  return { items, loading, error, refetch: fetchItems };
}

// ========================================
// Dashboard Statistics
// ========================================

export function useInventoryStats() {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalValue: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    warehouses: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        
        const [inventoryData, warehousesData] = await Promise.all([
          inventoryService.getAll(),
          warehouseService.getAll(),
        ]);

        const totalProducts = inventoryData.length;
        const totalValue = inventoryData.reduce(
          (sum, item) => sum + (item.quantity * item.price_per_unit),
          0
        );
        const lowStockCount = inventoryData.filter(
          item => item.stock_status === 'low_stock'
        ).length;
        const outOfStockCount = inventoryData.filter(
          item => item.stock_status === 'out_of_stock'
        ).length;

        setStats({
          totalProducts,
          totalValue,
          lowStockCount,
          outOfStockCount,
          warehouses: warehousesData.length,
        });
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return { stats, loading, error };
}

