import { Injectable, NotFoundException } from '@nestjs/common';
import { RegistroGps } from '@prisma/client';
import { calcularDistanciaMetros } from '../../../common/utils/geo.util';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class TrayectoriasService {
  constructor(private readonly prisma: PrismaService) {}

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

      if (
        distanciaLlegada <= radioControl &&
        minutosTranscurridos >= ruta.tiempoMinimoRecorridoMin
      ) {
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

        return {
          accion: 'TRAYECTORIA_COMPLETADA',
          trayectoria: trayectoriaCerrada,
          distanciaLlegada,
          minutosTranscurridos,
        };
      }

      if (
        distanciaLlegada <= radioControl &&
        minutosTranscurridos < ruta.tiempoMinimoRecorridoMin
      ) {
        return {
          accion: 'PUNTO_LLEGADA_IGNORADO',
          motivo: 'La unidad pasó por el punto final antes del tiempo mínimo.',
          distanciaLlegada,
          minutosTranscurridos,
          tiempoMinimo: ruta.tiempoMinimoRecorridoMin,
        };
      }
    }

    return {
      accion: 'SIN_CAMBIOS',
      distanciaInicio,
      distanciaLlegada,
    };
  }
}