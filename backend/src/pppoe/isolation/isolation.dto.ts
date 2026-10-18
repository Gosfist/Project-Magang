import { IsBoolean, IsIP, IsString, MaxLength, IsOptional } from 'class-validator';
export class SaveIsolationDto {
  @IsBoolean() enabled: boolean;
  @IsString() @MaxLength(100) poolName: string;
  @IsString() @MaxLength(32) subnet: string;
  @IsIP('4') localAddress: string;
  @IsOptional() @IsBoolean() scriptInstalled?: boolean;
  @IsOptional() @IsString() @MaxLength(64) scriptFingerprint?: string;
}
