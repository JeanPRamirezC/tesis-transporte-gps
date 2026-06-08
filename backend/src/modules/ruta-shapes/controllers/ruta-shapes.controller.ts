import { Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { RutaShapesService } from '../services/ruta-shapes.service';

@ApiTags('Ruta Shapes')
@Controller('ruta-shapes')
export class RutaShapesController {
  constructor(private readonly rutaShapesService: RutaShapesService) {}

  @Post('reconstruir/:idRuta')
  @ApiOperation({
    summary: 'Reconstruir el trazado de una ruta a partir de registros GPS.',
  })
  @ApiParam({
    name: 'idRuta',
    example: 1,
  })
  reconstruirRuta(@Param('idRuta', ParseIntPipe) idRuta: number) {
    return this.rutaShapesService.reconstruirRuta(idRuta);
  }

  @Get(':idRuta')
  @ApiOperation({
    summary: 'Obtener el shape reconstruido de una ruta.',
  })
  @ApiParam({
    name: 'idRuta',
    example: 1,
  })
  obtenerShapeRuta(@Param('idRuta', ParseIntPipe) idRuta: number) {
    return this.rutaShapesService.obtenerShapeRuta(idRuta);
  }

  @Post('generar-desde-paradas/:idRuta')
@ApiOperation({
  summary: 'Generar shape inicial de una ruta usando sus paradas ordenadas.',
})
@ApiParam({
  name: 'idRuta',
  example: 7,
})
generarShapeDesdeParadas(@Param('idRuta', ParseIntPipe) idRuta: number) {
  return this.rutaShapesService.generarShapeDesdeParadas(idRuta);
}
}