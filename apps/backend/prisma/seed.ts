#!/usr/bin/env node
/**
 * prisma/seed.ts
 *
 * Scrapes https://www.kalenderbali.org/haripenting.php for every month
 * from START_YEAR to END_YEAR and upserts data into the `holidays` table.
 *
 * Also purges rows older than (currentYear - 1) to prevent DB bloat.
 * Rule: always keep current year + 1 year back. E.g. in 2027, keep 2026+.
 *
 * Usage:
 *   npx ts-node prisma/seed.ts                  # seed 2025–2100
 *   npx ts-node prisma/seed.ts --year 2027       # seed only 2027
 *   npx ts-node prisma/seed.ts --purge           # purge old years only
 */

import { PrismaClient, HolidayType } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Config ────────────────────────────────────────────────────────────────

const START_YEAR = 2025;
const END_YEAR = 2100;
const BASE_URL = 'https://www.kalenderbali.org/haripenting.php';

// How long to wait between HTTP requests (ms) — be polite to the server
const REQUEST_DELAY_MS = 300;

// ─── Month name → number map ────────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  januari: 1,
  pebruari: 2,
  februari: 2,
  maret: 3,
  april: 4,
  mei: 5,
  juni: 6,
  juli: 7,
  agustus: 8,
  september: 9,
  oktober: 10,
  nopember: 11,
  november: 11,
  desember: 12,
};

// ─── Types ──────────────────────────────────────────────────────────────────

interface ScrapedEntry {
  date: string; // 'yyyy-MM-dd'
  name: string;
  type: HolidayType;
  source: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/**
 * Categorise a header line from haripenting.php into a HolidayType.
 * Headers seen: "HARI LIBUR", "HARI FAKULTATIF", "HARI PERINGATAN"
 */
function parseType(header: string): HolidayType {
  const h = header.toUpperCase();
  if (h.includes('LIBUR')) return HolidayType.national;
  if (h.includes('FAKULTATIF')) return HolidayType.balinese;
  return HolidayType.commemoration;
}

/**
 * Fetch and parse one month page.
 * Returns an array of holiday entries.
 */
async function scrapeMonth(
  year: number,
  month: number,
): Promise<ScrapedEntry[]> {
  const body = new URLSearchParams({
    bulan: String(month),
    tahun: String(year),
    Submit: 'Hasil',
  });

  let html: string;
  try {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (e) {
    console.warn(`  ⚠ Failed ${year}-${pad(month)}: ${(e as Error).message}`);
    return [];
  }

  const entries: ScrapedEntry[] = [];

  // The page contains sections like:
  //   HARI LIBUR - 1 Januari 2026. Tahun Baru Masehi - 16 Januari 2026. ...
  //   HARI FAKULTATIF - 17 Januari 2026. Hari Siwa Ratri
  //   HARI PERINGATAN - 2 Januari 2026. HUT Legiun Veteran RI - ...
  //
  // We strip HTML tags, then parse the plain-text blocks.
  const text = html
    .replaceAll(/<[^>]+>/g, ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&nbsp;', ' ')
    .replaceAll(/\s+/g, ' ');

  // Split on section headers
  const sectionRe = /HARI\s+(LIBUR|FAKULTATIF|PERINGATAN)\s*[-–]/gi;
  const parts = text.split(sectionRe);

  // parts: [ before, 'LIBUR', content, 'FAKULTATIF', content, ... ]
  for (let i = 1; i < parts.length; i += 2) {
    const headerWord = parts[i]; // e.g. 'LIBUR'
    const content = parts[i + 1] ?? '';
    const type = parseType(headerWord);

    // Each entry is separated by " - " and looks like: "17 Januari 2026. Hari Siwa Ratri"
    const rawEntries = content.split(/\s+-\s+/);
    for (const raw of rawEntries) {
      // Match: day monthName year . name
      const dateNameRe = /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\.\s+([^.]+)/;
      const m = dateNameRe.exec(raw);
      if (!m) continue;

      const day = Number.parseInt(m[1], 10);
      const monthName = m[2].toLowerCase();
      const entryYear = Number.parseInt(m[3], 10);
      const name = m[4].trim();

      const monthNum = MONTH_MAP[monthName];
      if (!monthNum || entryYear !== year) continue;

      entries.push({
        date: `${year}-${pad(monthNum)}-${pad(day)}`,
        name,
        type,
        source: BASE_URL,
      });
    }
  }

  return entries;
}

// ─── Purge old data ──────────────────────────────────────────────────────────

async function purgeOldYears(currentYear: number): Promise<void> {
  // Keep current year and 1 year back. Delete everything before that.
  const cutoffYear = currentYear - 1;
  const cutoff = new Date(`${cutoffYear}-01-01`);
  const result = await prisma.holiday.deleteMany({
    where: { date: { lt: cutoff } },
  });
  console.log(
    `🗑  Purged ${result.count} rows older than ${cutoffYear} (keeping ${cutoffYear}+)`,
  );
}

// ─── Args parser ─────────────────────────────────────────────────────────────

function parseYearArg(args: string[]): number | null {
  const yearArg = args.find((a) => a.startsWith('--year=') || a === '--year');
  if (!yearArg) return null;
  const val = yearArg.includes('=')
    ? yearArg.split('=')[1]
    : args[args.indexOf('--year') + 1];
  const year = Number.parseInt(val, 10);
  if (Number.isNaN(year)) {
    console.error('Invalid --year value');
    process.exit(1);
  }
  return year;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const purgeOnly = args.includes('--purge');
  const singleYear = parseYearArg(args);

  const currentYear = new Date().getFullYear();

  if (purgeOnly) {
    await purgeOldYears(currentYear);
    return;
  }

  const fromYear = singleYear ?? START_YEAR;
  const toYear = singleYear ?? END_YEAR;
  const totalMonths = (toYear - fromYear + 1) * 12;

  console.log(
    `\n📅 Scraping haripenting.php — ${fromYear} to ${toYear} (${totalMonths} months)\n`,
  );

  let totalUpserted = 0;
  let monthsDone = 0;

  for (let year = fromYear; year <= toYear; year++) {
    const yearEntries: ScrapedEntry[] = [];

    for (let month = 1; month <= 12; month++) {
      const entries = await scrapeMonth(year, month);
      yearEntries.push(...entries);
      monthsDone++;

      if (month < 12) await sleep(REQUEST_DELAY_MS);
    }

    // Bulk upsert for the year
    if (yearEntries.length > 0) {
      // createMany with skipDuplicates is fastest for bulk insert
      const result = await prisma.holiday.createMany({
        data: yearEntries.map((e) => ({
          id: crypto.randomUUID(),
          date: new Date(e.date),
          name: e.name,
          type: e.type,
          source: e.source,
        })),
        skipDuplicates: true,
      });
      totalUpserted += result.count;
    }

    const pct = Math.round((monthsDone / totalMonths) * 100);
    console.log(
      `  ✔ ${year}: ${yearEntries.length} entries scraped, ${pct}% overall`,
    );

    // Small pause between years
    if (year < toYear) await sleep(REQUEST_DELAY_MS * 2);
  }

  console.log(`\n✅ Done — ${totalUpserted} new rows inserted\n`);

  // Purge years that are too old
  await purgeOldYears(currentYear);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
