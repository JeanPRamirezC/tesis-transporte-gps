import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TipoIncidente, Prisma } from '@prisma/client';

export interface CrearReporteDto {
  idRuta?: number;
  tipoIncidente: TipoIncidente;
  descripcion?: string;
  latitud: number;
  longitud: number;
}

@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaService) {}

  async obtenerReportesActivos() {
    const limite15Minutos = new Date(Date.now() - 15 * 60 * 1000);

    return this.prisma.reporteIncidente.findMany({
      where: {
        creadoEn: {
          gte: limite15Minutos,
        },
      },
      include: {
        ruta: {
          select: {
            idRuta: true,
            codigoRuta: true,
            nombreRuta: true,
          },
        },
        usuario: {
          select: {
            idUsuario: true,
            email: true,
          },
        },
      },
      orderBy: { creadoEn: 'desc' },
    });
  }

  async obtenerTodosLosReportes() {
    return this.prisma.reporteIncidente.findMany({
      include: {
        ruta: {
          select: {
            idRuta: true,
            codigoRuta: true,
            nombreRuta: true,
          },
        },
        usuario: {
          select: {
            idUsuario: true,
            email: true,
          },
        },
      },
      orderBy: { creadoEn: 'desc' },
    });
  }


  async crearReporte(idUsuario: number, dto: CrearReporteDto) {
    // Validar tipo de incidente
    if (!Object.values(TipoIncidente).includes(dto.tipoIncidente)) {
      throw new BadRequestException('Tipo de incidente no válido.');
    }

    if (dto.latitud === undefined || dto.longitud === undefined) {
      throw new BadRequestException('Coordenadas latitud y longitud son obligatorias.');
    }

    // Validar ruta si es provista
    if (dto.idRuta) {
      const ruta = await this.prisma.ruta.findUnique({
        where: { idRuta: dto.idRuta },
      });
      if (!ruta) {
        throw new NotFoundException(`No existe la ruta con el ID ${dto.idRuta}`);
      }
    }

    return this.prisma.reporteIncidente.create({
      data: {
        idUsuario,
        idRuta: dto.idRuta || null,
        tipoIncidente: dto.tipoIncidente,
        descripcion: dto.descripcion || null,
        latitud: new Prisma.Decimal(dto.latitud),
        longitud: new Prisma.Decimal(dto.longitud),
      },
    });
  }

  async eliminarReporte(idReporte: number) {
    const reporte = await this.prisma.reporteIncidente.findUnique({
      where: { idReporte },
    });

    if (!reporte) {
      throw new NotFoundException(`No existe un reporte con el ID ${idReporte}`);
    }

    await this.prisma.reporteIncidente.delete({
      where: { idReporte },
    });

    return { mensaje: 'Reporte eliminado correctamente.' };
  }

  async limpiarReportesAntiguos() {
    const limite20Dias = new Date();
    limite20Dias.setDate(limite20Dias.getDate() - 20);

    const resultado = await this.prisma.reporteIncidente.deleteMany({
      where: {
        creadoEn: {
          lt: limite20Dias,
        },
      },
    });

    return {
      mensaje: 'Limpieza de reportes históricos de incidentes completada.',
      registrosEliminados: resultado.count,
      limiteFecha: limite20Dias,
    };
  }
}
