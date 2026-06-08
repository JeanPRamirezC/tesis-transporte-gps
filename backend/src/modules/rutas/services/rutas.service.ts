import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class RutasService {
  constructor(private readonly prisma: PrismaService) {}

  async listarRutas() {
    return this.prisma.ruta.findMany({
      orderBy: {
        nombreRuta: 'asc',
      },
      include: {
        rutaParadas: {
          include: {
            parada: true,
          },
          orderBy: {
            ordenParada: 'asc',
          },
        },
      },
    });
  }

  async obtenerRutaPorId(idRuta: number) {
    const ruta = await this.prisma.ruta.findUnique({
      where: { idRuta },
      include: {
        rutaParadas: {
          include: {
            parada: true,
          },
          orderBy: {
            ordenParada: 'asc',
          },
        },
      },
    });

    if (!ruta) {
      throw new NotFoundException(`No existe una ruta con id ${idRuta}`);
    }

    return ruta;
  }
}