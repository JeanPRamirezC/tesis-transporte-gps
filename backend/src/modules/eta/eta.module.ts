import { Module } from '@nestjs/common';
import { EtaController } from './controllers/eta.controller';
import { EtaService } from './services/eta.service';

@Module({
  controllers: [EtaController],
  providers: [EtaService],
  exports: [EtaService],
})
export class EtaModule {}