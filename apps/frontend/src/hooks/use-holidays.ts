'use client';

import { useState, useEffect } from 'react';
import {
  fetchNationalHolidays,
  buildHolidayMap,
  type Holiday,
} from '@/lib/holidays';

interface UseHolidaysResult {
  holidayMap: Map<string, Holiday[]>;
  isLoading: boolean;
}

export function useHolidays(): UseHolidaysResult {
  const [holidayMap, setHolidayMap] = useState<Map<string, Holiday[]>>(
    new Map(),
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const national = await fetchNationalHolidays();
        if (!cancelled) {
          setHolidayMap(buildHolidayMap(national));
        }
      } catch {
        // If fetch fails, still show Balinese holidays from static data
        if (!cancelled) {
          setHolidayMap(buildHolidayMap([]));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { holidayMap, isLoading };
}
