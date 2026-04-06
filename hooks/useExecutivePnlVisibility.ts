import { useCallback, useEffect, useState } from 'react';

export interface ExecutivePnlVisibility {
  summaryKpis: boolean;
  branchPnl: boolean;
  vehicleTop10: boolean;
  monthlyTrend: boolean;
  costStructure: boolean;
}

const DEFAULT: ExecutivePnlVisibility = {
  summaryKpis: true,
  branchPnl: true,
  vehicleTop10: true,
  monthlyTrend: true,
  costStructure: true,
};

const STORAGE_PREFIX = 'vcc-exec-pnl-visibility:';

function loadFromStorage(userId: string | undefined): ExecutivePnlVisibility {
  if (!userId || typeof window === 'undefined') return { ...DEFAULT };
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + userId);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw) as Partial<ExecutivePnlVisibility>;
    return { ...DEFAULT, ...parsed };
  } catch {
    return { ...DEFAULT };
  }
}

export function useExecutivePnlVisibility(userId: string | undefined) {
  const [visibility, setVisibility] = useState<ExecutivePnlVisibility>(() =>
    loadFromStorage(userId)
  );

  useEffect(() => {
    setVisibility(loadFromStorage(userId));
  }, [userId]);

  const setSection = useCallback(
    (key: keyof ExecutivePnlVisibility, value: boolean) => {
      setVisibility((prev) => {
        const next = { ...prev, [key]: value };
        if (userId && typeof window !== 'undefined') {
          try {
            localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(next));
          } catch {
            /* ignore quota / private mode */
          }
        }
        return next;
      });
    },
    [userId]
  );

  const resetToDefault = useCallback(() => {
    setVisibility({ ...DEFAULT });
    if (userId && typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_PREFIX + userId);
      } catch {
        /* ignore */
      }
    }
  }, [userId]);

  return { visibility, setSection, resetToDefault };
}
