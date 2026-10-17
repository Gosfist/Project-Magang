import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsIP, IsOptional } from 'class-validator';

export class SaveVpnClientDto {
  @IsIn(['radius', 'mikrotik'], { message: 'Pilih perangkat Server RADIUS atau MikroTik.' })
  deviceType: 'radius' | 'mikrotik';

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsIP(4, { message: 'Isi alamat IPv4 VPN perangkat tanpa subnet / CIDR.' })
  vpnIp: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
