import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { RutasService } from '../services/rutas.service';

@ApiTags('Rutas')
@Controller('rutas')
export class RutasController {
  constructor(private readonly rutasService: RutasService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar rutas registradas en el sistema.',
  })
  listarRutas() {
    return this.rutasService.listarRutas();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener una ruta por su identificador interno.',
  })
  @ApiParam({
    name: 'id',
    example: 1,
    description: 'Identificador interno de la ruta.',
  })
  obtenerRutaPorId(@Param('id', ParseIntPipe) id: number) {
    return this.rutasService.obtenerRutaPorId(id);
  }
}