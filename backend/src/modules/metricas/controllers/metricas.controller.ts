import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiParam, ApiTags } from '@nestjs/swagger';
import { MetricasService } from '../services/metricas.service';

@ApiTags('Metricas')
@Controller('metricas')
export class MetricasController {
  constructor(private readonly metricasService: MetricasService) {}

  @Get('unidades/productividad')
  @ApiOperation({
    summary: 'Obtener KPIs de productividad y eficiencia diaria por bus.',
  })
  @ApiQuery({
    name: 'fecha',
    required: false,
    example: '2026-06-18',
    description: 'Fecha en formato YYYY-MM-DD. Por defecto es el día de hoy.',
  })
  obtenerProductividadDiaria(@Query('fecha') fecha?: string) {
    return this.metricasService.obtenerProductividadDiaria(fecha);
  }

  @Get('rutas/:idRuta/comparativa')
  @ApiOperation({
    summary: 'Comparar tiempos de viaje (promedio, min, max) por bus en una misma ruta.',
  })
  @ApiParam({
    name: 'idRuta',
    example: 7,
  })
  @ApiQuery({
    name: 'dias',
    required: false,
    example: 7,
    description: 'Rango de días históricos a analizar. Por defecto 7 días.',
  })
  obtenerComparativaPorRuta(
    @Param('idRuta', ParseIntPipe) idRuta: number,
    @Query('dias') dias?: string,
  ) {
    const numDias = dias ? parseInt(dias, 10) : 7;
    return this.metricasService.obtenerComparativaPorRuta(idRuta, numDias);
  }

  @Get('trayectorias/:idTrayectoria/desvios')
  @ApiOperation({
    summary: 'Calcular desvíos geográficos e identificar paradas omitidas de una trayectoria.',
  })
  @ApiParam({
    name: 'idTrayectoria',
    example: 120,
  })
  obtenerDesviosTrayectoria(@Param('idTrayectoria', ParseIntPipe) idTrayectoria: number) {
    return this.metricasService.obtenerDesviosTrayectoria(idTrayectoria);
  }

  @Get('incidentes/asociaciones')
  @ApiOperation({
    summary: 'Listar reportes de incidentes enriquecidos con su asociación de bus más probable.',
  })
  obtenerAsociacionesIncidentes() {
    return this.metricasService.obtenerAsociacionesIncidentes();
  }
}
