import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { GpsService } from '../services/gps.service';

@ApiTags('GPS')
@Controller('gps')
export class GpsController {
  constructor(private readonly gpsService: GpsService) {}

  @Get('ultimas-posiciones')
  @ApiOperation({
    summary: 'Listar la última posición GPS registrada por cada unidad.',
  })
  listarUltimasPosiciones() {
    return this.gpsService.listarUltimasPosiciones();
  }
}