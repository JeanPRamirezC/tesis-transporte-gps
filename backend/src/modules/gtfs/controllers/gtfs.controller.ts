import { Controller, Get, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { GtfsService } from '../services/gtfs.service';

@ApiTags('GTFS')
@Controller('gtfs')
export class GtfsController {
  constructor(private readonly gtfsService: GtfsService) {}

  @Get('preview')
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
}
