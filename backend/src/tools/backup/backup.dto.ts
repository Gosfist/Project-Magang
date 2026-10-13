import { IsBoolean, IsIn, IsIP, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class BackupRouterDto {
  @IsIP('4') localAddress: string;
  @IsString() @Matches(/\S/) @MaxLength(100) baseProfile: string;
}
export class BackupScriptDto {
  @IsIn(['local', 'radius']) mode: 'local' | 'radius';
  @IsBoolean() reconnect: boolean;
}
export class BackupImportDto {
  @IsIn(['create', 'upsert']) mode: 'create' | 'upsert';
  @IsOptional() @IsString() @MaxLength(2000) token?: string;
}
