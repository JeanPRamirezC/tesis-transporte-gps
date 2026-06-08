import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('API Plataforma Transporte GPS')
    .setDescription(
      'API REST para el procesamiento de datos GPS, rutas, paradas, ETA y generación de información interoperable GTFS.'
    )
    .setVersion('1.0.0')
    .addTag('Unidades')
    .addTag('Rutas')
    .addTag('Paradas')
    .addTag('GPS')
    .addTag('Trayectorias')
    .addTag('ETA')
    .addTag('GTFS')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
}