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

  const ahora = new Date();

  // Obtener la hora actual en la zona horaria de Ecuador (America/Guayaquil)
  const formatEC = new Intl.DateTimeFormat('es-EC', {
    timeZone: 'America/Guayaquil',
    hour: 'numeric',
    hour12: false,
  });
  const horaActual = parseInt(formatEC.format(ahora));

  // Definir una ventana horaria de ±1 hora (ej: para las 15:00, de 14:00 a 16:00)
  const horaMinima = (horaActual - 1 + 24) % 24;
  const horaMaxima = (horaActual + 1) % 24;

  let promediosHorariosRaw: any[] = [];
  try {
    if (horaMinima <= horaMaxima) {
      promediosHorariosRaw = await this.prisma.$queryRawUnsafe(`
        SELECT 
          id_parada_origen AS "idParadaOrigen", 
          id_parada_destino AS "idParadaDestino", 
          AVG(duracion_segundos)::integer AS "promedio", 
          COUNT(*)::integer AS "muestras"
        FROM tiempos_tramo
        WHERE id_ruta = $1
          AND EXTRACT(HOUR FROM (fecha_hora_origen AT TIME ZONE 'America/Guayaquil')) BETWEEN $2 AND $3
        GROUP BY id_parada_origen, id_parada_destino
      `, idRuta, horaMinima, horaMaxima);
    } else {
      promediosHorariosRaw = await this.prisma.$queryRawUnsafe(`
        SELECT 
          id_parada_origen AS "idParadaOrigen", 
          id_parada_destino AS "idParadaDestino", 
          AVG(duracion_segundos)::integer AS "promedio", 
          COUNT(*)::integer AS "muestras"
        FROM tiempos_tramo
        WHERE id_ruta = $1
          AND (
            EXTRACT(HOUR FROM (fecha_hora_origen AT TIME ZONE 'America/Guayaquil')) >= $2
            OR EXTRACT(HOUR FROM (fecha_hora_origen AT TIME ZONE 'America/Guayaquil')) <= $3
          )
        GROUP BY id_parada_origen, id_parada_destino
      `, idRuta, horaMinima, horaMaxima);
    }
  } catch (err) {
    console.error("Error al consultar promedios por franja horaria:", err);
  }

  const promediosGenerales = await this.prisma.tiempoTramo.groupBy({
    by: ['idParadaOrigen', 'idParadaDestino'],
    where: { idRuta },
    _avg: { duracionSegundos: true },
    _count: { idTiempoTramo: true },
  });

  const mapaPromedios = new Map<string, { promedio: number; muestras: number; esHorario: boolean }>();

  // Llenar primero con los promedios generales como base/fallback
  for (const promedio of promediosGenerales) {
    const clave = `${promedio.idParadaOrigen}-${promedio.idParadaDestino}`;
    mapaPromedios.set(clave, {
      promedio: Math.round(promedio._avg.duracionSegundos ?? 0),
      muestras: promedio._count.idTiempoTramo,
      esHorario: false,
    });
  }

  // Sobrescribir con promedios específicos por hora si contamos con suficiente significación estadística (min 3 muestras)
  if (Array.isArray(promediosHorariosRaw)) {
    for (const promedio of promediosHorariosRaw) {
      if (promedio.muestras >= 3) {
        const clave = `${promedio.idParadaOrigen}-${promedio.idParadaDestino}`;
        mapaPromedios.set(clave, {
          promedio: promedio.promedio,
          muestras: promedio.muestras,
          esHorario: true,
        });
      }
    }
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

    const N = rutaParadas.length;

    // Detección dinámica de la siguiente parada objetivo (saltarse paradas si ya pasó o está más cerca de la i+2)
    let indiceSiguienteObjetivo = indiceParadaActual + 1;
    let menorDistancia = Infinity;

    for (let k = indiceParadaActual + 1; k < N; k++) {
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

    // Asegurar que el índice objetivo esté dentro de los límites de la ruta circular
    indiceSiguienteObjetivo = indiceSiguienteObjetivo % N;

    let acumuladoSegundos = 0;
    const etas = [];

    for (let step = 0; step < N; step++) {
      const j = (indiceSiguienteObjetivo + step) % N;
      const destino = rutaParadas[j];
      let segundosTramo = 0;
      let muestrasHistoricas = 0;
      let estadoConfiabilidad: EstadoConfiabilidadEta = estadoGeneral;
      let tipoCalculo: 'REAL_TIME_GPS' | 'HISTORICAL_AVERAGE' | 'HISTORICAL_AVERAGE_HOUR' | 'GEOGRAPHIC_FALLBACK' = 'HISTORICAL_AVERAGE';

      const distanciaAlBus = calcularDistanciaMetros(
        Number(ultimoGps.latitud),
        Number(ultimoGps.longitud),
        Number(destino.parada.latitud),
        Number(destino.parada.longitud),
      );

      if (step === 0) {
        // Primer tramo: desde la posición GPS real hasta la parada objetivo
        segundosTramo = Math.round(distanciaAlBus / velocidadUsadaMps);
        tipoCalculo = 'REAL_TIME_GPS';
      } else {
        // Tramos subsiguientes: promedios históricos o fallback geográfico
        const prevIdx = (j - 1 + N) % N;
        const origen = rutaParadas[prevIdx];
        const clave = `${origen.idParada}-${destino.idParada}`;
        const promedio = mapaPromedios.get(clave);

        if (promedio) {
          segundosTramo = promedio.promedio;
          muestrasHistoricas = promedio.muestras;
          tipoCalculo = promedio.esHorario ? 'HISTORICAL_AVERAGE_HOUR' : 'HISTORICAL_AVERAGE';
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
    const fechaHoraCalculoComun = new Date();

    for (const unidad of resultadoEta.unidades) {
      if (!unidad.ubicacionActual || !unidad.ubicacionActual.fechaHora) {
        continue;
      }

      // Buscar si ya existe una estimación previa para esta unidad y ruta
      const ultimaEstimacion = await this.prisma.estimacionEta.findFirst({
        where: {
          idUnidad: unidad.idUnidad,
          idRuta: resultadoEta.idRuta,
        },
        orderBy: { fechaHoraCalculo: 'desc' },
        select: { fechaHoraCalculo: true },
      });

      if (ultimaEstimacion) {
        const fechaUltimoGps = new Date(unidad.ubicacionActual.fechaHora);
        const fechaUltimaEstimacion = new Date(ultimaEstimacion.fechaHoraCalculo);

        // Si el último GPS es anterior o igual al momento del cálculo guardado anterior, omitimos duplicado
        if (fechaUltimoGps.getTime() <= fechaUltimaEstimacion.getTime()) {
          continue;
        }
      }

      for (const eta of unidad.etas) {
        if (eta.etaSegundos === null) {
          continue;
        }

        const estimacion = await this.prisma.estimacionEta.create({
          data: {
            idUnidad: unidad.idUnidad,
            idRuta: resultadoEta.idRuta,
            idParada: eta.idParada,
            fechaHoraCalculo: fechaHoraCalculoComun,
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

  async obtenerUltimoEtaPersistente(idRuta: number) {
    const ruta = await this.prisma.ruta.findUnique({
      where: { idRuta },
    });

    if (!ruta) {
      throw new NotFoundException(`No existe una ruta con id ${idRuta}`);
    }

    // 1. Obtener la última fecha de cálculo registrada para esta ruta
    const ultimaEstimacion = await this.prisma.estimacionEta.findFirst({
      where: { idRuta },
      orderBy: { fechaHoraCalculo: 'desc' },
      select: { fechaHoraCalculo: true },
    });

    if (!ultimaEstimacion) {
      return {
        idRuta: ruta.idRuta,
        codigoRuta: ruta.codigoRuta,
        nombreRuta: ruta.nombreRuta,
        totalUnidades: 0,
        unidades: [],
        mensaje: 'No hay estimaciones persistidas para esta ruta.',
      };
    }

    const fechaHoraCalculo = ultimaEstimacion.fechaHoraCalculo;

    // 2. Cargar ruta_paradas para tener el orden secuencial de paradas
    const rutaParadas = await this.prisma.rutaParada.findMany({
      where: { idRuta },
      include: { parada: true },
      orderBy: { ordenParada: 'asc' },
    });

    const mapaParadasOrden = new Map<number, number>();
    for (const rp of rutaParadas) {
      mapaParadasOrden.set(rp.idParada, rp.ordenParada);
    }

    // 3. Traer todas las estimaciones asociadas a ese lote de cálculo
    const estimaciones = await this.prisma.estimacionEta.findMany({
      where: {
        idRuta,
        fechaHoraCalculo,
      },
      include: {
        unidad: true,
        parada: true,
      },
    });

    // 4. Re-estructurar el resultado para agruparlo por Unidad
    const mapaUnidades = new Map<number, any>();

    for (const est of estimaciones) {
      if (!mapaUnidades.has(est.idUnidad)) {
        mapaUnidades.set(est.idUnidad, {
          idUnidad: est.idUnidad,
          codigoUnidad: est.unidad.codigoUnidad,
          placa: est.unidad.placa,
          ubicacionActual: null,
          paradaActual: null,
          estadoGeneral: est.estadoConfiabilidad,
          etas: [],
        });
      }

      const unidadInfo = mapaUnidades.get(est.idUnidad);
      const ordenParada = mapaParadasOrden.get(est.idParada) ?? 0;

      unidadInfo.etas.push({
        idParada: est.idParada,
        nombreParada: est.parada.nombreParada,
        ordenParada: ordenParada,
        etaSegundos: est.tiempoEstimadoLlegada,
        etaMinutos: Math.ceil(est.tiempoEstimadoLlegada / 60),
        estadoConfiabilidad: est.estadoConfiabilidad,
        muestrasHistoricas: 0, // No aplica directamente en datos persistidos
        distanciaAlBusMetros: 0, // Se calcula abajo
        duracionTramoSegundos: 0, // No aplica directamente en datos persistidos
        tipoCalculo: 'PERSISTIDO',
      });
    }

    // 5. Cargar pasos actuales y últimos GPS de todas las unidades implicadas
    const idUnidades = Array.from(mapaUnidades.keys());
    const pasosActuales = await this.prisma.pasoParadaActual.findMany({
      where: {
        idRuta,
        idUnidad: { in: idUnidades },
      },
      include: { parada: true },
    });

    const ahora = new Date();

    for (const [idUnidad, unidadInfo] of mapaUnidades.entries()) {
      const paso = pasosActuales.find((p) => p.idUnidad === idUnidad);
      const ultimoGps = await this.prisma.registroGps.findFirst({
        where: {
          idUnidad,
          idRuta,
          esOperativo: true,
        },
        orderBy: { fechaHora: 'desc' },
      });

      if (ultimoGps) {
        const antiguedadGpsMin = (ahora.getTime() - ultimoGps.fechaHora.getTime()) / 1000 / 60;
        unidadInfo.ubicacionActual = {
          latitud: Number(ultimoGps.latitud),
          longitud: Number(ultimoGps.longitud),
          velocidadKmh: ultimoGps.velocidad ? Number(ultimoGps.velocidad) : 0,
          velocidadUsadaKmh: ultimoGps.velocidad ? Number(ultimoGps.velocidad) : 0,
          fechaHora: ultimoGps.fechaHora,
          antiguedadGpsMin: Math.round(antiguedadGpsMin),
        };

        // Enriquecer cada ETA con la distancia lineal en vivo del bus
        for (const eta of unidadInfo.etas) {
          const paradaDeRuta = rutaParadas.find((rp) => rp.idParada === eta.idParada);
          if (paradaDeRuta) {
            const distanciaAlBus = calcularDistanciaMetros(
              Number(ultimoGps.latitud),
              Number(ultimoGps.longitud),
              Number(paradaDeRuta.parada.latitud),
              Number(paradaDeRuta.parada.longitud),
            );
            eta.distanciaAlBusMetros = Math.round(distanciaAlBus);
          }
        }
      }

      if (paso) {
        unidadInfo.paradaActual = {
          idParada: paso.idParada,
          nombreParada: paso.parada.nombreParada,
          ordenParada: paso.ordenParada,
          fechaHoraPaso: paso.fechaHoraPaso,
        };
      }

      // Ordenar las ETAs por orden de parada secuencial
      unidadInfo.etas.sort((a: any, b: any) => a.ordenParada - b.ordenParada);
    }

    const unidades = Array.from(mapaUnidades.values());

    return {
      idRuta: ruta.idRuta,
      codigoRuta: ruta.codigoRuta,
      nombreRuta: ruta.nombreRuta,
      totalUnidades: unidades.length,
      unidades,
      fechaHoraCalculo,
    };
  }

  async limpiarEstimacionesAntiguas() {
    const limite20Dias = new Date();
    limite20Dias.setDate(limite20Dias.getDate() - 20);

    const resultado = await this.prisma.estimacionEta.deleteMany({
      where: {
        fechaHoraCalculo: {
          lt: limite20Dias,
        },
      },
    });

    return {
      mensaje: 'Limpieza de estimaciones antiguas completada.',
      registrosEliminados: resultado.count,
      limiteFecha: limite20Dias,
    };
  }
}