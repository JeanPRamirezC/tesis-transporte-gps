import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { GtfsService } from '../services/gtfs.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';

@ApiTags('GTFS')
@Controller('gtfs')
export class GtfsController {
  constructor(private readonly gtfsService: GtfsService) {}

  @Get('preview')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({
    summary: 'Obtener un diagnóstico del estado de los datos para la generación del GTFS.',
  })
  async previewGtfs() {
    return this.gtfsService.generarPreview();
  }

  @Get('exportar')
  @ApiOperation({
    summary: 'Generar y descargar el archivo comprimido gtfs.zip con el feed estático.',
  })
  async exportarGtfs(@Res() res: Response) {
    const zipBuffer = await this.gtfsService.generarZip();

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename=gtfs.zip',
      'Content-Length': zipBuffer.length,
    });

    res.end(zipBuffer);
  }

  @Get('realtime/vehicle-positions')
  @ApiOperation({
    summary: 'Obtener el feed dinámico de posiciones de vehículos (GTFS-Realtime).',
  })
  async obtenerVehiclePositions(@Res() res: Response) {
    const buffer = await this.gtfsService.generarVehiclePositions();
    res.set({
      'Content-Type': 'application/x-protobuf',
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('realtime/trip-updates')
  @ApiOperation({
    summary: 'Obtener el feed dinámico de actualización de viajes (GTFS-Realtime).',
  })
  async obtenerTripUpdates(@Res() res: Response) {
    const buffer = await this.gtfsService.generarTripUpdates();
    res.set({
      'Content-Type': 'application/x-protobuf',
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
