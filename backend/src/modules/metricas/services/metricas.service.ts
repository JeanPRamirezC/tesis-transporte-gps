import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { calcularDistanciaMetros } from '../../../common/utils/geo.util';
import { toZonedTime } from 'date-fns-tz';
import { ECUADOR_TIMEZONE } from '../../../common/constants/timezone.constants';

@Injectable()
export class MetricasService {
  constructor(private readonly prisma: PrismaService) {}

  async obtenerProductividadDiaria(fechaStr?: string) {
    let targetDateStr = fechaStr;
    if (!targetDateStr) {
      const nowZoned = toZonedTime(new Date(), ECUADOR_TIMEZONE);
      const yyyy = nowZoned.getFullYear();
      const mm = String(nowZoned.getMonth() + 1).padStart(2, '0');
      const dd = String(nowZoned.getDate()).padStart(2, '0');
      targetDateStr = `${yyyy}-${mm}-${dd}`;
    }

    const startOfDay = new Date(`${targetDateStr}T00:00:00.000-05:00`);
    const endOfDay = new Date(`${targetDateStr}T23:59:59.999-05:00`);

    const unidades = await this.prisma.unidad.findMany({
      orderBy: { idUnidad: 'asc' },
    });

    const resultado = [];

    for (const unidad of unidades) {
      // 1. Kilómetros recorridos (GPS)
      const gpsRecords = await this.prisma.registroGps.findMany({
        where: {
          idUnidad: unidad.idUnidad,
          esOperativo: true,
          fechaHora: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        orderBy: {
          fechaHora: 'asc',
        },
      });

      let totalDistanciaMetros = 0;
      for (let i = 1; i < gpsRecords.length; i++) {
        const p1 = gpsRecords[i - 1];
        const p2 = gpsRecords[i];
        const dist = calcularDistanciaMetros(
          Number(p1.latitud),
          Number(p1.longitud),
          Number(p2.latitud),
          Number(p2.longitud),
        );
        if (dist > 1 && dist < 2000) {
          totalDistanciaMetros += dist;
        }
      }
      const kilometrosRecorridos = Number((totalDistanciaMetros / 1000).toFixed(2));

      // 2. Vueltas completadas
      const vueltasCompletadas = await this.prisma.trayectoria.count({
        where: {
          idUnidad: unidad.idUnidad,
          estado: 'COMPLETADA',
          fechaFin: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      });

      // 3. Horas de operación activa (trayectorias que se cruzan con el día)
      const trayectorias = await this.prisma.trayectoria.findMany({
        where: {
          idUnidad: unidad.idUnidad,
          fechaInicio: {
            lte: endOfDay,
          },
          OR: [
            { fechaFin: null },
            { fechaFin: { gte: startOfDay } },
          ],
        },
      });

      let totalSegundosActivo = 0;
      for (const t of trayectorias) {
        const tInicio = t.fechaInicio.getTime() < startOfDay.getTime() ? startOfDay : t.fechaInicio;
        const tFin = !t.fechaFin || t.fechaFin.getTime() > endOfDay.getTime() ? endOfDay : t.fechaFin;

        const diffSegs = (tFin.getTime() - tInicio.getTime()) / 1000;
        if (diffSegs > 0) {
          totalSegundosActivo += diffSegs;
        }
      }
      const horasOperativas = Number((totalSegundosActivo / 3600).toFixed(2));

      resultado.push({
        idUnidad: unidad.idUnidad,
        codigoUnidad: unidad.codigoUnidad,
        placa: unidad.placa,
        kilometrosRecorridos,
        horasOperativas,
        vueltasCompletadas,
      });
    }

    return {
      fecha: targetDateStr,
      unidades: resultado,
    };
  }

  async obtenerComparativaPorRuta(idRuta: number, dias: number) {
    const now = new Date();
    const startDate = new Date(now.getTime() - dias * 24 * 60 * 60 * 1000);

    const trayectorias = await this.prisma.trayectoria.findMany({
      where: {
        idRuta,
        estado: 'COMPLETADA',
        fechaFin: {
          not: null,
        },
        fechaInicio: {
          gte: startDate,
        },
      },
      include: {
        unidad: true,
      },
    });

    // Obtener todos los buses para asegurar presencia en el gráfico comparativo
    const todasUnidades = await this.prisma.unidad.findMany({
      orderBy: { idUnidad: 'asc' },
    });

    const agrupado = new Map<number, number[]>();
    for (const t of trayectorias) {
      if (!t.fechaFin) continue;
      const duracionMinutos = (t.fechaFin.getTime() - t.fechaInicio.getTime()) / 60000;
      const lista = agrupado.get(t.idUnidad) || [];
      lista.push(duracionMinutos);
      agrupado.set(t.idUnidad, lista);
    }

    const comparativa = todasUnidades.map((unidad) => {
      const duraciones = agrupado.get(unidad.idUnidad) || [];
      const totalViajes = duraciones.length;

      if (totalViajes === 0) {
        return {
          idUnidad: unidad.idUnidad,
          codigoUnidad: unidad.codigoUnidad,
          placa: unidad.placa,
          tiempoPromedioMinutos: 0,
          tiempoMinimoMinutos: 0,
          tiempoMaximoMinutos: 0,
          totalViajes: 0,
        };
      }

      const min = Math.min(...duraciones);
      const max = Math.max(...duraciones);
      const sum = duraciones.reduce((a, b) => a + b, 0);
      const avg = sum / totalViajes;

      return {
        idUnidad: unidad.idUnidad,
        codigoUnidad: unidad.codigoUnidad,
        placa: unidad.placa,
        tiempoPromedioMinutos: Number(avg.toFixed(1)),
        tiempoMinimoMinutos: Number(min.toFixed(1)),
        tiempoMaximoMinutos: Number(max.toFixed(1)),
        totalViajes,
      };
    });

    return {
      idRuta,
      rangoDias: dias,
      comparativa,
    };
  }

  async obtenerDesviosTrayectoria(idTrayectoria: number) {
    const trayectoria = await this.prisma.trayectoria.findUnique({
      where: { idTrayectoria },
      include: { ruta: true, unidad: true },
    });

    if (!trayectoria) {
      throw new NotFoundException(`No existe una trayectoria con id ${idTrayectoria}`);
    }

    const gpsRecords = await this.prisma.registroGps.findMany({
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

    const shapePoints = await this.prisma.rutaShape.findMany({
      where: { idRuta: trayectoria.idRuta },
      orderBy: { secuencia: 'asc' },
    });

    const rutaParadas = await this.prisma.rutaParada.findMany({
      where: { idRuta: trayectoria.idRuta },
      include: { parada: true },
      orderBy: { ordenParada: 'asc' },
    });

    // 1. Calcular Desvío Geográfico
    let puntosDesviados = 0;
    const totalPuntos = gpsRecords.length;

    for (const gps of gpsRecords) {
      const latGps = Number(gps.latitud);
      const lngGps = Number(gps.longitud);
      let minDistance = Infinity;

      for (const sp of shapePoints) {
        const dist = calcularDistanciaMetros(
          latGps,
          lngGps,
          Number(sp.latitud),
          Number(sp.longitud),
        );
        if (dist < minDistance) {
          minDistance = dist;
        }
      }

      if (minDistance > 150) {
        puntosDesviados++;
      }
    }

    const indiceCumplimiento = totalPuntos > 0
      ? Math.round(((totalPuntos - puntosDesviados) / totalPuntos) * 100)
      : 100;

    // 2. Calcular Paradas Omitidas
    const paradasAnalizadas = [];
    for (const rp of rutaParadas) {
      const latParada = Number(rp.parada.latitud);
      const lngParada = Number(rp.parada.longitud);
      let esVisitada = false;

      for (const gps of gpsRecords) {
        const dist = calcularDistanciaMetros(
          Number(gps.latitud),
          Number(gps.longitud),
          latParada,
          lngParada,
        );
        if (dist <= 100) {
          esVisitada = true;
          break;
        }
      }

      paradasAnalizadas.push({
        idParada: rp.parada.idParada,
        nombreParada: rp.parada.nombreParada,
        ordenParada: rp.ordenParada,
        visitada: esVisitada,
      });
    }

    const omitidas = paradasAnalizadas.filter((p) => !p.visitada).map((p) => p.idParada);

    return {
      idTrayectoria,
      idRuta: trayectoria.idRuta,
      idUnidad: trayectoria.idUnidad,
      codigoUnidad: trayectoria.unidad.codigoUnidad,
      placa: trayectoria.unidad.placa,
      indiceCumplimiento,
      totalPuntos,
      puntosDesviados,
      paradasAnalizadas,
      omitidas,
    };
  }

  async obtenerAsociacionesIncidentes() {
    const reportes = await this.prisma.reporteIncidente.findMany({
      orderBy: { creadoEn: 'desc' },
      include: {
        ruta: true,
        usuario: {
          select: { email: true },
        },
      },
    });

    const resultado = [];

    for (const reporte of reportes) {
      const timeLimitMin = new Date(reporte.creadoEn.getTime() - 10 * 60 * 1000);
      const timeLimitMax = new Date(reporte.creadoEn.getTime() + 10 * 60 * 1000);

      const candidateGps = await this.prisma.registroGps.findMany({
        where: {
          esOperativo: true,
          fechaHora: {
            gte: timeLimitMin,
            lte: timeLimitMax,
          },
        },
        include: {
          unidad: true,
        },
      });

      let bestMatch = null;
      let minDistance = Infinity;

      for (const gps of candidateGps) {
        const dist = calcularDistanciaMetros(
          Number(reporte.latitud),
          Number(reporte.longitud),
          Number(gps.latitud),
          Number(gps.longitud),
        );

        if (dist <= 500 && dist < minDistance) {
          minDistance = dist;
          bestMatch = gps;
        }
      }

      let asociacion = null;
      if (bestMatch) {
        const diferenciaTiempoSegundos = Math.round(
          Math.abs(bestMatch.fechaHora.getTime() - reporte.creadoEn.getTime()) / 1000,
        );
        asociacion = {
          idUnidad: bestMatch.idUnidad,
          codigoUnidad: bestMatch.unidad.codigoUnidad,
          placa: bestMatch.unidad.placa,
          distanciaMetros: Math.round(minDistance),
          diferenciaTiempoSegundos,
        };
      }

      resultado.push({
        idReporte: reporte.idReporte,
        tipoIncidente: reporte.tipoIncidente,
        descripcion: reporte.descripcion,
        latitud: Number(reporte.latitud),
        longitud: Number(reporte.longitud),
        creadoEn: reporte.creadoEn,
        ruta: reporte.ruta
          ? {
              idRuta: reporte.ruta.idRuta,
              codigoRuta: reporte.ruta.codigoRuta,
              nombreRuta: reporte.ruta.nombreRuta,
            }
          : null,
        usuario: reporte.usuario,
        asociacion,
      });
    }

    return resultado;
  }
}
