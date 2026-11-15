import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
export class PayrollProfileDto {
  @IsString() @Matches(/^[1-9]\d{0,19}$/) userId: string;
  @IsString() @Matches(/^\d{4}-\d{2}-01$/) effectiveFrom: string;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) absenceTrackingFrom: string;
  @IsIn(['MONTHLY', 'DAILY']) salaryType: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(1000000000) amount: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(31) maxLeave: number;
  @IsBoolean() excessLeaveCut: boolean;
  @Type(() => Number) @IsInt() @Min(0) @Max(1000000000) excessLeaveAmount: number;
  @IsBoolean() lateCut: boolean;
  @Type(() => Number) @IsInt() @Min(0) @Max(1000000000) lateAmount: number;
  @IsBoolean() earlyCut: boolean;
  @Type(() => Number) @IsInt() @Min(0) @Max(1000000000) earlyAmount: number;
}
export class AttendancePolicyDto {
  @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) checkInStart: string;
  @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) lateAfter: string;
  @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) checkOutTime: string;
  @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) autoCheckoutTime: string;
  @IsString() @Matches(/^[0-6](,[0-6])*$/) workDays: string;
}
export class EmployeeLeaveDto {
  @IsString() @Matches(/^[1-9]\d{0,19}$/) userId: string;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) date: string;
  @IsString() @MaxLength(500) note: string;
}
