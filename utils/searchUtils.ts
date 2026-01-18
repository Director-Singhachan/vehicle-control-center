// Search Utilities - Shared search logic for products, stores, etc.
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Generic search function that searches across multiple fields
 * Returns unique results by removing duplicates
 */
export async function searchWithMultipleFields<T extends { id: string }>(
  supabase: SupabaseClient,
  tableName: string,
  searchTerm: string,
  fields: string[],
  additionalFilters?: Record<string, any>,
  limit: number = 100
): Promise<T[]> {
  if (!searchTerm.trim()) {
    // If no search term, return all with filters
    let query = supabase.from(tableName).select('*');
    
    if (additionalFilters) {
      Object.entries(additionalFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });
    }
    
    const { data, error } = await query.order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return (data || []) as T[];
  }

  const searchPattern = `%${searchTerm.trim()}%`;
  const searchQueries = fields.map(field => {
    let query = supabase
      .from(tableName)
      .select('*')
      .ilike(field, searchPattern);
    
    if (additionalFilters) {
      Object.entries(additionalFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });
    }
    
    return query;
  });

  const results = await Promise.all(searchQueries);
  
  // Check for errors
  for (const result of results) {
    if (result.error) {
      console.error(`[searchUtils] Error searching ${tableName}:`, result.error);
      throw result.error;
    }
  }

  // Combine results and remove duplicates by id
  const allResults = results.flatMap(r => r.data || []);
  const uniqueResults = allResults.filter(
    (item, index, self) => index === self.findIndex(t => t.id === item.id)
  );

  // Sort and limit
  uniqueResults.sort((a, b) => {
    // Sort by first field, then by created_at
    const aValue = (a as any)[fields[0]] || '';
    const bValue = (b as any)[fields[0]] || '';
    if (aValue !== bValue) {
      return aValue.localeCompare(bValue);
    }
    return 0;
  });

  return uniqueResults.slice(0, limit) as T[];
}
