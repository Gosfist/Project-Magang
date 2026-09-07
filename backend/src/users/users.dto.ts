import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString() @MaxLength(255) name: string;
  @IsEmail({}, { message: 'Format email tidak valid.' }) email: string;
  @IsString() @MinLength(6, { message: 'Password minimal 6 karakter.' }) password: string;
  @IsIn(['admin', 'petugas']) role: string;
  @IsIn(['active', 'inactive']) status: string;
}

export class UpdateUserDto extends CreateUserDto {
  @IsOptional() @IsString() @MinLength(6, { message: 'Password minimal 6 karakter.' })
  declare password: string;
}
