import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateDepositDto {
  @IsString() pppoeAccountId: string;
  @IsString() invoiceId: string;
  @Type(() => Number) @IsInt() @Min(1) amount: number;
  @IsDateString() depositDate: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class RejectDepositDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
