import { Module } from '@nestjs/common';
import { ReportesController } from './controllers/reportes.controller';
import { ReportesService } from './services/reportes.service';

@Module({
  controllers: [ReportesController],
  providers: [ReportesService],
  exports: [ReportesService],
})
export class ReportesModule {}
