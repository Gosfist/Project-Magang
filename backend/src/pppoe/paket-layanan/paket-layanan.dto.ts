import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SavePackageDto {
  @IsString() @MaxLength(100) name: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) downloadMbps: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) uploadMbps: number;
  @Type(() => Number) @IsInt() @Min(0) price: number;
  @Type(() => Number) @IsInt() @Min(0) costPrice: number;
  @IsOptional() @IsString() @MaxLength(100) addressPool?: string;
  @IsOptional() @IsString() ipPoolId?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(3650) validityDays: number = 30;
}
