import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SaveVpnServerDto {
  @IsString() @MaxLength(100) name: string;
  @IsString() @MaxLength(100) host: string;
  @IsOptional() @IsString() @MaxLength(50) subnet?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) wgPort?: number;
  @IsString() wgPublicKey: string;
  @IsOptional() @IsString() wgPrivateKey?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(254) poolStart?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(254) poolEnd?: number;
  @IsOptional() @IsString() @MaxLength(45) gateway?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
