import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { VigitrackService } from '../services/vigitrack.service';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';

@ApiTags('Integración Vigitrack')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.ADMIN)
@Controller('integraciones/vigitrack')
export class VigitrackController {
  constructor(private readonly vigitrackService: VigitrackService) {}

  @Post('sincronizar-rutas')
  @ApiOperation({
    summary: 'Sincronizar rutas desde la API de Vigitrack.',
  })
  sincronizarRutas() {
    return this.vigitrackService.sincronizarRutas();
  }

  @Get('monitoreo')
  @ApiOperation({
    summary: 'Consultar monitoreo actual desde la API de Vigitrack.',
  })
  obtenerMonitoreo() {
    return this.vigitrackService.obtenerMonitoreo();
  }

  @Post('sincronizar-monitoreo')
  @ApiOperation({
    summary: 'Sincronizar registros GPS desde el monitoreo de Vigitrack.',
  })
  sincronizarMonitoreo() {
    return this.vigitrackService.sincronizarMonitoreo();
  }
}