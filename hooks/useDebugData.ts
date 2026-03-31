import { useEffect } from 'react';
import { useDebugDataContext } from '../context/DebugDataContext';

/**
 * Hook to share raw data from a view component with the global Debug Tools.
 * @param key Unique key for the data point.
 * @param data The JSON data object.
 * @param deps Dependency array for when the data updates.
 */
export const useDebugData = (key: string, data: any, deps: any[] = []) => {
  const { setDebugData, removeDebugData } = useDebugDataContext();

  useEffect(() => {
    if (data !== undefined && data !== null) {
      setDebugData(key, data);
    }
    
    // Optional: cleanup on unmount? Normally raw data from views is only useful while the view is active.
    // Commented out to allow tracking data even after navigating if needed, or keeping it simple.
    // return () => removeDebugData(key);
  }, [key, ...deps, setDebugData]);
};
