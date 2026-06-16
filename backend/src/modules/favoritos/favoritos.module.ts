import { Module } from '@nestjs/common';
import { FavoritosController } from './controllers/favoritos.controller';
import { FavoritosService } from './services/favoritos.service';

@Module({
  controllers: [FavoritosController],
  providers: [FavoritosService],
})
export class FavoritosModule {}
