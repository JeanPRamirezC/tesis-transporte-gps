import { Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { RutaShapesService } from '../services/ruta-shapes.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';

@ApiTags('Ruta Shapes')
@Controller('ruta-shapes')
export class RutaShapesController {
  constructor(private readonly rutaShapesService: RutaShapesService) {}

  @Post('reconstruir/:idRuta')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN)
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
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN)
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

  @Post('snap-to-roads/:idRuta')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({
    summary: 'Generar shape de ruta usando GPS real y Google Roads API.',
  })
  @ApiParam({
    name: 'idRuta',
    example: 7,
  })
  generarShapeSnapToRoads(@Param('idRuta', ParseIntPipe) idRuta: number) {
    return this.rutaShapesService.generarShapeSnapToRoads(idRuta);
  }

  @Post('generar-final/:idRuta')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({
    summary: 'Generar shape final usando varias trayectorias y consenso espacial.',
  })
  @ApiParam({
    name: 'idRuta',
    example: 7,
  })
  generarShapeFinal(@Param('idRuta', ParseIntPipe) idRuta: number) {
    return this.rutaShapesService.generarShapeFinal(idRuta);
  }

  @Post('generar-desde-trayectoria/:idTrayectoria')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({
    summary: 'Generar shape usando una trayectoria específica.',
  })
  @ApiParam({
    name: 'idTrayectoria',
    example: 20,
  })
  generarShapeDesdeTrayectoria(
    @Param('idTrayectoria', ParseIntPipe) idTrayectoria: number,
  ) {
    return this.rutaShapesService.generarShapeDesdeTrayectoria(idTrayectoria);
  }
}