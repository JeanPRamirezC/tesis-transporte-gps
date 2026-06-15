import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import appConfig from './config/app.config';
import { PrismaModule } from './database/prisma.module';
import { VigitrackModule } from './modules/integrations/vigitrack/vigitrack.module';
import { RutasModule } from './modules/rutas/rutas.module';
import { GpsModule } from './modules/gps/gps.module';
import { RutaShapesModule } from './modules/ruta-shapes/ruta-shapes.module';
import { ScheduleModule } from '@nestjs/schedule';
import { TrayectoriasModule } from './modules/trayectorias/trayectorias.module';
import { TiemposTramoModule } from './modules/tiempos-tramo/tiempos-tramo.module';
import { EtaModule } from './modules/eta/eta.module';
import { MapaModule } from './modules/mapa/mapa.module';
import { GtfsModule } from './modules/gtfs/gtfs.module';
import { PlanificadorModule } from './modules/planificador/planificador.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),   
    TrayectoriasModule,
    ScheduleModule.forRoot(),
    PrismaModule,
    VigitrackModule,
    RutasModule,
    GpsModule,
    RutaShapesModule,
    TiemposTramoModule,
    EtaModule,
    MapaModule,
    GtfsModule,
    PlanificadorModule,
  ],
})
export class AppModule {}