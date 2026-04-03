'use client';

import { useState, useEffect } from 'react';
import type { Holiday } from '@/lib/holidays';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000';

interface UseHolidaysResult {
  holidayMap: Map<string, Holiday[]>;
  isLoading: boolean;
}

async function fetchHolidayYear(year: number): Promise<Holiday[]> {
  const res = await fetch(`${API_BASE}/holidays?year=${year}`, {
    next: { revalidate: 86400 },
  });
  if (!res.ok) return [];
  return res.json();
}

function buildHolidayMap(holidays: Holiday[]): Map<string, Holiday[]> {
  const map = new Map<string, Holiday[]>();
  for (const h of holidays) {
    const list = map.get(h.date) ?? [];
    list.push(h);
    map.set(h.date, list);
  }
  return map;
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
        const year = new Date().getFullYear();
        const [curr, next] = await Promise.all([
          fetchHolidayYear(year),
          fetchHolidayYear(year + 1),
        ]);
        if (!cancelled) {
          setHolidayMap(buildHolidayMap([...curr, ...next]));
        }
      } catch {
        // silently fall back to empty map — calendar still works without holidays
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
