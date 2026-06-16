import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';
import { ReportesService } from '../services/reportes.service';
import { CreateReportDto } from '../dto/reportes.dto';

@ApiTags('Reportes de Incidentes')
@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get('activos')
  @ApiOperation({
    summary: 'Obtener la lista de reportes de incidentes vándalos/tráfico activos (últimos 15 minutos).',
    description: 'Endpoint público de libre acceso para renderizar incidentes sobre el mapa de la ciudad.',
  })
  async obtenerReportesActivos() {
    return this.reportesService.obtenerReportesActivos();
  }

  @Get('todos')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({
    summary: 'Obtener la lista de todos los reportes de incidentes (Exclusivo Administrador).',
  })
  async obtenerTodosLosReportes() {
    return this.reportesService.obtenerTodosLosReportes();
  }


  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Registrar un nuevo reporte de incidente de transporte en Ibarra (Pasajero autenticado).',
  })
  @ApiBody({ type: CreateReportDto })
  async crearReporte(@Request() req: any, @Body() dto: CreateReportDto) {
    const idUsuario = req.user.idUsuario;
    return this.reportesService.crearReporte(idUsuario, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({
    summary: 'Eliminar/moderar un reporte de incidente (Exclusivo Administrador).',
  })
  async eliminarReporte(@Param('id', ParseIntPipe) id: number) {
    return this.reportesService.eliminarReporte(id);
  }
}
