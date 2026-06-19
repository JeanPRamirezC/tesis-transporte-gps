import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { RegistroGps } from '@prisma/client';
import {
  GPS_RADIO_DETECCION_PARADA_METROS,
  GPS_MAX_DURACION_TRAMO_SEGUNDOS,
} from '../../../common/constants/gps.constants';
import { calcularDistanciaMetros } from '../../../common/utils/geo.util';

@Injectable()
export class TiemposTramoService {
  constructor(private readonly prisma: PrismaService) {}

  async listarTiemposTramo() {
    return this.prisma.tiempoTramo.findMany({
      orderBy: {
        fechaHoraOrigen: 'desc',
      },
      include: {
        unidad: true,
        ruta: true,
      },
    });
  }

  async listarPorRuta(idRuta: number) {
    return this.prisma.tiempoTramo.findMany({
      where: {
        idRuta,
      },
      orderBy: {
        fechaHoraOrigen: 'desc',
      },
      include: {
        unidad: true,
        ruta: true,
      },
    });
  }

  async procesarPasoPorParada(registroGps: RegistroGps) {
  if (!registroGps.esOperativo || !registroGps.idRuta) {
    return {
      accion: 'IGNORADO',
      motivo: 'Registro GPS no operativo o sin ruta.',
    };
  }

  const rutaParadas = await this.prisma.rutaParada.findMany({
    where: {
      idRuta: registroGps.idRuta,
    },
    include: {
      parada: true,
    },
    orderBy: {
      ordenParada: 'asc',
    },
  });

  if (rutaParadas.length === 0) {
    return {
      accion: 'IGNORADO',
      motivo: 'La ruta no tiene paradas registradas.',
    };
  }

  const latitudBus = Number(registroGps.latitud);
  const longitudBus = Number(registroGps.longitud);

  const paradasCercanas = rutaParadas
    .map((rutaParada) => {
      const distancia = calcularDistanciaMetros(
        latitudBus,
        longitudBus,
        Number(rutaParada.parada.latitud),
        Number(rutaParada.parada.longitud),
      );

      return {
        rutaParada,
        distancia,
      };
    })
    .filter((item) => item.distancia <= GPS_RADIO_DETECCION_PARADA_METROS)
    .sort((a, b) => a.distancia - b.distancia);

  const paradaDetectada = paradasCercanas[0];

  if (!paradaDetectada) {
    return {
      accion: 'SIN_PARADA_CERCANA',
    };
  }

  const paradaActual = paradaDetectada.rutaParada;

  const ultimoPaso = await this.prisma.pasoParadaActual.findUnique({
    where: {
      idUnidad_idRuta: {
        idUnidad: registroGps.idUnidad,
        idRuta: registroGps.idRuta,
      },
    },
  });

  if (!ultimoPaso) {
    await this.prisma.pasoParadaActual.create({
      data: {
        idUnidad: registroGps.idUnidad,
        idRuta: registroGps.idRuta,
        idParada: paradaActual.idParada,
        ordenParada: paradaActual.ordenParada,
        fechaHoraPaso: registroGps.fechaHora,
      },
    });

    return {
      accion: 'PRIMERA_PARADA_DETECTADA',
      parada: paradaActual.ordenParada,
    };
  }

  if (ultimoPaso.idParada === paradaActual.idParada) {
    return {
      accion: 'MISMA_PARADA_IGNORADA',
      parada: paradaActual.ordenParada,
    };
  }

  if (paradaActual.ordenParada !== ultimoPaso.ordenParada + 1) {
    await this.prisma.pasoParadaActual.update({
      where: {
        idPasoParadaActual: ultimoPaso.idPasoParadaActual,
      },
      data: {
        idParada: paradaActual.idParada,
        ordenParada: paradaActual.ordenParada,
        fechaHoraPaso: registroGps.fechaHora,
      },
    });

    return {
      accion: 'SALTO_DE_PARADA',
      paradaAnterior: ultimoPaso.ordenParada,
      paradaActual: paradaActual.ordenParada,
    };
  }

  const duracionSegundos = Math.round(
    (registroGps.fechaHora.getTime() - ultimoPaso.fechaHoraPaso.getTime()) /
      1000,
  );

  // Actualizar siempre el estado del bus para que pueda seguir su ruta
  await this.prisma.pasoParadaActual.update({
    where: {
      idPasoParadaActual: ultimoPaso.idPasoParadaActual,
    },
    data: {
      idParada: paradaActual.idParada,
      ordenParada: paradaActual.ordenParada,
      fechaHoraPaso: registroGps.fechaHora,
    },
  });

  // Si el tiempo transcurrido es mayor al límite lógico, omitimos registrar el tramo
  if (duracionSegundos > GPS_MAX_DURACION_TRAMO_SEGUNDOS) {
    return {
      accion: 'TIEMPO_TRAMO_IGNORADO',
      motivo: `Duración de tramo excede el límite máximo permitido (${duracionSegundos}s > ${GPS_MAX_DURACION_TRAMO_SEGUNDOS}s), indicando descanso o parada prolongada.`,
    };
  }

  const tiempoTramo = await this.prisma.tiempoTramo.create({
    data: {
      idUnidad: registroGps.idUnidad,
      idRuta: registroGps.idRuta,
      idParadaOrigen: ultimoPaso.idParada,
      idParadaDestino: paradaActual.idParada,
      fechaHoraOrigen: ultimoPaso.fechaHoraPaso,
      fechaHoraDestino: registroGps.fechaHora,
      duracionSegundos,
    },
  });

  return {
    accion: 'TIEMPO_TRAMO_REGISTRADO',
    tiempoTramo,
  };
}

async obtenerPromediosPorRuta(idRuta: number) {
  const promedios = await this.prisma.tiempoTramo.groupBy({
    by: ['idParadaOrigen', 'idParadaDestino'],
    where: {
      idRuta,
    },
    _avg: {
      duracionSegundos: true,
    },
    _count: {
      idTiempoTramo: true,
    },
    orderBy: [
      {
        idParadaOrigen: 'asc',
      },
      {
        idParadaDestino: 'asc',
      },
    ],
  });

  return {
    idRuta,
    totalTramos: promedios.length,
    tramos: promedios.map((tramo) => ({
      idParadaOrigen: tramo.idParadaOrigen,
      idParadaDestino: tramo.idParadaDestino,
      promedioSegundos: Math.round(tramo._avg.duracionSegundos ?? 0),
      cantidadMuestras: tramo._count.idTiempoTramo,
    })),
  };
}

async obtenerCoberturaPorRuta(idRuta: number) {
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

  const promedios = await this.prisma.tiempoTramo.groupBy({
    by: ['idParadaOrigen', 'idParadaDestino'],
    where: {
      idRuta,
    },
    _avg: {
      duracionSegundos: true,
    },
    _count: {
      idTiempoTramo: true,
    },
  });

  const mapaPromedios = new Map<string, { promedio: number; muestras: number }>();

  for (const promedio of promedios) {
    const clave = `${promedio.idParadaOrigen}-${promedio.idParadaDestino}`;

    mapaPromedios.set(clave, {
      promedio: Math.round(promedio._avg.duracionSegundos ?? 0),
      muestras: promedio._count.idTiempoTramo,
    });
  }

  const tramos = [];

  for (let i = 0; i < rutaParadas.length - 1; i++) {
    const origen = rutaParadas[i];
    const destino = rutaParadas[i + 1];

    const clave = `${origen.idParada}-${destino.idParada}`;
    const historico = mapaPromedios.get(clave);

    tramos.push({
      ordenOrigen: origen.ordenParada,
      paradaOrigen: origen.parada.nombreParada,
      ordenDestino: destino.ordenParada,
      paradaDestino: destino.parada.nombreParada,
      tieneHistorico: Boolean(historico),
      promedioSegundos: historico?.promedio ?? null,
      muestras: historico?.muestras ?? 0,
    });
  }

  const tramosConHistorico = tramos.filter((tramo) => tramo.tieneHistorico).length;

  return {
    idRuta,
    totalParadas: rutaParadas.length,
    totalTramos: tramos.length,
    tramosConHistorico,
    tramosSinHistorico: tramos.length - tramosConHistorico,
    porcentajeCobertura:
      tramos.length > 0
        ? Math.round((tramosConHistorico / tramos.length) * 100)
        : 0,
    tramos,
  };
}

