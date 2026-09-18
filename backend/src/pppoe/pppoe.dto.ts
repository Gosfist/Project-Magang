import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

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

export class SaveAccountDto {
  @IsString() pppoePackageId: string;
  @IsString() @Matches(/\S/, { message: 'Nama pelanggan wajib diisi.' }) @MaxLength(150) customerName: string;
  @IsOptional() @IsString() @MaxLength(50) idCardNumber?: string;
  @IsOptional() @IsString() @MaxLength(500) idCardPhoto?: string;
  @IsString() @MaxLength(64) @Matches(/^[A-Za-z0-9._@-]+$/, { message: 'Nama pengguna hanya boleh berisi huruf, angka, titik, garis bawah, @, dan tanda hubung.' }) username: string;
  @IsOptional() @IsString() @MinLength(6, { message: 'Kata sandi PPPoE minimal 6 karakter.' }) @MaxLength(64) password?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsOptional() @Type(() => Number) @IsNumber() latitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber() longitude?: number;
  @IsOptional() @IsIn(['PREPAID', 'POSTPAID']) subscriptionType?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(31) billingDay?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) discount?: number;
  @IsString() @Matches(/^[1-9]\d*$/, { message: 'ODC / ODP wajib dipilih.' }) @MaxLength(100) odp: string;
  @IsOptional() @IsString() routerNasId?: string;
  @IsOptional() @IsIn(['none', 'prorate', 'full']) firstInvoice?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional() @IsString() areaId?: string;
}
