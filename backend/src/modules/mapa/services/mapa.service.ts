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
        estado: 'ACTIVA',
      },
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
    });

    const unidadesEnRuta = unidades.filter(
      (u) => u.registrosGps[0]?.idRuta === idRuta,
    );

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
      unidades: unidadesEnRuta.map((unidad) => {
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
      }),
      eta: eta.unidades.map((u) => {
        const nextEta = u.etas[0];
        if (!nextEta) {
          return {
            codigoUnidad: u.codigoUnidad,
            minutosEstimados: 0,
            nombreParada: 'Fin de ruta',
          };
        }

        // Si faltan menos de 20 segundos para la parada, consideramos que el tiempo se cumplió
        // y pasamos automáticamente a mostrar la estimación hacia la siguiente parada (u.etas[1])
        const yaLlego = nextEta.etaSegundos < 20;
        const targetEta = yaLlego && u.etas[1] ? u.etas[1] : nextEta;

        return {
          codigoUnidad: u.codigoUnidad,
          minutosEstimados: targetEta.etaMinutos ?? 0,
          nombreParada: targetEta.nombreParada ?? 'Siguiente parada',
        };
      }),
    };
  }
}