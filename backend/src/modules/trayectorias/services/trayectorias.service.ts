import { Injectable, NotFoundException } from '@nestjs/common';
import { RegistroGps } from '@prisma/client';
import { calcularDistanciaMetros } from '../../../common/utils/geo.util';
import { PrismaService } from '../../../database/prisma.service';
import { toZonedTime } from 'date-fns-tz';
import { ECUADOR_TIMEZONE } from '../../../common/constants/timezone.constants';
import { TiemposTramoService } from '../../tiempos-tramo/services/tiempos-tramo.service';

@Injectable()
export class TrayectoriasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tiemposTramoService: TiemposTramoService,
  ) {}

  async listarTrayectorias() {
    return this.prisma.trayectoria.findMany({
      orderBy: {
        fechaInicio: 'desc',
      },
      include: {
        unidad: true,
        ruta: true,
      },
    });
  }

  async listarTrayectoriasEnCurso() {
    return this.prisma.trayectoria.findMany({
      where: {
        estado: 'EN_CURSO',
      },
      orderBy: {
        fechaInicio: 'desc',
      },
      include: {
        unidad: true,
        ruta: true,
      },
    });
  }

  async obtenerTrayectoriaPorId(idTrayectoria: number) {
    const trayectoria = await this.prisma.trayectoria.findUnique({
      where: {
        idTrayectoria,
      },
      include: {
        unidad: true,
        ruta: true,
      },
    });

    if (!trayectoria) {
      throw new NotFoundException(
        `No existe una trayectoria con id ${idTrayectoria}`,
      );
    }

    return trayectoria;
  }

  async obtenerPuntosGps(idTrayectoria: number) {
    const trayectoria = await this.prisma.trayectoria.findUnique({
      where: {
        idTrayectoria,
      },
    });

    if (!trayectoria) {
      throw new NotFoundException(
        `No existe una trayectoria con id ${idTrayectoria}`,
      );
    }

    return this.prisma.registroGps.findMany({
      where: {
        idRuta: trayectoria.idRuta,
        idUnidad: trayectoria.idUnidad,
        esOperativo: true,
        fechaHora: {
          gte: trayectoria.fechaInicio,
          lte: trayectoria.fechaFin || new Date(),
        },
      },
      orderBy: {
        fechaHora: 'asc',
      },
    });
  }

  async procesarRegistroGps(registroGps: RegistroGps) {
    if (!registroGps.idRuta) {
      return {
        accion: 'IGNORADO',
        motivo: 'Registro GPS sin ruta asociada.',
      };
    }

    const ruta = await this.prisma.ruta.findUnique({
      where: {
        idRuta: registroGps.idRuta,
      },
    });

    if (
      !ruta ||
      !ruta.latitudSalida ||
      !ruta.longitudSalida ||
      !ruta.latitudLlegada ||
      !ruta.longitudLlegada
    ) {
      return {
        accion: 'IGNORADO',
        motivo: 'La ruta no tiene puntos de inicio/llegada configurados.',
      };
    }

    const trayectoriaEnCurso = await this.prisma.trayectoria.findFirst({
      where: {
        idUnidad: registroGps.idUnidad,
        idRuta: registroGps.idRuta,
        estado: 'EN_CURSO',
      },
      orderBy: {
        fechaInicio: 'desc',
      },
    });

    const latitudBus = Number(registroGps.latitud);
    const longitudBus = Number(registroGps.longitud);

    const distanciaInicio = calcularDistanciaMetros(
      latitudBus,
      longitudBus,
      Number(ruta.latitudSalida),
      Number(ruta.longitudSalida),
    );

    const distanciaLlegada = calcularDistanciaMetros(
      latitudBus,
      longitudBus,
      Number(ruta.latitudLlegada),
      Number(ruta.longitudLlegada),
    );

    const radioControl = ruta.radioControlMetros;

    if (!trayectoriaEnCurso && distanciaInicio <= radioControl) {
      // Cerrar cualquier otra trayectoria activa de la misma unidad en otras rutas
      const trayectoriasActivasMismaUnidad = await this.prisma.trayectoria.findMany({
        where: {
          idUnidad: registroGps.idUnidad,
          estado: 'EN_CURSO',
        },
      });

      for (const tActiva of trayectoriasActivasMismaUnidad) {
        const ultimoGps = await this.prisma.registroGps.findFirst({
          where: {
            idUnidad: tActiva.idUnidad,
            idRuta: tActiva.idRuta,
            fechaHora: {
              gte: tActiva.fechaInicio,
            },
          },
          orderBy: {
            fechaHora: 'desc',
          },
        });

        const fechaFin = ultimoGps ? ultimoGps.fechaHora : tActiva.fechaInicio;

        await this.prisma.trayectoria.update({
          where: { idTrayectoria: tActiva.idTrayectoria },
          data: {
            estado: 'INCOMPLETA',
            fechaFin,
            motivoCierre: 'Nueva trayectoria iniciada en otra ruta.',
          },
        });
      }

      const nuevaTrayectoria = await this.prisma.trayectoria.create({
        data: {
          idUnidad: registroGps.idUnidad,
          idRuta: registroGps.idRuta,
          estado: 'EN_CURSO',
          fechaInicio: registroGps.fechaHora,
        },
      });

      return {
        accion: 'TRAYECTORIA_INICIADA',
        trayectoria: nuevaTrayectoria,
        distanciaInicio,
      };
    }

    if (trayectoriaEnCurso) {
      const minutosTranscurridos =
        (registroGps.fechaHora.getTime() -
          trayectoriaEnCurso.fechaInicio.getTime()) /
        1000 /
        60;

      if (minutosTranscurridos >= ruta.tiempoMaximoRecorridoMin) {
        const trayectoriaCerrada = await this.prisma.trayectoria.update({
          where: {
            idTrayectoria: trayectoriaEnCurso.idTrayectoria,
          },
          data: {
            estado: 'INCOMPLETA',
            fechaFin: registroGps.fechaHora,
            motivoCierre: 'Tiempo máximo de recorrido excedido.',
          },
        });

        return {
          accion: 'TRAYECTORIA_INCOMPLETA',
          trayectoria: trayectoriaCerrada,
          minutosTranscurridos,
          tiempoMaximo: ruta.tiempoMaximoRecorridoMin,
        };
      }

      if (distanciaLlegada <= radioControl) {
        if (minutosTranscurridos >= ruta.tiempoMinimoRecorridoMin) {
          // Validar que la unidad haya completado al menos el 75% de las paradas
          // Esto evita cierres prematuros en rutas circulares o con tramos que se cruzan
          const ultimoPaso = await this.prisma.pasoParadaActual.findUnique({
            where: {
              idUnidad_idRuta: {
                idUnidad: registroGps.idUnidad,
                idRuta: registroGps.idRuta,
              },
            },
          });

          const totalRutaParadas = await this.prisma.rutaParada.count({
            where: { idRuta: registroGps.idRuta },
          });

          const paradasRequeridas = Math.floor(totalRutaParadas * 0.75);
          const ordenActual = ultimoPaso ? ultimoPaso.ordenParada : 0;

          if (totalRutaParadas > 0 && ordenActual < paradasRequeridas) {
            return {
              accion: 'PUNTO_LLEGADA_IGNORADO',
              motivo: `La unidad está en el punto de control de llegada pero no ha completado el recorrido mínimo de paradas (Parada actual: ${ordenActual}/${totalRutaParadas}, requeridas: ${paradasRequeridas}).`,
              distanciaLlegada,
              minutosTranscurridos,
            };
          }

          // Consultar registros GPS de la trayectoria hasta el momento
          const registrosTrayectoria = await this.prisma.registroGps.findMany({
            where: {
              idRuta: trayectoriaEnCurso.idRuta,
              idUnidad: trayectoriaEnCurso.idUnidad,
              esOperativo: true,
              fechaHora: {
                gte: trayectoriaEnCurso.fechaInicio,
                lte: registroGps.fechaHora,
              },
            },
            select: {
              latitud: true,
              longitud: true,
            },
          });

          // Estimar longitud de la ruta a partir de paradas
          const rutaParadas = await this.prisma.rutaParada.findMany({
            where: { idRuta: trayectoriaEnCurso.idRuta },
            include: { parada: true },
            orderBy: { ordenParada: 'asc' },
          });

          let longitudRutaMetros = 0;
          for (let i = 1; i < rutaParadas.length; i++) {
            longitudRutaMetros += calcularDistanciaMetros(
              Number(rutaParadas[i - 1].parada.latitud),
              Number(rutaParadas[i - 1].parada.longitud),
              Number(rutaParadas[i].parada.latitud),
              Number(rutaParadas[i].parada.longitud),
            );
          }

          if (longitudRutaMetros === 0) {
            longitudRutaMetros = 5000; // Valor por defecto estimado
          }

          // La unidad debe haberse alejado al menos el 30% de la longitud de la ruta (entre 500m y 1500m)
          const distanciaMinimaAlejamiento = Math.max(500, Math.min(1500, longitudRutaMetros * 0.3));

          let distanciaMaxima = 0;
          for (const reg of registrosTrayectoria) {
            const dist = calcularDistanciaMetros(
              Number(ruta.latitudSalida),
              Number(ruta.longitudSalida),
              Number(reg.latitud),
              Number(reg.longitud),
            );
            if (dist > distanciaMaxima) {
              distanciaMaxima = dist;
            }
          }

          if (distanciaMaxima >= distanciaMinimaAlejamiento) {
            const trayectoriaCerrada = await this.prisma.trayectoria.update({
              where: {
                idTrayectoria: trayectoriaEnCurso.idTrayectoria,
              },
              data: {
                estado: 'COMPLETADA',
                fechaFin: registroGps.fechaHora,
                motivoCierre: 'Llegada al punto final de la ruta.',
              },
            });

            await this.tiemposTramoService.reconstruirTiemposTramoTrayectoria(trayectoriaCerrada.idTrayectoria);

            return {
              accion: 'TRAYECTORIA_COMPLETADA',
              trayectoria: trayectoriaCerrada,
              distanciaLlegada,
              minutosTranscurridos,
              distanciaMaxima,
            };
          } else {
            // Falso positivo: no se alejó lo suficiente (estuvo estacionado)
            return {
              accion: 'PUNTO_LLEGADA_IGNORADO',
              motivo: `La unidad no se alejó lo suficiente del origen de la ruta (${Math.round(distanciaMaxima)}m de ${Math.round(distanciaMinimaAlejamiento)}m requeridos).`,
              distanciaLlegada,
              minutosTranscurridos,
              distanciaMaxima,
            };
          }
        } else {
          return {
            accion: 'PUNTO_LLEGADA_IGNORADO',
            motivo: 'La unidad pasó por el punto final antes del tiempo mínimo.',
            distanciaLlegada,
            minutosTranscurridos,
            tiempoMinimo: ruta.tiempoMinimoRecorridoMin,
          };
        }
      }
    }

    return {
      accion: 'SIN_CAMBIOS',
      distanciaInicio,
      distanciaLlegada,
    };
  }

  async listarTrayectoriasValidasPorRuta(idRuta: number) {
  const trayectorias = await this.prisma.trayectoria.findMany({
    where: {
      idRuta,
      estado: 'COMPLETADA',
      fechaFin: {
        not: null,
      },
    },
    include: {
      unidad: true,
      ruta: true,
    },
    orderBy: {
      fechaInicio: 'desc',
    },
  });

  const resultado = [];

  for (const trayectoria of trayectorias) {
    if (!trayectoria.fechaFin) continue;

    const totalGps = await this.prisma.registroGps.count({
      where: {
        idRuta,
        idUnidad: trayectoria.idUnidad,
        esOperativo: true,
        fechaHora: {
          gte: trayectoria.fechaInicio,
          lte: trayectoria.fechaFin,
        },
      },
    });

    const duracionMinutos = Math.round(
      (trayectoria.fechaFin.getTime() - trayectoria.fechaInicio.getTime()) /
        1000 /
        60,
    );

    resultado.push({
      idTrayectoria: trayectoria.idTrayectoria,
      idRuta: trayectoria.idRuta,
      codigoRuta: trayectoria.ruta.codigoRuta,
      nombreRuta: trayectoria.ruta.nombreRuta,
      idUnidad: trayectoria.idUnidad,
      codigoUnidad: trayectoria.unidad.codigoUnidad,
      placa: trayectoria.unidad.placa,
      fechaInicio: trayectoria.fechaInicio,
      fechaFin: trayectoria.fechaFin,
      duracionMinutos,
      totalGps,
      esValidaVisualmente: totalGps >= 50,
    });
  }

  return {
    idRuta,
    totalTrayectorias: resultado.length,
    trayectoriasValidas: resultado.filter((t) => t.esValidaVisualmente).length,
    trayectorias: resultado,
  };
}

  async autocerrarTrayectoriasExcedidas() {
    const trayectoriasEnCurso = await this.prisma.trayectoria.findMany({
      where: {
        estado: 'EN_CURSO',
      },
      include: {
        ruta: true,
      },
    });

    const ahora = toZonedTime(new Date(), ECUADOR_TIMEZONE);
    let cerradasCount = 0;

    for (const trayectoria of trayectoriasEnCurso) {
      const ruta = trayectoria.ruta;
      if (!ruta) continue;

      const minutosTranscurridos =
        (ahora.getTime() - trayectoria.fechaInicio.getTime()) / 1000 / 60;

      if (minutosTranscurridos >= ruta.tiempoMaximoRecorridoMin) {
        const ultimoGps = await this.prisma.registroGps.findFirst({
          where: {
            idUnidad: trayectoria.idUnidad,
            idRuta: trayectoria.idRuta,
            fechaHora: {
              gte: trayectoria.fechaInicio,
            },
          },
          orderBy: {
            fechaHora: 'desc',
          },
        });

        const fechaFin = ultimoGps
          ? ultimoGps.fechaHora
          : new Date(trayectoria.fechaInicio.getTime() + ruta.tiempoMaximoRecorridoMin * 60 * 1000);

        await this.prisma.trayectoria.update({
          where: {
            idTrayectoria: trayectoria.idTrayectoria,
          },
          data: {
            estado: 'INCOMPLETA',
            fechaFin,
            motivoCierre: 'Cerrado automáticamente por límite de tiempo de recorrido (excedido).',
          },
        });

        cerradasCount++;
      }
    }

    return {
      procesadas: trayectoriasEnCurso.length,
      cerradas: cerradasCount,
    };
  }

  async limpiarTrayectoriasAntiguas(limite: Date) {
    const resultado = await this.prisma.trayectoria.deleteMany({
      where: {
        creadoEn: {
          lt: limite,
        },
        estado: {
          not: 'EN_CURSO',
        },
      },
    });

    return {
      registrosEliminados: resultado.count,
    };
  }
}