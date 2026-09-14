import { Transform } from 'class-transformer';
import { IsIP, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SaveIpPoolDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @IsNotEmpty() @MaxLength(100) name: string;
  @IsIP('4') networkStart: string;
  @IsIP('4') networkEnd: string;
}
