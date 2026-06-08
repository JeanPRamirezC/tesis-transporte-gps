import { Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { VigitrackService } from '../services/vigitrack.service';

@ApiTags('Integración Vigitrack')
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