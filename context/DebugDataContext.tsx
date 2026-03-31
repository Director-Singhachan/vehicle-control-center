import React, { createContext, useContext, useState, useCallback } from 'react';

interface DebugDataContextType {
  dataMap: Record<string, any>;
  setDebugData: (key: string, data: any) => void;
  removeDebugData: (key: string) => void;
  clearDebugData: () => void;
}

const DebugDataContext = createContext<DebugDataContextType | undefined>(undefined);

export const DebugDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dataMap, setDataMap] = useState<Record<string, any>>({});

  const setDebugData = useCallback((key: string, data: any) => {
    setDataMap((prev) => ({ ...prev, [key]: data }));
  }, []);

  const removeDebugData = useCallback((key: string) => {
    setDataMap((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const clearDebugData = useCallback(() => {
    setDataMap({});
  }, []);

  return (
    <DebugDataContext.Provider value={{ dataMap, setDebugData, removeDebugData, clearDebugData }}>
      {children}
    </DebugDataContext.Provider>
  );
};

export const useDebugDataContext = () => {
  const context = useContext(DebugDataContext);
  if (context === undefined) {
    throw new Error('useDebugDataContext must be used within a DebugDataProvider');
  }
  return context;
};
