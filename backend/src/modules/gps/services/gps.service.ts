import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class GpsService {
  constructor(private readonly prisma: PrismaService) {}

  async listarUltimasPosiciones() {
    const unidades = await this.prisma.unidad.findMany({
      include: {
        registrosGps: {
          orderBy: {
            fechaHora: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        idUnidad: 'asc',
      },
    });

    return unidades.map((unidad) => ({
      idUnidad: unidad.idUnidad,
      codigoUnidad: unidad.codigoUnidad,
      placa: unidad.placa,
      estado: unidad.estado,
      ultimaPosicion: unidad.registrosGps[0] ?? null,
    }));
  }
}