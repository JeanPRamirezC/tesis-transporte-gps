import { Module } from '@nestjs/common';
import { GtfsController } from './controllers/gtfs.controller';
import { GtfsService } from './services/gtfs.service';

@Module({
  controllers: [GtfsController],
  providers: [GtfsService],
})
export class GtfsModule {}
