// Data Cache Store - Cache API responses to avoid refetching
import { create } from 'zustand';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface DataCacheState {
  cache: Map<string, CacheEntry<any>>;
  
  // Actions
  get: <T>(key: string) => T | null;
  set: <T>(key: string, data: T, ttl?: number) => void;
  invalidate: (key: string | string[]) => void;
  clear: () => void;
  isStale: (key: string) => boolean;
}

// Default TTL: 2 minutes for most data, 5 minutes for static data
const DEFAULT_TTL = 2 * 60 * 1000; // 2 minutes (increased from 30 seconds)
const STATIC_TTL = 5 * 60 * 1000; // 5 minutes

export const useDataCacheStore = create<DataCacheState>((set, get) => ({
  cache: new Map(),

  get: <T>(key: string): T | null => {
    const entry = get().cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      get().cache.delete(key);
      return null;
    }

    return entry.data as T;
  },

  set: <T>(key: string, data: T, ttl: number = DEFAULT_TTL) => {
    const now = Date.now();
    get().cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl,
    });
  },

  invalidate: (key: string | string[]) => {
    const keys = Array.isArray(key) ? key : [key];
    keys.forEach(k => get().cache.delete(k));
  },

  clear: () => {
    get().cache.clear();
  },

  isStale: (key: string) => {
    const entry = get().cache.get(key);
    if (!entry) return true;
    return Date.now() > entry.expiresAt;
  },
}));

// Helper function to create cache key
export const createCacheKey = (prefix: string, ...args: any[]): string => {
  return `${prefix}:${args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(':')}`;
};

