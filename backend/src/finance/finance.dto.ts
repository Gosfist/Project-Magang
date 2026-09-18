import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateTransactionDto {
  @IsIn(['INCOME', 'EXPENSE']) type: string;
  @IsString() @MaxLength(50) category: string;
  @Type(() => Number) @IsInt() @Min(1) amount: number;
  @IsString() @MaxLength(500) description: string;
  @IsDateString() transactionDate: string;
  @IsOptional() @IsString() @MaxLength(30) referenceType?: string;
  @IsOptional() @IsString() referenceId?: string;
}

export class UpdateTransactionDto extends CreateTransactionDto {}
