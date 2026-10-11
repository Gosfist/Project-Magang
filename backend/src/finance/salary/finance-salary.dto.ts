import { Type } from 'class-transformer';
import { IsInt, Min, Max } from 'class-validator';
export class SalarySettingsDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(1000000000) psb: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(1000000000) sales: number;
}
