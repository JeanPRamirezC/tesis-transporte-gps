import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { VigitrackService } from './vigitrack.service';
import { TrayectoriasService } from '../../../trayectorias/services/trayectorias.service';
import { EtaService } from '../../../eta/services/eta.service';
import { PrismaService } from '../../../../database/prisma.service';
import { estaDentroDeVentanaOperativa } from '../../../../common/utils/operation-window.util';
import { ReportesService } from '../../../reportes/services/reportes.service';

@Injectable()
export class VigitrackSchedulerService {
  private readonly logger = new Logger(VigitrackSchedulerService.name);
  private ejecutando = false;
  private ejecutandoEta = false;

  constructor(
    private readonly vigitrackService: VigitrackService,
    private readonly trayectoriasService: TrayectoriasService,
    private readonly etaService: EtaService,
    private readonly prisma: PrismaService,
    private readonly reportesService: ReportesService,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async sincronizarMonitoreoAutomaticamente() {
    if (this.ejecutando) {
      this.logger.warn('Sincronización omitida: proceso anterior en ejecución.');
      return;
    }

    this.ejecutando = true;

    try {
      const resultado = await this.vigitrackService.sincronizarMonitoreo();

      this.logger.log(
        `Sincronización automática finalizada. Registros: ${
          resultado.total ?? 0
        }`,
      );
    } catch (error) {
      this.logger.error('Error en sincronización automática Vigitrack', error);
    } finally {
      this.ejecutando = false;
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async autocerrarTrayectoriasExcedidas() {
    this.logger.log('Iniciando verificación de trayectorias excedidas por tiempo...');
    try {
      const resultado = await this.trayectoriasService.autocerrarTrayectoriasExcedidas();
      if (resultado.cerradas > 0) {
        this.logger.log(
          `Cierre automático de trayectorias completado. Se cerraron ${resultado.cerradas} trayectorias de ${resultado.procesadas} activas analizadas.`,
        );
      } else {
        this.logger.log(
          `Verificación de trayectorias completada. No hay trayectorias excedidas (procesadas: ${resultado.procesadas}).`,
        );
      }
    } catch (error) {
      this.logger.error('Error en el autocierre de trayectorias excedidas', error);
    }
  }

  @Cron('*/30 * * * * *')
  async handleGenerarEtasCron() {
    const permitirFueraDeHorario = process.env.GPS_ALLOW_OUT_OF_HOURS === 'true';

    if (!permitirFueraDeHorario && !estaDentroDeVentanaOperativa()) {
      return;
    }

    if (this.ejecutandoEta) {
      this.logger.warn('Generación de ETA omitida: proceso anterior en ejecución.');
      return;
    }

    this.ejecutandoEta = true;

    try {
      // 1. Buscar rutas con trayectorias en curso
      const trayectoriasActivas = await this.prisma.trayectoria.findMany({
        where: { estado: 'EN_CURSO' },
        select: { idRuta: true },
        distinct: ['idRuta'],
      });

      if (trayectoriasActivas.length === 0) {
        return;
      }

      this.logger.log(
        `Iniciando generación periódica de ETA para ${trayectoriasActivas.length} rutas activas...`
      );

      // 2. Generar estimaciones para cada ruta activa
      for (const trayectoria of trayectoriasActivas) {
        try {
          const resultado = await this.etaService.generarEstimacionesEtaPorRuta(
            trayectoria.idRuta
          );
          if (resultado.totalEstimaciones > 0) {
            this.logger.debug(
              `ETA guardado para ruta ${trayectoria.idRuta}: ${resultado.totalEstimaciones} registros persistidos.`
            );
          }
        } catch (error) {
          this.logger.error(
            `Error al generar estimaciones ETA para ruta ${trayectoria.idRuta}`,
            error
          );
        }
      }
    } catch (error) {
      this.logger.error('Error en tarea programada de generación de ETA', error);
    } finally {
      this.ejecutandoEta = false;
    }
  }

  @Cron('0 0 1 * * *') // Todos los días a la 01:00 AM
  async handleLimpiezaEtasCron() {
    this.logger.log('Iniciando limpieza de estimaciones de ETA antiguas (30 días)...');
    try {
      const resultado = await this.etaService.limpiarEstimacionesAntiguas();
      this.logger.log(
        `Limpieza completada. Registros eliminados: ${resultado.registrosEliminados}.`
      );
    } catch (error) {
      this.logger.error('Error en la limpieza nocturna de estimaciones de ETA', error);
    }
  }

  @Cron('0 30 1 * * *') // Todos los días a la 01:30 AM
  async handleLimpiezaReportesCron() {
    this.logger.log('Iniciando limpieza de reportes de incidentes antiguos (30 días)...');
    try {
      const resultado = await this.reportesService.limpiarReportesAntiguos();
      this.logger.log(
        `Limpieza completada. Incidentes eliminados: ${resultado.registrosEliminados}.`
      );
    } catch (error) {
      this.logger.error('Error en la limpieza nocturna de reportes de incidentes', error);
    }
  }
}