import { Type } from 'class-transformer';
import { IsIn, IsInt, Max, Min } from 'class-validator';

export class BillingSettingsDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(28) billingStartDay: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(31) billingEndDay: number;
  @IsIn(['WIB', 'WITA', 'WIT']) billingTimezone: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(23) isolationCheckHour: number;
  @Type(() => Number) @IsInt() @Min(0) psbFee: number;
}
