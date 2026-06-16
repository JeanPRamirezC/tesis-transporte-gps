import { Controller, Post, Body } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBody } from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { RegisterDto, LoginDto } from '../dto/auth.dto';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('registro')
  @ApiOperation({
    summary: 'Registrar un nuevo usuario en la plataforma (Ciudadano/Público).',
  })
  @ApiBody({ type: RegisterDto })
  async registro(@Body() registerDto: RegisterDto) {
    return this.authService.registro(
      registerDto.email,
      registerDto.password,
      registerDto.rol,
    );
  }

  @Post('login')
  @ApiOperation({
    summary: 'Iniciar sesión y obtener el token de acceso JWT.',
  })
  @ApiBody({ type: LoginDto })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.email, loginDto.password);
  }
}
