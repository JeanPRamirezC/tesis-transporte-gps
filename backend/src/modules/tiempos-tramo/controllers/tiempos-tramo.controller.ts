import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { TiemposTramoService } from '../services/tiempos-tramo.service';

@ApiTags('Tiempos Tramo')
@Controller('tiempos-tramo')
export class TiemposTramoController {
  constructor(private readonly tiemposTramoService: TiemposTramoService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar todos los tiempos registrados entre paradas.',
  })
  listarTiemposTramo() {
    return this.tiemposTramoService.listarTiemposTramo();
  }

  @Get('ruta/:idRuta')
  @ApiOperation({
    summary: 'Listar tiempos registrados entre paradas de una ruta.',
  })
  @ApiParam({
    name: 'idRuta',
    example: 1,
  })
  listarPorRuta(@Param('idRuta', ParseIntPipe) idRuta: number) {
    return this.tiemposTramoService.listarPorRuta(idRuta);
  }

  @Get('promedios/ruta/:idRuta')
@ApiOperation({
  summary: 'Obtener promedios históricos de duración por tramo de una ruta.',
})
@ApiParam({
  name: 'idRuta',
  example: 7,
})
obtenerPromediosPorRuta(@Param('idRuta', ParseIntPipe) idRuta: number) {
  return this.tiemposTramoService.obtenerPromediosPorRuta(idRuta);
}

@Get('cobertura/ruta/:idRuta')
@ApiOperation({
  summary: 'Obtener cobertura histórica de tramos por ruta.',
})
@ApiParam({
  name: 'idRuta',
  example: 7,
})
obtenerCoberturaPorRuta(@Param('idRuta', ParseIntPipe) idRuta: number) {
  return this.tiemposTramoService.obtenerCoberturaPorRuta(idRuta);
}
}