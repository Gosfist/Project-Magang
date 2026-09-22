import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Format email tidak valid.' })
  email: string;

  @IsString()
  @MinLength(1, { message: 'Kata sandi wajib diisi.' })
  password: string;
}

export class UpdateProfileDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  photo?: string;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Kata sandi minimal 6 karakter.' })
  password?: string;
}
