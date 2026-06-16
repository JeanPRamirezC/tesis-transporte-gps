import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FavoritosService } from '../services/favoritos.service';

@ApiTags('Rutas Favoritas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('favoritos')
export class FavoritosController {
  constructor(private readonly favoritosService: FavoritosService) {}

  @Get()
  @ApiOperation({
    summary: 'Obtener el listado de rutas favoritas del usuario autenticado.',
  })
  async obtenerFavoritos(@Request() req: any) {
    const idUsuario = req.user.idUsuario;
    return this.favoritosService.obtenerFavoritos(idUsuario);
  }

  @Post()
  @ApiOperation({
    summary: 'Añadir una ruta a la lista de favoritos del usuario.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        idRuta: { type: 'number', example: 2, description: 'ID de la ruta a guardar.' },
      },
      required: ['idRuta'],
    },
  })
  async agregarFavorito(@Request() req: any, @Body('idRuta', ParseIntPipe) idRuta: number) {
    const idUsuario = req.user.idUsuario;
    return this.favoritosService.agregarFavorito(idUsuario, idRuta);
  }

  @Delete(':idRuta')
  @ApiOperation({
    summary: 'Remover una ruta de la lista de favoritos.',
  })
  async eliminarFavorito(
    @Request() req: any,
    @Param('idRuta', ParseIntPipe) idRuta: number,
  ) {
    const idUsuario = req.user.idUsuario;
    return this.favoritosService.eliminarFavorito(idUsuario, idRuta);
  }
}
