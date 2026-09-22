import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreatePsbOrderDto {
  @IsString() @Matches(/\S/, { message: 'Nama pelanggan wajib diisi.' }) @MaxLength(150) customerName: string;
  @IsString() @Matches(/\d/, { message: 'Nomor WhatsApp wajib diisi.' }) @MaxLength(30) phone: string;
  @IsOptional() @IsString() @MaxLength(50) idCardNumber?: string;
  @IsOptional() @IsString() idCardPhoto?: string;
  @IsString() @Matches(/\S/, { message: 'Alamat wajib diisi.' }) @MaxLength(1000) address: string;
  @IsString() pppoePackageId: string;
  @IsOptional() @IsString() areaId?: string;
}

export class UpdatePsbOrderDto extends CreatePsbOrderDto {}

export class ActivatePsbOrderDto {
  @IsString() @MaxLength(64) @Matches(/^[A-Za-z0-9._@-]+$/) username: string;
  @IsString() @MinLength(6) @MaxLength(64) password: string;
  @IsString() @Matches(/^[1-9]\d*$/, { message: 'ODC / ODP wajib dipilih.' }) odp: string;
  @IsOptional() @IsString() routerNasId?: string;
  @IsString() @Matches(/^data:image\/(jpeg|png|webp);base64,/, { message: 'Foto instalasi wajib berupa JPG, PNG, atau WebP.' }) installationPhoto: string;
}

export class PsbStatusDto {
  @IsIn(['PROCESS', 'ACTIVATED', 'COMPLETED']) status: string;
}
