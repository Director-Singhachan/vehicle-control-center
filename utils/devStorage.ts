/**
 * Utility for simulated storage in Dev Mode.
 * Stores various entities in localStorage to avoid database pollution.
 */

const STORAGE_PREFIX = 'dev_sim_';

export const devStorage = {
  /**
   * Get all items for a given table
   */
  getItems<T>(tableName: string): T[] {
    try {
      const data = localStorage.getItem(`${STORAGE_PREFIX}${tableName}`);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error(`Failed to parse dev data for ${tableName}`, e);
      return [];
    }
  },

  /**
   * Save an item to a table (insert or update)
   */
  saveItem<T extends { id?: string }>(tableName: string, item: T): T {
    const items = this.getItems<T>(tableName);
    
    // Ensure ID exists
    if (!item.id) {
      (item as any).id = crypto.randomUUID();
    }
    
    const existingIndex = items.findIndex(i => i.id === item.id);
    
    let newItems;
    if (existingIndex >= 0) {
      // Update
      newItems = [...items];
      newItems[existingIndex] = { ...newItems[existingIndex], ...item, updated_at: new Date().toISOString(), is_dev_mode: true };
      item = newItems[existingIndex];
    } else {
      // Insert
      const newItem = { 
        ...item, 
        created_at: new Date().toISOString(), 
        updated_at: new Date().toISOString(),
        is_dev_mode: true 
      };
      newItems = [newItem, ...items];
      item = newItem as T;
    }

    localStorage.setItem(`${STORAGE_PREFIX}${tableName}`, JSON.stringify(newItems));
    return item;
  },

  /**
   * Save multiple items
   */
  saveItems<T extends { id?: string }>(tableName: string, itemsToSave: T[]): T[] {
    const saved: T[] = [];
    for (const item of itemsToSave) {
      saved.push(this.saveItem(tableName, item));
    }
    return saved;
  },

  /**
   * Delete an item
   */
  deleteItem(tableName: string, id: string) {
    const items = this.getItems<{ id: string }>(tableName);
    const newItems = items.filter(i => i.id !== id);
    localStorage.setItem(`${STORAGE_PREFIX}${tableName}`, JSON.stringify(newItems));
  },

  /**
   * Merge DB results with simulated data
   */
  mergeWithSimulated<T>(tableName: string, dbData: T[], filterFn?: (item: T) => boolean): T[] {
    const simData = this.getItems<T>(tableName);
    let filteredSim = simData;
    if (filterFn) {
      filteredSim = simData.filter(filterFn);
    }
    return [...filteredSim, ...dbData];
  },

  /**
   * Clear all dev data
   */
  clearAll() {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(STORAGE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  }
};
