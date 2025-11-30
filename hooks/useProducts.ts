// Hooks for Products
import { useState, useEffect } from 'react';
import { productService, type Product, type ProductFilters } from '../services/productService';

export const useProducts = (filters?: ProductFilters) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await productService.getAll(filters);
        setProducts(data);
      } catch (err) {
        setError(err as Error);
        console.error('[useProducts] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [filters?.search, filters?.category, filters?.is_active]);

  return {
    products,
    loading,
    error,
    refetch: async () => {
      const data = await productService.getAll(filters);
      setProducts(data);
    },
  };
};

export const useProductCategories = () => {
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await productService.getCategories();
        setCategories(data);
      } catch (err) {
        setError(err as Error);
        console.error('[useProductCategories] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  return {
    categories,
    loading,
    error,
    refetch: async () => {
      const data = await productService.getCategories();
      setCategories(data);
    },
  };
};

