import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsIP, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class SaveRouterDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(100) name: string;
  @Transform(trim) @IsIP('4') nasname: string;
  @IsOptional() @IsString() @Matches(/^[1-9]\d*$/) vpnClientId?: string | null;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(32) shortname?: string;
  @Transform(trim) @IsOptional() @IsIP('4') ipAddress?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) ports?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) coaPort?: number;
  @Transform(trim) @IsOptional() @IsIP('4') radiusServerIp?: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(253) vpnHost?: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(100) vpnUsername?: string;
  // Used once in the returned Terminal script. Never persisted in NAS or logs.
  @IsOptional() @IsString() @MaxLength(256) vpnPassword?: string;
  @IsOptional() @IsString() @MaxLength(60) secret?: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(200) description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(18) internetCidr?: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(18) isolationCidr?: string;
}
