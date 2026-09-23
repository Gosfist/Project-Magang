import { Type } from 'class-transformer';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDepositDto {
  @IsString() pppoeAccountId: string;
  @IsString() invoiceId: string;
  @IsDateString() depositDate: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class RejectDepositDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
