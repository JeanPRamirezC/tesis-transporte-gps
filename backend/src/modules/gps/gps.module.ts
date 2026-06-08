import { Module } from '@nestjs/common';
import { GpsController } from './controllers/gps.controller';
import { GpsService } from './services/gps.service';

@Module({
  controllers: [GpsController],
  providers: [GpsService],
})
export class GpsModule {}