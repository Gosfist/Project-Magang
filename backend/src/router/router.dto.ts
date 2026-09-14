import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SaveRouterDto {
  @IsString() @MaxLength(100) name: string;
  @IsString() @MaxLength(128) nasname: string;
  @IsOptional() @IsString() @MaxLength(32) shortname?: string;
  @IsOptional() @IsString() @MaxLength(30) type?: string;
  @IsOptional() @IsString() @MaxLength(20) authMode?: string;
  @IsOptional() @IsString() @MaxLength(45) ipAddress?: string;
  @IsOptional() @IsString() @MaxLength(64) username?: string;
  @IsOptional() @IsString() password?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) port?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) ports?: number;
  @IsOptional() @IsString() @MaxLength(60) secret?: string;
  @IsOptional() @IsString() vpnClientId?: string;
  @IsOptional() @Type(() => Number) latitude?: number;
  @IsOptional() @Type(() => Number) longitude?: number;
  @IsOptional() @IsString() @MaxLength(200) description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

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

export class SaveVpnClientDto {
  @IsString() @MaxLength(100) name: string;
  @IsString() vpnServerId: string;
  @IsString() @MaxLength(45) vpnIp: string;
  @IsString() clientPublicKey: string;
  @IsOptional() @IsString() clientPrivateKey?: string;
  @IsOptional() @IsString() @MaxLength(100) allowedIps?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isRadiusServer?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
