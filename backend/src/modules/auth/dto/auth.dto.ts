import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, MinLength } from 'class-validator';
import { RolUsuario } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({ example: 'usuario@correo.com', description: 'Correo electrónico del usuario.' })
  @IsEmail({}, { message: 'El formato de correo es incorrecto.' })
  @IsNotEmpty({ message: 'El correo electrónico es requerido.' })
  email: string;

  @ApiProperty({ example: 'password123', description: 'Contraseña del usuario (mínimo 6 caracteres).' })
  @IsNotEmpty({ message: 'La contraseña es requerida.' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres.' })
  password: string;

  @ApiProperty({
    example: 'PUBLICO',
    enum: RolUsuario,
    required: false,
    description: 'Rol asignado al usuario (Default: PUBLICO).',
  })
  @IsOptional()
  rol?: RolUsuario;
}

export class LoginDto {
  @ApiProperty({ example: 'usuario@correo.com', description: 'Correo electrónico de inicio de sesión.' })
  @IsEmail({}, { message: 'El formato de correo es incorrecto.' })
  @IsNotEmpty({ message: 'El correo electrónico es requerido.' })
  email: string;

  @ApiProperty({ example: 'password123', description: 'Contraseña de inicio de sesión.' })
  @IsNotEmpty({ message: 'La contraseña es requerida.' })
  password: string;
}
