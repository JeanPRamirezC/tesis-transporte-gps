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

  @Cron('0 0 2 * * *') // Todos los días a la 02:00 AM
  async handleLimpiezaNocturnaCron() {
    this.logger.log('=== INICIANDO LIMPIEZA NOCTURNA DE LA BASE DE DATOS ===');
    const limite20Dias = new Date();
    limite20Dias.setDate(limite20Dias.getDate() - 20);

    // 1. Limpieza de Estimaciones de ETA
    try {
      this.logger.log('Limpiando estimaciones de ETA antiguas (20 días)...');
      const resultado = await this.etaService.limpiarEstimacionesAntiguas();
      this.logger.log(`ETAs eliminadas: ${resultado.registrosEliminados}.`);
    } catch (error) {
      this.logger.error('Error al limpiar estimaciones de ETA', error);
    }

    // 2. Limpieza de Reportes de Incidentes
    try {
      this.logger.log('Limpiando reportes de incidentes antiguos (20 días)...');
      const resultado = await this.reportesService.limpiarReportesAntiguos();
      this.logger.log(`Incidentes eliminados: ${resultado.registrosEliminados}.`);
    } catch (error) {
      this.logger.error('Error al limpiar reportes de incidentes', error);
    }

    // 3. Limpieza de Trayectorias finalizadas/incompletas
    try {
      this.logger.log('Limpiando trayectorias antiguas (20 días)...');
      const resultado = await this.trayectoriasService.limpiarTrayectoriasAntiguas(limite20Dias);
      this.logger.log(`Trayectorias eliminadas: ${resultado.registrosEliminados}.`);
    } catch (error) {
      this.logger.error('Error al limpiar trayectorias antiguas', error);
    }

    // 4. Limpieza de Tiempos de Tramo
    try {
      this.logger.log('Limpiando tiempos de tramo antiguos (20 días)...');
      const resultado = await this.prisma.tiempoTramo.deleteMany({
        where: {
          creadoEn: {
            lt: limite20Dias,
          },
        },
      });
      this.logger.log(`Tiempos de tramo eliminados: ${resultado.count}.`);
    } catch (error) {
      this.logger.error('Error al limpiar tiempos de tramo antiguos', error);
    }

    // 5. Limpieza de Registros GPS sin trayectoria
    try {
      this.logger.log('Limpiando registros GPS antiguos (20 días)...');
      const gpsAntiguos = await this.prisma.registroGps.deleteMany({
        where: {
          fechaHora: {
            lt: limite20Dias,
          },
        },
      });
      this.logger.log(`Registros GPS antiguos eliminados: ${gpsAntiguos.count}.`);

      this.logger.log('Limpiando registros GPS sin ruta (idRuta = null)...');
      const gpsSinRuta = await this.prisma.registroGps.deleteMany({
        where: {
          idRuta: null,
        },
      });
      this.logger.log(`Registros GPS sin ruta eliminados: ${gpsSinRuta.count}.`);
    } catch (error) {
      this.logger.error('Error al limpiar registros GPS', error);
    }

    this.logger.log('=== LIMPIEZA NOCTURNA DE LA BASE DE DATOS FINALIZADA ===');
  }
}