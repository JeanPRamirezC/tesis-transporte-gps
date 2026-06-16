import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { TipoIncidente } from '@prisma/client';

export class CreateReportDto {
  @ApiProperty({ example: 2, required: false, description: 'ID de la ruta afectada por el incidente.' })
  @IsOptional()
  @IsNumber()
  idRuta?: number;

  @ApiProperty({
    example: 'TRAFICO_ALTO',
    enum: TipoIncidente,
    description: 'Tipo de incidente ocurrido.',
  })
  @IsEnum(TipoIncidente, { message: 'El tipo de incidente no es válido.' })
  @IsNotEmpty({ message: 'El tipo de incidente es requerido.' })
  tipoIncidente: TipoIncidente;

  @ApiProperty({ example: 'Gran fila de buses detenidos por choque', required: false, maxLength: 250, description: 'Descripción detallada.' })
  @IsOptional()
  @IsString()
  @MaxLength(250, { message: 'La descripción no puede exceder los 250 caracteres.' })
  descripcion?: string;

  @ApiProperty({ example: 0.35116, description: 'Latitud del reporte.' })
  @IsNumber()
  @IsNotEmpty({ message: 'La latitud es requerida.' })
  latitud: number;

  @ApiProperty({ example: -78.14871, description: 'Longitud del reporte.' })
  @IsNumber()
  @IsNotEmpty({ message: 'La longitud es requerida.' })
  longitud: number;
}
