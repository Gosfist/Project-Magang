import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class CreateAddonDto {
  @IsString() @Matches(/\S/) @MaxLength(150) name: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(1000000000) amount: number;
  @IsOptional() @IsString() @IsIn(['MONTHLY', 'ONCE']) feeType?: string;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) dueDate: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class CreatePromiseDto {
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) promisedDate: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}
