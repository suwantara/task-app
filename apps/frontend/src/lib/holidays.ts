/**
 * Holiday data for the calendar.
 *
 * National holidays: fetched from guangrei/APIHariLibur_V2 (auto-updated from Google Calendar)
 * URL: https://raw.githubusercontent.com/guangrei/APIHariLibur_V2/main/holidays.json
 *
 * Balinese holidays: static data based on the 210-day Pawukon cycle + Saka calendar.
 * Sources: PHDI (Parisada Hindu Dharma Indonesia) almanac.
 * Update this list every year from: https://www.parisada.org or trusted Balinese calendar apps.
 */

export interface Holiday {
  date: string; // 'yyyy-MM-dd'
  name: string;
  type: 'national' | 'balinese' | 'joint-leave';
}

// ─── Balinese Holidays (Static — update yearly) ────────────────────────────
// Source: PHDI almanac / kalender Bali resmi
// Covers 2025–2027

const BALINESE_HOLIDAYS: Holiday[] = [
  // ── 2025 ──
  { date: '2025-01-01', name: 'Penyekeban Galungan', type: 'balinese' },
  { date: '2025-01-08', name: 'Hari Raya Galungan', type: 'balinese' },
  { date: '2025-01-10', name: 'Manis Galungan', type: 'balinese' },
  { date: '2025-01-18', name: 'Hari Raya Kuningan', type: 'balinese' },
  { date: '2025-01-25', name: 'Saraswati', type: 'balinese' },
  { date: '2025-02-15', name: 'Pagerwesi', type: 'balinese' },
  { date: '2025-03-06', name: 'Nyepi (Hari Suci Nyepi)', type: 'balinese' },
  { date: '2025-03-08', name: 'Ngembak Geni', type: 'balinese' },
  { date: '2025-07-09', name: 'Penyekeban Galungan', type: 'balinese' },
  { date: '2025-07-16', name: 'Hari Raya Galungan', type: 'balinese' },
  { date: '2025-07-18', name: 'Manis Galungan', type: 'balinese' },
  { date: '2025-07-26', name: 'Hari Raya Kuningan', type: 'balinese' },
  { date: '2025-10-04', name: 'Saraswati', type: 'balinese' },
  { date: '2025-10-11', name: 'Pagerwesi', type: 'balinese' },
  { date: '2025-12-03', name: 'Penyekeban Galungan', type: 'balinese' },

  // ── 2026 ──
  { date: '2026-01-10', name: 'Hari Raya Galungan', type: 'balinese' },
  { date: '2026-01-12', name: 'Manis Galungan', type: 'balinese' },
  { date: '2026-01-20', name: 'Hari Raya Kuningan', type: 'balinese' },
  { date: '2026-03-14', name: 'Saraswati', type: 'balinese' },
  { date: '2026-03-19', name: 'Nyepi (Hari Suci Nyepi / Tahun Baru Saka 1948)', type: 'balinese' },
  { date: '2026-03-21', name: 'Ngembak Geni', type: 'balinese' },
  { date: '2026-03-21', name: 'Pagerwesi', type: 'balinese' },
  { date: '2026-06-19', name: 'Penyekeban Galungan', type: 'balinese' },
  { date: '2026-06-26', name: 'Hari Raya Galungan', type: 'balinese' },
  { date: '2026-06-28', name: 'Manis Galungan', type: 'balinese' },
  { date: '2026-07-06', name: 'Hari Raya Kuningan', type: 'balinese' },
  { date: '2026-09-19', name: 'Saraswati', type: 'balinese' },
  { date: '2026-09-26', name: 'Pagerwesi', type: 'balinese' },
  { date: '2026-11-28', name: 'Penyekeban Galungan', type: 'balinese' },
  { date: '2026-12-05', name: 'Hari Raya Galungan', type: 'balinese' },
  { date: '2026-12-07', name: 'Manis Galungan', type: 'balinese' },
  { date: '2026-12-15', name: 'Hari Raya Kuningan', type: 'balinese' },

  // ── 2027 ──
  { date: '2027-03-10', name: 'Nyepi (Hari Suci Nyepi / Tahun Baru Saka 1949)', type: 'balinese' },
  { date: '2027-03-12', name: 'Ngembak Geni', type: 'balinese' },
  { date: '2027-02-27', name: 'Saraswati', type: 'balinese' },
  { date: '2027-03-06', name: 'Pagerwesi', type: 'balinese' },
  { date: '2027-05-09', name: 'Penyekeban Galungan', type: 'balinese' },
  { date: '2027-05-16', name: 'Hari Raya Galungan', type: 'balinese' },
  { date: '2027-05-18', name: 'Manis Galungan', type: 'balinese' },
  { date: '2027-05-26', name: 'Hari Raya Kuningan', type: 'balinese' },
  { date: '2027-08-07', name: 'Saraswati', type: 'balinese' },
  { date: '2027-08-14', name: 'Pagerwesi', type: 'balinese' },
  { date: '2027-10-16', name: 'Penyekeban Galungan', type: 'balinese' },
  { date: '2027-10-23', name: 'Hari Raya Galungan', type: 'balinese' },
  { date: '2027-10-25', name: 'Manis Galungan', type: 'balinese' },
  { date: '2027-11-02', name: 'Hari Raya Kuningan', type: 'balinese' },
];

// ─── API Response type ──────────────────────────────────────────────────────

interface NationalHolidayResponse {
  [dateKey: string]:
    | { summary: string }
    | { author: string; link: string; updated: string }; // "info" key
}

// ─── Fetch national holidays from API ──────────────────────────────────────

const NATIONAL_HOLIDAYS_URL =
  'https://raw.githubusercontent.com/guangrei/APIHariLibur_V2/main/holidays.json';

export async function fetchNationalHolidays(): Promise<Holiday[]> {
  const res = await fetch(NATIONAL_HOLIDAYS_URL, {
    next: { revalidate: 86400 }, // cache 24 hours (Next.js fetch cache)
  });
  if (!res.ok) return [];

  const data: NationalHolidayResponse = await res.json();
  const holidays: Holiday[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (key === 'info') continue;
    const entry = value as { summary: string };
    const isJointLeave =
      entry.summary.toLowerCase().includes('cuti bersama');
    holidays.push({
      date: key,
      name: entry.summary,
      type: isJointLeave ? 'joint-leave' : 'national',
    });
  }

  return holidays;
}

// ─── Merge all holidays into a map ─────────────────────────────────────────

export function buildHolidayMap(
  nationalHolidays: Holiday[],
): Map<string, Holiday[]> {
  const map = new Map<string, Holiday[]>();

  const addToMap = (h: Holiday) => {
    const existing = map.get(h.date) ?? [];
    existing.push(h);
    map.set(h.date, existing);
  };

  for (const h of nationalHolidays) addToMap(h);
  for (const h of BALINESE_HOLIDAYS) addToMap(h);

  return map;
}
