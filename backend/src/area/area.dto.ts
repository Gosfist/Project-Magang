import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SaveAreaDto {
  @IsString() @MaxLength(150) name: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
}

export class AssignCollectorDto {
  @IsString() userId: string;
}
