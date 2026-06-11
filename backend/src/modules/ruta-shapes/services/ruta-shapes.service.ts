import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { calcularDistanciaMetros } from '../../../common/utils/geo.util';
import { PrismaService } from '../../../database/prisma.service';


@Injectable()
export class RutaShapesService {
  constructor(private readonly prisma: PrismaService) {}

  private calcularDiferenciaRumbo(rumboA: number, rumboB: number) {
  const diferencia = Math.abs(rumboA - rumboB);
  return Math.min(diferencia, 360 - diferencia);
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

async reconstruirRuta(idRuta: number) {
  const RADIO_CLUSTER_METROS = 50;
  const MIN_PUNTOS_POR_CLUSTER = 3;
  const MIN_TRAYECTORIAS_POR_CLUSTER = 2;

  const ruta = await this.prisma.ruta.findUnique({
    where: { idRuta },
  });

  if (!ruta) {
    throw new NotFoundException(`No existe una ruta con id ${idRuta}`);
  }

  const trayectorias = await this.prisma.trayectoria.findMany({
    where: {
      idRuta,
      estado: 'COMPLETADA',
      fechaFin: {
        not: null,
      },
    },
    orderBy: {
      fechaInicio: 'asc',
    },
  });

  if (trayectorias.length < MIN_TRAYECTORIAS_POR_CLUSTER) {
    return {
      mensaje: 'No existen suficientes trayectorias completadas para reconstruir la ruta.',
      ruta: ruta.nombreRuta,
      totalTrayectorias: trayectorias.length,
      minimoRequerido: MIN_TRAYECTORIAS_POR_CLUSTER,
    };
  }

  const puntosGps: Array<{
    latitud: number;
    longitud: number;
    idTrayectoria: number;
    ordenRelativo: number;
  }> = [];

  for (const trayectoria of trayectorias) {
    if (!trayectoria.fechaFin) continue;

    const registros = await this.prisma.registroGps.findMany({
      where: {
        idRuta,
        idUnidad: trayectoria.idUnidad,
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

    registros.forEach((registro, index) => {
      puntosGps.push({
        latitud: Number(registro.latitud),
        longitud: Number(registro.longitud),
        idTrayectoria: trayectoria.idTrayectoria,
        ordenRelativo: index,
      });
    });
  }

  if (puntosGps.length === 0) {
    return {
      mensaje: 'No existen puntos GPS operativos dentro de las trayectorias completadas.',
      ruta: ruta.nombreRuta,
      totalTrayectorias: trayectorias.length,
    };
  }

  const clusters: Array<{
    latitudSum: number;
    longitudSum: number;
    totalPuntos: number;
    trayectorias: Set<number>;
    ordenRelativoSum: number;
  }> = [];

  for (const punto of puntosGps) {
    let clusterEncontrado:
      | (typeof clusters)[number]
      | undefined = undefined;

    for (const cluster of clusters) {
      const latitudCentro = cluster.latitudSum / cluster.totalPuntos;
      const longitudCentro = cluster.longitudSum / cluster.totalPuntos;

      const distancia = calcularDistanciaMetros(
        punto.latitud,
        punto.longitud,
        latitudCentro,
        longitudCentro,
      );

      if (distancia <= RADIO_CLUSTER_METROS) {
        clusterEncontrado = cluster;
        break;
      }
    }

    if (clusterEncontrado) {
      clusterEncontrado.latitudSum += punto.latitud;
      clusterEncontrado.longitudSum += punto.longitud;
      clusterEncontrado.totalPuntos += 1;
      clusterEncontrado.trayectorias.add(punto.idTrayectoria);
      clusterEncontrado.ordenRelativoSum += punto.ordenRelativo;
    } else {
      clusters.push({
        latitudSum: punto.latitud,
        longitudSum: punto.longitud,
        totalPuntos: 1,
        trayectorias: new Set([punto.idTrayectoria]),
        ordenRelativoSum: punto.ordenRelativo,
      });
    }
  }

  const clustersValidos = clusters
    .filter(
      (cluster) =>
        cluster.totalPuntos >= MIN_PUNTOS_POR_CLUSTER &&
        cluster.trayectorias.size >= MIN_TRAYECTORIAS_POR_CLUSTER,
    )
    .map((cluster) => ({
      latitud: cluster.latitudSum / cluster.totalPuntos,
      longitud: cluster.longitudSum / cluster.totalPuntos,
      totalPuntos: cluster.totalPuntos,
      totalTrayectorias: cluster.trayectorias.size,
      ordenPromedio: cluster.ordenRelativoSum / cluster.totalPuntos,
    }))
    .sort((a, b) => a.ordenPromedio - b.ordenPromedio);

  if (clustersValidos.length < 2) {
    return {
      mensaje: 'No se encontraron suficientes puntos comunes para reconstruir la ruta.',
      ruta: ruta.nombreRuta,
      totalPuntosGps: puntosGps.length,
      totalClusters: clusters.length,
      clustersValidos: clustersValidos.length,
    };
  }

  await this.prisma.rutaShape.deleteMany({
    where: { idRuta },
  });

  await this.prisma.rutaShape.createMany({
    data: clustersValidos.map((cluster, index) => ({
      idRuta,
      latitud: new Prisma.Decimal(cluster.latitud),
      longitud: new Prisma.Decimal(cluster.longitud),
      secuencia: index + 1,
    })),
  });

  return {
    mensaje: 'Ruta reconstruida correctamente por consenso espacial.',
    ruta: ruta.nombreRuta,
    totalTrayectorias: trayectorias.length,
    totalPuntosGps: puntosGps.length,
    totalClusters: clusters.length,
    totalClustersValidos: clustersValidos.length,
    parametros: {
      radioClusterMetros: RADIO_CLUSTER_METROS,
      minPuntosPorCluster: MIN_PUNTOS_POR_CLUSTER,
      minTrayectoriasPorCluster: MIN_TRAYECTORIAS_POR_CLUSTER,
    },
  };
}

private dividirEnBloques<T>(items: T[], tamano: number): T[][] {
  const bloques: T[][] = [];

  for (let i = 0; i < items.length; i += tamano - 1) {
    bloques.push(items.slice(i, i + tamano));
  }

  return bloques;
}

private reducirPuntosCercanosConRumbo(
  puntos: { latitud: number; longitud: number; rumbo: number }[],
  distanciaMinimaMetros = 25,
  diferenciaMaximaRumbo = 45,
) {
  const puntosFiltrados: { latitud: number; longitud: number; rumbo: number }[] = [];

  for (const punto of puntos) {
    const ultimo = puntosFiltrados[puntosFiltrados.length - 1];

    if (!ultimo) {
      puntosFiltrados.push(punto);
      continue;
    }

    const distancia = calcularDistanciaMetros(
      ultimo.latitud,
      ultimo.longitud,
      punto.latitud,
      punto.longitud,
    );

    const diferenciaRumbo = this.calcularDiferenciaRumbo(
      ultimo.rumbo,
      punto.rumbo,
    );

    if (
      distancia >= distanciaMinimaMetros ||
      diferenciaRumbo > diferenciaMaximaRumbo
    ) {
      puntosFiltrados.push(punto);
    }
  }

  return puntosFiltrados;
}

async generarShapeSnapToRoads(idRuta: number) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error('No existe GOOGLE_MAPS_API_KEY en variables de entorno.');
  }

  const ruta = await this.prisma.ruta.findUnique({
    where: { idRuta },
  });

  if (!ruta) {
    throw new NotFoundException(`No existe una ruta con id ${idRuta}`);
  }

  const trayectorias = await this.prisma.trayectoria.findMany({
    where: {
      idRuta,
      estado: 'COMPLETADA',
      fechaFin: {
        not: null,
      },
    },
    orderBy: {
      fechaInicio: 'asc',
    },
    take: 3,
  });

  if (trayectorias.length === 0) {
    return {
      mensaje: 'No existen trayectorias completadas para esta ruta.',
      idRuta,
    };
  }

  const puntosGps: { latitud: number; longitud: number; rumbo: number }[] = [];

  for (const trayectoria of trayectorias) {
    if (!trayectoria.fechaFin) continue;

    const registros = await this.prisma.registroGps.findMany({
      where: {
        idRuta,
        idUnidad: trayectoria.idUnidad,
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

    for (const registro of registros) {
      puntosGps.push({
  latitud: Number(registro.latitud),
  longitud: Number(registro.longitud),
  rumbo: registro.rumbo ? Number(registro.rumbo) : 0,
});
    }
  }

  const puntosReducidos = this.reducirPuntosCercanosSimple(puntosGps, 10);

  if (puntosReducidos.length < 2) {
    return {
      mensaje: 'No hay suficientes puntos GPS después de la limpieza.',
      puntosOriginales: puntosGps.length,
      puntosReducidos: puntosReducidos.length,
    };
  }

  const bloques = this.dividirEnBloques(puntosReducidos, 100);
  const puntosAjustados: { latitud: number; longitud: number }[] = [];

  for (const bloque of bloques as Array<
  { latitud: number; longitud: number }[]
>) {
    const path = bloque
  .map((punto) => `${punto.latitud},${punto.longitud}`)
  .join('|');

    const url = `https://roads.googleapis.com/v1/snapToRoads?interpolate=true&path=${path}&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      return {
        mensaje: 'Error al consultar Google Roads API.',
        error: data,
      };
    }

    if (!data.snappedPoints) continue;

    for (const punto of data.snappedPoints) {
      puntosAjustados.push({
        latitud: punto.location.latitude,
        longitud: punto.location.longitude,
      });
    }
  }

  await this.prisma.rutaShape.deleteMany({
    where: { idRuta },
  });

  await this.prisma.rutaShape.createMany({
    data: puntosAjustados.map((punto, index) => ({
      idRuta,
      latitud: new Prisma.Decimal(punto.latitud),
      longitud: new Prisma.Decimal(punto.longitud),
      secuencia: index + 1,
    })),
  });

  return {
    mensaje: 'Shape generado con GPS y ajustado a calles correctamente.',
    idRuta,
    ruta: ruta.nombreRuta,
    trayectoriasUsadas: trayectorias.length,
    puntosGpsOriginales: puntosGps.length,
    puntosReducidos: puntosReducidos.length,
    puntosAjustados: puntosAjustados.length,
  };
}

private normalizarPuntos(
  puntos: { latitud: number; longitud: number }[],
  total = 100,
) {
  if (puntos.length === 0) {
    return [];
  }

  if (puntos.length === 1) {
    return Array.from({ length: total }, () => puntos[0]);
  }

  const resultado: { latitud: number; longitud: number }[] = [];

  for (let i = 0; i < total; i++) {
    const posicion = (i * (puntos.length - 1)) / (total - 1);
    const indexInferior = Math.floor(posicion);
    const indexSuperior = Math.ceil(posicion);
    const factor = posicion - indexInferior;

    const puntoA = puntos[indexInferior];
    const puntoB = puntos[indexSuperior];

    resultado.push({
      latitud: puntoA.latitud + (puntoB.latitud - puntoA.latitud) * factor,
      longitud: puntoA.longitud + (puntoB.longitud - puntoA.longitud) * factor,
    });
  }

  return resultado;
}

private promedioPuntos(puntos: { latitud: number; longitud: number }[]) {
  return {
    latitud: puntos.reduce((sum, p) => sum + p.latitud, 0) / puntos.length,
    longitud: puntos.reduce((sum, p) => sum + p.longitud, 0) / puntos.length,
  };
}

async generarShapeFinal(idRuta: number) {
  const MAX_TRAYECTORIAS = 10;
  
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('No existe GOOGLE_MAPS_API_KEY en variables de entorno.');
  }

  const ruta = await this.prisma.ruta.findUnique({
    where: { idRuta },
  });

  if (!ruta) {
    throw new NotFoundException(`No existe una ruta con id ${idRuta}`);
  }

  // 1. Estimar la longitud física de la ruta usando las paradas registradas
  const rutaParadas = await this.prisma.rutaParada.findMany({
    where: { idRuta },
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

  // Si no hay paradas registradas, asumimos un valor por defecto de 5 km
  if (longitudRutaMetros === 0) {
    longitudRutaMetros = 5000;
  }

  // 2. Parámetros adaptativos calculados dinámicamente
  // Mínimo de puntos GPS requeridos (al menos 1 cada 200 metros, min 12, max 40)
  const minGps = Math.max(12, Math.min(40, Math.round(longitudRutaMetros / 200)));
  
  // Puntos normalizados (un punto cada 45 metros aproximadamente, min 45, max 500)
  const puntosNormalizados = Math.max(45, Math.min(500, Math.round(longitudRutaMetros / 45)));
  
  // Radio de consenso espacial (dinámico entre 50m y 120m)
  const radioConsenso = Math.max(50, Math.min(120, Math.round(longitudRutaMetros * 0.01)));

  const trayectorias = await this.prisma.trayectoria.findMany({
    where: {
      idRuta,
      estado: 'COMPLETADA',
      fechaFin: { not: null },
    },
    orderBy: {
      fechaFin: 'desc',
    },
    take: MAX_TRAYECTORIAS,
  });

  const trayectoriasProcesadas: Array<{
    idTrayectoria: number;
    totalGps: number;
    puntos: { latitud: number; longitud: number }[];
  }> = [];

  for (const trayectoria of trayectorias) {
    if (!trayectoria.fechaFin) continue;

    const registros = await this.prisma.registroGps.findMany({
      where: {
        idRuta,
        idUnidad: trayectoria.idUnidad,
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

    // Filtro adaptativo de puntos mínimos
    if (registros.length < minGps) continue;

    const DISTANCIA_MAXIMA_SALTO_METROS = 600;

    const puntosGps = registros.map((registro) => ({
      latitud: Number(registro.latitud),
      longitud: Number(registro.longitud),
    }));

    const puntosSinSaltos = this.eliminarSaltosGps(
      puntosGps,
      DISTANCIA_MAXIMA_SALTO_METROS,
    );

    const puntosReducidos = this.reducirPuntosCercanosSimple(
      puntosSinSaltos,
      25,
    );

    const bloques = this.dividirEnBloques(puntosReducidos, 100);
    const puntosAjustados: { latitud: number; longitud: number }[] = [];

    for (const bloque of bloques) {
      const path = bloque
        .map((punto) => `${punto.latitud},${punto.longitud}`)
        .join('|');

      const url = `https://roads.googleapis.com/v1/snapToRoads?path=${path}&interpolate=true&key=${apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        return {
          mensaje: 'Error al consultar Google Roads API.',
          idTrayectoria: trayectoria.idTrayectoria,
          error: data,
        };
      }

      for (const punto of data.snappedPoints ?? []) {
        puntosAjustados.push({
          latitud: punto.location.latitude,
          longitud: punto.location.longitude,
        });
      }
    }

    if (puntosAjustados.length >= 2) {
      trayectoriasProcesadas.push({
        idTrayectoria: trayectoria.idTrayectoria,
        totalGps: registros.length,
        puntos: this.normalizarPuntos(puntosAjustados, puntosNormalizados),
      });
    }
  }

  if (trayectoriasProcesadas.length < 2) {
    return {
      mensaje: 'No existen suficientes trayectorias válidas para generar el shape final.',
      idRuta,
      ruta: ruta.nombreRuta,
      trayectoriasDisponibles: trayectorias.length,
      trayectoriasProcesadas: trayectoriasProcesadas.length,
      requeridoGpsPorTrayectoria: minGps,
    };
  }

  // La trayectoria de referencia será la que contenga la mayor cantidad de puntos gps registrados
  const trayectoriaReferencia = trayectoriasProcesadas.reduce((mejor, actual) =>
    actual.totalGps > mejor.totalGps ? actual : mejor,
  );

  const shapeFinal: { latitud: number; longitud: number }[] = [];

  // 3. Consenso Espacial (Búsqueda de vecinos más cercanos físicamente)
  for (let i = 0; i < puntosNormalizados; i++) {
    const puntoReferencia = trayectoriaReferencia.puntos[i];
    const puntosCercanos: { latitud: number; longitud: number }[] = [puntoReferencia];

    for (const trayectoria of trayectoriasProcesadas) {
      if (trayectoria.idTrayectoria === trayectoriaReferencia.idTrayectoria) continue;

      // Buscar el punto más cercano espacialmente al punto de referencia
      let puntoMasCercano = trayectoria.puntos[0];
      let distanciaMinima = calcularDistanciaMetros(
        puntoReferencia.latitud,
        puntoReferencia.longitud,
        puntoMasCercano.latitud,
        puntoMasCercano.longitud,
      );

      for (let j = 1; j < trayectoria.puntos.length; j++) {
        const dist = calcularDistanciaMetros(
          puntoReferencia.latitud,
          puntoReferencia.longitud,
          trayectoria.puntos[j].latitud,
          trayectoria.puntos[j].longitud,
        );
        if (dist < distanciaMinima) {
          distanciaMinima = dist;
          puntoMasCercano = trayectoria.puntos[j];
        }
      }

      // Si la distancia mínima física está dentro del radio de consenso, lo consideramos en el promedio
      if (distanciaMinima <= radioConsenso) {
        puntosCercanos.push(puntoMasCercano);
      }
    }

    if (puntosCercanos.length >= 2) {
      shapeFinal.push(this.promedioPuntos(puntosCercanos));
    } else {
      shapeFinal.push(puntoReferencia);
    }
  }

  await this.prisma.rutaShape.deleteMany({
    where: { idRuta },
  });

  await this.prisma.rutaShape.createMany({
    data: shapeFinal.map((punto, index) => ({
      idRuta,
      latitud: new Prisma.Decimal(punto.latitud),
      longitud: new Prisma.Decimal(punto.longitud),
      secuencia: index + 1,
    })),
  });

  return {
    mensaje: 'Shape final generado correctamente por consenso espacial adaptativo.',
    idRuta,
    ruta: ruta.nombreRuta,
    longitudEstimadaMetros: Math.round(longitudRutaMetros),
    trayectoriasUsadas: trayectoriasProcesadas.map((t) => ({
      idTrayectoria: t.idTrayectoria,
      totalGps: t.totalGps,
    })),
    totalPuntosShape: shapeFinal.length,
    parametros: {
      maxTrayectorias: MAX_TRAYECTORIAS,
      minGpsRequerido: minGps,
      puntosNormalizados,
      radioConsensoMetros: radioConsenso,
    },
  };
}
private reducirPuntosCercanosSimple(
  puntos: { latitud: number; longitud: number }[],
  distanciaMinimaMetros = 25,
) {
  const puntosFiltrados: { latitud: number; longitud: number }[] = [];

  for (const punto of puntos) {
    const ultimo = puntosFiltrados[puntosFiltrados.length - 1];

    if (!ultimo) {
      puntosFiltrados.push(punto);
      continue;
    }

    const distancia = calcularDistanciaMetros(
      ultimo.latitud,
      ultimo.longitud,
      punto.latitud,
      punto.longitud,
    );

    if (distancia >= distanciaMinimaMetros) {
      puntosFiltrados.push(punto);
    }
  }

  return puntosFiltrados;
}

private eliminarSaltosGps(
  puntos: { latitud: number; longitud: number }[],
  distanciaMaximaMetros = 500,
) {
  if (puntos.length <= 1) {
    return puntos;
  }

  const resultado: { latitud: number; longitud: number }[] = [puntos[0]];

  for (let i = 1; i < puntos.length; i++) {
    const anterior = resultado[resultado.length - 1];
    const actual = puntos[i];

    const distancia = calcularDistanciaMetros(
      anterior.latitud,
      anterior.longitud,
      actual.latitud,
      actual.longitud,
    );

    if (distancia <= distanciaMaximaMetros) {
      resultado.push(actual);
    } else {
      // Si la distancia supera el límite, verificamos si es un ruido de GPS aislado
      // o una pérdida legítima de señal (gap) en donde la ruta continúa más adelante.
      if (i < puntos.length - 1) {
        const siguiente = puntos[i + 1];
        const distActualSiguiente = calcularDistanciaMetros(
          actual.latitud,
          actual.longitud,
          siguiente.latitud,
          siguiente.longitud,
        );
        const distAnteriorSiguiente = calcularDistanciaMetros(
          anterior.latitud,
          anterior.longitud,
          siguiente.latitud,
          siguiente.longitud,
        );

        // Caso 1: El punto siguiente vuelve a estar cerca del punto anterior,
        // lo que significa que el punto 'actual' fue un pico de ruido aislado (glitch).
        // Lo omitimos, y la comparación del ciclo continuará usando el 'anterior'.
        if (distAnteriorSiguiente <= distanciaMaximaMetros && distActualSiguiente > distanciaMaximaMetros) {
          continue;
        }
      }

      // Caso 2: Es el último punto o los siguientes puntos continúan la ruta
      // a partir de este nuevo punto 'actual' (gap de transmisión).
      // Lo agregamos para no truncar la ruta.
      resultado.push(actual);
    }
  }

  return resultado;
}

async generarShapeDesdeTrayectoria(idTrayectoria: number) {
  const DISTANCIA_MAXIMA_SALTO_METROS = 600;
  const DISTANCIA_MINIMA_ENTRE_PUNTOS = 10;

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error('No existe GOOGLE_MAPS_API_KEY en variables de entorno.');
  }

  const trayectoria = await this.prisma.trayectoria.findUnique({
    where: { idTrayectoria },
    include: {
      ruta: true,
      unidad: true,
    },
  });

  if (!trayectoria) {
    throw new NotFoundException(
      `No existe una trayectoria con id ${idTrayectoria}`,
    );
  }

  if (!trayectoria.fechaFin) {
    return {
      mensaje: 'La trayectoria no tiene fecha de fin.',
      idTrayectoria,
    };
  }

  const registros = await this.prisma.registroGps.findMany({
    where: {
      idRuta: trayectoria.idRuta,
      idUnidad: trayectoria.idUnidad,
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

  if (registros.length < 2) {
    return {
      mensaje: 'La trayectoria no tiene suficientes registros GPS.',
      idTrayectoria,
      totalGps: registros.length,
    };
  }

  const puntosGps = registros.map((registro) => ({
    latitud: Number(registro.latitud),
    longitud: Number(registro.longitud),
  }));

  const puntosSinSaltos = this.eliminarSaltosGps(
    puntosGps,
    DISTANCIA_MAXIMA_SALTO_METROS,
  );

  const puntosReducidos = this.reducirPuntosCercanosSimple(
    puntosSinSaltos,
    DISTANCIA_MINIMA_ENTRE_PUNTOS,
  );

  const bloques = this.dividirEnBloques(puntosReducidos, 100);

  const puntosAjustados: { latitud: number; longitud: number }[] = [];

  for (const bloque of bloques as Array<
    { latitud: number; longitud: number }[]
  >) {
    const path = bloque
      .map((punto) => `${punto.latitud},${punto.longitud}`)
      .join('|');

    const url = `https://roads.googleapis.com/v1/snapToRoads?path=${path}&interpolate=true&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      return {
        mensaje: 'Error al consultar Google Roads API.',
        idTrayectoria,
        error: data,
      };
    }

    for (const punto of data.snappedPoints ?? []) {
      puntosAjustados.push({
        latitud: punto.location.latitude,
        longitud: punto.location.longitude,
      });
    }
  }

  await this.prisma.rutaShape.deleteMany({
    where: { idRuta: trayectoria.idRuta },
  });

  await this.prisma.rutaShape.createMany({
    data: puntosAjustados.map((punto, index) => ({
      idRuta: trayectoria.idRuta,
      latitud: new Prisma.Decimal(punto.latitud),
      longitud: new Prisma.Decimal(punto.longitud),
      secuencia: index + 1,
    })),
  });

  return {
    mensaje: 'Shape generado desde trayectoria individual.',
    idRuta: trayectoria.idRuta,
    ruta: trayectoria.ruta.nombreRuta,
    idTrayectoria: trayectoria.idTrayectoria,
    unidad: trayectoria.unidad.codigoUnidad,
    totalGpsOriginales: registros.length,
    totalGpsSinSaltos: puntosSinSaltos.length,
    totalGpsReducidos: puntosReducidos.length,
    totalPuntosAjustados: puntosAjustados.length,
    parametros: {
      distanciaMaximaSaltoMetros: DISTANCIA_MAXIMA_SALTO_METROS,
      distanciaMinimaEntrePuntos: DISTANCIA_MINIMA_ENTRE_PUNTOS,
    },
  };
}
}