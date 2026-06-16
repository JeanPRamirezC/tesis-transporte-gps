import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { calcularDistanciaMetros } from '../../../common/utils/geo.util';
import { EtaService } from '../../eta/services/eta.service';

export interface PasoItinerario {
  tipo: 'WALK' | 'TRANSIT';
  descripcion: string;
  distanciaMetros: number;
  tiempoSegundos: number;
  tiempoMinutos: number;
  origen?: { lat: number; lon: number; nombre: string };
  destino?: { lat: number; lon: number; nombre: string };
  idRuta?: number;
  codigoRuta?: string | null;
  nombreRuta?: string;
  paradaOrigen?: string;
  paradaDestino?: string;
  cantidadParadas?: number;
  shape?: { lat: number; lng: number }[];
  tiempoEsperaSegundos?: number;
  tiempoEsperaMinutos?: number;
  tiempoViajeSegundos?: number;
  tiempoViajeMinutos?: number;
  busActivo?: boolean;
  codigoBus?: string | null;
}

export interface Itinerario {
  tipo: 'DIRECT_WALK' | 'DIRECT_TRANSIT' | 'TRANSFER_TRANSIT';
  tiempoTotalSegundos: number;
  tiempoTotalMinutos: number;
  distanciaTotalCaminataMetros: number;
  transbordos: number;
  pasos: PasoItinerario[];
}

