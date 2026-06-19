import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { GTFS_ROUTE_SCHEDULES } from '../constants/schedules.constants';
import { timeStringToSeconds, secondsToTimeString, toTitleCase } from '../utils/time.util';
import AdmZip = require('adm-zip');
import { transit_realtime } from 'gtfs-realtime-bindings';
import { VigitrackService } from '../../integrations/vigitrack/services/vigitrack.service';
import { EtaService } from '../../eta/services/eta.service';

@Injectable()
export class GtfsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vigitrackService: VigitrackService,
    private readonly etaService: EtaService,
  ) {}

  private escapeCsv(str: string): string {
    const stringified = String(str ?? '');
    if (stringified.includes(',') || stringified.includes('"') || stringified.includes('\n')) {
      return `"${stringified.replace(/"/g, '""')}"`;
    }
    return stringified;
  }

  async generarPreview() {
    // 1. Cargar datos desde base de datos
    const rutasBd = await this.prisma.ruta.findMany({
      include: {
        rutaParadas: true,
        rutaShapes: true,
      },
    });

    const promedios = await this.prisma.tiempoTramo.groupBy({
      by: ['idRuta', 'idParadaOrigen', 'idParadaDestino'],
      _avg: { duracionSegundos: true },
    });

    const mapaPromedios = new Map<string, number>();
    for (const p of promedios) {
      const clave = `${p.idRuta}-${p.idParadaOrigen}-${p.idParadaDestino}`;
      mapaPromedios.set(clave, Math.round(p._avg.duracionSegundos ?? 0));
    }

    // 2. Diagnosticar rutas y schedules
    const codigosConfigurados = Array.from(new Set(GTFS_ROUTE_SCHEDULES.map((s) => s.codigoRuta)));
    const rutasIncluidas = [];
    const rutasConfiguradasNoEncontradas = [];
    const rutasSinParadas = [];
    const rutasSinShape = [];

    for (const codigo of codigosConfigurados) {
      const ruta = rutasBd.find((r) => r.codigoRuta === codigo);
      if (!ruta) {
        rutasConfiguradasNoEncontradas.push(codigo);
        continue;
      }

      rutasIncluidas.push({
        idRuta: ruta.idRuta,
        codigoRuta: ruta.codigoRuta,
        nombreRuta: ruta.nombreRuta,
      });

      if (ruta.rutaParadas.length === 0) {
        rutasSinParadas.push(ruta.codigoRuta);
      }

      if (ruta.rutaShapes.length === 0) {
        rutasSinShape.push(ruta.codigoRuta);
      }
    }

    // 3. Simular la generación de viajes (trips) y tiempos de parada (stop_times)
    let totalTrips = 0;
    let totalStopTimes = 0;
    let tramosConHistorico = 0;
    let tramosConFallback = 0;

    for (const schedule of GTFS_ROUTE_SCHEDULES) {
      const ruta = rutasBd.find((r) => r.codigoRuta === schedule.codigoRuta);
      if (!ruta || ruta.rutaParadas.length === 0) {
        continue;
      }

      // Ordenar las paradas de la ruta
      const paradasDeRuta = [...ruta.rutaParadas].sort((a, b) => a.ordenParada - b.ordenParada);

      // Calcular salidas de trips
      const inicioSeg = timeStringToSeconds(schedule.horaInicio);
      const finSeg = timeStringToSeconds(schedule.horaFin);
      const frecuenciaSeg = schedule.frecuenciaMinutos * 60;

      for (let salidaSeg = inicioSeg; salidaSeg <= finSeg; salidaSeg += frecuenciaSeg) {
        totalTrips++;
        totalStopTimes += paradasDeRuta.length;

        // Evaluar tramos (desde la segunda parada en adelante)
        for (let i = 1; i < paradasDeRuta.length; i++) {
          const origen = paradasDeRuta[i - 1];
          const destino = paradasDeRuta[i];
          const clave = `${ruta.idRuta}-${origen.idParada}-${destino.idParada}`;

          if (mapaPromedios.has(clave)) {
            tramosConHistorico++;
          } else {
            tramosConFallback++;
          }
        }
      }
    }

    return {
      rutasIncluidas,
      rutasConfiguradasNoEncontradas,
      rutasSinParadas,
      rutasSinShape,
      totalTrips,
      totalStopTimes,
      tramosConHistorico,
      tramosConFallback,
    };
  }

  async generarZip(): Promise<Buffer> {
    // 1. Cargar datos desde base de datos
    const rutasBd = await this.prisma.ruta.findMany({
      include: {
        rutaParadas: {
          include: { parada: true },
          orderBy: { ordenParada: 'asc' },
        },
        rutaShapes: {
          orderBy: { secuencia: 'asc' },
        },
      },
    });

    const promedios = await this.prisma.tiempoTramo.groupBy({
      by: ['idRuta', 'idParadaOrigen', 'idParadaDestino'],
      _avg: { duracionSegundos: true },
    });

    const mapaPromedios = new Map<string, number>();
    for (const p of promedios) {
      const clave = `${p.idRuta}-${p.idParadaOrigen}-${p.idParadaDestino}`;
      mapaPromedios.set(clave, Math.round(p._avg.duracionSegundos ?? 0));
    }

    // Filtrar rutas que estén configuradas en los horarios operativos
    const codigosRutaConfigurados = new Set(GTFS_ROUTE_SCHEDULES.map((s) => s.codigoRuta));
    const rutasValidas = rutasBd.filter((r) => r.codigoRuta && codigosRutaConfigurados.has(r.codigoRuta));

    // --- agency.txt ---
    let agencyCsv = 'agency_id,agency_name,agency_url,agency_timezone,agency_lang\n';
    agencyCsv += 'coop_28,Cooperativa 28 de Septiembre,https://example.com,America/Guayaquil,es\n';

    // --- routes.txt ---
    let routesCsv = 'route_id,agency_id,route_short_name,route_long_name,route_type\n';
    for (const ruta of rutasValidas) {
      routesCsv += `${ruta.idRuta},coop_28,${this.escapeCsv(ruta.codigoRuta ?? '')},${this.escapeCsv(toTitleCase(ruta.nombreRuta))},3\n`;
    }

    // --- stops.txt ---
    // Recopilar IDs únicos de paradas asociadas a las rutas válidas
    const paradasMapeadas = new Map<number, any>();
    for (const ruta of rutasValidas) {
      for (const rp of ruta.rutaParadas) {
        paradasMapeadas.set(rp.idParada, rp.parada);
      }
    }

    let stopsCsv = 'stop_id,stop_name,stop_lat,stop_lon\n';
    for (const parada of paradasMapeadas.values()) {
      stopsCsv += `${parada.idParada},${this.escapeCsv(toTitleCase(parada.nombreParada))},${parada.latitud},${parada.longitud}\n`;
    }

    // --- shapes.txt ---
    let shapesCsv = 'shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence\n';
    for (const ruta of rutasValidas) {
      if (ruta.rutaShapes.length === 0) continue;
      if (ruta.rutaParadas.length === 0) continue; // Evita shapes sin viajes asociados (unused_shape)
      const shapeId = `${ruta.codigoRuta}_shape`;
      for (const sh of ruta.rutaShapes) {
        shapesCsv += `${shapeId},${sh.latitud},${sh.longitud},${sh.secuencia}\n`;
      }
    }

    // --- calendar.txt ---
    let calendarCsv = 'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\n';
    calendarCsv += 'WEEKDAY,1,1,1,1,1,0,0,20260101,20261231\n';
    calendarCsv += 'SATURDAY,0,0,0,0,0,1,0,20260101,20261231\n';
    calendarCsv += 'SUNDAY,0,0,0,0,0,0,1,20260101,20261231\n';

    // --- trips.txt y stop_times.txt ---
    let tripsCsv = 'route_id,service_id,trip_id,trip_headsign,direction_id,shape_id\n';
    let stopTimesCsv = 'trip_id,arrival_time,departure_time,stop_id,stop_sequence\n';

    for (const schedule of GTFS_ROUTE_SCHEDULES) {
      const ruta = rutasValidas.find((r) => r.codigoRuta === schedule.codigoRuta);
      // Si la ruta no tiene paradas registradas, no podemos generar viajes
      if (!ruta || ruta.rutaParadas.length === 0) {
        continue;
      }

      const paradasDeRuta = ruta.rutaParadas; // Ya vienen ordenadas por ordenParada asc debido al include

      const inicioSeg = timeStringToSeconds(schedule.horaInicio);
      const finSeg = timeStringToSeconds(schedule.horaFin);
      const frecuenciaSeg = schedule.frecuenciaMinutos * 60;

      for (let salidaSeg = inicioSeg; salidaSeg <= finSeg; salidaSeg += frecuenciaSeg) {
        const hhmm = secondsToTimeString(salidaSeg).substring(0, 5).replace(':', '');
        const tripId = `${schedule.codigoRuta}_${schedule.serviceId}_${hhmm}`;
        const shapeId = ruta.rutaShapes.length > 0 ? `${schedule.codigoRuta}_shape` : '';

        // Escribir trip
        tripsCsv += `${ruta.idRuta},${schedule.serviceId},${tripId},${this.escapeCsv(toTitleCase(ruta.nombreRuta))},0,${shapeId}\n`;

        // Calcular stop_times
        let segundosAcumulados = salidaSeg;

        for (let i = 0; i < paradasDeRuta.length; i++) {
          const rp = paradasDeRuta[i];

          if (i > 0) {
            const origen = paradasDeRuta[i - 1];
            const clave = `${ruta.idRuta}-${origen.idParada}-${rp.idParada}`;
            const duracionTramo = mapaPromedios.get(clave) ?? 90; // Fallback de 90 segundos
            segundosAcumulados += duracionTramo;
          }

          const timeStr = secondsToTimeString(segundosAcumulados);
          stopTimesCsv += `${tripId},${timeStr},${timeStr},${rp.idParada},${rp.ordenParada}\n`;
        }
      }
    }

    // --- feed_info.txt ---
    let feedInfoCsv = 'feed_publisher_name,feed_publisher_url,feed_lang,feed_start_date,feed_end_date,feed_version,feed_contact_email,feed_contact_url\n';
    feedInfoCsv += 'Cooperativa 28 de Septiembre,https://example.com,es,20260101,20261231,1.0,info@coop28septiembre.com,https://example.com\n';

    // 2. Empaquetar archivos en ZIP
    const zip = new AdmZip();
    zip.addFile('agency.txt', Buffer.from(agencyCsv, 'utf-8'));
    zip.addFile('routes.txt', Buffer.from(routesCsv, 'utf-8'));
    zip.addFile('stops.txt', Buffer.from(stopsCsv, 'utf-8'));
    if (shapesCsv.trim().split('\n').length > 1) {
      zip.addFile('shapes.txt', Buffer.from(shapesCsv, 'utf-8'));
    }
    zip.addFile('calendar.txt', Buffer.from(calendarCsv, 'utf-8'));
    zip.addFile('trips.txt', Buffer.from(tripsCsv, 'utf-8'));
    zip.addFile('stop_times.txt', Buffer.from(stopTimesCsv, 'utf-8'));
    zip.addFile('feed_info.txt', Buffer.from(feedInfoCsv, 'utf-8'));

    return zip.toBuffer();
  }

  async generarVehiclePositions(): Promise<Buffer> {
    await this.vigitrackService.sincronizarMonitoreoConCooldown();

    const ahora = new Date();
    const inicioDia = new Date(ahora);
    inicioDia.setHours(0, 0, 0, 0);

    const trayectoriasActivas = await this.prisma.trayectoria.findMany({
      where: {
        estado: 'EN_CURSO',
        fechaInicio: {
          gte: inicioDia,
        },
      },
      include: {
        unidad: true,
        ruta: true,
      },
    });

    const header = transit_realtime.FeedHeader.create({
      gtfsRealtimeVersion: '2.0',
      incrementality: transit_realtime.FeedHeader.Incrementality.FULL_DATASET,
      timestamp: Math.round(ahora.getTime() / 1000),
    });

    const entities: transit_realtime.FeedEntity[] = [];

    const formatEC = new Intl.DateTimeFormat('es-EC', {
      timeZone: 'America/Guayaquil',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    for (const t of trayectoriasActivas) {
      const gps = await this.prisma.registroGps.findFirst({
        where: {
          idUnidad: t.idUnidad,
          esOperativo: true,
          fechaHora: {
            gte: inicioDia,
          },
        },
        orderBy: {
          fechaHora: 'desc',
        },
      });

      if (!gps) continue;

      const parts = formatEC.formatToParts(t.fechaInicio);
      const partMap = new Map(parts.map(p => [p.type, p.value]));
      const yyyymmdd = `${partMap.get('year')}${partMap.get('month')}${partMap.get('day')}`;
      const hhmmss = `${partMap.get('hour')}${partMap.get('minute')}${partMap.get('second')}`;
      const tripId = `ADD_${t.ruta.codigoRuta}_${t.unidad.codigoUnidad}_${yyyymmdd}_${hhmmss}`;

      const entity = transit_realtime.FeedEntity.create({
        id: `vehicle_${t.idTrayectoria}`,
        vehicle: transit_realtime.VehiclePosition.create({
          trip: transit_realtime.TripDescriptor.create({
            tripId,
            routeId: String(t.idRuta),
            scheduleRelationship: transit_realtime.TripDescriptor.ScheduleRelationship.ADDED,
          }),
          position: transit_realtime.Position.create({
            latitude: Number(gps.latitud),
            longitude: Number(gps.longitud),
            bearing: gps.rumbo ? Number(gps.rumbo) : undefined,
            speed: gps.velocidad ? Number(gps.velocidad) / 3.6 : undefined,
          }),
          timestamp: Math.round(gps.fechaHora.getTime() / 1000),
          vehicle: transit_realtime.VehicleDescriptor.create({
            id: t.unidad.codigoUnidad,
            label: t.unidad.placa ?? t.unidad.codigoUnidad,
          }),
        }),
      });

      entities.push(entity);
    }

    const message = transit_realtime.FeedMessage.create({
      header,
      entity: entities,
    });

    return Buffer.from(transit_realtime.FeedMessage.encode(message).finish());
  }

  async generarTripUpdates(): Promise<Buffer> {
    await this.vigitrackService.sincronizarMonitoreoConCooldown();

    const ahora = new Date();
    const inicioDia = new Date(ahora);
    inicioDia.setHours(0, 0, 0, 0);

    const trayectoriasActivas = await this.prisma.trayectoria.findMany({
      where: {
        estado: 'EN_CURSO',
        fechaInicio: {
          gte: inicioDia,
        },
      },
      include: {
        unidad: true,
        ruta: true,
      },
    });

    const header = transit_realtime.FeedHeader.create({
      gtfsRealtimeVersion: '2.0',
      incrementality: transit_realtime.FeedHeader.Incrementality.FULL_DATASET,
      timestamp: Math.round(ahora.getTime() / 1000),
    });

    const entities: transit_realtime.FeedEntity[] = [];

    const formatEC = new Intl.DateTimeFormat('es-EC', {
      timeZone: 'America/Guayaquil',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const idsRutasUnicas = Array.from(new Set(trayectoriasActivas.map(t => t.idRuta)));
    const mapaEtasPorRuta = new Map<number, any>();

    for (const idRuta of idsRutasUnicas) {
      try {
        const res = await this.etaService.calcularEtaPorRuta(idRuta);
        mapaEtasPorRuta.set(idRuta, res);
      } catch (e) {
        // Ignorar errores de ruta sin paradas
      }
    }

    for (const t of trayectoriasActivas) {
      const rutaEtas = mapaEtasPorRuta.get(t.idRuta);
      if (!rutaEtas || !rutaEtas.unidades) continue;

      const unitEta = rutaEtas.unidades.find((u: any) => u.idUnidad === t.idUnidad);
      if (!unitEta || !unitEta.etas || unitEta.etas.length === 0) continue;

      const parts = formatEC.formatToParts(t.fechaInicio);
      const partMap = new Map(parts.map(p => [p.type, p.value]));
      const yyyymmdd = `${partMap.get('year')}${partMap.get('month')}${partMap.get('day')}`;
      const hhmmss = `${partMap.get('hour')}${partMap.get('minute')}${partMap.get('second')}`;
      const tripId = `ADD_${t.ruta.codigoRuta}_${t.unidad.codigoUnidad}_${yyyymmdd}_${hhmmss}`;

      const stopTimeUpdates = unitEta.etas.map((eta: any) => {
        const etaTimestamp = Math.round(ahora.getTime() / 1000) + eta.etaSegundos;

        return transit_realtime.TripUpdate.StopTimeUpdate.create({
          stopSequence: eta.ordenParada,
          stopId: String(eta.idParada),
          arrival: transit_realtime.TripUpdate.StopTimeEvent.create({
            time: etaTimestamp,
          }),
          departure: transit_realtime.TripUpdate.StopTimeEvent.create({
            time: etaTimestamp,
          }),
        });
      });

      const entity = transit_realtime.FeedEntity.create({
        id: `trip_update_${t.idTrayectoria}`,
        tripUpdate: transit_realtime.TripUpdate.create({
          trip: transit_realtime.TripDescriptor.create({
            tripId,
            routeId: String(t.idRuta),
            scheduleRelationship: transit_realtime.TripDescriptor.ScheduleRelationship.ADDED,
          }),
          stopTimeUpdate: stopTimeUpdates,
          timestamp: Math.round(ahora.getTime() / 1000),
        }),
      });

      entities.push(entity);
    }

    const message = transit_realtime.FeedMessage.create({
      header,
      entity: entities,
    });

    return Buffer.from(transit_realtime.FeedMessage.encode(message).finish());
  }
}

