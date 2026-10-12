import { IsBoolean, IsIP, IsString, MaxLength } from 'class-validator';
export class SaveIsolationDto {
  @IsBoolean() enabled: boolean;
  @IsString() @MaxLength(100) poolName: string;
  @IsString() @MaxLength(32) subnet: string;
  @IsIP('4') localAddress: string;
}