@Injectable()
export class PlanificadorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly etaService: EtaService,
  ) {}

  private calcularTiempoRuta(
    ruta: any,
    idxOrigen: number,
    idxDestino: number,
    mapaPromedios: Map<string, number>,
  ): number {
    let segundos = 0;
    const n = ruta.rutaParadas.length;

    if (idxOrigen < idxDestino) {
      for (let i = idxOrigen; i < idxDestino; i++) {
        const o = ruta.rutaParadas[i].parada;
        const d = ruta.rutaParadas[i + 1].parada;
        const clave = `${ruta.idRuta}-${o.idParada}-${d.idParada}`;
        if (mapaPromedios.has(clave)) {
          segundos += mapaPromedios.get(clave)!;
        } else {
          const dist = calcularDistanciaMetros(
            Number(o.latitud),
            Number(o.longitud),
            Number(d.latitud),
            Number(d.longitud),
          );
          segundos += Math.round(dist / 5.0);
        }
      }
    } else {
      // Ruta circular: desde idxOrigen hasta el final, luego regreso al inicio, y desde el inicio al destino
      // 1. De origen a terminal
      for (let i = idxOrigen; i < n - 1; i++) {
        const o = ruta.rutaParadas[i].parada;
        const d = ruta.rutaParadas[i + 1].parada;
        const clave = `${ruta.idRuta}-${o.idParada}-${d.idParada}`;
        if (mapaPromedios.has(clave)) {
          segundos += mapaPromedios.get(clave)!;
        } else {
          const dist = calcularDistanciaMetros(
            Number(o.latitud),
            Number(o.longitud),
            Number(d.latitud),
            Number(d.longitud),
          );
          segundos += Math.round(dist / 5.0);
        }
      }

      // 2. De la última a la primera parada (retorno del loop)
      if (n > 1) {
        const o = ruta.rutaParadas[n - 1].parada;
        const d = ruta.rutaParadas[0].parada;
        const clave = `${ruta.idRuta}-${o.idParada}-${d.idParada}`;
        if (mapaPromedios.has(clave)) {
          segundos += mapaPromedios.get(clave)!;
        } else {
          const dist = calcularDistanciaMetros(
            Number(o.latitud),
            Number(o.longitud),
            Number(d.latitud),
            Number(d.longitud),
          );
          segundos += Math.round(dist / 5.0);
        }
      }

      // 3. De la primera parada al destino
      for (let i = 0; i < idxDestino; i++) {
        const o = ruta.rutaParadas[i].parada;
        const d = ruta.rutaParadas[i + 1].parada;
        const clave = `${ruta.idRuta}-${o.idParada}-${d.idParada}`;
        if (mapaPromedios.has(clave)) {
          segundos += mapaPromedios.get(clave)!;
        } else {
          const dist = calcularDistanciaMetros(
            Number(o.latitud),
            Number(o.longitud),
            Number(d.latitud),
            Number(d.longitud),
          );
          segundos += Math.round(dist / 5.0);
        }
      }
    }
    return segundos;
  }

  async planificarViaje(
    origenLat: number,
    origenLon: number,
    destinoLat: number,
    destinoLon: number,
    maxCaminataMetros: number = 800,
  ): Promise<Itinerario[]> {
    const VELOCIDAD_CAMINATA_MPS = 1.39; // 5 km/h
    const TIEMPO_ESPERA_ESTIMADO_SEG = 240; // 4 minutos de espera en parada

    // 1. Obtener todas las rutas y paradas activas
    const rutas = await this.prisma.ruta.findMany({
      where: { estado: 'ACTIVA' },
      include: {
        rutaParadas: {
          include: { parada: true },
          orderBy: { ordenParada: 'asc' },
        },
      },
    });

    const paradas = await this.prisma.parada.findMany({
      where: { estado: 'ACTIVA' },
    });

    // 2. Obtener promedios de tiempo entre tramos de base de datos
    const promedios = await this.prisma.tiempoTramo.groupBy({
      by: ['idRuta', 'idParadaOrigen', 'idParadaDestino'],
      _avg: { duracionSegundos: true },
    });

    const mapaPromedios = new Map<string, number>();
    for (const p of promedios) {
      const clave = `${p.idRuta}-${p.idParadaOrigen}-${p.idParadaDestino}`;
      mapaPromedios.set(clave, Math.round(p._avg.duracionSegundos ?? 0));
    }

    const mapaEtasRutas = new Map<number, any>();
    const getEtasRuta = async (idRuta: number) => {
      if (mapaEtasRutas.has(idRuta)) {
        return mapaEtasRutas.get(idRuta);
      }
      try {
        const res = await this.etaService.calcularEtaPorRuta(idRuta);
        mapaEtasRutas.set(idRuta, res);
        return res;
      } catch (err) {
        return null;
      }
    };

    const itinerarios: Itinerario[] = [];

    // 3. Opción de caminata directa
    const distCaminataDirecta = calcularDistanciaMetros(
      origenLat,
      origenLon,
      destinoLat,
      destinoLon,
    );
    const tiempoCaminataDirectaSeg = Math.round(
      distCaminataDirecta / VELOCIDAD_CAMINATA_MPS,
    );

    if (distCaminataDirecta <= 2500) {
      itinerarios.push({
        tipo: 'DIRECT_WALK',
        tiempoTotalSegundos: tiempoCaminataDirectaSeg,
        tiempoTotalMinutos: Math.ceil(tiempoCaminataDirectaSeg / 60),
        distanciaTotalCaminataMetros: Math.round(distCaminataDirecta),
        transbordos: 0,
        pasos: [
          {
            tipo: 'WALK',
            descripcion: 'Caminar directamente al destino',
            distanciaMetros: Math.round(distCaminataDirecta),
            tiempoSegundos: tiempoCaminataDirectaSeg,
            tiempoMinutos: Math.ceil(tiempoCaminataDirectaSeg / 60),
            origen: { lat: origenLat, lon: origenLon, nombre: 'Mi ubicación' },
            destino: { lat: destinoLat, lon: destinoLon, nombre: 'Destino' },
          },
        ],
      });
    }

    // 4. Encontrar paradas cercanas al origen y al destino
    const paradasOrigen = paradas
      .map((p) => ({
        parada: p,
        distancia: calcularDistanciaMetros(
          origenLat,
          origenLon,
          Number(p.latitud),
          Number(p.longitud),
        ),
      }))
      .filter((item) => item.distancia <= maxCaminataMetros);

    const paradasDestino = paradas
      .map((p) => ({
        parada: p,
        distancia: calcularDistanciaMetros(
          destinoLat,
          destinoLon,
          Number(p.latitud),
          Number(p.longitud),
        ),
      }))
      .filter((item) => item.distancia <= maxCaminataMetros);

    // 5. RUTAS DIRECTAS (0 Transbordos, soporte circular)
    for (const po of paradasOrigen) {
      for (const pd of paradasDestino) {
        if (po.parada.idParada === pd.parada.idParada) continue;

        for (const ruta of rutas) {
          const idxOrigen = ruta.rutaParadas.findIndex(
            (rp) => rp.idParada === po.parada.idParada,
          );
          const idxDestino = ruta.rutaParadas.findIndex(
            (rp) => rp.idParada === pd.parada.idParada,
          );

          if (idxOrigen !== -1 && idxDestino !== -1) {
            const esDirecto = idxOrigen < idxDestino;
            const cantidadParadas = esDirecto
              ? (idxDestino - idxOrigen)
              : (ruta.rutaParadas.length - idxOrigen + idxDestino);

            // Calcular ETA en tiempo real o fallback
            const etasRuta = await getEtasRuta(ruta.idRuta);
            let tiempoEsperaSegundos = 300; // Fallback 5 minutos
            let busActivo = false;
            let codigoBus: string | null = null;

            if (etasRuta && etasRuta.unidades && etasRuta.unidades.length > 0) {
              let minEta = Infinity;
              let bestUnit = null;

              for (const u of etasRuta.unidades) {
                const etaItem = u.etas.find((e: any) => e.idParada === po.parada.idParada);
                if (etaItem && etaItem.etaSegundos !== null && etaItem.etaSegundos > 0) {
                  if (etaItem.etaSegundos < minEta) {
                    minEta = etaItem.etaSegundos;
                    bestUnit = u;
                  }
                }
              }

              if (bestUnit && minEta !== Infinity) {
                tiempoEsperaSegundos = minEta;
                busActivo = true;
                codigoBus = bestUnit.codigoUnidad;
              }
            }

            const tiempoWalk1 = po.distancia / VELOCIDAD_CAMINATA_MPS;
            const tiempoViajeBus = this.calcularTiempoRuta(
              ruta,
              idxOrigen,
              idxDestino,
              mapaPromedios,
            );
            const tiempoWalk2 = pd.distancia / VELOCIDAD_CAMINATA_MPS;
            const tiempoTotal =
              tiempoWalk1 +
              tiempoViajeBus +
              tiempoWalk2 +
              tiempoEsperaSegundos;

            itinerarios.push({
              tipo: 'DIRECT_TRANSIT',
              tiempoTotalSegundos: Math.round(tiempoTotal),
              tiempoTotalMinutos: Math.ceil(tiempoTotal / 60),
              distanciaTotalCaminataMetros: Math.round(
                po.distancia + pd.distancia,
              ),
              transbordos: 0,
              pasos: [
                {
                  tipo: 'WALK',
                  descripcion: `Caminar hasta la parada ${toTitleCase(po.parada.nombreParada)}`,
                  distanciaMetros: Math.round(po.distancia),
                  tiempoSegundos: Math.round(tiempoWalk1),
                  tiempoMinutos: Math.ceil(tiempoWalk1 / 60),
                  origen: { lat: origenLat, lon: origenLon, nombre: 'Mi ubicación' },
                  destino: {
                    lat: Number(po.parada.latitud),
                    lon: Number(po.parada.longitud),
                    nombre: toTitleCase(po.parada.nombreParada),
                  },
                },
                {
                  tipo: 'TRANSIT',
                  descripcion: `Tomar autobús de la línea ${toTitleCase(ruta.nombreRuta)} (${ruta.codigoRuta})`,
                  distanciaMetros: 0,
                  tiempoSegundos: Math.round(tiempoEsperaSegundos + tiempoViajeBus),
                  tiempoMinutos: Math.ceil((tiempoEsperaSegundos + tiempoViajeBus) / 60),
                  idRuta: ruta.idRuta,
                  codigoRuta: ruta.codigoRuta,
                  nombreRuta: toTitleCase(ruta.nombreRuta),
                  paradaOrigen: toTitleCase(po.parada.nombreParada),
                  paradaDestino: toTitleCase(pd.parada.nombreParada),
                  cantidadParadas,
                  origen: {
                    lat: Number(po.parada.latitud),
                    lon: Number(po.parada.longitud),
                    nombre: toTitleCase(po.parada.nombreParada),
                  },
                  destino: {
                    lat: Number(pd.parada.latitud),
                    lon: Number(pd.parada.longitud),
                    nombre: toTitleCase(pd.parada.nombreParada),
                  },
                  tiempoEsperaSegundos: Math.round(tiempoEsperaSegundos),
                  tiempoEsperaMinutos: Math.ceil(tiempoEsperaSegundos / 60),
                  tiempoViajeSegundos: Math.round(tiempoViajeBus),
                  tiempoViajeMinutos: Math.ceil(tiempoViajeBus / 60),
                  busActivo,
                  codigoBus,
                },
                {
                  tipo: 'WALK',
                  descripcion: `Caminar desde la parada ${toTitleCase(pd.parada.nombreParada)} hasta el destino`,
                  distanciaMetros: Math.round(pd.distancia),
                  tiempoSegundos: Math.round(tiempoWalk2),
                  tiempoMinutos: Math.ceil(tiempoWalk2 / 60),
                  origen: {
                    lat: Number(pd.parada.latitud),
                    lon: Number(pd.parada.longitud),
                    nombre: toTitleCase(pd.parada.nombreParada),
                  },
                  destino: { lat: destinoLat, lon: destinoLon, nombre: 'Destino' },
                },
              ],
            });
          }
        }
      }
    }

    // 6. RUTAS CON CONEXIÓN (1 Transbordo, soporte circular)
    const MAX_DISTANCIA_TRANSBORDO_METROS = 250;

    for (const po of paradasOrigen) {
      for (const pd of paradasDestino) {
        if (po.parada.idParada === pd.parada.idParada) continue;

        const rutasO = rutas.filter((r) =>
          r.rutaParadas.some((rp) => rp.idParada === po.parada.idParada),
        );
        const rutasD = rutas.filter((r) =>
          r.rutaParadas.some((rp) => rp.idParada === pd.parada.idParada),
        );

        for (const r1 of rutasO) {
          for (const r2 of rutasD) {
            if (r1.idRuta === r2.idRuta) continue;

            const idxO_r1 = r1.rutaParadas.findIndex(
              (rp) => rp.idParada === po.parada.idParada,
            );
            const idxD_r2 = r2.rutaParadas.findIndex(
              (rp) => rp.idParada === pd.parada.idParada,
            );

            if (idxO_r1 !== -1 && idxD_r2 !== -1) {
              for (let i = 0; i < r1.rutaParadas.length; i++) {
                if (i === idxO_r1) continue;
                const pt1 = r1.rutaParadas[i].parada;

                for (let j = 0; j < r2.rutaParadas.length; j++) {
                  if (j === idxD_r2) continue;
                  const pt2 = r2.rutaParadas[j].parada;

                  const distTransfer = calcularDistanciaMetros(
                    Number(pt1.latitud),
                    Number(pt1.longitud),
                    Number(pt2.latitud),
                    Number(pt2.longitud),
                  );

                  if (distTransfer <= MAX_DISTANCIA_TRANSBORDO_METROS) {
                    const esDirector1 = idxO_r1 < i;
                    const cantidadParadasr1 = esDirector1
                      ? (i - idxO_r1)
                      : (r1.rutaParadas.length - idxO_r1 + i);

                    const esDirector2 = j < idxD_r2;
                    const cantidadParadasr2 = esDirector2
                      ? (idxD_r2 - j)
                      : (r2.rutaParadas.length - j + idxD_r2);

                    // Calcular ETA en tiempo real o fallback para R1
                    const etasR1 = await getEtasRuta(r1.idRuta);
                    let tiempoEsperaR1 = 300; // Fallback 5 min
                    let busActivoR1 = false;
                    let codigoBusR1: string | null = null;

                    if (etasR1 && etasR1.unidades && etasR1.unidades.length > 0) {
                      let minEta = Infinity;
                      let bestUnit = null;

                      for (const u of etasR1.unidades) {
                        const etaItem = u.etas.find((e: any) => e.idParada === po.parada.idParada);
                        if (etaItem && etaItem.etaSegundos !== null && etaItem.etaSegundos > 0) {
                          if (etaItem.etaSegundos < minEta) {
                            minEta = etaItem.etaSegundos;
                            bestUnit = u;
                          }
                        }
                      }

                      if (bestUnit && minEta !== Infinity) {
                        tiempoEsperaR1 = minEta;
                        busActivoR1 = true;
                        codigoBusR1 = bestUnit.codigoUnidad;
                      }
                    }

                    // Calcular ETA en tiempo real o fallback para R2
                    const etasR2 = await getEtasRuta(r2.idRuta);
                    let tiempoEsperaR2 = 300; // Fallback 5 min
                    let busActivoR2 = false;
                    let codigoBusR2: string | null = null;

                    if (etasR2 && etasR2.unidades && etasR2.unidades.length > 0) {
                      let minEta = Infinity;
                      let bestUnit = null;

                      for (const u of etasR2.unidades) {
                        const etaItem = u.etas.find((e: any) => e.idParada === pt2.idParada);
                        if (etaItem && etaItem.etaSegundos !== null && etaItem.etaSegundos > 0) {
                          if (etaItem.etaSegundos < minEta) {
                            minEta = etaItem.etaSegundos;
                            bestUnit = u;
                          }
                        }
                      }

                      if (bestUnit && minEta !== Infinity) {
                        tiempoEsperaR2 = minEta;
                        busActivoR2 = true;
                        codigoBusR2 = bestUnit.codigoUnidad;
                      }
                    }

                    const tiempoWalk1 = po.distancia / VELOCIDAD_CAMINATA_MPS;
                    const tiempoBus1 = this.calcularTiempoRuta(
                      r1,
                      idxO_r1,
                      i,
                      mapaPromedios,
                    );
                    const tiempoWalkTransfer = distTransfer / VELOCIDAD_CAMINATA_MPS;
                    const tiempoBus2 = this.calcularTiempoRuta(
                      r2,
                      j,
                      idxD_r2,
                      mapaPromedios,
                    );
                    const tiempoWalk2 = pd.distancia / VELOCIDAD_CAMINATA_MPS;

                    const tiempoTotal =
                      tiempoWalk1 +
                      (tiempoEsperaR1 + tiempoBus1) +
                      tiempoWalkTransfer +
                      (tiempoEsperaR2 + tiempoBus2) +
                      tiempoWalk2;

                    itinerarios.push({
                      tipo: 'TRANSFER_TRANSIT',
                      tiempoTotalSegundos: Math.round(tiempoTotal),
                      tiempoTotalMinutos: Math.ceil(tiempoTotal / 60),
                      distanciaTotalCaminataMetros: Math.round(
                        po.distancia + distTransfer + pd.distancia,
                      ),
                      transbordos: 1,
                      pasos: [
                        {
                          tipo: 'WALK',
                          descripcion: `Caminar hasta la parada ${toTitleCase(po.parada.nombreParada)}`,
                          distanciaMetros: Math.round(po.distancia),
                          tiempoSegundos: Math.round(tiempoWalk1),
                          tiempoMinutos: Math.ceil(tiempoWalk1 / 60),
                          origen: { lat: origenLat, lon: origenLon, nombre: 'Mi ubicación' },
                          destino: {
                            lat: Number(po.parada.latitud),
                            lon: Number(po.parada.longitud),
                            nombre: toTitleCase(po.parada.nombreParada),
                          },
                        },
                        {
                          tipo: 'TRANSIT',
                          descripcion: `Tomar autobús de la línea ${toTitleCase(r1.nombreRuta)} (${r1.codigoRuta})`,
                          distanciaMetros: 0,
                          tiempoSegundos: Math.round(tiempoEsperaR1 + tiempoBus1),
                          tiempoMinutos: Math.ceil((tiempoEsperaR1 + tiempoBus1) / 60),
                          idRuta: r1.idRuta,
                          codigoRuta: r1.codigoRuta,
                          nombreRuta: toTitleCase(r1.nombreRuta),
                          paradaOrigen: toTitleCase(po.parada.nombreParada),
                          paradaDestino: toTitleCase(pt1.nombreParada),
                          cantidadParadas: cantidadParadasr1,
                          origen: {
                            lat: Number(po.parada.latitud),
                            lon: Number(po.parada.longitud),
                            nombre: toTitleCase(po.parada.nombreParada),
                          },
                          destino: {
                            lat: Number(pt1.latitud),
                            lon: Number(pt1.longitud),
                            nombre: toTitleCase(pt1.nombreParada),
                          },
                          tiempoEsperaSegundos: Math.round(tiempoEsperaR1),
                          tiempoEsperaMinutos: Math.ceil(tiempoEsperaR1 / 60),
                          tiempoViajeSegundos: Math.round(tiempoBus1),
                          tiempoViajeMinutos: Math.ceil(tiempoBus1 / 60),
                          busActivo: busActivoR1,
                          codigoBus: codigoBusR1,
                        },
                        {
                          tipo: 'WALK',
                          descripcion: distTransfer > 0 
                            ? `Caminar hacia la parada ${toTitleCase(pt2.nombreParada)} para transbordo`
                            : `Realizar transbordo en la misma parada`,
                          distanciaMetros: Math.round(distTransfer),
                          tiempoSegundos: Math.round(tiempoWalkTransfer),
                          tiempoMinutos: Math.ceil(tiempoWalkTransfer / 60),
                          origen: {
                            lat: Number(pt1.latitud),
                            lon: Number(pt1.longitud),
                            nombre: toTitleCase(pt1.nombreParada),
                          },
                          destino: {
                            lat: Number(pt2.latitud),
                            lon: Number(pt2.longitud),
                            nombre: toTitleCase(pt2.nombreParada),
                          },
                        },
                        {
                          tipo: 'TRANSIT',
                          descripcion: `Tomar autobús de la línea ${toTitleCase(r2.nombreRuta)} (${r2.codigoRuta})`,
                          distanciaMetros: 0,
                          tiempoSegundos: Math.round(tiempoEsperaR2 + tiempoBus2),
                          tiempoMinutos: Math.ceil((tiempoEsperaR2 + tiempoBus2) / 60),
                          idRuta: r2.idRuta,
                          codigoRuta: r2.codigoRuta,
                          nombreRuta: toTitleCase(r2.nombreRuta),
                          paradaOrigen: toTitleCase(pt2.nombreParada),
                          paradaDestino: toTitleCase(pd.parada.nombreParada),
                          cantidadParadas: cantidadParadasr2,
                          origen: {
                            lat: Number(pt2.latitud),
                            lon: Number(pt2.longitud),
                            nombre: toTitleCase(pt2.nombreParada),
                          },
                          destino: {
                            lat: Number(pd.parada.latitud),
                            lon: Number(pd.parada.longitud),
                            nombre: toTitleCase(pd.parada.nombreParada),
                          },
                          tiempoEsperaSegundos: Math.round(tiempoEsperaR2),
                          tiempoEsperaMinutos: Math.ceil(tiempoEsperaR2 / 60),
                          tiempoViajeSegundos: Math.round(tiempoBus2),
                          tiempoViajeMinutos: Math.ceil(tiempoBus2 / 60),
                          busActivo: busActivoR2,
                          codigoBus: codigoBusR2,
                        },
                        {
                          tipo: 'WALK',
                          descripcion: `Caminar desde la parada ${toTitleCase(pd.parada.nombreParada)} hasta el destino`,
                          distanciaMetros: Math.round(pd.distancia),
                          tiempoSegundos: Math.round(tiempoWalk2),
                          tiempoMinutos: Math.ceil(tiempoWalk2 / 60),
                          origen: {
                            lat: Number(pd.parada.latitud),
                            lon: Number(pd.parada.longitud),
                            nombre: toTitleCase(pd.parada.nombreParada),
                          },
                          destino: { lat: destinoLat, lon: destinoLon, nombre: 'Destino' },
                        },
                      ],
                    });
                  }
                }
              }
            }
          }
        }
      }
    }

    // 7. Filtrar duplicados y ordenar por tiempo total
    const itinerariosUnicos = this.eliminarItinerariosDuplicados(itinerarios);

    const mejoresItinerarios = itinerariosUnicos
      .sort((a, b) => {
        if (a.transbordos !== b.transbordos) {
          return a.transbordos - b.transbordos;
        }
        return a.tiempoTotalSegundos - b.tiempoTotalSegundos;
      })
      .slice(0, 5);

    // 8. Enriquecer los pasos TRANSIT con sus shapes reales
    for (const iti of mejoresItinerarios) {
      for (const paso of iti.pasos) {
        if (paso.tipo === 'TRANSIT' && paso.idRuta && paso.origen && paso.destino) {
          const ruta = rutas.find((r) => r.idRuta === paso.idRuta);
          if (ruta) {
            const idxOrigen = ruta.rutaParadas.findIndex(
              (rp) => rp.parada.nombreParada.toLowerCase() === paso.paradaOrigen?.toLowerCase(),
            );
            const idxDestino = ruta.rutaParadas.findIndex(
              (rp) => rp.parada.nombreParada.toLowerCase() === paso.paradaDestino?.toLowerCase(),
            );
            paso.shape = await this.obtenerSegmentoShape(
              paso.idRuta,
              paso.origen.lat,
              paso.origen.lon,
              paso.destino.lat,
              paso.destino.lon,
              idxOrigen !== -1 ? idxOrigen : 0,
              idxDestino !== -1 ? idxDestino : 0,
            );
          }
        }
      }
    }

    return mejoresItinerarios;
  }

  private async obtenerSegmentoShape(
    idRuta: number,
    origenLat: number,
    origenLon: number,
    destinoLat: number,
    destinoLon: number,
    idxOrigen: number,
    idxDestino: number,
  ): Promise<{ lat: number; lng: number }[]> {
    const shapes = await this.prisma.rutaShape.findMany({
      where: { idRuta },
      orderBy: { secuencia: 'asc' },
    });

    if (shapes.length === 0) return [];

    let minDistanceO = Infinity;
    let minDistanceD = Infinity;
    let idxShapeOrigen = 0;
    let idxShapeDestino = 0;

    for (let i = 0; i < shapes.length; i++) {
      const distO = calcularDistanciaMetros(
        origenLat,
        origenLon,
        Number(shapes[i].latitud),
        Number(shapes[i].longitud),
      );
      if (distO < minDistanceO) {
        minDistanceO = distO;
        idxShapeOrigen = i;
      }

      const distD = calcularDistanciaMetros(
        destinoLat,
        destinoLon,
        Number(shapes[i].latitud),
        Number(shapes[i].longitud),
      );
      if (distD < minDistanceD) {
        minDistanceD = distD;
        idxShapeDestino = i;
      }
    }

    const puntos = shapes.map((s) => ({
      lat: Number(s.latitud),
      lng: Number(s.longitud),
    }));

    if (idxOrigen <= idxDestino) {
      // Caso directo (no cruza la terminal)
      // Ajustamos los índices de shape para que vayan en orden ascendente
      if (idxShapeOrigen <= idxShapeDestino) {
        return puntos.slice(idxShapeOrigen, idxShapeDestino + 1);
      } else {
        // Fallback si por distancia GPS se cruzaron
        return puntos.slice(idxShapeDestino, idxShapeOrigen + 1).reverse();
      }
    } else {
      // Caso circular (cruza la terminal, del final al principio)
      return [
        ...puntos.slice(idxShapeOrigen),
        ...puntos.slice(0, idxShapeDestino + 1),
      ];
    }
  }

  private eliminarItinerariosDuplicados(itinerarios: Itinerario[]): Itinerario[] {
    const mapaItinerarios = new Map<string, Itinerario>();

    for (const iti of itinerarios) {
      const firmasPasos = iti.pasos
        .map((p) => {
          if (p.tipo === 'TRANSIT') {
            return `TRANSIT-${p.codigoRuta}-${p.paradaOrigen}-${p.paradaDestino}`;
          }
          return `WALK-${p.distanciaMetros}`;
        })
        .join('|');

      const existente = mapaItinerarios.get(firmasPasos);
      if (!existente || existente.tiempoTotalSegundos > iti.tiempoTotalSegundos) {
        mapaItinerarios.set(firmasPasos, iti);
      }
    }
    return Array.from(mapaItinerarios.values());
  }
}

// Función auxiliar para formatear a Title Case
function toTitleCase(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

