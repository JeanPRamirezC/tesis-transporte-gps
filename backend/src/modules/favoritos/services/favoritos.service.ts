import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class FavoritosService {
  constructor(private readonly prisma: PrismaService) {}

  async obtenerFavoritos(idUsuario: number) {
    return this.prisma.favorito.findMany({
      where: { idUsuario },
      include: {
        ruta: {
          select: {
            idRuta: true,
            codigoRuta: true,
            nombreRuta: true,
            estado: true,
          },
        },
      },
      orderBy: { creadoEn: 'desc' },
    });
  }

  async agregarFavorito(idUsuario: number, idRuta: number) {
    // Verificar que la ruta exista
    const ruta = await this.prisma.ruta.findUnique({
      where: { idRuta },
    });

    if (!ruta) {
      throw new NotFoundException(`No existe una ruta con el ID ${idRuta}`);
    }

    // Verificar si ya está marcado como favorito
    const favoritoExistente = await this.prisma.favorito.findUnique({
      where: {
        idUsuario_idRuta: {
          idUsuario,
          idRuta,
        },
      },
    });

    if (favoritoExistente) {
      return favoritoExistente; // Si ya existe, retornamos silenciosamente
    }

    return this.prisma.favorito.create({
      data: {
        idUsuario,
        idRuta,
      },
    });
  }

  async eliminarFavorito(idUsuario: number, idRuta: number) {
    const favorito = await this.prisma.favorito.findUnique({
      where: {
        idUsuario_idRuta: {
          idUsuario,
          idRuta,
        },
      },
    });

    if (!favorito) {
      throw new NotFoundException('Esta ruta no está en tu lista de favoritos.');
    }

    await this.prisma.favorito.delete({
      where: {
        idUsuario_idRuta: {
          idUsuario,
          idRuta,
        },
      },
    });

    return { mensaje: 'Ruta removida de favoritos correctamente.' };
  }
}
