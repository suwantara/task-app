import { IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryHolidaysDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2200)
  year: number;
}
