import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { calcularDistanciaMetros } from '../../../common/utils/geo.util';

@Injectable()
export class RutasService {
  constructor(private readonly prisma: PrismaService) {}

  async listarRutas() {
    return this.prisma.ruta.findMany({
      orderBy: {
        nombreRuta: 'asc',
      },
      include: {
        rutaParadas: {
          include: {
            parada: true,
          },
          orderBy: {
            ordenParada: 'asc',
          },
        },
      },
    });
  }

  async obtenerRutaPorId(idRuta: number) {
    const ruta = await this.prisma.ruta.findUnique({
      where: { idRuta },
      include: {
        rutaParadas: {
          include: {
            parada: true,
          },
          orderBy: {
            ordenParada: 'asc',
          },
        },
      },
    });

    if (!ruta) {
      throw new NotFoundException(`No existe una ruta con id ${idRuta}`);
    }

    return ruta;
  }

  async validarParadasContraGps(idRuta: number) {
  const RADIO_VALIDACION_METROS = 80;

  const ruta = await this.prisma.ruta.findUnique({
    where: { idRuta },
  });

  if (!ruta) {
    throw new NotFoundException(`No existe una ruta con id ${idRuta}`);
  }

  const rutaParadas = await this.prisma.rutaParada.findMany({
    where: { idRuta },
    include: {
      parada: true,
    },
    orderBy: {
      ordenParada: 'asc',
    },
  });

  const registrosGps = await this.prisma.registroGps.findMany({
    where: {
      idRuta,
      esOperativo: true,
    },
    select: {
      latitud: true,
      longitud: true,
    },
  });

  const resultado = rutaParadas.map((rutaParada) => {
    let distanciaMinima = Number.MAX_SAFE_INTEGER;
    let gpsCercanos = 0;

    for (const gps of registrosGps) {
      const distancia = calcularDistanciaMetros(
        Number(rutaParada.parada.latitud),
        Number(rutaParada.parada.longitud),
        Number(gps.latitud),
        Number(gps.longitud),
      );

      if (distancia < distanciaMinima) {
        distanciaMinima = distancia;
      }

      if (distancia <= RADIO_VALIDACION_METROS) {
        gpsCercanos++;
      }
    }

    return {
      idParada: rutaParada.idParada,
      nombreParada: rutaParada.parada.nombreParada,
      ordenParada: rutaParada.ordenParada,
      latitud: Number(rutaParada.parada.latitud),
      longitud: Number(rutaParada.parada.longitud),
      distanciaMinimaMetros: Math.round(distanciaMinima),
      gpsCercanos,
      conservar: gpsCercanos > 0,
    };
  });

  return {
    idRuta,
    codigoRuta: ruta.codigoRuta,
    nombreRuta: ruta.nombreRuta,
    radioValidacionMetros: RADIO_VALIDACION_METROS,
    totalParadas: resultado.length,
    paradasConGps: resultado.filter((p) => p.conservar).length,
    paradasSinGps: resultado.filter((p) => !p.conservar).length,
    paradas: resultado,
  };
}
}