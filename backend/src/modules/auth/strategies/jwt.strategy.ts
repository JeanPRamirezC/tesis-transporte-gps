import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'super-secret-key-for-thesis',
    });
  }

  async validate(payload: any) {
    // payload contiene: { sub: user.idUsuario, email: user.email, rol: user.rol }
    const user = await this.prisma.usuario.findUnique({
      where: { idUsuario: payload.sub },
      select: {
        idUsuario: true,
        email: true,
        rol: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no válido o sesión caducada.');
    }

    return user; // Inyecta el usuario en request.user
  }
}
