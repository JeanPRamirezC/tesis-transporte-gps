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
          include: {
            ruta: true,
          },
        },
      },
      orderBy: {
        idUnidad: 'asc',
      },
    });

    return unidades.map((unidad) => {
      const gps = unidad.registrosGps[0] ?? null;
      return {
        idUnidad: unidad.idUnidad,
        codigoUnidad: unidad.codigoUnidad,
        placa: unidad.placa,
        estado: unidad.estado,
        ultimaPosicion: gps
          ? {
              idRegistroGps: gps.idRegistroGps,
              fechaHora: gps.fechaHora,
              latitud: Number(gps.latitud),
              longitud: Number(gps.longitud),
              velocidad: gps.velocidad ? Number(gps.velocidad) : null,
              rumbo: gps.rumbo ? Number(gps.rumbo) : null,
              idRuta: gps.idRuta,
              ruta: gps.ruta
                ? {
                    idRuta: gps.ruta.idRuta,
                    codigoRuta: gps.ruta.codigoRuta,
                    nombreRuta: gps.ruta.nombreRuta,
                  }
                : null,
            }
          : null,
      };
    });
  }
}