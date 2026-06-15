import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { EstadoConfiabilidadEta } from '@prisma/client';
import { calcularDistanciaMetros } from '../../../common/utils/geo.util';

@Injectable()
export class EtaService {
  constructor(private readonly prisma: PrismaService) {}

  async calcularEtaPorRuta(idRuta: number) {
  const VELOCIDAD_PROMEDIO_KMH = 18;
  const VELOCIDAD_MINIMA_KMH = 5;
  const TIEMPO_TRAMO_FALLBACK_SEG = 90;
  const GPS_MAX_ANTIGUEDAD_MIN = 3;

  const ruta = await this.prisma.ruta.findUnique({
    where: { idRuta },
  });

  if (!ruta) {
    throw new NotFoundException(`No existe una ruta con id ${idRuta}`);
  }

  const pasosActuales = await this.prisma.pasoParadaActual.findMany({
    where: {
      idRuta,
      unidad: {
        trayectorias: {
          some: {
            idRuta,
            estado: 'EN_CURSO',
          },
        },
      },
    },
    include: {
      unidad: true,
      parada: true,
    },
  });

  const rutaParadas = await this.prisma.rutaParada.findMany({
    where: { idRuta },
    include: { parada: true },
    orderBy: { ordenParada: 'asc' },
  });

  const promedios = await this.prisma.tiempoTramo.groupBy({
    by: ['idParadaOrigen', 'idParadaDestino'],
    where: { idRuta },
    _avg: { duracionSegundos: true },
    _count: { idTiempoTramo: true },
  });

  const mapaPromedios = new Map<string, { promedio: number; muestras: number }>();

  for (const promedio of promedios) {
    const clave = `${promedio.idParadaOrigen}-${promedio.idParadaDestino}`;

    mapaPromedios.set(clave, {
      promedio: Math.round(promedio._avg.duracionSegundos ?? 0),
      muestras: promedio._count.idTiempoTramo,
    });
  }

  const unidades = [];

  for (const paso of pasosActuales) {
    const ultimoGps = await this.prisma.registroGps.findFirst({
      where: {
        idUnidad: paso.idUnidad,
        idRuta,
        esOperativo: true,
      },
      orderBy: {
        fechaHora: 'desc',
      },
    });

    const indiceParadaActual = rutaParadas.findIndex(
      (rp) => rp.idParada === paso.idParada,
    );

    if (indiceParadaActual === -1) {
      unidades.push({
        idUnidad: paso.idUnidad,
        codigoUnidad: paso.unidad.codigoUnidad,
        placa: paso.unidad.placa,
        estadoGeneral: 'FUERA_DE_RUTA',
        paradaActual: paso.parada.nombreParada,
        etas: [],
      });

      continue;
    }

    if (!ultimoGps) {
      unidades.push({
        idUnidad: paso.idUnidad,
        codigoUnidad: paso.unidad.codigoUnidad,
        placa: paso.unidad.placa,
        estadoGeneral: 'DATOS_DESACTUALIZADOS',
        paradaActual: paso.parada.nombreParada,
        etas: [],
      });

      continue;
    }

    const ahora = new Date();
    const antiguedadGpsMin =
      (ahora.getTime() - ultimoGps.fechaHora.getTime()) / 1000 / 60;

    let estadoGeneral: EstadoConfiabilidadEta = 'CONFIABLE';

    if (antiguedadGpsMin > GPS_MAX_ANTIGUEDAD_MIN) {
      estadoGeneral = 'DATOS_DESACTUALIZADOS';
    }

    const velocidadActualKmh = ultimoGps.velocidad
      ? Number(ultimoGps.velocidad)
      : 0;

    if (
      velocidadActualKmh > 0 &&
      velocidadActualKmh < VELOCIDAD_MINIMA_KMH &&
      estadoGeneral !== 'DATOS_DESACTUALIZADOS'
    ) {
      estadoGeneral = 'DETENIDO';
    }

    // Clamping: Limitar la velocidad máxima de cálculo a 30 km/h para evitar subestimaciones del ETA
    const VELOCIDAD_MAXIMA_KMH = 30;
    const velocidadUsadaKmh =
      velocidadActualKmh >= VELOCIDAD_MINIMA_KMH
        ? Math.min(velocidadActualKmh, VELOCIDAD_MAXIMA_KMH)
        : VELOCIDAD_PROMEDIO_KMH;

    const velocidadUsadaMps = velocidadUsadaKmh / 3.6;

    // Detección dinámica de la siguiente parada objetivo (saltarse paradas si ya pasó o está más cerca de la i+2)
    let indiceSiguienteObjetivo = indiceParadaActual + 1;
    let menorDistancia = Infinity;

    for (let k = indiceParadaActual + 1; k < rutaParadas.length; k++) {
      const paradaEval = rutaParadas[k];
      const dist = calcularDistanciaMetros(
        Number(ultimoGps.latitud),
        Number(ultimoGps.longitud),
        Number(paradaEval.parada.latitud),
        Number(paradaEval.parada.longitud),
      );

      // Limitamos el escaneo a las siguientes 2 paradas para evitar problemas con giros en U
      if (k <= indiceParadaActual + 2) {
        if (dist < menorDistancia) {
          menorDistancia = dist;
          indiceSiguienteObjetivo = k;
        }
      }
    }

    let acumuladoSegundos = 0;
    const etas = [];

    for (let j = indiceSiguienteObjetivo; j < rutaParadas.length; j++) {
      const destino = rutaParadas[j];
      let segundosTramo = 0;
      let muestrasHistoricas = 0;
      let estadoConfiabilidad: EstadoConfiabilidadEta = estadoGeneral;
      let tipoCalculo: 'REAL_TIME_GPS' | 'HISTORICAL_AVERAGE' | 'GEOGRAPHIC_FALLBACK' = 'HISTORICAL_AVERAGE';

      const distanciaAlBus = calcularDistanciaMetros(
        Number(ultimoGps.latitud),
        Number(ultimoGps.longitud),
        Number(destino.parada.latitud),
        Number(destino.parada.longitud),
      );

      if (j === indiceSiguienteObjetivo) {
        // Primer tramo: desde la posición GPS real hasta la parada objetivo
        segundosTramo = Math.round(distanciaAlBus / velocidadUsadaMps);
        tipoCalculo = 'REAL_TIME_GPS';
      } else {
        // Tramos subsiguientes: promedios históricos o fallback geográfico
        const origen = rutaParadas[j - 1];
        const clave = `${origen.idParada}-${destino.idParada}`;
        const promedio = mapaPromedios.get(clave);

        if (promedio) {
          segundosTramo = promedio.promedio;
          muestrasHistoricas = promedio.muestras;
          tipoCalculo = 'HISTORICAL_AVERAGE';
        } else {
          // Fallback geográfico basado en la distancia real del tramo y velocidad de 18 km/h (5 m/s)
          const distanciaTramo = calcularDistanciaMetros(
            Number(origen.parada.latitud),
            Number(origen.parada.longitud),
            Number(destino.parada.latitud),
            Number(destino.parada.longitud),
          );
          segundosTramo = Math.round(distanciaTramo / (VELOCIDAD_PROMEDIO_KMH / 3.6));
          muestrasHistoricas = 0;
          tipoCalculo = 'GEOGRAPHIC_FALLBACK';

          if (estadoConfiabilidad === 'CONFIABLE') {
            estadoConfiabilidad = 'SIN_HISTORICO';
          }
          if (estadoGeneral === 'CONFIABLE') {
            estadoGeneral = 'SIN_HISTORICO';
          }
        }
      }

      acumuladoSegundos += segundosTramo;

      etas.push({
        idParada: destino.idParada,
        nombreParada: destino.parada.nombreParada,
        ordenParada: destino.ordenParada,
        etaSegundos: acumuladoSegundos,
        etaMinutos: Math.ceil(acumuladoSegundos / 60),
        estadoConfiabilidad,
        muestrasHistoricas,
        // Diagnósticos enriquecidos
        distanciaAlBusMetros: Math.round(distanciaAlBus),
        duracionTramoSegundos: segundosTramo,
        tipoCalculo,
      });
    }

    unidades.push({
      idUnidad: paso.idUnidad,
      codigoUnidad: paso.unidad.codigoUnidad,
      placa: paso.unidad.placa,
      ubicacionActual: {
        latitud: Number(ultimoGps.latitud),
        longitud: Number(ultimoGps.longitud),
        velocidadKmh: velocidadActualKmh,
        velocidadUsadaKmh,
        fechaHora: ultimoGps.fechaHora,
        antiguedadGpsMin: Math.round(antiguedadGpsMin),
      },
      paradaActual: {
        idParada: paso.idParada,
        nombreParada: paso.parada.nombreParada,
        ordenParada: paso.ordenParada,
        fechaHoraPaso: paso.fechaHoraPaso,
      },
      estadoGeneral,
      etas,
    });
  }

  return {
    idRuta: ruta.idRuta,
    codigoRuta: ruta.codigoRuta,
    nombreRuta: ruta.nombreRuta,
    totalUnidades: unidades.length,
    unidades,
  };
}

  async generarEstimacionesEtaPorRuta(idRuta: number) {
  const resultadoEta = await this.calcularEtaPorRuta(idRuta);

  const estimacionesCreadas = [];

  for (const unidad of resultadoEta.unidades) {
    for (const eta of unidad.etas) {
      if (eta.etaSegundos === null) {
        continue;
      }

      const estimacion = await this.prisma.estimacionEta.create({
        data: {
          idUnidad: unidad.idUnidad,
          idRuta: resultadoEta.idRuta,
          idParada: eta.idParada,
          fechaHoraCalculo: new Date(),
          tiempoEstimadoLlegada: eta.etaSegundos,
          estadoConfiabilidad: eta.estadoConfiabilidad as EstadoConfiabilidadEta,
        },
      });

      estimacionesCreadas.push(estimacion);
    }
  }

  return {
    mensaje: 'Estimaciones ETA generadas correctamente.',
    idRuta: resultadoEta.idRuta,
    codigoRuta: resultadoEta.codigoRuta,
    nombreRuta: resultadoEta.nombreRuta,
    totalEstimaciones: estimacionesCreadas.length,
    estimaciones: estimacionesCreadas,
  };
}
}