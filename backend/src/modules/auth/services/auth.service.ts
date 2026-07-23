import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { RolUsuario } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async registro(email: string, password: string, rol: RolUsuario = RolUsuario.PUBLICO) {
    if (!email || !email.includes('@')) {
      throw new BadRequestException('Formato de correo electrónico inválido.');
    }

    if (!password || password.length < 6) {
      throw new BadRequestException('La contraseña debe tener al menos 6 caracteres.');
    }

    const usuarioExistente = await this.prisma.usuario.findUnique({
      where: { email },
    });

    if (usuarioExistente) {
      throw new BadRequestException('El correo electrónico ya está registrado.');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const nuevoUsuario = await this.prisma.usuario.create({
      data: {
        email,
        passwordHash,
        rol,
      },
    });

    return {
      idUsuario: nuevoUsuario.idUsuario,
      email: nuevoUsuario.email,
      rol: nuevoUsuario.rol,
      creadoEn: nuevoUsuario.creadoEn,
    };
  }

  async login(email: string, password: string) {
    if (!email || !password) {
      throw new BadRequestException('El correo y la contraseña son obligatorios.');
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
    });

    if (!usuario) {
      throw new UnauthorizedException('Credenciales incorrectas.');
    }

    const passwordValido = await bcrypt.compare(password, usuario.passwordHash);

    if (!passwordValido) {
      throw new UnauthorizedException('Credenciales incorrectas.');
    }

    const payload = {
      sub: usuario.idUsuario,
      email: usuario.email,
      rol: usuario.rol,
    };

    const token = this.jwtService.sign(payload);

    return {
      accessToken: token,
      user: {
        idUsuario: usuario.idUsuario,
        email: usuario.email,
        rol: usuario.rol,
      },
    };
  }
}
