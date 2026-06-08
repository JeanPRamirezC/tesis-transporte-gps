import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { calcularDistanciaMetros } from '../../../common/utils/geo.util';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class RutaShapesService {
  constructor(private readonly prisma: PrismaService) {}

  async reconstruirRuta(idRuta: number) {
    const ruta = await this.prisma.ruta.findUnique({
      where: { idRuta },
    });

    if (!ruta) {
      throw new NotFoundException(`No existe una ruta con id ${idRuta}`);
    }

    const registrosGps = await this.prisma.registroGps.findMany({
      where: {
        idRuta,
        esOperativo: true,
      },
      orderBy: {
        fechaHora: 'asc',
      },
    });

    if (registrosGps.length < 2) {
      return {
        mensaje: 'No existen suficientes registros GPS para reconstruir la ruta.',
        totalRegistros: registrosGps.length,
      };
    }

    const distanciaMinimaMetros = 20;
    const puntosFiltrados: Array<{ latitud: number; longitud: number }> = [];

    for (const registro of registrosGps) {
      const puntoActual = {
        latitud: Number(registro.latitud),
        longitud: Number(registro.longitud),
      };

      const ultimoPunto = puntosFiltrados[puntosFiltrados.length - 1];

      if (!ultimoPunto) {
        puntosFiltrados.push(puntoActual);
        continue;
      }

      const distancia = calcularDistanciaMetros(
        ultimoPunto.latitud,
        ultimoPunto.longitud,
        puntoActual.latitud,
        puntoActual.longitud,
      );

      if (distancia >= distanciaMinimaMetros) {
        puntosFiltrados.push(puntoActual);
      }
    }

    await this.prisma.rutaShape.deleteMany({
      where: { idRuta },
    });

    await this.prisma.rutaShape.createMany({
      data: puntosFiltrados.map((punto, index) => ({
        idRuta,
        latitud: new Prisma.Decimal(punto.latitud),
        longitud: new Prisma.Decimal(punto.longitud),
        secuencia: index + 1,
      })),
    });

    return {
      mensaje: 'Ruta reconstruida correctamente.',
      ruta: ruta.nombreRuta,
      totalRegistrosGps: registrosGps.length,
      totalPuntosShape: puntosFiltrados.length,
    };
  }

  async obtenerShapeRuta(idRuta: number) {
    const ruta = await this.prisma.ruta.findUnique({
      where: { idRuta },
    });

    if (!ruta) {
      throw new NotFoundException(`No existe una ruta con id ${idRuta}`);
    }

    const puntos = await this.prisma.rutaShape.findMany({
      where: { idRuta },
      orderBy: { secuencia: 'asc' },
    });

    return {
      ruta,
      totalPuntos: puntos.length,
      puntos,
    };
  }

  async generarShapeDesdeParadas(idRuta: number) {
  const ruta = await this.prisma.ruta.findUnique({
    where: { idRuta },
  });

  if (!ruta) {
    throw new NotFoundException(`No existe una ruta con id ${idRuta}`);
  }

  const rutaParadas = await this.prisma.rutaParada.findMany({
    where: {
      idRuta,
    },
    include: {
      parada: true,
    },
    orderBy: {
      ordenParada: 'asc',
    },
  });

  if (rutaParadas.length < 2) {
    return {
      mensaje: 'No existen suficientes paradas para generar el shape.',
      totalParadas: rutaParadas.length,
    };
  }

  await this.prisma.rutaShape.deleteMany({
    where: {
      idRuta,
    },
  });

  await this.prisma.rutaShape.createMany({
    data: rutaParadas.map((rutaParada, index) => ({
      idRuta,
      latitud: rutaParada.parada.latitud,
      longitud: rutaParada.parada.longitud,
      secuencia: index + 1,
    })),
  });

  return {
    mensaje: 'Shape generado correctamente desde paradas.',
    idRuta,
    ruta: ruta.nombreRuta,
    totalPuntosShape: rutaParadas.length,
  };
}
}