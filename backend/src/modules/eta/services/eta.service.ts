import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { EstadoConfiabilidadEta } from '@prisma/client';

@Injectable()
export class EtaService {
  constructor(private readonly prisma: PrismaService) {}

  async calcularEtaPorRuta(idRuta: number) {
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
      include: {
        parada: true,
      },
      orderBy: {
        ordenParada: 'asc',
      },
    });

    const promedios = await this.prisma.tiempoTramo.groupBy({
      by: ['idParadaOrigen', 'idParadaDestino'],
      where: { idRuta },
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

    const unidades = pasosActuales.map((paso) => {
      const indiceParadaActual = rutaParadas.findIndex(
        (rp) => rp.idParada === paso.idParada,
      );

      if (indiceParadaActual === -1) {
        return {
          idUnidad: paso.idUnidad,
          codigoUnidad: paso.unidad.codigoUnidad,
          placa: paso.unidad.placa,
          paradaActual: paso.parada.nombreParada,
          estado: 'PARADA_NO_ENCONTRADA_EN_RUTA',
          etas: [],
        };
      }

      let acumuladoSegundos = 0;
      let estadoGeneral = 'CONFIABLE';

      const etas = [];

      for (let i = indiceParadaActual; i < rutaParadas.length - 1; i++) {
        const origen = rutaParadas[i];
        const destino = rutaParadas[i + 1];

        const clave = `${origen.idParada}-${destino.idParada}`;
        const promedio = mapaPromedios.get(clave);

        if (!promedio) {
          estadoGeneral = 'SIN_HISTORICO';

          etas.push({
            idParada: destino.idParada,
            nombreParada: destino.parada.nombreParada,
            ordenParada: destino.ordenParada,
            etaSegundos: null,
            etaMinutos: null,
            estadoConfiabilidad: 'SIN_HISTORICO',
            muestrasHistoricas: 0,
          });

          continue;
        }

        acumuladoSegundos += promedio.promedio;

        etas.push({
          idParada: destino.idParada,
          nombreParada: destino.parada.nombreParada,
          ordenParada: destino.ordenParada,
          etaSegundos: acumuladoSegundos,
          etaMinutos: Math.ceil(acumuladoSegundos / 60),
          estadoConfiabilidad: 'CONFIABLE',
          muestrasHistoricas: promedio.muestras,
        });
      }

      return {
        idUnidad: paso.idUnidad,
        codigoUnidad: paso.unidad.codigoUnidad,
        placa: paso.unidad.placa,
        paradaActual: {
          idParada: paso.idParada,
          nombreParada: paso.parada.nombreParada,
          ordenParada: paso.ordenParada,
          fechaHoraPaso: paso.fechaHoraPaso,
        },
        estadoGeneral,
        etas,
      };
    });

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