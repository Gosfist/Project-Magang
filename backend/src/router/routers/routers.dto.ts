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
  @IsOptional() @IsString() @MaxLength(200) description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
