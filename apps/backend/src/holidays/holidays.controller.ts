import { Controller, Get, Query } from '@nestjs/common';
import { HolidaysService } from './holidays.service';
import { QueryHolidaysDto } from './dto/query-holidays.dto';

@Controller('holidays')
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  /**
   * GET /holidays?year=2026
   * Public — no auth required (calendar data is non-sensitive).
   */
  @Get()
  findByYear(@Query() query: QueryHolidaysDto) {
    return this.holidaysService.findByYear(query.year);
  }
}
