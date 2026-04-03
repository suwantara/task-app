import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HolidayType } from '@prisma/client';

@Injectable()
export class HolidaysService {
  private readonly logger = new Logger(HolidaysService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findByYear(year: number) {
    const start = new Date(`${year}-01-01`);
    const end = new Date(`${year}-12-31`);

    const rows = await this.prisma.holiday.findMany({
      where: { date: { gte: start, lte: end } },
      orderBy: { date: 'asc' },
      select: { date: true, name: true, type: true },
    });

    return rows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      name: r.name,
      type: this.mapType(r.type),
    }));
  }

  /**
   * Delete all holiday rows whose year <= currentYear - 2.
   * Called by the GitHub Actions scraper after it upserts new data.
   * Example: if current year is 2027, deletes everything before 2026-01-01.
   */
  async purgeOldYears(currentYear: number): Promise<number> {
    const cutoff = new Date(`${currentYear - 1}-01-01`);
    const result = await this.prisma.holiday.deleteMany({
      where: { date: { lt: cutoff } },
    });
    this.logger.log(
      `Purged ${result.count} holiday rows older than ${currentYear - 1}`,
    );
    return result.count;
  }

  // Map Prisma enum → frontend string type
  private mapType(type: HolidayType): string {
    switch (type) {
      case HolidayType.national:      return 'national';
      case HolidayType.balinese:      return 'balinese';
      case HolidayType.joint_leave:   return 'joint-leave';
      case HolidayType.commemoration: return 'commemoration';
    }
  }
}
