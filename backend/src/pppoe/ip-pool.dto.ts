import { Transform } from 'class-transformer';
import { IsInt, Min, IsIP, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SaveIpPoolDto {
  @IsInt() @Min(1) routerNasId: number;
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @IsNotEmpty() @MaxLength(100) name: string;
  @IsIP('4') networkStart: string;
  @IsIP('4') networkEnd: string;
}
