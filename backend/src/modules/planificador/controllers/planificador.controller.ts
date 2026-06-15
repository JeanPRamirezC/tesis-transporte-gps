import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PlanificadorService } from '../services/planificador.service';

@ApiTags('Planificador de Viajes')
@Controller('planificador')
export class PlanificadorController {
  constructor(private readonly planificadorService: PlanificadorService) {}

  @Get('planificar')
  @ApiOperation({
    summary: 'Planificar el viaje en autobús desde un origen a un destino en Ibarra.',
    description: 'Devuelve opciones de viaje óptimas combinando caminata a pie y autobuses urbanos.',
  })
  @ApiQuery({ name: 'origenLat', type: Number, description: 'Latitud del punto de origen.' })
  @ApiQuery({ name: 'origenLon', type: Number, description: 'Longitud del punto de origen.' })
  @ApiQuery({ name: 'destinoLat', type: Number, description: 'Latitud del punto de destino.' })
  @ApiQuery({ name: 'destinoLon', type: Number, description: 'Longitud del punto de destino.' })
  @ApiQuery({
    name: 'maxCaminataMetros',
    type: Number,
    required: false,
    description: 'Distancia máxima que el usuario está dispuesto a caminar a pie en metros (Default: 800m).',
  })
  async planificar(
    @Query('origenLat') origenLatStr: string,
    @Query('origenLon') origenLonStr: string,
    @Query('destinoLat') destinoLatStr: string,
    @Query('destinoLon') destinoLonStr: string,
    @Query('maxCaminataMetros') maxCaminataStr?: string,
  ) {
    const origenLat = parseFloat(origenLatStr);
    const origenLon = parseFloat(origenLonStr);
    const destinoLat = parseFloat(destinoLatStr);
    const destinoLon = parseFloat(destinoLonStr);

    if (
      isNaN(origenLat) ||
      isNaN(origenLon) ||
      isNaN(destinoLat) ||
      isNaN(destinoLon)
    ) {
      throw new BadRequestException(
        'Los parámetros origenLat, origenLon, destinoLat y destinoLon son obligatorios y deben ser números decimales válidos.',
      );
    }

    const maxCaminataMetros = maxCaminataStr 
      ? parseFloat(maxCaminataStr) 
      : 800;

    return this.planificadorService.planificarViaje(
      origenLat,
      origenLon,
      destinoLat,
      destinoLon,
      maxCaminataMetros,
    );
  }
}
