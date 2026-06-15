import { HttpService } from '@nestjs/axios';
import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { firstValueFrom } from 'rxjs';

import {
  estaDentroDeVentanaOperativa,
  obtenerVentanaOperativaTexto,
} from '../../../../common/utils/operation-window.util';
import { PrismaService } from '../../../../database/prisma.service';
import {
  VigitrackMonitoreo,
  VigitrackMonitoreoResponse,
} from '../interfaces/vigitrack-monitoreo.interface';
import {
  VigitrackRuta,
  VigitrackRutasResponse,
} from '../interfaces/vigitrack-ruta.interface';

import { TrayectoriasService } from '../../../trayectorias/services/trayectorias.service';

import { TiemposTramoService } from '../../../tiempos-tramo/services/tiempos-tramo.service';

@Injectable()
export class VigitrackService {
  private readonly logger = new Logger(VigitrackService.name);
  private readonly rutasUrl =
    'https://apismart7bus.vigitracklatam.com/rutas_28septiembre';

  private readonly monitoreoUrl =
  'https://apismart7bus.vigitracklatam.com/monitoring28SeptiembreSIU';

  constructor(
  private readonly httpService: HttpService,
  private readonly prisma: PrismaService,
  private readonly trayectoriasService: TrayectoriasService,
  private readonly tiemposTramoService: TiemposTramoService,
) {}

  async sincronizarRutas() {
    const rutasProveedor = await this.obtenerRutasDesdeProveedor();

    const rutasSincronizadas = await Promise.all(
      rutasProveedor.map((ruta) => this.guardarRuta(ruta)),
    );

    return {
      mensaje: 'Rutas sincronizadas correctamente desde Vigitrack',
      total: rutasSincronizadas.length,
      rutas: rutasSincronizadas,
    };
  }

  private async obtenerRutasDesdeProveedor(): Promise<VigitrackRuta[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<VigitrackRutasResponse>(this.rutasUrl, { timeout: 5000 }),
      );

      const body = response.data;

      if (body.status_code !== 200 || !Array.isArray(body.data)) {
        throw new BadGatewayException(
          'La API de Vigitrack no devolvió una respuesta válida.',
        );
      }

      return body.data;
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'No fue posible consultar la API de rutas de Vigitrack.',
      );
    }
  }

  private async guardarRuta(ruta: VigitrackRuta) {
    const nombreRuta = ruta.DescRuta.trim();
    const codigoRuta = ruta.LetrRuta.trim();

    return this.prisma.ruta.upsert({
      where: {
        idRutaProveedor: ruta.idRuta,
      },
      update: {
        nombreRuta,
        codigoRuta,
      },
      create: {
        idRutaProveedor: ruta.idRuta,
        nombreRuta,
        codigoRuta,
      },
    });
  }

  async obtenerMonitoreo() {
  return this.obtenerMonitoreoDesdeProveedor();
}

async sincronizarMonitoreo() {
  const permitirFueraDeHorario =
    process.env.GPS_ALLOW_OUT_OF_HOURS === 'true';

  if (!permitirFueraDeHorario && !estaDentroDeVentanaOperativa()) {
    return {
      mensaje: 'Sincronización omitida fuera de la ventana operativa.',
      ventanaOperativa: obtenerVentanaOperativaTexto(),
      registros: [],
    };
  }

  const monitoreo = await this.obtenerMonitoreoDesdeProveedor();

  const registros = [];

  for (const item of monitoreo) {
    try {
      const registro = await this.guardarMonitoreo(item);
      registros.push(registro);
    } catch (error) {
      this.logger.error(
        `Error procesando monitoreo para la unidad ${item.CodiVehiMoni?.trim() ?? 'desconocida'}: ${error.message}`,
        error.stack,
      );
    }
  }

  return {
    mensaje: 'Monitoreo sincronizado correctamente desde Vigitrack',
    total: registros.length,
    registros,
  };
}

