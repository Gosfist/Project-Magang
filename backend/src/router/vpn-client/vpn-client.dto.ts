
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

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
