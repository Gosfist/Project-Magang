
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsIP, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
const hex = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value;

export class SaveVpnClientDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(100) name: string;
  @Transform(hex) @Matches(/^[0-9a-f]{16}$/, { message: 'Network ID ZeroTier harus 16 karakter heksadesimal.' }) networkId: string;
  @IsOptional() @Transform(hex) @ValidateIf((_, value) => value !== '')
  @Matches(/^[0-9a-f]{10}$/, { message: 'Device ID ZeroTier harus 10 karakter heksadesimal.' }) nodeId?: string;
  @IsOptional() @Transform(trim) @ValidateIf((_, value) => value !== '') @IsIP(4) vpnIp?: string;
  @IsIn(['mikrotik', 'linux', 'other']) deviceType: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsBoolean() isRadiusServer?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
