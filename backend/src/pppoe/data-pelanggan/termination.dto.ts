import { Type } from 'class-transformer';
import { IsInt, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
export class CreateTerminationDto {
    @IsString() @Matches(/^[1-9]\d{0,18}$/) accountId: string;
    @IsString() @Matches(/\S/) @MaxLength(1000) reason: string;
}
export class CompleteTerminationDto {
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @Max(Number.MAX_SAFE_INTEGER)
    amount: number;
}