private async obtenerMonitoreoDesdeProveedor(): Promise<VigitrackMonitoreo[]> {
  try {
    const response = await firstValueFrom(
      this.httpService.get<VigitrackMonitoreoResponse>(this.monitoreoUrl, { timeout: 5000 }),
    );

    const body = response.data;

    if (body.status_code !== 200 || !Array.isArray(body.data)) {
      throw new BadGatewayException(
        'La API de monitoreo de Vigitrack no devolvió una respuesta válida.',
      );
    }

    return body.data;
  } catch (error) {
    if (error instanceof BadGatewayException) {
      throw error;
    }

    throw new InternalServerErrorException(
      'No fue posible consultar la API de monitoreo de Vigitrack.',
    );
  }
}

private convertirFechaVigitrack(fecha: string): Date {
  return new Date(fecha.replace(' ', 'T'));
}

private async guardarMonitoreo(item: VigitrackMonitoreo) {
  const codigoUnidad = item.CodiVehiMoni?.trim() ?? '';
  const placa = item.PlacVehiMoni?.trim() ?? '';
  const codigoRuta = item.LetrRutaMoni?.trim() ?? '';

  if (!codigoUnidad) {
    return {
      estado: 'DESCARTADO',
      motivo: 'Código de unidad vacío o nulo',
    };
  }

  const latitud = Number(item.UltiLatiMoni);
  const longitud = Number(item.UltiLongMoni);
  const velocidad = Number(item.UltiVeloMoni);
  const rumbo = Number(item.UltiRumbMoni);
  
  if (!item.UltiFechMoni) {
    return {
      codigoUnidad,
      placa,
      estado: 'DESCARTADO',
      motivo: 'Fecha de monitoreo vacía o nula',
    };
  }
  const fechaHora = this.convertirFechaVigitrack(item.UltiFechMoni);

  if (Number.isNaN(latitud) || Number.isNaN(longitud)) {
    return {
      codigoUnidad,
      placa,
      estado: 'DESCARTADO',
      motivo: 'Coordenadas inválidas',
    };
  }

  const unidad = await this.prisma.unidad.upsert({
    where: {
      codigoUnidad,
    },
    update: {
      placa,
    },
    create: {
      codigoUnidad,
      placa,
    },
  });

  const ruta = await this.prisma.ruta.findFirst({
    where: {
      codigoRuta,
    },
  });

  const duplicado = await this.prisma.registroGps.findFirst({
    where: {
      idUnidad: unidad.idUnidad,
      fechaHora,
      latitud: new Prisma.Decimal(latitud),
      longitud: new Prisma.Decimal(longitud),
    },
  });

  if (duplicado) {
    return {
      codigoUnidad,
      placa,
      estado: 'DUPLICADO',
      registro: duplicado,
    };
  }

  const registroGps = await this.prisma.registroGps.create({
    data: {
      idUnidad: unidad.idUnidad,
      idRuta: ruta?.idRuta ?? null,
      fechaHora,
      latitud: new Prisma.Decimal(latitud),
      longitud: new Prisma.Decimal(longitud),
      velocidad: new Prisma.Decimal(velocidad),
      rumbo: new Prisma.Decimal(rumbo),
      estadoSalidaProveedor: item.EstaSaliMoni,
      esOperativo: ruta !== null,
      motivoNoOperativo: ruta === null ? 'RUTA_NO_IDENTIFICADA' : null,
    },
  });

  const resultadoTiempoTramo =
  await this.tiemposTramoService.procesarPasoPorParada(registroGps);

  const resultadoTrayectoria =
  await this.trayectoriasService.procesarRegistroGps(registroGps);

  return {
    codigoUnidad,
    placa,
    codigoRuta,
    rutaEncontrada: ruta?.nombreRuta ?? null,
    estado: 'CREADO',
    registro: registroGps,
    trayectoria: resultadoTrayectoria,
    tiempoTramo: resultadoTiempoTramo,
  };
}
}