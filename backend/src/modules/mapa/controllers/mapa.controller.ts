import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { MapaService } from '../services/mapa.service';

@ApiTags('Mapa')
@Controller('mapa')
export class MapaController {
  constructor(private readonly mapaService: MapaService) {}

  @Get('ruta/:idRuta')
  @ApiOperation({
    summary: 'Obtener datos completos de una ruta para visualización en mapa.',
  })
  @ApiParam({
    name: 'idRuta',
    example: 7,
  })
  obtenerDatosMapaPorRuta(@Param('idRuta', ParseIntPipe) idRuta: number) {
    return this.mapaService.obtenerDatosMapaPorRuta(idRuta);
  }
}