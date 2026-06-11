import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { EtaService } from '../../eta/services/eta.service';

@Injectable()
export class MapaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly etaService: EtaService,
  ) {}

  async obtenerDatosMapaPorRuta(idRuta: number) {
    const ruta = await this.prisma.ruta.findUnique({
      where: { idRuta },
    });

    if (!ruta) {
      throw new NotFoundException(`No existe una ruta con id ${idRuta}`);
    }

    const shape = await this.prisma.rutaShape.findMany({
      where: { idRuta },
      orderBy: { secuencia: 'asc' },
    });

    const paradas = await this.prisma.rutaParada.findMany({
      where: { idRuta },
      include: {
        parada: true,
      },
      orderBy: {
        ordenParada: 'asc',
      },
    });

    const unidades = await this.prisma.unidad.findMany({
      where: {
        registrosGps: {
          some: {
            idRuta,
          },
        },
      },
      include: {
        registrosGps: {
          where: {
            idRuta,
          },
          orderBy: {
            fechaHora: 'desc',
          },
          take: 1,
        },
      },
    });

    const eta = await this.etaService.calcularEtaPorRuta(idRuta);

    return {
      ruta: {
        idRuta: ruta.idRuta,
        codigoRuta: ruta.codigoRuta,
        nombreRuta: ruta.nombreRuta,
        salida: ruta.latitudSalida && ruta.longitudSalida ? {
          latitud: Number(ruta.latitudSalida),
          longitud: Number(ruta.longitudSalida),
        } : null,
        llegada: ruta.latitudLlegada && ruta.longitudLlegada ? {
          latitud: Number(ruta.latitudLlegada),
          longitud: Number(ruta.longitudLlegada),
        } : null,
      },
      shape: shape.map((punto) => ({
        latitud: Number(punto.latitud),
        longitud: Number(punto.longitud),
        secuencia: punto.secuencia,
      })),
      paradas: paradas.map((rp) => ({
        idParada: rp.parada.idParada,
        nombreParada: rp.parada.nombreParada,
        ordenParada: rp.ordenParada,
        latitud: Number(rp.parada.latitud),
        longitud: Number(rp.parada.longitud),
      })),
      unidades: unidades.map((unidad) => ({
        idUnidad: unidad.idUnidad,
        codigoUnidad: unidad.codigoUnidad,
        placa: unidad.placa,
        estado: unidad.estado,
        ultimaPosicion: unidad.registrosGps[0]
          ? {
              fechaHora: unidad.registrosGps[0].fechaHora,
              latitud: Number(unidad.registrosGps[0].latitud),
              longitud: Number(unidad.registrosGps[0].longitud),
              velocidad: unidad.registrosGps[0].velocidad
                ? Number(unidad.registrosGps[0].velocidad)
                : null,
              rumbo: unidad.registrosGps[0].rumbo
                ? Number(unidad.registrosGps[0].rumbo)
                : null,
            }
          : null,
      })),
      eta,
    };
  }
}