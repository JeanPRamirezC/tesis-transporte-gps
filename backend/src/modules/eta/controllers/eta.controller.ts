import { Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { EtaService } from '../services/eta.service';

@ApiTags('ETA')
@Controller('eta')
export class EtaController {
  constructor(private readonly etaService: EtaService) {}

  @Get('ruta/:idRuta')
  @ApiOperation({
    summary: 'Calcular ETA acumulado para las paradas restantes de una ruta.',
  })
  @ApiParam({
    name: 'idRuta',
    example: 7,
  })
  calcularEtaPorRuta(@Param('idRuta', ParseIntPipe) idRuta: number) {
    return this.etaService.calcularEtaPorRuta(idRuta);
  }
  @Post('ruta/:idRuta/generar')
@ApiOperation({
  summary: 'Generar y guardar estimaciones ETA para una ruta.',
})
@ApiParam({
  name: 'idRuta',
  example: 7,
})
generarEstimacionesEtaPorRuta(@Param('idRuta', ParseIntPipe) idRuta: number) {
  return this.etaService.generarEstimacionesEtaPorRuta(idRuta);
}
}