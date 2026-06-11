import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { TrayectoriasService } from '../services/trayectorias.service';

@ApiTags('Trayectorias')
@Controller('trayectorias')
export class TrayectoriasController {
  constructor(private readonly trayectoriasService: TrayectoriasService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar todas las trayectorias registradas.',
  })
  listarTrayectorias() {
    return this.trayectoriasService.listarTrayectorias();
  }

  @Get('en-curso')
  @ApiOperation({
    summary: 'Listar trayectorias actualmente en curso.',
  })
  listarTrayectoriasEnCurso() {
    return this.trayectoriasService.listarTrayectoriasEnCurso();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener una trayectoria por su identificador.',
  })
  @ApiParam({
    name: 'id',
    example: 1,
  })
  obtenerTrayectoriaPorId(@Param('id', ParseIntPipe) id: number) {
    return this.trayectoriasService.obtenerTrayectoriaPorId(id);
  }

  @Get('ruta/:idRuta/validas')
@ApiOperation({
  summary: 'Listar trayectorias completadas útiles para visualización por ruta.',
})
@ApiParam({
  name: 'idRuta',
  example: 7,
})
listarTrayectoriasValidasPorRuta(@Param('idRuta', ParseIntPipe) idRuta: number) {
  return this.trayectoriasService.listarTrayectoriasValidasPorRuta(idRuta);
}
}