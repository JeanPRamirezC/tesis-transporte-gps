import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { VigitrackService } from './vigitrack.service';

@Injectable()
export class VigitrackSchedulerService {
  private readonly logger = new Logger(VigitrackSchedulerService.name);
  private ejecutando = false;

  constructor(private readonly vigitrackService: VigitrackService) {}

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
}