import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { VigitrackService } from './vigitrack.service';
import { TrayectoriasService } from '../../../trayectorias/services/trayectorias.service';

@Injectable()
export class VigitrackSchedulerService {
  private readonly logger = new Logger(VigitrackSchedulerService.name);
  private ejecutando = false;

  constructor(
    private readonly vigitrackService: VigitrackService,
    private readonly trayectoriasService: TrayectoriasService,
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
}