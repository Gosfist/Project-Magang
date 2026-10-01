import { Type } from 'class-transformer';
import { IsNumber, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SaveMainCoreDto {
  @IsOptional() @IsString() parentId?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) parentPortOut?: number;
  @IsOptional() @IsString() routerNasId?: string;
  @IsString() @MaxLength(255) namaTitik: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-99.99) @Max(99.99) redamanIn?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(99999999.99) jarakKabel?: number;
  @IsOptional() @IsString() @MaxLength(1000) alamat?: string;
  @IsOptional() @IsObject() spesifikasi?: Record<string, unknown>;
}