  async reconstruirTiemposTramoTrayectoria(idTrayectoria: number): Promise<void> {
    const trayectoria = await this.prisma.trayectoria.findUnique({
      where: { idTrayectoria },
    });
    if (!trayectoria || !trayectoria.fechaFin) return;

    const rutaParadas = await this.prisma.rutaParada.findMany({
      where: { idRuta: trayectoria.idRuta },
      include: { parada: true },
      orderBy: { ordenParada: 'asc' },
    });

    const gpsRecords = await this.prisma.registroGps.findMany({
      where: {
        idUnidad: trayectoria.idUnidad,
        idRuta: trayectoria.idRuta,
        esOperativo: true,
        fechaHora: {
          gte: trayectoria.fechaInicio,
          lte: trayectoria.fechaFin,
        },
      },
      orderBy: {
        fechaHora: 'asc',
      },
    });

    if (gpsRecords.length === 0) return;

    const pasoTiempos: { [key: number]: Date } = {};
    let ultimoGpsIndex = 0;

    for (const rp of rutaParadas) {
      const latParada = Number(rp.parada.latitud);
      const lngParada = Number(rp.parada.longitud);

      let minDistance = Infinity;
      let closestPing: any = null;
      let closestIndex = -1;

      for (let j = ultimoGpsIndex; j < gpsRecords.length; j++) {
        const gps = gpsRecords[j];
        const dist = calcularDistanciaMetros(
          Number(gps.latitud),
          Number(gps.longitud),
          latParada,
          lngParada,
        );

        if (dist <= 150) {
          if (dist < minDistance) {
            minDistance = dist;
            closestPing = gps;
            closestIndex = j;
          }
        } else if (closestPing && dist > 250) {
          break;
        }
      }

      if (closestPing) {
        pasoTiempos[rp.parada.idParada] = closestPing.fechaHora;
        ultimoGpsIndex = closestIndex;
      }
    }

    for (let i = 0; i < rutaParadas.length - 1; i++) {
      const origen = rutaParadas[i];
      const destino = rutaParadas[i + 1];

      const tOrigen = pasoTiempos[origen.parada.idParada];
      const tDestino = pasoTiempos[destino.parada.idParada];

      if (tOrigen && tDestino) {
        const duracionSegundos = Math.round(
          (tDestino.getTime() - tOrigen.getTime()) / 1000,
        );

        if (duracionSegundos > 0 && duracionSegundos <= 1200) {
          const existe = await this.prisma.tiempoTramo.findFirst({
            where: {
              idUnidad: trayectoria.idUnidad,
              idRuta: trayectoria.idRuta,
              idParadaOrigen: origen.parada.idParada,
              idParadaDestino: destino.parada.idParada,
              fechaHoraOrigen: tOrigen,
            },
          });

          if (!existe) {
            await this.prisma.tiempoTramo.create({
              data: {
                idUnidad: trayectoria.idUnidad,
                idRuta: trayectoria.idRuta,
                idParadaOrigen: origen.parada.idParada,
                idParadaDestino: destino.parada.idParada,
                fechaHoraOrigen: tOrigen,
                fechaHoraDestino: tDestino,
                duracionSegundos,
              },
            });
          }
        }
      }
    }
  }
}