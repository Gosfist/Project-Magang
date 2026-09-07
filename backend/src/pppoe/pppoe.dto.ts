import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class SavePackageDto {
  @IsString() @MaxLength(100) name: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) downloadMbps: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) uploadMbps: number;
  @Type(() => Number) @IsInt() @Min(0) price: number;
  @IsOptional() @IsString() @MaxLength(100) addressPool?: string;
}

export class SaveAccountDto {
  @IsString() pppoePackageId: string;
  @IsString() @MaxLength(150) customerName: string;
  @IsString() @MaxLength(64) @Matches(/^[A-Za-z0-9._@-]+$/, { message: 'Username hanya boleh berisi huruf, angka, titik, garis bawah, @, dan tanda hubung.' }) username: string;
  @IsOptional() @IsString() @MinLength(6, { message: 'Password PPPoE minimal 6 karakter.' }) @MaxLength(64) password?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}
